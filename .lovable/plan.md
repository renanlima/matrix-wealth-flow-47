## Diagnóstico — por que está lento hoje

Após auditar `src/router.tsx`, `__root.tsx`, `AuthGate`, `AppShell` e as 14 rotas, identifiquei 6 gargalos reais que causam a lentidão percebida ao trocar de página:

1. **Sem preload de rotas.** O router está com `defaultPreloadStaleTime: 0` mas sem `defaultPreload: "intent"`. Resultado: cada clique baixa o chunk da rota só depois do clique → atraso de 200–600ms visível antes do skeleton aparecer.
2. **Sem cache entre navegações.** Toda página usa `useEffect + useState` e refaz todas as queries do Supabase ao remontar (ex.: voltar para `/admin/clientes` recarrega a lista do zero, mesmo que tenha sido aberta há 2s). O `@tanstack/react-query` está instalado mas **não está sendo usado**.
3. **`AuthGate` bloqueia renderização** com spinner em tela cheia até `profile` chegar — em cada rota filha de `/admin` e `/app`. Isso causa um "flash de loader" a cada navegação interna, mesmo já estando logado.
4. **Bibliotecas pesadas no bundle inicial:** `jspdf` + `html2canvas` (~400KB gz) são importadas no topo de `src/lib/pdf.ts`, que é importado por `app.relatorios.tsx`. Ao entrar em `/app/relatorios` puxa essas libs mesmo quem não vai exportar PDF.
5. **Recharts no dashboard inicial** (`/app`) — biblioteca grande, deveria ser lazy.
6. **Queries N+1 e excesso de dados:** `admin.index.tsx` busca *todas* as `holdings`, *todas* as `coin_prices`, *todos* os `deposits/withdrawals` para somar no cliente — paginação default de 1000 linhas vai estourar com volume real. O mesmo padrão se repete em `app.index.tsx`.

---

## Plano de otimização (1 fase, sem mudar schema)

### A. Router — preload no hover e cache curto

Em `src/router.tsx`:
- Adicionar `defaultPreload: "intent"` (baixa o JS da rota no hover/touchstart, ~50ms antes do clique).
- Trocar `defaultPreloadStaleTime: 0` por `defaultPreloadStaleTime: 30_000` (mantém dados pré-carregados frescos por 30s).
- Adicionar `defaultStaleTime: 10_000` para SWR de loaders.

**Impacto:** clique → render praticamente instantâneo em rotas já visitadas, e ~150ms mais rápido em rotas novas.

### B. Introduzir TanStack Query (já instalado) para cache de dados

- Criar `src/lib/queryClient.ts` com `QueryClient` (staleTime 30s, gcTime 5min).
- Envolver `<RootComponent>` com `<QueryClientProvider>`.
- Migrar as 6 rotas mais navegadas para `useQuery`:
  - `admin.index.tsx`, `admin.clientes.index.tsx`, `admin.cotacoes.tsx`
  - `app.index.tsx`, `app.fundos.tsx`, `app.documentos.tsx`
- Cada query com `queryKey` baseado em `user.id`/filtros, sem refetch automático em foco.

**Impacto:** voltar para uma página já visitada renderiza com dados em cache em <50ms; refetch em background.

### C. Lazy-load das libs pesadas

- Em `src/lib/pdf.ts` converter para função que faz `await import("jspdf")` e `await import("html2canvas")` dentro do handler. Mantém a mesma API exportada.
- Em `app.index.tsx` e `app.relatorios.tsx`, importar Recharts via `lazy()` + `<Suspense>`, ou criar um wrapper `ChartLazy.tsx`.

**Impacto:** bundle inicial do `/app` cai ~500KB; primeira pintura mais rápida e navegação entre páginas mais leve.

### D. AuthGate sem flash de spinner

- Mover a checagem de auth para `beforeLoad` das rotas pai `/admin` e `/app` usando `context.auth` (configurado no `router` a partir do `AuthContext` via um pequeno hook que injeta).
- Como alternativa minimamente invasiva: deixar `AuthGate` renderizar `children` imediatamente quando `session && profile` já existem em memória (não esperar `loading`), e só mostrar spinner no primeiro carregamento da app.

**Impacto:** acaba o "piscar" cinza ao trocar de aba do menu.

### E. Reduzir payload das queries pesadas

- `admin.index.tsx`: substituir `select("symbol, price_usd")` filtrando por `.in("symbol", symbolsAtivos)` — só busca preços das moedas que aparecem em holdings.
- Trocar somatórios `deposits/withdrawals` (busca todas as linhas) por uma RPC `get_admin_aum()` (`SECURITY DEFINER`, retorna 1 linha com totais agregados). Sem alterar tabelas — só adiciona função.
- Mesmo padrão para `app.index.tsx` → RPC `get_client_dashboard(user.id)`.

**Impacto:** payload de ~centenas de KB cai para <5KB, e o tempo de query no Postgres cai ~10×.

### F. Pequenos ajustes de UX percebida

- Adicionar `<Link preload="intent">` (herdado do default já cobre).
- Skeletons em vez de `Loader2` centralizado (a estrutura aparece imediatamente).
- Memoizar componentes pesados de tabela com `React.memo`.

---

## Ordem de execução sugerida

1. Router defaults + lazy-load de jspdf/html2canvas/recharts (5 min, ganho imediato).
2. QueryClient + migração das 6 rotas principais (~30 min).
3. AuthGate sem flash (~10 min).
4. RPCs de agregação para dashboards (~20 min, requer 1 migration só com `CREATE FUNCTION`).
5. Skeletons substituindo spinners (~15 min).

## Detalhes técnicos

```text
Hoje:       click ──> chunk fetch (300ms) ──> query (400ms) ──> render
Depois:     hover ──> chunk preload (em paralelo)
            click ──> render skeleton (instant) ──> query/cache ──> swap
```

Sem alteração de schema; apenas: adicionar `CREATE FUNCTION get_admin_aum()` e `get_client_dashboard(uuid)` (`SECURITY DEFINER`, `STABLE`, search_path travado).

**Resultado esperado:** navegação entre páginas do menu cai de ~700–1500ms para <100ms (cache hit) ou ~250ms (cold).

Posso começar pela etapa 1+2 e medir antes de seguir para RPCs?
