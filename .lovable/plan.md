## Melhorias de UX e Dashboard Analítico

Plano dividido em 3 frentes: navegação/clique, dashboard do gestor com mais analytics, e refinamentos no app do cliente.

---

### 1. Navegação clicável (linha inteira)

**Problema:** hoje só o botão "Abrir" navega. Linha inteira deveria ser clicável.

**Onde aplicar:**
- `admin/clientes` → linha do cliente abre detalhe (cursor-pointer + hover)
- `admin/clientes/$clientId` aba Fundos → linha do fundo abre detalhe
- `app/fundos` → header do card do fundo expande/colapsa posições
- Manter botão "Abrir" como affordance visual, mas a linha inteira recebe `onClick` + `role="button"` + `cursor-pointer` + foco por teclado (`Enter`/`Space`).

---

### 2. Dashboard Admin — mais dados analíticos

Hoje só temos 4 KPIs (AUM, clientes, posições, último preço). Vou adicionar:

**Novos KPIs (linha 2):**
- **Caixa total USD** (depósitos − saques − custo de holdings + realizações)
- **Lucro não realizado** (market − custo das holdings ativas) com % e cor
- **Lucro realizado MTD** (realizações no mês corrente)
- **Net flow 30d** (depósitos − saques nos últimos 30 dias)

**Gráficos:**
- **AUM por cliente** (bar chart horizontal, top 10) — identifica concentração
- **Distribuição por moeda** (pie chart consolidado da gestora)
- **Movimentação de caixa últimos 90 dias** (área chart: depósitos vs saques por dia)
- **Top 5 maiores ganhos/perdas não realizados** (lista com cliente, moeda, P&L)

**Alertas operacionais (card):**
- Cotações desatualizadas (>24h)
- Erros recentes em `coin_price_errors` (contagem últimas 24h)
- Fundos sem fechamento de performance no mês passado
- Clientes sem movimentação há >90 dias

**Atalhos rápidos:** "Novo cliente", "Atualizar cotações", "Publicar no mural" como botões no topo.

---

### 3. UX geral — Admin

- **Busca/filtro na lista de clientes** (input com debounce filtrando por nome/email)
- **Ordenação clicável** nos cabeçalhos das tabelas (clientes, fundos, caixa)
- **Empty states melhores** com CTA inline ("Nenhum cliente cadastrado → [Novo cliente]")
- **Confirmação destrutiva via AlertDialog** em vez de `confirm()` nativo (remover lançamento, deletar holding) — mais elegante e acessível
- **Badge de status** (componente `Badge`) em vez de span colorido para "ativo/encerrado/ativa"
- **Breadcrumbs** no detalhe do cliente: `Clientes › Nome › Fundos › Nome do fundo`
- **Toasts com ação "Desfazer"** após exclusão de lançamento de caixa (5s)
- **Atalhos de teclado:** `/` foca busca, `n` abre "novo" no contexto da página, `Esc` fecha dialogs (já nativo)
- **Sticky header** na sidebar e nas tabs internas do cliente (já longas)

---

### 4. UX geral — Cliente

- **Card resumo no topo do `/app/fundos`** com total agregado (patrimônio, custo, P&L %) — hoje só vê por fundo
- **Toggle "Mostrar encerradas"** nas posições (hoje mistura ativas e encerradas sem filtro)
- **Sparkline 24h** ao lado de cada moeda no dashboard usando `percent_change_24h`
- **Última atualização** visível também no `/app/fundos` e `/app/rendimentos`
- **Indicador de variação no KPI** "Patrimônio total" (ex: "+2.3% nas últimas 24h" estimado pelas posições)
- **Skeleton loaders** nos cards/tabelas durante fetch (em vez de tela vazia)
- **Botão "Exportar PDF"** no header do dashboard do cliente (já existe `lib/pdf.ts`)

---

### 5. Acessibilidade & polimento

- `aria-label` em botões só com ícone (lixeira, refresh)
- Foco visível consistente (`focus-visible:ring-primary`)
- Tabelas com `<caption>` para screen readers
- Reduzir layout shift: reservar altura mínima nos cards de KPI

---

### Detalhes técnicos

**Arquivos a editar:**
- `src/routes/admin.index.tsx` — adicionar KPIs, gráficos (recharts já instalado), alertas, atalhos
- `src/routes/admin.clientes.index.tsx` — linha clicável, busca, ordenação, empty state
- `src/routes/admin.clientes.$clientId.index.tsx` — linha clicável em Fundos, AlertDialog para exclusão, breadcrumbs, toast undo
- `src/routes/app.index.tsx` — variação 24h, skeleton, botão PDF
- `src/routes/app.fundos.tsx` — card resumo agregado, toggle encerradas, skeleton
- `src/components/AppShell.tsx` — atalhos de teclado globais (opcional)
- Novo: `src/components/ui/data-table-row.tsx` — wrapper `<TableRow>` clicável reutilizável
- Novo: `src/components/admin/AdminAnalytics.tsx` — gráficos do dashboard (separa lógica pesada)

**Sem migrations** — toda análise é derivada das tabelas existentes (`deposits`, `withdrawals`, `holdings`, `realizations`, `coin_prices`, `coin_price_errors`, `performance_history`, `funds`).

**Performance:** consultas agregadas no React Query com `staleTime: 60s` (já padrão pós-refactor de velocidade); novo dashboard fará 1 batch de `Promise.all` igual ao atual, só com mais selects.

---

### Ordem de execução

1. Linha clicável + busca/ordenação em listas (impacto alto, esforço baixo)
2. Dashboard admin analítico (novos KPIs, gráficos, alertas)
3. AlertDialog de exclusão + breadcrumbs + skeletons
4. Refinamentos do app do cliente (resumo agregado, toggle encerradas, sparklines)
5. Acessibilidade e atalhos de teclado

Posso seguir com essa ordem ou você prefere priorizar alguma frente?
