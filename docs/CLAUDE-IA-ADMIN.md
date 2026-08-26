# CodeCraft IA — chave grátis (qualidade sênior)

## Por que o AI Studio falhou
O Google mostrou **“request is suspicious”** / bloqueio por **solicitações automatizadas**.
Isso trava a criação de chave **dentro do navegador do Cursor**.

O projeto **codecraft-ia** já foi criado no Google Cloud. Continue no **Chrome normal** (fora do Cursor).

## Caminho A — Gemini (recomendado se desbloquear)
1. Abra o **Chrome** (não o browser do Cursor)
2. https://aistudio.google.com/apikey
3. **Importar projetos** → marque **codecraft-ia** → importar
4. **Criar chave de API** → projeto **codecraft-ia** → copiar
5. Cole a chave aqui no chat **ou** no Supabase → Secrets → `GEMINI_API_KEY`

## Caminho B — Groq (mais fácil, sem Cloud Project)
1. Chrome: https://console.groq.com/keys
2. Login com Google
3. **Create API Key** → copiar (`gsk_...`)
4. Cole aqui → eu configuro `GROQ_API_KEY`
5. A IA usa **Llama 3.3 70B** + pesquisa web no servidor (nível profissional)

## Sem cartão
Os dois caminhos têm faixa grátis. Não precisa Claude pago.
