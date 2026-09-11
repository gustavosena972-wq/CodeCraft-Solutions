// Cancela assinatura Asaas + desativa plano local.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function asaasBase(key: string) {
  const env = (Deno.env.get("ASAAS_ENV") || "").toLowerCase();
  if (env === "sandbox" || env === "homolog" || key.startsWith("$aact_hmlg_")) {
    return "https://sandbox.asaas.com/api/v3";
  }
  return "https://api.asaas.com/v3";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const asaasKey = Deno.env.get("ASAAS_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("cc_profiles")
      .select("last_org_id, asaas_subscription_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profile?.last_org_id) {
      const { data: org } = await admin
        .from("cc_orgs")
        .select("owner_id")
        .eq("id", profile.last_org_id)
        .maybeSingle();
      if (!org?.owner_id || org.owner_id !== userData.user.id) {
        return json({ error: "Só o dono da empresa pode cancelar a assinatura." }, 403);
      }
    }

    const subId = String(profile?.asaas_subscription_id || "");
    if (asaasKey && subId) {
      const ASAAS = asaasBase(asaasKey);
      await fetch(`${ASAAS}/subscriptions/${subId}`, {
        method: "DELETE",
        headers: {
          access_token: asaasKey,
          "Content-Type": "application/json",
          "User-Agent": "CodeCraftGestao/1.0",
        },
      }).catch(() => null);
    }

    await admin.from("cc_profiles").update({
      plan: "NONE",
      billing_status: "inactive",
      billing_method: "",
      next_charge_at: null,
      asaas_subscription_id: "",
    }).eq("id", userData.user.id);

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro ao cancelar" }, 500);
  }
});
