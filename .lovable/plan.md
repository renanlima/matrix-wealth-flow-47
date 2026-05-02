## Tour interativo do admin — "Comece por aqui"

Um guia passo a passo embutido no painel, focado no fluxo essencial de operação: **cadastrar cliente → criar fundo → lançar depósito → adicionar posição → atualizar cotações → conferir no painel do cliente**.

---

### 1. Como vai funcionar (UX)

- **Card "Comece por aqui"** fixo no topo do `/admin` (Dashboard), logo abaixo do título.
- Mostra os **6 passos** numerados, cada um com:
  - Status (✓ feito / ● em andamento / ○ pendente) — detectado automaticamente nos dados existentes.
  - Título curto + 1 linha de descrição.
  - Botão "Ir agora" que leva direto à tela/ação correspondente.
- **Barra de progresso** no topo (ex: "3 de 6 concluídos").
- **Botão "Ocultar guia"** — quando o admin marca como concluído OU quando todos os 6 passos estão ✓, o card colapsa em um link discreto "Ver guia inicial" no rodapé do dashboard.
- Estado salvo em `localStorage` (chave `admin_onboarding_dismissed`) — não precisa de migration.
- **Tooltip "?" no header do AppShell** (ícone HelpCircle) que reabre o guia a qualquer momento.

---

### 2. Os 6 passos

| # | Passo | Detecção automática (✓) | Ação do botão |
|---|-------|--------------------------|---------------|
| 1 | **Cadastrar o primeiro cliente** | `profiles` com role=client existe | `/admin/clientes` (com foco no botão "Novo cliente") |
| 2 | **Criar um fundo para o cliente** | qualquer registro em `funds` | `/admin/clientes` (abre cliente → aba Fundos) |
| 3 | **Registrar depósito inicial (USD)** | qualquer registro em `deposits` | `/admin/clientes/$id` (aba Caixa) |
| 4 | **Adicionar a primeira posição** (cripto, RF ou futuros) | qualquer `holdings` ativa | `/admin/clientes/$id/fundos/$fundId` |
| 5 | **Atualizar cotações** | `coin_prices.updated_at` < 24h | `/admin/cotacoes` (botão "Atualizar agora") |
| 6 | **Conferir o que o cliente vê** | sempre disponível | abre `/app` em nova aba (ou modo preview) |

Cada passo também tem um pequeno texto de ajuda expansível ("Como faço?") com 2-3 frases explicando o porquê e o que esperar.

---

### 3. Visual e responsividade

- Card com borda destacada (`border-primary/30`) e ícone `Sparkles` no título.
- Layout em **lista vertical** (1 coluna) — funciona bem no viewport atual (1550px) e em mobile.
- Passos concluídos ficam com opacidade 60% e ícone `CheckCircle2` verde.
- Passo "atual" (primeiro pendente) recebe destaque sutil (background `bg-primary/5`).
- Ao terminar todos: card mostra mensagem "Tudo pronto. Bom trabalho!" e o botão "Ocultar guia" vira primário.

---

### 4. Detalhes técnicos

**Novo componente:** `src/components/admin/OnboardingGuide.tsx`
- Recebe os contadores que o `fetchAdminStats` já calcula (`clientCount`, `activeHoldings`, último depósito, `lastPriceUpdate`) — sem queries adicionais.
- Lê/escreve `localStorage` para `dismissed`.
- Usa `<Link>` do TanStack Router para navegação tipada.
- Para o passo 2/3/4 que precisam de um clientId, escolhe o cliente mais recente (`profiles` ordenado por `created_at desc`) ou, se não houver, leva à lista.

**Edição:** `src/routes/admin.index.tsx`
- Renderiza `<OnboardingGuide stats={stats} />` no topo do dashboard, antes dos KPIs.
- Adiciona ao `Stats` os campos faltantes: `firstClientId` (ou null) e `hasDeposit: boolean` — derivados das queries já existentes (sem novo round-trip).

**Edição:** `src/components/AppShell.tsx`
- Adiciona ícone `HelpCircle` no header (apenas para `requireRole=admin`) que dispara um evento custom `reopen-onboarding` ouvido pelo guia (limpa o `localStorage` e força exibição).

**Sem migrations**, **sem novas tabelas**, **sem alterações de RLS**.

---

### 5. Arquivos

- **Criar:** `src/components/admin/OnboardingGuide.tsx`
- **Editar:** `src/routes/admin.index.tsx` (renderizar guia + expor 2 campos extras em Stats)
- **Editar:** `src/components/AppShell.tsx` (botão de ajuda no header admin)

---

### 6. Fora de escopo (para depois, se quiser)

- Tour avançado (documentos, mural, fechamento mensal, saques, realizações, futuros, PDFs).
- Tooltips contextuais flutuantes em cada tela (estilo Intro.js / Shepherd).
- Persistência do progresso no banco (sincroniza entre dispositivos).

Posso seguir com essa implementação?
