
# Matrix Digital Assets — Plano da Rodada 1

SaaS interno para gestora de criptoativos acompanhar carteiras de clientes em tempo real. Esta primeira rodada entrega o núcleo funcional; módulos secundários ficam estruturados (tabelas + telas vazias com TODO) para fases seguintes.

## Identidade visual

- Tema dark, fundo `#0A0E1A` com grid digital sutil de fundo
- Acento cyan `#00D4FF` (glow suave em hovers, gráficos, bordas ativas)
- Tipografia: monoespaçada (JetBrains Mono) para números/símbolos; sans-serif (Inter) para textos
- Header global com logo Matrix (placeholder em `/public/logo.png`), nome do usuário e toggle USD/BRL
- Componentes shadcn/ui customizados para o tema; Recharts em paleta cyan

## Autenticação e papéis

- Supabase Auth (email + senha)
- Tabela `profiles` com `role` (`admin` | `client`)
- 1 admin único criado via SQL seed (você fornece email + senha inicial)
- Admin cria clientes via modal → Edge Function `create-client` (cria `auth.user` + `profiles` + `clients`)
- Cliente troca a própria senha em `/app/perfil`
- RLS estrito em todas as tabelas: admin acessa tudo; cliente só vê linhas onde `client_id = auth.uid()`

## Banco de dados (todas as tabelas criadas nesta rodada)

Tabelas funcionais nesta rodada (CRUD + UI):
`profiles`, `clients`, `funds`, `holdings`, `realizations`, `deposits`, `withdrawals`, `coin_prices`, `fx_rates`, `mural_posts`

Tabelas criadas com schema + RLS, mas só usadas em fases seguintes (TODO nas telas):
`fixed_income`, `futures_records`, `contracts`, `receipts`, `invoices`, `performance_history`

Storage buckets privados (max 5MB, signed URLs): `contracts`, `receipts`, `invoices`, `futures`, `mural`

## Regras de negócio implementadas agora

- **Caixa USD do cliente**:
  `Σ deposits − Σ withdrawals − Σ(holdings ativas: qty × entry_price) + Σ realizations.total_usd`
- **Realização sempre total**: vender holding fecha 100% da quantidade. Para manter parte, admin cria novo holding em outro fundo com a quantidade restante (fluxo guiado no modal).
- **Toggle USD/BRL global**: persiste em `localStorage`, conversão via `fx_rates`.
- **Rentabilidade exibida ao cliente é bruta**; taxa administrativa não aparece em lugar nenhum.

Fechamento mensal de performance e exibição de carried deficit ficam para fase 2 (tabela `performance_history` já criada).

## Edge Functions desta rodada

- `create-client` — admin cria cliente (auth + profile + clients) numa única chamada autorizada
- `update-coin-prices` — busca preços na CoinMarketCap v2 (`/cryptocurrency/quotes/latest`) em batch para todos os símbolos únicos de holdings ativas; faz upsert em `coin_prices`. Agendada via `pg_cron` para 10:00 UTC diariamente. Botão "atualizar agora" em `/admin/cotacoes`.
- `update-fx-rates` — busca USD/BRL e grava em `fx_rates` (rodada junto com a de cotações).

`CMC_API_KEY` armazenada como secret no Lovable Cloud, nunca exposta ao client.

Edge functions deixadas como stub para fase 2: `close-monthly-performance`.

## Telas — Admin (`/admin/*`)

- `/admin` — dashboard: AUM total, nº de clientes, carteira consolidada (donut por moeda), última atualização de cotações
- `/admin/clientes` — lista com busca; modal "Novo cliente" (nome, email, senha inicial)
- `/admin/clientes/:id` — tabs:
  - **Fundos** (CRUD funcional)
  - **Caixa USD** (depósitos/saques, saldo calculado)
  - Rendimentos Alternativos · Mercado Futuro · Documentos · Performance Mensal → tabs visíveis com placeholder "Em breve"
- `/admin/clientes/:id/fundos/:fundId` — holdings, realizações, ações: nova compra, realizar holding (total), encerrar fundo
- `/admin/mural` — publicar/editar/excluir lâminas (upload PDF/imagem + período mês/ano)
- `/admin/cotacoes` — status do cache, lista de símbolos com último preço/timestamp, botão "atualizar agora"

## Telas — Cliente (`/app/*`)

- `/app` — dashboard: patrimônio total (USD com toggle BRL), breakdown por fundo (donut), variação 24h por holding, último update de preços. Gráfico de evolução 12 meses fica como placeholder até fase 2 (depende de `performance_history`).
- `/app/fundos` — lista de fundos; detalhe com holdings (qty, preço médio, preço atual, P&L %)
- `/app/mural` — lâminas em ordem cronológica, filtro mês/ano
- `/app/perfil` — trocar senha
- Telas Rendimentos / Futuros / Documentos / Relatórios PDF: rotas criadas com placeholder "Em breve" (fase 2)

## Componentes-chave

- `useCurrency()` hook + `<Money>` component (USD com 2 casas, BRL convertido via `fx_rates`)
- `<CryptoQty>` (até 8 casas), `<Pct>` (sinal + cor verde/vermelho)
- Toggle USD/BRL no header (persistente)
- Tabelas shadcn DataTable com sort/filtro/paginação
- Upload com preview, validação de 5MB e tipos (PDF/JPG/PNG)
- Layout admin e layout cliente separados, com guards de role

## Detalhes técnicos

- Stack: TanStack Start + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Recharts
- Backend: Lovable Cloud (Supabase gerenciado) — Auth, Postgres, Storage, Edge Functions
- RLS: policies via `has_role(auth.uid(), 'admin')` (security definer) + escopo por `client_id`
- Server-side reads usam `createServerFn` + `requireSupabaseAuth`; uploads/downloads via signed URLs
- Schedules: `pg_cron` chamando as edge functions de preços/fx
- CoinMarketCap: cache agressivo em `coin_prices` (free tier), batch por símbolos
- PT-BR em toda a UI; números no padrão financeiro (US para USD, pt-BR para BRL)

## Antes de começar a implementar, vou precisar de você

1. **Email + senha** do admin único (para o seed SQL)
2. **CMC_API_KEY** — vou pedir como secret assim que iniciarmos a implementação
3. Confirmação para subir um logo placeholder em `/public/logo.png` (você troca depois pelo definitivo)

## Fora do escopo desta rodada (estruturado para fase 2)

- Fechamento mensal de performance (`close-monthly-performance` + UI)
- Rendimentos alternativos (fixed income) — UI completa
- Mercado futuro — cards com preview
- Documentos (NFs, Contratos com versionamento, Recibos) — UI completa
- Relatórios PDF client-side (`/app/relatorios`)
- Gráfico de evolução 12 meses no dashboard do cliente
