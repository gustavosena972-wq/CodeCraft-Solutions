// Webhook Asaas → ativa/renova assinatura e trata atraso/cancelamento
// Configure no Asaas: URL (+ ?apikey=ANON) + header asaas-access-token = ASAAS_WEBHOOK_TOKEN
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function resolveUser(
  admin: ReturnType<typeof createClient>,
  payment: Record<string, unknown>,
  subscription: Record<string, unknown> | null,
) {
  const subscriptionId = String(payment.subscription || subscription?.id || "");
  const ref = String(payment.externalReference || subscription?.externalReference || "");
  let userId = "";
  let plan = "";

  if (ref.includes(":")) {
    const parts = ref.split(":");
    userId = parts[0] || "";
    plan = parts[1] || "";
  }

  if ((!userId || !["START", "BUSINESS", "CORP"].includes(plan)) && subscriptionId) {
    const { data: bySub } = await admin
      .from("cc_profiles")
      .select("id, plan")
      .eq("asaas_subscription_id", subscriptionId)
      .maybeSingle();
    if (bySub?.id) {
      userId = String(bySub.id);
      if (!["START", "BUSINESS", "CORP"].includes(plan)) {
        plan = String(bySub.plan || "");
      }
    }
  }

  return { userId, plan, subscriptionId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
  const got = req.headers.get("asaas-access-token") || "";
  if (!expected || got !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const event = await req.json();
  const payment = (event.payment || event) as Record<string, unknown>;
  const subscription = (event.subscription || null) as Record<string, unknown> | null;
  const status = String(payment.status || subscription?.status || "");
  const eventName = String(event.event || "");

  const paidStatuses = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
  const paidEvents = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_RECEIVED_IN_CASH"];
  const dueStatuses = ["OVERDUE", "PENDING"];
  const dueEvents = ["PAYMENT_OVERDUE", "PAYMENT_DELETED"];
  const cancelEvents = [
    "SUBSCRIPTION_DELETED",
    "SUBSCRIPTION_INACTIVATED",
    "PAYMENT_REFUNDED",
    "PAYMENT_CHARGEBACK_REQUESTED",
    "PAYMENT_CHARGEBACK_DISPUTE",
  ];

  const { userId, plan, subscriptionId } = await resolveUser(admin, payment, subscription);

  // Atraso / pendência longa
  if (dueEvents.includes(eventName) || (dueStatuses.includes(status) && eventName.includes("OVERDUE"))) {
    if (!userId) return json({ ok: true, skipped: "no-user-overdue" });
    const { error } = await admin
      .from("cc_profiles")
      .update({ billing_status: "past_due" })
      .eq("id", userId);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, past_due: true, userId });
  }

  // Cancelamento / chargeback
  if (cancelEvents.includes(eventName) || status === "REFUNDED") {
    if (!userId) return json({ ok: true, skipped: "no-user-cancel" });
    const { error } = await admin
      .from("cc_profiles")
      .update({
        plan: "NONE",
        billing_status: "inactive",
        billing_method: "",
        next_charge_at: null,
        asaas_subscription_id: "",
      })
      .eq("id", userId);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, cancelled: true, userId });
  }

  if (!paidStatuses.includes(status) && !paidEvents.includes(eventName)) {
    return json({ ok: true, skipped: status || eventName });
  }

  if (!userId || !["START", "BUSINESS", "CORP"].includes(plan)) {
    return json({ error: "externalReference/subscription inválido" }, 400);
  }

  const paymentId = String(payment.id || "");
  if (paymentId) {
    const { data: existing } = await admin
      .from("cc_charges")
      .select("id")
      .eq("owner_id", userId)
      .eq("asaas_payment_id", paymentId)
      .maybeSingle();
    if (existing) {
      return json({ ok: true, duplicate: true });
    }
  }

  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  const method = String(payment.billingType || "").toUpperCase() === "PIX" ? "pix" : "card";
  const amountCents = Math.round(Number(payment.value || 0) * 100);

  const patch: Record<string, unknown> = {
    plan,
    billing_status: "active",
    billing_method: method,
    billed_at: new Date().toISOString(),
    next_charge_at: next.toISOString(),
  };
  if (subscriptionId) patch.asaas_subscription_id = subscriptionId;

  const { error } = await admin.from("cc_profiles").update(patch).eq("id", userId);
  if (error) return json({ error: error.message }, 500);

  await admin.from("cc_charges").insert({
    owner_id: userId,
    amount: amountCents || (plan === "START" ? 28000 : plan === "CORP" ? 50000 : 39000),
    method,
    status: "paid",
    plan,
    card_last4: "",
    asaas_payment_id: paymentId || null,
  });

  return json({ ok: true, renewed: true, userId, plan });
});
