# CodeCraft IA Admin — qualidade sênior (sem pagar Claude)

A IA do painel usa **Google Gemini** (grátis, sem cartão) + **pesquisa Google** no servidor.
Não é chatbot raso: entrega relatório de oportunidades com contato e abordagem.

## 1) Chave Gemini (grátis)
1. Abra https://aistudio.google.com/apikey
2. Faça login com Google
3. **Create API key**
4. Copie a chave

## 2) Secret no Supabase
Projeto `eqaoanbanhryhbldlbhc` → Edge Functions → Secrets:

| Nome | Valor |
|------|--------|
| `GEMINI_API_KEY` | sua chave Gemini |
| `GEMINI_MODEL` (opcional) | padrão `gemini-2.0-flash` |

## 3) Deploy da function
```bash
npx supabase functions deploy ccs-admin-ai --project-ref eqaoanbanhryhbldlbhc
```

## 4) Teste
Admin → **IA Admin** → **Caçar em tudo**
Status esperado: **Gemini · web** + relatório com oportunidades reais e links.

## Claude (opcional, pago)
Só se um dia quiser: `ANTHROPIC_API_KEY`. Gemini continua sendo o caminho principal sem custo.
