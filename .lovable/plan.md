## Modo DEMO — Overlay visual no admin

Toggle nas Configurações que troca os dados visíveis no painel admin por um dataset fictício e otimista de 3 meses, **sem inserir nada no banco**. Ideal para apresentações.

---

### 1. Como funciona (UX)

- Nova rota **`/admin/configuracoes`** (item no menu lateral, ícone Settings) com um card "Modo DEMO":
  - Switch grande "Ativar modo demonstração"
  - Texto explicativo: "Substitui os dados reais por um dataset fictício otimista (3 meses, 3 clientes, 4 fundos, ~15 ativos). Nenhum dado real é alterado."
  - Botão "Resetar dados demo" (regenera com novo seed se quiser variar).
- **Badge "MODO DEMO"** persistente no header do AppShell (cor warning, pulsante) sempre que ativo, em qualquer rota admin.
- Estado em `localStorage` (`demo_mode_enabled`) — persiste entre sessões e sincroniza entre abas.
- **Não afeta o painel do cliente** (`/app/*`) nem o banco.

---

### 2. Dataset gerado (determinístico)

Função `generateDemoData(seed)` em `src/lib/demo-data.ts` produz:

**3 clientes:**
- Aurora Capital (Mariana Souza)
- BlueRidge Wealth (Carlos Mendes)
- Helix Family Office (Fernanda Lopes)

**4 fundos** (alguns clientes têm 2):
- Aurora Cripto Core, Aurora RF USD, BlueRidge Hedge, Helix Diversificado

**~15 holdings ativas** distribuídas: BTC, ETH, SOL, BNB, AVAX, LINK, MATIC, ARB, DOT, ADA + 3 RF (Treasury 6m, Corporate AAA, Stablecoin yield).

**3 meses de histórico:**
- ~12 depósitos (entre $20k–$200k cada, distribuídos nos 90 dias)
- ~5 saques pequenos
- ~6 realizações (sempre com lucro, +8% a +25%)
- 3 fechamentos mensais positivos (+4% a +9% ao mês)
- Cotações com "última atualização" recente

**Tom otimista realista:** P&L total não realizado ~+22% no trimestre; 1-2 posições com perda pequena (–3% a –5%) para parecer real; AUM agregado ~$3.5M–$4.5M.

Tudo gerado a partir de um seed fixo (ou aleatório quando o admin clicar "Resetar"), com PRNG simples (mulberry32) — mesma entrada produz mesma saída, sem dependências.

---

### 3. Onde o overlay se aplica

Apenas leitura (substitui o retorno das `useQuery` quando `demo === true`):

| Rota | O que troca |
|------|-------------|
| `/admin` (Dashboard) | Stats completas: KPIs, gráficos AUM/moeda/cashflow, top movers, alertas zerados |
| `/admin/clientes` | Lista dos 3 clientes demo |
| `/admin/clientes/$id` | Aceita só os 3 IDs demo (uuid fixos `demo-1/2/3`); mostra fundos, caixa, lançamentos |
| `/admin/clientes/$id/fundos/$fundId` | Holdings + realizações do fundo demo |
| `/admin/cotacoes` | Mostra preços demo (15 moedas, todos "atualizados há 2min") |

Onboarding guide marca todos os 6 passos como ✓ no modo demo.

**Sem alterações em:** `/app/*` (cliente real continua vendo seus dados), mural, documentos, futuros, edge functions.

---

### 4. Arquivos

**Criar:**
- `src/contexts/DemoContext.tsx` — provider + `useDemo()` hook + sync entre abas via `storage` event
- `src/lib/demo-data.ts` — `generateDemoData(seed)`, `getDemoStats()`, `getDemoClients()`, `getDemoClientDetail(id)`, `getDemoFundDetail(fundId)`, `getDemoPrices()`
- `src/routes/admin.configuracoes.tsx` — página com switch e descrição

**Editar:**
- `src/router.tsx` ou `src/routes/__root.tsx` — envolver app em `<DemoProvider>` (junto ao QueryClientProvider)
- `src/routes/admin.tsx` — adicionar item "Configurações" no `navItems`
- `src/components/AppShell.tsx` — badge "MODO DEMO" pulsante quando ativo
- `src/routes/admin.index.tsx` — `useQuery` lê `demo` e usa `getDemoStats()`; `OnboardingGuide` recebe state com tudo `true`
- `src/routes/admin.clientes.index.tsx` — overlay na lista
- `src/routes/admin.clientes.$clientId.index.tsx` — overlay no detalhe (aceita `demo-1/2/3`)
- `src/routes/admin.clientes.$clientId.fundos.$fundId.tsx` — overlay no fundo
- `src/routes/admin.cotacoes.tsx` — overlay nas cotações

---

### 5. Detalhes técnicos

- **Cache invalidation**: incluir `demo` no `queryKey` (ex: `["admin", "stats", { demo }]`) para que ao alternar o toggle as queries refaçam imediatamente sem refetch real.
- **Tipagem**: o gerador retorna exatamente os mesmos shapes do `Stats`, `ClientRow` etc. — zero alteração nos componentes que consomem.
- **Sem dependências novas**.
- **Sem migrations / sem secrets / sem edge functions**.
- **Performance**: dataset é puro JS in-memory, ~50ms para gerar; memorizado por seed.
- **Seed default** = `42` (estável); botão "Resetar" gera um novo seed aleatório e salva em `localStorage`.

---

### 6. Fora de escopo

- Modo demo no painel do cliente (`/app/*`) — pode vir depois.
- Persistir progresso da apresentação (qual cliente foi mostrado).
- Snapshot/comparação entre datasets.

Posso implementar?
