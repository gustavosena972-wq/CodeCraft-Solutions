// CodeCraft Solutions — IA Admin (Claude)
// Secrets no Supabase: ANTHROPIC_API_KEY
// Deploy: npx supabase functions deploy ccs-admin-ai --project-ref eqaoanbanhryhbldlbhc
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const SYSTEM = `Você é a CodeCraft IA — agente operacional da CodeCraft Solutions (Belo Horizonte).
Você NÃO é uma IA genérica solta: você opera o painel admin da empresa.

## Empresa
- Nome: CodeCraft Solutions · estúdio de software em BH
- WhatsApp: (31) 99975-8385 · PIX oficial: 31999758385
- Instagram: @code.invention
- Produto SaaS: CodeCraft Gestão (só empresas/CNPJ) — Financeiro, RH, assinatura Asaas · R$ 280 / R$ 390 / R$ 500
- Serviços: landing (a partir de R$ 300), site (a partir de R$ 500), loja (a partir de R$ 500), sistema sob medida (R$ 1.500–15.000), manutenção (a partir de R$ 100/mês)
- Diferencial: portal do cliente ao vivo, chat, PIX, acompanhamento de status
- Gestão URL: https://gustavosena972-wq.github.io/financas-codecraft/

## Suas missões
1. Achar clientes reais que precisam dos serviços CodeCraft (site, loja, sistema, Gestão)
2. Caçar em vários canais: Google, Maps, Instagram, sites de freelance (99freelas, Workana, GetNinjas, Freelancer), LinkedIn, anúncios e sites de empresas BH/MG
3. Entregar RELATÓRIO por oportunidade: o que a pessoa/empresa precisa, projeto sugerido CodeCraft, canal, contato (ou como obter), link e mensagem de abordagem
4. Priorizar leads inbound do site (chat/formulário) antes de outbound
5. Gerir operação: projetos travados, PIX, chats sem resposta
6. Usar web_search sempre que o admin pedir prospecção, caça, varredura, Instagram, freelance ou “achar clientes”

## Formato do relatório de oportunidade (obrigatório na caça)
Para cada lead encontrado, use este bloco:
<strong>Oportunidade N</strong>
<ul>
<li><strong>Quem:</strong> nome da empresa ou pessoa</li>
<li><strong>O que precisa:</strong> dor / pedido observado</li>
<li><strong>Projeto CodeCraft:</strong> serviço + faixa de preço</li>
<li><strong>Canal:</strong> Instagram / 99freelas / Maps / Google / etc.</li>
<li><strong>Contato:</strong> telefone, @instagram, e-mail ou URL do anúncio (só se real)</li>
<li><strong>Link:</strong> URL clicável</li>
<li><strong>Abordagem:</strong> texto pronto em português formal</li>
</ul>
Entregue o máximo de oportunidades úteis na varredura (sem teto artificial de quantidade). Seja completo nos relatórios.

## Regras
- Português do Brasil, formal, claro, acionável
- NUNCA invente telefone, e-mail, @ ou CNPJ. Se a busca não trouxe contato, diga “contato no anúncio/perfil” e dê o link
- Prefira BH / Grande BH / MG, sem limitar se achar demanda forte em freelance nacional
- Quando sugerir abordagem, texto pronto para WhatsApp/DM
- Respostas longas e completas são bem-vindas — não encurte por economia de tokens
- HTML simples: <p>, <strong>, <em>, <ul>, <li>, <br>, <a href="...">. Sem scripts.`;

