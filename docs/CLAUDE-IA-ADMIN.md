# Claude na IA Admin (CodeCraft Solutions)

A IA do painel chama a Edge Function `ccs-admin-ai` (Anthropic Claude + pesquisa web).
A chave **nunca** vai no `index.html`.

## O que ela faz na caça
- Busca quem precisa de site / loja / sistema / Gestão
- Canais: Google, Maps, Instagram, 99Freelas, Workana, GetNinjas, Freelancer, LinkedIn
- Entrega **relatório**: o que a pessoa precisa, projeto CodeCraft, canal, contato (se real), link e abordagem

## 1) Secret no Supabase
Dashboard → projeto **eqaoanbanhryhbldlbhc** → **Edge Functions** → **Secrets**:

| Nome | Valor |
|------|--------|
| `ANTHROPIC_API_KEY` | sua chave `sk-ant-...` |
| `ANTHROPIC_MODEL` (opcional) | padrão `claude-sonnet-4-5` |

## 2) Deploy
```bash
npx supabase login
npx supabase functions deploy ccs-admin-ai --project-ref eqaoanbanhryhbldlbhc
```

## 3) Teste
Admin → **IA Admin** → **Caçar em tudo**
- Com Claude: status “Claude · web” e relatório montado
- Sem chave/function: motor local com links prontos para freelance/Instagram/Maps
