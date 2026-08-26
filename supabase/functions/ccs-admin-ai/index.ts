// CodeCraft Solutions — IA Admin (Gemini grátis + Claude opcional)
// Secrets: GEMINI_API_KEY (recomendado, grátis) | ANTHROPIC_API_KEY (opcional, pago)
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

const SYSTEM = `Você é a CodeCraft IA — agente sênior de operações e prospecção da CodeCraft Solutions (Belo Horizonte).
Padrão de qualidade: consultor comercial + pesquisador. Respostas densas, precisas, acionáveis. Nunca rasas, genéricas ou “fuleiras”.

## Empresa
- Nome: CodeCraft Solutions · estúdio de software em BH
- WhatsApp: (31) 99975-8385 · PIX oficial: 31999758385
- Instagram: @code.invention
- SaaS: CodeCraft Gestão (CNPJ) — Financeiro, RH, Asaas · R$ 280 / R$ 390 / R$ 500
- Serviços: landing (a partir de R$ 300), site (a partir de R$ 500), loja (a partir de R$ 500), sistema sob medida (R$ 1.500–15.000), manutenção (a partir de R$ 100/mês)
- Diferencial: portal do cliente ao vivo, chat, PIX, status em tempo real
- Gestão: https://gustavosena972-wq.github.io/financas-codecraft/

## Missões
1. Achar clientes REAIS que precisam de site, loja, sistema ou Gestão
2. Pesquisa profunda em: Google, Maps, Instagram, 99Freelas, Workana, GetNinjas, Freelancer, LinkedIn, sites de empresas BH/MG
3. Relatório completo por oportunidade (obrigatório na caça)
4. Priorizar leads inbound do snapshot (chat/formulário) antes de outbound
5. Operação: projetos travados, PIX em aberto, chats sem resposta
6. Sempre pesquisar na web quando o pedido for prospecção, caça, Instagram, freelance ou “achar clientes”

## Relatório de oportunidade (obrigatório)
Para cada lead:
<strong>Oportunidade N</strong>
<ul>
<li><strong>Quem:</strong> nome real encontrado</li>
<li><strong>O que precisa:</strong> dor concreta observada</li>
<li><strong>Projeto CodeCraft:</strong> serviço + faixa de preço</li>
<li><strong>Canal:</strong> origem</li>
<li><strong>Contato:</strong> só se real (telefone, @, e-mail ou URL do anúncio)</li>
<li><strong>Link:</strong> URL clicável da fonte</li>
<li><strong>Por que agora:</strong> 1 frase de timing/urgência</li>
<li><strong>Abordagem:</strong> mensagem pronta (WhatsApp/DM), tom formal BH, curta</li>
</ul>
Meta: 5 a 10 oportunidades sólidas por varredura. Qualidade > quantidade vazia.

## Regras de excelência
- Português do Brasil, formal, claro, denso
- NUNCA invente telefone, e-mail, @, CNPJ ou “empresa fictícia”
- Se a busca não trouxe contato, diga “contato no anúncio/perfil” + link
- Prefira BH / Grande BH / MG; freelance nacional ok se demanda forte
- Cite fontes com links
- HTML simples: <p>, <strong>, <em>, <ul>, <li>, <br>, <a href="...">. Sem scripts
- Respostas longas e completas são esperadas`;

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

async function callGemini(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  withSearch: boolean;
}) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 8192,
    },
  };
  if (opts.withSearch) {
    body.tools = [{ google_search: {} }];
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      ok: false as const,
      error: data?.error?.message || `Gemini HTTP ${res.status}`,
      data,
    };
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p: { text?: string }) => p.text || "").join("\n").trim();
  if (!text) {
    return { ok: false as const, error: "Gemini retornou vazio.", data };
  }
  return { ok: true as const, text, data, webSearch: opts.withSearch };
}

