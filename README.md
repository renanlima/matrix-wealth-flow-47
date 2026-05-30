# Matrix Digital Assets

Plataforma de gestão de criptoativos, fundos, renda fixa e operações de futuros, com painel administrativo (gestor) e painel do cliente. Construída com TanStack Start (SSR React) + Supabase, sincronizada bidirecionalmente com **Lovable** e implantada na **Cloudflare** (Workers).

> Projeto Lovable original: gerenciado via `@lovable.dev/vite-tanstack-config`. Pushes neste repositório GitHub refletem automaticamente no Lovable e vice-versa.

---

## 1. Stack técnica

| Camada            | Tecnologia                                                                 |
|-------------------|----------------------------------------------------------------------------|
| Runtime / Build   | **Vite 7** + **TanStack Start** (SSR) + **TanStack Router** (file-based)   |
| UI                | **React 19** + **shadcn/ui** (style: `new-york`) + **Radix UI** + **Tailwind 4** |
| Estado / dados    | **TanStack Query 5** (staleTime 30s, gcTime 5min, no refetch on focus)     |
| Formulários       | **react-hook-form** + **zod** + `@hookform/resolvers`                      |
| Backend / DB      | **Supabase** (Postgres + Auth + Storage + Edge Functions Deno)             |
| Edge / Deploy     | **Cloudflare Workers** via `@cloudflare/vite-plugin` + `wrangler`          |
| Charts / Datas    | recharts • date-fns • react-day-picker                                     |
| PDF / Export      | jspdf + html2canvas (ver `src/lib/pdf.ts`)                                 |
| Notifs            | sonner (Toaster, tema dark, top-right)                                     |
| Linguagem         | TypeScript 5.8 (strict, `@/*` → `src/*`)                                   |

### Versões críticas
- Node ≥ 20 recomendado (compatível com Vite 7 e Wrangler 2025).
- React 19 + react-dom 19 (cuidado: muitas libs ainda exigem peer override).
- Tailwind 4 (sintaxe nova, configuração via `@tailwindcss/vite`, sem `tailwind.config.js`).

---

## 2. Estrutura de pastas

```
matrix-wealth-flow-47/
├── public/                          # Estáticos servidos em /
│   └── logo.png
├── src/
│   ├── assets/                      # Imagens importadas pelo bundler
│   ├── components/
│   │   ├── admin/                   # Componentes do painel admin (Documents, FixedIncome, Futures, Performance, Onboarding)
│   │   ├── client/                  # Componentes do cliente (ClientHoldingsTable)
│   │   ├── extrato/                 # ExtratoFundo
│   │   ├── ui/                      # shadcn/ui (gerado — não editar à mão)
│   │   ├── AppShell.tsx             # Shell com sidebar/header
│   │   ├── AuthGate.tsx             # Bloqueia rotas não autenticadas
│   │   └── Money.tsx                # Formatação monetária
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Sessão + perfil (role admin|client)
│   │   ├── CurrencyContext.tsx      # Moeda exibida (BRL/USD/USDT)
│   │   └── DemoContext.tsx          # Modo demo (dados fake)
│   ├── hooks/
│   │   └── use-mobile.tsx
│   ├── integrations/supabase/
│   │   ├── client.ts                # Cliente browser (anon/publishable key) — proxy lazy
│   │   ├── client.server.ts         # Cliente admin (service_role) — SOMENTE servidor, bypassa RLS
│   │   ├── auth-middleware.ts       # Middleware TanStack Start: valida Bearer e injeta { supabase, userId, claims }
│   │   ├── auth-attacher.ts         # Anexa Authorization header em chamadas client→server
│   │   └── types.ts                 # Tipos gerados (Database) — não editar
│   ├── lib/
│   │   ├── demo-data.ts             # Fixture do modo demo
│   │   ├── extrato.ts               # Cálculo de extrato de fundo
│   │   ├── format.ts                # Formatação BRL/USD/percentual
│   │   ├── pdf.ts                   # Export PDF (jspdf+html2canvas)
│   │   ├── upload.ts                # Upload p/ Supabase Storage
│   │   └── utils.ts                 # cn() do shadcn
│   ├── routes/                      # File-based routing TanStack
│   │   ├── __root.tsx               # Root layout, providers, <head>
│   │   ├── index.tsx                # Landing
│   │   ├── login.tsx
│   │   ├── admin.tsx                # Layout do admin
│   │   ├── admin.index.tsx          # Dashboard admin
│   │   ├── admin.clientes.index.tsx
│   │   ├── admin.clientes.$clientId.index.tsx
│   │   ├── admin.clientes.$clientId.fundos.$fundId.tsx
│   │   ├── admin.clientes.$clientId.fundos.$fundId_.extrato.tsx
│   │   ├── admin.configuracoes.tsx
│   │   ├── admin.cotacoes.tsx
│   │   ├── admin.mural.tsx
│   │   ├── app.tsx                  # Layout do cliente
│   │   ├── app.index.tsx            # Dashboard cliente
│   │   ├── app.fundos.tsx
│   │   ├── app.fundos_.$fundId.tsx
│   │   ├── app.fundos_.$fundId_.extrato.tsx
│   │   ├── app.futuros.tsx
│   │   ├── app.rendimentos.tsx
│   │   ├── app.relatorios.tsx
│   │   ├── app.documentos.tsx
│   │   ├── app.mural.tsx
│   │   └── app.perfil.tsx
│   ├── router.tsx                   # createRouter + QueryClient por request (SSR-safe)
│   ├── routeTree.gen.ts             # GERADO automaticamente pelo router-plugin — NÃO EDITAR
│   └── styles.css                   # Tailwind 4 + variáveis CSS shadcn
├── supabase/
│   ├── config.toml                  # project_id + verify_jwt por function
│   ├── migrations/                  # SQL versionado (ordem cronológica)
│   └── functions/                   # Edge functions Deno
├── components.json                  # Config shadcn
├── vite.config.ts                   # Apenas `defineConfig()` do plugin Lovable
├── wrangler.jsonc                   # Cloudflare Workers (entry = @tanstack/react-start/server-entry)
├── tsconfig.json                    # strict, alias @/* → src/*
└── package.json
```