function scrubHtml(s: string) {
  return String(s || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function mdToHtml(text: string) {
  let t = String(text || "").trim();
  if (/<[a-z][\s\S]*>/i.test(t)) return scrubHtml(t);
  t = t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/^### (.+)$/gm, "<strong>$1</strong>");
  t = t.replace(/^## (.+)$/gm, "<strong>$1</strong>");
  t = t.replace(/^# (.+)$/gm, "<strong>$1</strong>");
  t = t.replace(/^\s*[-*] (.+)$/gm, "• $1");
  t = t.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
  return scrubHtml(t);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return json({
        error: "ANTHROPIC_API_KEY não configurada no Supabase.",
        code: "NO_KEY",
      }, 503);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const auth = req.headers.get("Authorization") || "";
    if (!auth) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    // Sem teto artificial de mensagem — só evita payload absurdo de segurança
    const message = String(body.message || "").trim().slice(0, 500_000);
    if (!message) return json({ error: "Mensagem vazia" }, 400);

    const snapshot = body.snapshot || {};
    const market = body.market || {};
    // Histórico amplo (janela do modelo ~200k; sem corte curto por mensagem)
    const history = Array.isArray(body.history) ? body.history.slice(-80) : [];

    const contextBlock = [
      "## Snapshot operacional (ao vivo do painel)",
      JSON.stringify(snapshot, null, 0).slice(0, 200_000),
      "",
      "## Mercado",
      JSON.stringify(market, null, 0).slice(0, 50_000),
      "",
      "Responda à mensagem do admin abaixo com base nesse snapshot e no conhecimento da CodeCraft. Seja completo — sem economizar tokens.",
    ].join("\n");

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const h of history) {
      const role = h.role === "assistant" ? "assistant" : "user";
      const content = String(h.content || "").slice(0, 100_000);
      if (content) messages.push({ role, content });
    }
    messages.push({
      role: "user",
      content: contextBlock + "\n\n## Pedido do admin\n" + message,
    });

    const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5";
    // Máximo de saída do modelo (Claude Sonnet 4.x). Sem limite baixo nosso.
    const maxTokens = Math.min(
      Math.max(Number(Deno.env.get("ANTHROPIC_MAX_TOKENS") || 64000) || 64000, 1024),
      64000,
    );
    const webSearchUses = Math.min(
      Math.max(Number(Deno.env.get("ANTHROPIC_WEB_SEARCH_USES") || 25) || 25, 1),
      50,
    );

    // 1ª tentativa: com web search (se a conta permitir)
    const payloadWithSearch = {
      model,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: webSearchUses,
        },
      ],
    };

    const payloadPlain = {
      model,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages,
    };

    async function callClaude(payload: unknown) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }

    function extractText(data: { content?: Array<{ type?: string; text?: string }> }) {
      const parts = Array.isArray(data?.content) ? data.content : [];
      return parts
        .filter((p) => p.type === "text")
        .map((p) => p.text || "")
        .join("\n\n")
        .trim();
    }

    let usedSearch = true;
    let result = await callClaude(payloadWithSearch);
    if (!result.ok) {
      usedSearch = false;
      result = await callClaude(payloadPlain);
    }

    if (!result.ok) {
      const errMsg =
        result.data?.error?.message ||
        result.data?.message ||
        `Claude HTTP ${result.status}`;
      return json({ error: errMsg, code: "CLAUDE_ERROR" }, 502);
    }

    let textOut = extractText(result.data);
    let continuations = 0;
    // Se a API cortou por max_tokens, continua até completar (até 4 rodadas extras)
    while (
      result.data?.stop_reason === "max_tokens" &&
      textOut &&
      continuations < 4
    ) {
      continuations++;
      const contMessages = [
        ...messages,
        { role: "assistant" as const, content: textOut },
        {
          role: "user" as const,
          content:
            "Continue exatamente de onde parou. Não repita o que já escreveu. Complete o relatório/resposta até o fim.",
        },
      ];
      const contPayload = usedSearch
        ? { ...payloadWithSearch, messages: contMessages }
        : { ...payloadPlain, messages: contMessages };
      result = await callClaude(contPayload);
      if (!result.ok) break;
      const more = extractText(result.data);
      if (!more) break;
      textOut = textOut + "\n\n" + more;
    }

    if (!textOut) {
      return json({ error: "Claude retornou vazio.", code: "EMPTY" }, 502);
    }

    return json({
      reply: textOut,
      replyHtml: mdToHtml(textOut),
      model,
      maxTokens,
      continuations,
      webSearch: usedSearch,
      provider: "claude",
    });
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : String(e),
      code: "EXCEPTION",
    }, 500);
  }
});