async function callClaude(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  history: Array<{ role: string; content: string }>;
  withSearch: boolean;
  maxTokens: number;
}) {
  const messages = [
    ...opts.history.map((h) => ({
      role: h.role === "assistant" ? "assistant" : "user",
      content: String(h.content || "").slice(0, 100_000),
    })),
    { role: "user", content: opts.prompt },
  ];
  const payload: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: SYSTEM,
    messages,
  };
  if (opts.withSearch) {
    payload.tools = [{
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 25,
    }];
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      ok: false as const,
      error: data?.error?.message || `Claude HTTP ${res.status}`,
      data,
    };
  }
  const text = (Array.isArray(data.content) ? data.content : [])
    .filter((p: { type?: string }) => p.type === "text")
    .map((p: { text?: string }) => p.text || "")
    .join("\n\n")
    .trim();
  if (!text) return { ok: false as const, error: "Claude retornou vazio.", data };
  return { ok: true as const, text, data, webSearch: opts.withSearch };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || "";
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
    if (!geminiKey && !anthropicKey) {
      return json({
        error: "Configure GEMINI_API_KEY (grátis) ou ANTHROPIC_API_KEY no Supabase.",
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
    const message = String(body.message || "").trim().slice(0, 500_000);
    if (!message) return json({ error: "Mensagem vazia" }, 400);

    const snapshot = body.snapshot || {};
    const market = body.market || {};
    const history = Array.isArray(body.history) ? body.history.slice(-40) : [];
    const wantsHunt = /cacar|caçar|prospect|cliente|instagram|freelance|99freela|workana|getninjas|maps|varredura|oportunid|em tudo|achar/i
      .test(message);

    const prompt = [
      "## Snapshot operacional (ao vivo)",
      JSON.stringify(snapshot, null, 0).slice(0, 200_000),
      "",
      "## Mercado",
      JSON.stringify(market, null, 0).slice(0, 50_000),
      "",
      wantsHunt
        ? "## Instrução de caça\nPesquise AGORA na web (Google/Maps/Instagram/freelance) oportunidades REAIS para CodeCraft. Entregue relatório completo com links. Não invente contatos."
        : "## Instrução\nResponda com excelência operacional usando o snapshot.",
      "",
      "## Pedido do admin",
      message,
    ].join("\n");

    // 1) Gemini grátis (forte + Google Search) — caminho principal
    if (geminiKey) {
      const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
      let result = await callGemini({
        apiKey: geminiKey,
        model,
        prompt,
        withSearch: true,
      });
      if (!result.ok) {
        result = await callGemini({
          apiKey: geminiKey,
          model,
          prompt,
          withSearch: false,
        });
      }
      if (result.ok) {
        return json({
          reply: result.text,
          replyHtml: mdToHtml(result.text),
          model,
          provider: "gemini",
          webSearch: !!result.webSearch,
        });
      }
      // se Gemini falhar e não houver Claude, devolve erro
      if (!anthropicKey) {
        return json({ error: result.error, code: "GEMINI_ERROR" }, 502);
      }
    }

    // 2) Claude opcional (pago)
    const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5";
    const maxTokens = Math.min(
      Math.max(Number(Deno.env.get("ANTHROPIC_MAX_TOKENS") || 64000) || 64000, 1024),
      64000,
    );
    let claude = await callClaude({
      apiKey: anthropicKey,
      model,
      prompt,
      history,
      withSearch: true,
      maxTokens,
    });
    if (!claude.ok) {
      claude = await callClaude({
        apiKey: anthropicKey,
        model,
        prompt,
        history,
        withSearch: false,
        maxTokens,
      });
    }
    if (!claude.ok) {
      return json({ error: claude.error, code: "CLAUDE_ERROR" }, 502);
    }
    return json({
      reply: claude.text,
      replyHtml: mdToHtml(claude.text),
      model,
      provider: "claude",
      webSearch: !!claude.webSearch,
    });
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : String(e),
      code: "EXCEPTION",
    }, 500);
  }
});
