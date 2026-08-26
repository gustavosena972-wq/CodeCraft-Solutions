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

const SYSTEM = `Você é a CodeCraft IA — agente sênior de prospecção da CodeCraft Solutions (Belo Horizonte).
Você caça DEMANDA REAL, não vitrine de empresas bem avaliadas.

## Empresa
- CodeCraft Solutions · BH e Brasil · PIX 31999758385 · @code.invention
- Atendimento ao cliente: chat do site (não WhatsApp)
- Atendemos MEI, pequenas, médias e grandes empresas
- Serviços: landing (≥R$300), site (≥R$500), loja (≥R$500), sistema (R$1.500–15.000), manutenção (≥R$100/mês)
- SaaS: CodeCraft Gestão (CNPJ) R$280 / R$390 / R$500 — https://gustavosena972-wq.github.io/financas-codecraft/

## O que é uma oportunidade válida
Inclua SOMENTE se houver sinal claro de necessidade:
- Pedido explícito: “preciso de site”, “quero loja virtual”, “contratar desenvolvedor”, anúncio em 99Freelas/Workana/GetNinjas
- Negócio local que parece operar só no WhatsApp / Instagram / Maps, sem site próprio claro no resultado
- Lead inbound do snapshot (chat/formulário do site)

## PROIBIDO
- Listar clínicas/salões/oficinas só porque têm 4–5 estrelas no Maps/Google
- Inventar telefone, WhatsApp, @, e-mail ou CNPJ
- Inventar “o que precisa” sem base no anúncio/snippet
- Relatório genérico de nicho sem nome real + link da fonte

## Relatório (obrigatório)
Para cada lead REAL:
<strong>Oportunidade N</strong>
<ul>
<li><strong>Quem:</strong> nome exato do anúncio/perfil/empresa</li>
<li><strong>O que precisa:</strong> frase do pedido ou dor observada no texto</li>
<li><strong>Projeto CodeCraft:</strong> serviço + preço</li>
<li><strong>Canal:</strong> 99Freelas / Workana / GetNinjas / Instagram / Google / chat do site</li>
<li><strong>Contato:</strong> telefone/@/e-mail SÓ se aparecer no resultado; senão “abrir link e pegar contato no anúncio”</li>
<li><strong>Link:</strong> URL clicável da fonte (obrigatório)</li>
<li><strong>Abordagem:</strong> mensagem curta pronta</li>
</ul>
Priorize freelance e pedidos explícitos. Se a pesquisa trouxe só Maps 5 estrelas, diga isso e foque nos anúncios de demanda. HTML simples apenas.`;

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

function extractContacts(text: string) {
  const t = String(text || "");
  const phones = Array.from(
    t.matchAll(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?\d{4}|\d{4})[-\s]?\d{4}/g),
  ).map((m) => m[0].replace(/\s+/g, " ").trim());
  const emails = Array.from(
    t.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g),
  ).map((m) => m[0]);
  const ig = Array.from(t.matchAll(/@[a-zA-Z0-9._]{3,30}/g)).map((m) => m[0]);
  const uniq = (arr: string[]) => [...new Set(arr)].slice(0, 5);
  return {
    phones: uniq(phones),
    emails: uniq(emails),
    instagram: uniq(ig),
  };
}