> **NÃO editar manualmente:** `src/routeTree.gen.ts`, `src/integrations/supabase/types.ts`, `src/integrations/supabase/client*.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `src/components/ui/*` (regenerar via shadcn CLI). Cabeçalho `This file is automatically generated` indica regeneração obrigatória.

---

## 3. Variáveis de ambiente

Crie um `.env` na raiz (não comitar). No Lovable, configure em **Project → Environment**. Na Cloudflare, use `wrangler secret put`.

| Var                            | Escopo            | Obrigatória | Descrição                                                |
|-------------------------------|-------------------|-------------|----------------------------------------------------------|
| `VITE_SUPABASE_URL`           | client (build)    | sim         | URL pública do projeto Supabase                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY`| client (build)   | sim         | Publishable/anon key Supabase                            |
| `SUPABASE_URL`                | server (runtime)  | sim         | Mesmo URL acima, exposto ao runtime de servidor          |
| `SUPABASE_PUBLISHABLE_KEY`    | server (runtime)  | sim         | Usada no `auth-middleware` (token de usuário)            |
| `SUPABASE_SERVICE_ROLE_KEY`   | server (runtime)  | sim         | **SECRETA** — bypassa RLS. Nunca expor no client.        |

`vite.config.ts` (via plugin Lovable) injeta automaticamente as `VITE_*` no build. Variáveis `process.env.*` são lidas em runtime no Worker.

---

## 4. Comandos

```bash
npm install              # instala dependências (bun também suportado: bun install)
npm run dev              # dev server em http://localhost:8080  (porta fixa pelo plugin Lovable)
npm run build            # build de produção (Cloudflare Worker)
npm run build:dev        # build com NODE_ENV=development
npm run preview          # preview do build
npm run lint             # ESLint
npm run format           # Prettier
```

> Bun é o package manager de origem (`bun.lockb` presente). Em ambientes sem Bun, **use npm** — `package-lock.json` também é mantido. Não comite alterações que toquem nos dois lockfiles simultaneamente sem revisar.

---

## 5. Backend — Supabase

### 5.1 Projeto
- `project_id`: `xliplxqwvvtmgfovznzf` (ver `supabase/config.toml`).

### 5.2 Schema (resumo)

Enums:
- `app_role` = `admin | client`
- `fund_status` = `ativo | encerrado`
- `holding_status` = `ativa | encerrada`

Tabelas principais (em `public`):
- `profiles` — 1:1 com `auth.users`, guarda `role`, `full_name`, `email`.
- `clients` — cadastro de cliente.
- `funds` — fundos.
- `holdings` — posições do cliente em fundos/ativos.
- `realizations` — realizações de lucro/prejuízo.
- `deposits`, `withdrawals` — movimentações de caixa.
- `coin_prices`, `fx_rates` — preços de cripto e câmbio (alimentados por edge functions).
- `mural_posts` — comunicados.
- `fixed_income` — renda fixa.
- `futures_records` — registros de operações de futuros.
- `contracts`, `receipts`, `invoices` — documentos do cliente.
- `performance_history` — histórico de performance mensal.
- `audit_log`, `job_runs`, `coin_price_errors`, `rate_limit_log` — observabilidade.

### 5.3 Autorização
- **RLS habilitado em todas as tabelas.**
- Função `public.has_role(uid, role)` é `SECURITY DEFINER` (evita recursão de RLS em `profiles`) — use-a nas policies em vez de subqueries em `profiles`.
- Browser usa **publishable key** (RLS aplicado).
- Servidor (`client.server.ts`) usa **service_role** (bypassa RLS) — restrito a server functions/edge functions.

### 5.4 Edge Functions (`supabase/functions/`)

| Function                       | `verify_jwt` | Função                                                          |
|-------------------------------|--------------|-----------------------------------------------------------------|
| `create-client`               | ✅           | Cria cliente + auth user (admin only)                           |
| `update-client`               | (default)    | Atualiza dados do cliente                                       |
| `update-coin-prices`          | ❌           | Cron — atualiza `coin_prices` (CoinGecko/CMC)                   |
| `update-fx-rates`             | ❌           | Cron — atualiza `fx_rates`                                      |
| `update-fixed-income-prices`  | ❌           | Cron — marca preços de renda fixa                               |
| `close-monthly-performance`   | ❌           | Cron mensal — fecha mês e popula `performance_history`          |
| `seed-admin`, `seed-caio`, `seed-caio-admin` | ❌ | Seeds iniciais (rodar uma vez)                            |
| `_shared/job-runner.ts`       | n/a          | Helper para registrar `job_runs`                                |

Functions com `verify_jwt = false` devem ser protegidas por outros meios (header secreto, IP allowlist na Supabase, ou rodar via cron interno). **Não chamar do browser sem proteção.**

### 5.5 Migrações
Aplicar em ordem cronológica (timestamp do nome). Em dev local com Supabase CLI:
```bash
supabase db reset   # recria do zero a partir de migrations/
supabase db push    # aplica migrations pendentes no projeto remoto
```
Para gerar tipos após mudança de schema:
```bash
supabase gen types typescript --project-id xliplxqwvvtmgfovznzf > src/integrations/supabase/types.ts
```

---

## 6. Frontend — pontos importantes

### 6.1 Roteamento
- **File-based**: nome do arquivo vira a rota. `.` separa segmentos, `$param` é dinâmico, `_` no fim torna o segmento "pathless" (não acumula no breadcrumb).
- `routeTree.gen.ts` é **gerado** pelo `@tanstack/router-plugin` no dev — qualquer rota nova aparece sozinha ao salvar.
- Layouts: `admin.tsx` e `app.tsx` envolvem todas as rotas que começam com `admin.*` / `app.*`.
- Preload: `defaultPreload: "intent"` + `defaultPreloadDelay: 30` (hover prefetch).

### 6.2 Autenticação
- `AuthProvider` (em `__root.tsx`) escuta `supabase.auth.onAuthStateChange` **antes** de chamar `getSession()` (ordem importa — evita race em SSR).
- Carrega `profile` (com `role`) via `setTimeout(0)` para evitar deadlock dentro do callback de auth.
- `AuthGate` protege rotas autenticadas; rotas admin checam `profile.role === "admin"`.
- Em server functions, use o middleware `requireSupabaseAuth` (`auth-middleware.ts`) — exige header `Authorization: Bearer <token>`.

### 6.3 Providers (ordem em `__root.tsx`)
```
QueryClientProvider
  └ AuthProvider
      └ CurrencyProvider
          └ DemoProvider
              └ <Outlet />
              └ <Toaster richColors theme="dark" position="top-right" />
```
Não mudar a ordem sem motivo — `CurrencyProvider` e `DemoProvider` dependem de `useAuth`.

### 6.4 SSR e QueryClient
- **Um `QueryClient` novo é criado por request** (`getRouter()` em `src/router.tsx`). Não compartilhe queryClient entre requests no servidor — vaza dados entre usuários.

### 6.5 Modo demo
- `DemoContext` ativa fixture em `lib/demo-data.ts`. Útil para screenshots/preview Lovable sem credenciais reais.

---

## 7. Deploy

### 7.1 Lovable (sync)
- Push no `main` deste repo → deploy/preview automático no Lovable.
- Edição no Lovable → commit automático aqui (rode `git pull` antes de editar local).

### 7.2 Cloudflare Workers
- `wrangler.jsonc` aponta `main` para `@tanstack/react-start/server-entry`.
- `compatibility_flags = ["nodejs_compat"]` (necessário para o runtime do TanStack Start).
- Build: `npm run build` gera o worker; deploy: `npx wrangler deploy`.
- Secrets: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (idem para as demais runtime vars).

---

## 8. Convenções de código

- **Sem comentários explicativos óbvios.** Só comente *why*, nunca *what*.
- Aliases: importe sempre via `@/...` (NÃO usar caminho relativo `../../`).
- Componentes shadcn em `components/ui/*` são regenerados via `npx shadcn@latest add <componente>` — não edite à mão; se precisar customizar, crie wrapper em `components/`.
- Formatação monetária: SEMPRE usar `<Money />` ou helpers de `lib/format.ts` (respeita moeda do `CurrencyContext`).
- Datas: sempre `date-fns`, locale `pt-BR` quando exibir.
- Tailwind 4: variáveis CSS em `src/styles.css`. Tema dark é default (`<html className="dark">`).
- Não acessar `supabaseAdmin` (client.server.ts) em código que pode rodar no browser.

---

## 9. Operação — checklist para uma IA/dev novo

1. `npm install` (ou `bun install`).
2. Criar `.env` com `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`. Para rodar server functions localmente, também `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. `npm run dev` → http://localhost:8080.
4. Para mudanças de schema: editar SQL em `supabase/migrations/` (novo arquivo com timestamp) → aplicar via `supabase db push` → **regenerar `types.ts`**.
5. Para mudanças em rotas: criar arquivo em `src/routes/` seguindo a convenção `nome.com.pontos.tsx` — `routeTree.gen.ts` atualiza sozinho.
6. Para componentes novos: shadcn primeiro (`npx shadcn@latest add ...`), wrapper depois.
7. Antes de commitar: `npm run lint && npm run format`.
8. Para alterar uma edge function: editar `supabase/functions/<name>/index.ts` → `supabase functions deploy <name>`.
9. **Nunca** commitar `.env`, service role key, ou tokens.
10. **Sempre** `git pull` antes de editar — Lovable empurra commits sem aviso.

---

## 10. Troubleshooting

| Sintoma                                              | Causa provável / fix                                                                 |
|------------------------------------------------------|---------------------------------------------------------------------------------------|
| `Missing Supabase environment variable(s)`           | Faltam `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` no `.env` ou no Lovable.   |
| Loop infinito de redirect no login                   | `profile` carregando — verifique se o user tem linha em `profiles` (trigger de signup). |
| RLS `permission denied`                              | Policy faltando ou usando subquery em `profiles` (use `has_role()` em vez disso).     |
| `Duplicate plugin` no Vite                           | Adicionou tanstackStart/viteReact/tailwindcss manualmente em `vite.config.ts`. Remova — o plugin Lovable já inclui. |
| Rota nova não aparece                                | Salve o arquivo de rota; `router-plugin` regenera `routeTree.gen.ts`. Se persistir, delete o gen e rode `npm run dev`. |
| `Unauthorized: No authorization header` em server fn | Cliente esqueceu de chamar via `auth-attacher` — use os helpers padrão.                |
| Dados vazando entre SSR requests                     | Algum lugar guardou `QueryClient` em módulo. Use sempre o que vem do `getRouter()`.   |
| `nodejs_compat` error na Cloudflare                  | Verifique `compatibility_flags` em `wrangler.jsonc`.                                  |

---

## 11. Links

- Repo: https://github.com/renanlima/matrix-wealth-flow-47
- Lovable project: (acessível pelo dono via dashboard Lovable)
- Supabase dashboard: https://supabase.com/dashboard/project/xliplxqwvvtmgfovznzf
- TanStack Start docs: https://tanstack.com/start
- shadcn/ui: https://ui.shadcn.com
