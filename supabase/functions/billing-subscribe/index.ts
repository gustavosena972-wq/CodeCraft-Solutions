// Cobrança Asaas com assinatura mensal recorrente.
// Secrets: ASAAS_API_KEY (+ opcional ASAAS_ENV=sandbox|production)
// Sandbox: chave $aact_hmlg_… → https://sandbox.asaas.com/api/v3
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICES: Record<string, number> = { START: 280, BUSINESS: 390, CORP: 500 };

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

function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || "127.0.0.1";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const asaasKey = Deno.env.get("ASAAS_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!asaasKey) return json({ error: "ASAAS_API_KEY não configurada." }, 503);
    const ASAAS = asaasBase(asaasKey);

    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json();
    const plan = String(body.plan || "");
    const method = String(body.method || "pix");
    const price = PRICES[plan];
    if (!price) return json({ error: "Plano inválido" }, 400);

    const email = userData.user.email || "";
    const cpf = String(body.card?.cpf || body.cpf || body.payer?.cpf || "").replace(/\D/g, "");
    const holder = String(
      body.card?.holder || body.name || body.payer?.name || userData.user.user_metadata?.name || "Cliente",
    );
    if (cpf.length !== 11 && cpf.length !== 14) {
      return json({ error: "Informe um CPF válido do pagador." }, 400);
    }
    if (method === "card") {
      const num = String(body.card?.number || "").replace(/\D/g, "");
      const exp = String(body.card?.exp || "");
      const cvv = String(body.card?.cvv || "");
      if (num.length < 13 || !exp.includes("/") || cvv.length < 3) {
        return json({ error: "Dados do cartão incompletos." }, 400);
      }
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("cc_profiles")
      .select("last_org_id, asaas_customer_id, asaas_subscription_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    let org: { id?: string; owner_id?: string; cep?: string; phone?: string; number?: string } | null = null;
    if (profile?.last_org_id) {
      const orgRes = await admin
        .from("cc_orgs")
        .select("id, owner_id, cep, phone, number")
        .eq("id", profile.last_org_id)
        .maybeSingle();
      org = orgRes.data;
    }
    if (!org?.owner_id || org.owner_id !== userData.user.id) {
      return json({ error: "Só o dono da empresa pode assinar ou alterar o plano." }, 403);
    }

    const postalCode =
      String(body.holderInfo?.postalCode || org?.cep || "").replace(/\D/g, "").slice(0, 8) || "30130100";
    const addressNumber =
      String(body.holderInfo?.addressNumber || org?.number || "").trim() || "100";
    const phoneDigits =
      String(body.holderInfo?.phone || org?.phone || "").replace(/\D/g, "") || "31999999999";

    const headers = {
      access_token: asaasKey,
      "Content-Type": "application/json",
      "User-Agent": "CodeCraftGestao/1.0",
    };

    let customerId = String(profile?.asaas_customer_id || "");
    if (!customerId) {
      const search = await fetch(`${ASAAS}/customers?email=${encodeURIComponent(email)}&limit=1`, {
        headers,
      });
      const searchBody = await search.json();
      if (search.ok && searchBody?.data?.[0]?.id) {
        customerId = searchBody.data[0].id;
      } else {
        const customerRes = await fetch(`${ASAAS}/customers`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: holder,
            email,
            cpfCnpj: cpf,
            phone: phoneDigits,
            mobilePhone: phoneDigits,
            postalCode,
            addressNumber,
          }),
        });
        const customer = await customerRes.json();
        if (!customerRes.ok) {
          return json({ error: customer.errors?.[0]?.description || "Falha ao criar cliente Asaas" }, 400);
        }
        customerId = customer.id;
      }
    }

    // Cancela assinatura anterior no Asaas (troca de plano / reassinatura)
    const oldSub = String(profile?.asaas_subscription_id || "");
    if (oldSub) {
      await fetch(`${ASAAS}/subscriptions/${oldSub}`, { method: "DELETE", headers }).catch(() => null);
    }

    const [mm, yy] = String(body.card?.exp || "").split("/");
    const creditCard = {
      holderName: holder,
      number: String(body.card?.number || "").replace(/\D/g, ""),
      expiryMonth: mm,
      expiryYear: yy?.length === 2 ? `20${yy}` : yy,
      ccv: String(body.card?.cvv || ""),
    };
    const creditCardHolderInfo = {
      name: holder,
      email,
      cpfCnpj: cpf,
      postalCode,
      addressNumber,
      phone: phoneDigits,
      mobilePhone: phoneDigits,
    };
    const remoteIp = String(body.remoteIp || clientIp(req));
    const externalReference = `${userData.user.id}:${plan}`;
    const last4 = creditCard.number.slice(-4);
    const today = new Date();

    let pixPayload: string | null = null;
    let pixImage: string | null = null;
    let paymentId: string | null = null;
    let paymentStatus: string | null = null;
    let invoiceUrl: string | null = null;
    let subscriptionId = "";
    let activated = false;

    if (method === "pix") {
      // Assinatura PIX mensal: Asaas gera cobrança todo mês (renovação automática da fatura)
      const subRes = await fetch(`${ASAAS}/subscriptions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: price,
          nextDueDate: today.toISOString().slice(0, 10),
          cycle: "MONTHLY",
          description: `CodeCraft Gestão · ${plan}`,
          externalReference,
        }),
      });
      const sub = await subRes.json();
      if (!subRes.ok) {
        return json({
          error: sub.errors?.[0]?.description || "Falha ao criar assinatura PIX mensal.",
        }, 400);
      }
      subscriptionId = sub.id;

      // A 1ª cobrança às vezes demora um instante a aparecer
      let payment: Record<string, unknown> | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 700));
        const listRes = await fetch(
          `${ASAAS}/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=1`,
          { headers },
        );
        const listBody = await listRes.json();
        payment = listBody?.data?.[0];
        if (payment?.id) break;
      }
      if (payment) {
        paymentId = String(payment.id || "");
        paymentStatus = String(payment.status || "");
        invoiceUrl = (payment.invoiceUrl as string) || null;
        activated = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(String(payment.status));
        if (payment.id) {
          const pixRes = await fetch(`${ASAAS}/payments/${payment.id}/pixQrCode`, { headers });
          const pix = await pixRes.json();
          if (pixRes.ok) {
            pixPayload = pix.payload || null;
            pixImage = pix.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null;
          }
        }
      }
    } else {
      // Cartão: assinatura mensal; 1ª cobrança na data de hoje
      const subRes = await fetch(`${ASAAS}/subscriptions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: price,
          nextDueDate: today.toISOString().slice(0, 10),
          cycle: "MONTHLY",
          description: `CodeCraft Gestão · ${plan}`,
          externalReference,
          creditCard,
          creditCardHolderInfo,
          remoteIp,
        }),
      });
      const sub = await subRes.json();
      if (!subRes.ok) {
        return json({ error: sub.errors?.[0]?.description || "Falha na assinatura Asaas" }, 400);
      }
      subscriptionId = sub.id;

      // Busca a 1ª cobrança gerada pela assinatura
      const listRes = await fetch(
        `${ASAAS}/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=1`,
        { headers },
      );
      const listBody = await listRes.json();
      const payment = listBody?.data?.[0];
      if (payment) {
        paymentId = payment.id;
        paymentStatus = payment.status;
        invoiceUrl = payment.invoiceUrl || null;
        activated = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(String(payment.status));
      }
    }

    const next = new Date();
    next.setMonth(next.getMonth() + 1);

    if (activated) {
      await admin.from("cc_profiles").update({
        plan,
        billing_status: "active",
        billing_method: method === "pix" ? "pix" : "card",
        card_last4: method === "card" ? last4 : "",
        card_holder: method === "card" ? holder : holder,
        card_exp: method === "card" ? String(body.card?.exp || "") : "",
        card_cpf: cpf,
        billed_at: new Date().toISOString(),
        next_charge_at: next.toISOString(),
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
      }).eq("id", userData.user.id);
      await admin.from("cc_charges").insert({
        owner_id: userData.user.id,
        amount: price * 100,
        method: method === "pix" ? "pix" : "card",
        status: "paid",
        plan,
        card_last4: method === "card" ? last4 : "",
      });
    } else {
      // PIX/cartão pendente: guarda plano + subscription para o webhook ativar
      await admin.from("cc_profiles").update({
        plan,
        billing_status: "inactive",
        card_last4: method === "card" ? last4 || "" : "",
        card_holder: holder,
        card_cpf: cpf,
        card_exp: method === "card" ? String(body.card?.exp || "") : "",
        billing_method: method === "pix" ? "pix" : "card",
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
      }).eq("id", userData.user.id);
    }

    return json({
      ok: true,
      paymentId,
      status: paymentStatus,
      activated,
      subscriptionId,
      invoiceUrl,
      pixPayload,
      pixImage,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro Asaas" }, 500);
  }
});