async function duckSearch(query: string, limit = 8): Promise<Array<{ title: string; url: string; snippet: string; contacts: ReturnType<typeof extractContacts> }>> {
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
      },
      body: `q=${encodeURIComponent(query)}`,
    });
    const html = await res.text();
    const out: Array<{ title: string; url: string; snippet: string; contacts: ReturnType<typeof extractContacts> }> = [];

    const blocks = html.split(/class="result__body"|class="result results_links/);
    for (const block of blocks) {
      if (out.length >= limit) break;
      const a = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!a) continue;
      let url = decodeHtml(a[1] || "");
      const uddg = url.match(/uddg=([^&]+)/);
      if (uddg) url = decodeURIComponent(uddg[1]);
      const title = decodeHtml(String(a[2] || "").replace(/<[^>]+>/g, "")).trim();
      const sn = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\//i);
      const snippet = decodeHtml(String(sn?.[1] || "").replace(/<[^>]+>/g, "")).trim();
      if (!title || !url.startsWith("http")) continue;
      // Filtra páginas de “melhor clínica 5 estrelas” genéricas
      const blob = (title + " " + snippet).toLowerCase();
      if (/melhores|ranking|top\s*\d|5\s*estrelas|avalia[cç][aã]o/.test(blob) && !/preciso|contratar|or[cç]amento|freela/.test(blob)) {
        continue;
      }
      out.push({
        title,
        url,
        snippet,
        contacts: extractContacts(title + " " + snippet + " " + url),
      });
    }

    if (!out.length) {
      const simple = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let sm: RegExpExecArray | null;
      while ((sm = simple.exec(html)) && out.length < limit) {
        let url = decodeHtml(sm[1] || "");
        const uddg = url.match(/uddg=([^&]+)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
        const title = decodeHtml(String(sm[2] || "").replace(/<[^>]+>/g, "")).trim();
        if (title && url.startsWith("http")) {
          out.push({ title, url, snippet: "", contacts: extractContacts(title) });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function scrapeFreelancePages() {
  const targets = [
    {
      label: "99Freelas",
      url: "https://www.99freelas.com.br/projects?q=site&order=mais-recentes&categoria=web-mobile-e-software",
    },
    {
      label: "99Freelas loja",
      url: "https://www.99freelas.com.br/projects?q=loja+virtual&order=mais-recentes",
    },
    {
      label: "Workana",
      url: "https://www.workana.com/jobs?query=criar%20site&category=it-programming",
    },
  ];
  const blocks: string[] = [];
  for (const t of targets) {
    try {
      const res = await fetch(t.url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
          accept: "text/html",
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const links: Array<{ title: string; url: string }> = [];
      const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) && links.length < 12) {
        let href = decodeHtml(m[1] || "");
        const title = decodeHtml(String(m[2] || "").replace(/<[^>]+>/g, "")).trim();
        if (title.length < 12 || title.length > 140) continue;
        if (!/site|loja|landing|sistema|aplicativo|app|wordpress|ecommerce|e-commerce|web/i.test(title)) {
          continue;
        }
        if (href.startsWith("/")) {
          const base = new URL(t.url);
          href = base.origin + href;
        }
        if (!href.startsWith("http")) continue;
        if (/login|cadastro|como-funciona|premium|blog/i.test(href)) continue;
        links.push({ title, url: href });
      }
      // unique by url
      const seen = new Set<string>();
      const uniq = links.filter((l) => {
        if (seen.has(l.url)) return false;
        seen.add(l.url);
        return true;
      }).slice(0, 8);
      if (!uniq.length) continue;
      blocks.push(
        `### Pedidos em ${t.label}\nFonte: ${t.url}\n` +
          uniq.map((l, i) => `${i + 1}. ${l.title}\n   URL: ${l.url}`).join("\n"),
      );
    } catch {
      // ignore scrape failures
    }
  }
  return blocks.join("\n\n");
}

async function gatherWebResearch(message: string) {
  // Consultas de DEMANDA (não “melhores empresas 5 estrelas”)
  const queries = [
    'site:99freelas.com.br preciso de site OR loja virtual OR sistema OR landing',
    'site:workana.com criar site OR loja virtual OR landing page Brasil',
    'site:getninjas.com.br criação de site OR loja virtual Belo Horizonte',
    '"preciso de site" OR "quero um site" OR "orçamento de site" Belo Horizonte OR BH',
    '"contratar" (site OR "loja virtual" OR landing) (BH OR "Belo Horizonte" OR Minas)',
    'site:instagram.com ("preciso de site" OR "alguém faz site" OR "orçamento site") Brasil',
    message.slice(0, 160),
  ];
  const blocks: string[] = [];
  const freelance = await scrapeFreelancePages();
  if (freelance) blocks.push(freelance);

  for (const q of queries) {
    const hits = await duckSearch(q, 8);
    if (!hits.length) continue;
    blocks.push(
      `### Busca demanda: ${q}\n` +
        hits
          .map((h, i) => {
            const c = h.contacts;
            const contactLine = [
              c.phones.length ? `tel: ${c.phones.join(", ")}` : "",
              c.emails.length ? `email: ${c.emails.join(", ")}` : "",
              c.instagram.length ? `ig: ${c.instagram.join(", ")}` : "",
            ].filter(Boolean).join(" | ") || "contato: abrir o link do anúncio";
            return `${i + 1}. ${h.title}\n   URL: ${h.url}\n   Snippet: ${h.snippet || "(sem snippet)"}\n   Contatos detectados: ${contactLine}`;
          })
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
        ? "## Instrução de caça\nUse PRIORITARIAMENTE pedidos de freelance e frases “preciso de site”. Proibido relatório de empresas 5 estrelas do Maps. Para cada lead: quem, o que precisa (do texto), projeto, canal, contato (só se detectado), link, abordagem."
        : "## Instrução\nResponda com excelência operacional usando o snapshot.",
      "",
      "## Pedido do admin",
      message,
    ].filter(Boolean).join("\n");

    // 1) Groq (grátis, forte) + nossa pesquisa web
    if (groqKey) {
      const model = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
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
      // Fallback se o modelo padrão sair da lista da conta
      const fallbacks = [
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "qwen/qwen3.6-27b",
        "groq/compound",
      ];
      for (const fb of fallbacks) {
        if (fb === model) continue;
        const again = await callGroq({ apiKey: groqKey, model: fb, prompt });
        if (again.ok) {
          return json({
            reply: again.text,
            replyHtml: mdToHtml(again.text),
            model: fb,
            provider: "groq",
            webSearch: !!research,
          });
        }
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
