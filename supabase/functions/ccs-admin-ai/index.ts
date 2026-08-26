// CodeCraft Solutions — IA Admin sênior
// Secrets (grátis): GROQ_API_KEY (recomendado) | GEMINI_API_KEY (opcional)
// Opcional pago: ANTHROPIC_API_KEY
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
2. Usar os RESULTADOS DE PESQUISA WEB fornecidos (Google/Maps/Instagram/freelance via links e snippets)
3. Relatório completo por oportunidade
4. Priorizar leads inbound do snapshot antes de outbound
5. Operação: projetos travados, PIX, chats sem resposta

## Relatório de oportunidade (obrigatório na caça)
Para cada lead real dos resultados/pesquisa:
<strong>Oportunidade N</strong>
<ul>
<li><strong>Quem:</strong> nome real</li>
<li><strong>O que precisa:</strong> dor concreta</li>
<li><strong>Projeto CodeCraft:</strong> serviço + faixa de preço</li>
<li><strong>Canal:</strong> origem</li>
<li><strong>Contato:</strong> só se real</li>
<li><strong>Link:</strong> URL da fonte</li>
<li><strong>Por que agora:</strong> timing</li>
<li><strong>Abordagem:</strong> mensagem pronta WhatsApp/DM</li>
</ul>
Meta: 5 a 10 oportunidades sólidas. Qualidade > quantidade vazia.

## Regras
- Português do Brasil, formal, denso
- NUNCA invente telefone, e-mail, @, CNPJ ou empresa fictícia
- Se não houver contato no snippet, diga “contato no anúncio/perfil” + link
- Prefira BH / Grande BH / MG
- HTML: <p>, <strong>, <em>, <ul>, <li>, <br>, <a href="...">. Sem scripts`;

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

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function duckSearch(query: string, limit = 8): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "Mozilla/5.0 CodeCraftBot/1.0",
      },
      body: `q=${encodeURIComponent(query)}`,
    });
    const html = await res.text();
    const out: Array<{ title: string; url: string; snippet: string }> = [];
    const re =
      /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)> )?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < limit) {
      let url = decodeHtml(m[1] || "");
      // DuckDuckGo redirect URLs
      const uddg = url.match(/uddg=([^&]+)/);
      if (uddg) url = decodeURIComponent(uddg[1]);
      const title = decodeHtml(String(m[2] || "").replace(/<[^>]+>/g, "")).trim();
      const snippet = decodeHtml(String(m[3] || "").replace(/<[^>]+>/g, "")).trim();
      if (title && url.startsWith("http")) out.push({ title, url, snippet });
    }
    // fallback simpler parse
    if (!out.length) {
      const simple = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let sm: RegExpExecArray | null;
      while ((sm = simple.exec(html)) && out.length < limit) {
        let url = decodeHtml(sm[1] || "");
        const uddg = url.match(/uddg=([^&]+)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
        const title = decodeHtml(String(sm[2] || "").replace(/<[^>]+>/g, "")).trim();
        if (title && url.startsWith("http")) out.push({ title, url, snippet: "" });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function gatherWebResearch(message: string) {
  const queries = [
    message.slice(0, 180),
    "preciso de site OR loja virtual OR sistema site:99freelas.com.br",
    "preciso de site OR landing page site:workana.com",
    "criação de site Belo Horizonte",
    "clínica dentista salão oficina Belo Horizonte site WhatsApp",
    "site:instagram.com Belo Horizonte clínica OR salão OR oficina OR loja",
  ];
  const blocks: string[] = [];
  for (const q of queries.slice(0, 5)) {
    const hits = await duckSearch(q, 6);
    if (!hits.length) continue;
    blocks.push(
      `### Busca: ${q}\n` +
        hits
          .map(
            (h, i) =>
              `${i + 1}. ${h.title}\n   URL: ${h.url}\n   Snippet: ${h.snippet || "(sem snippet)"}`,
          )
          .join("\n"),
    );
  }
  return blocks.join("\n\n");
}

async function callGroq(opts: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.3,
      max_tokens: 8000,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: opts.prompt },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      ok: false as const,
      error: data?.error?.message || `Groq HTTP ${res.status}`,
    };
  }
  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) return { ok: false as const, error: "Groq retornou vazio." };
  return { ok: true as const, text };
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
    generationConfig: { temperature: 0.35, maxOutputTokens: 8192 },
  };
  if (opts.withSearch) body.tools = [{ google_search: {} }];
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
    };
  }
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || "")
    .join("\n")
    .trim();
  if (!text) return { ok: false as const, error: "Gemini retornou vazio." };
  return { ok: true as const, text, webSearch: opts.withSearch };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const groqKey = Deno.env.get("GROQ_API_KEY") || "";
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || "";
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
    if (!groqKey && !geminiKey && !anthropicKey) {
      return json({
        error: "Configure GROQ_API_KEY (grátis) no Supabase Secrets.",
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
    const wantsHunt = /cacar|caçar|prospect|cliente|instagram|freelance|99freela|workana|getninjas|maps|varredura|oportunid|em tudo|achar/i
      .test(message);

    let research = "";
    if (wantsHunt || !geminiKey) {
      research = await gatherWebResearch(message);
    }

    const prompt = [
      "## Snapshot operacional (ao vivo)",
      JSON.stringify(snapshot, null, 0).slice(0, 150_000),
      "",
      "## Mercado",
      JSON.stringify(market, null, 0).slice(0, 30_000),
      "",
      research
        ? `## Resultados de pesquisa web (use estes dados; não invente)\n${research}`
        : "",
      "",
      wantsHunt
        ? "## Instrução de caça\nMonte relatório sênior com oportunidades REAIS a partir da pesquisa. Links obrigatórios. Sem contato inventado."
        : "## Instrução\nResponda com excelência operacional usando o snapshot.",
      "",
      "## Pedido do admin",
      message,
    ].filter(Boolean).join("\n");

    // 1) Groq (grátis, forte) + nossa pesquisa web
    if (groqKey) {
      const model = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";
      const result = await callGroq({ apiKey: groqKey, model, prompt });
      if (result.ok) {
        return json({
          reply: result.text,
          replyHtml: mdToHtml(result.text),
          model,
          provider: "groq",
          webSearch: !!research,
        });
      }
      if (!geminiKey && !anthropicKey) {
        return json({ error: result.error, code: "GROQ_ERROR" }, 502);
      }
    }

    // 2) Gemini (se tiver chave)
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
          webSearch: !!result.webSearch || !!research,
        });
      }
      if (!anthropicKey) {
        return json({ error: result.error, code: "GEMINI_ERROR" }, 502);
      }
    }

    return json({
      error: "Nenhum provedor respondeu. Configure GROQ_API_KEY.",
      code: "NO_PROVIDER",
    }, 502);
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : String(e),
      code: "EXCEPTION",
    }, 500);
  }
});
