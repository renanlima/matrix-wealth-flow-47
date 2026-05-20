## Diagnóstico

A rota cliente `src/routes/app.fundos_.$fundId.extrato.tsx` é tratada pelo TanStack Router como **filha** de `src/routes/app.fundos_.$fundId.tsx` (mesmo prefixo `app.fundos_.$fundId`). O componente pai (`ClientFundDetail`) **não renderiza `<Outlet />`**, então quando o usuário clica em "Extrato":

- A URL muda para `/app/fundos/{id}/extrato` ✓
- O match acontece, mas o componente `ClientExtrato` (e portanto `<ExtratoFundo>`) nunca monta — fica visível só a página do fundo.
- Resultado prático: "não puxa nada" e o botão "Voltar aos fundos" do extrato nem aparece (o usuário vê o botão da página de detalhe do fundo).

O lado admin não tem esse problema porque o arquivo já usa o sufixo `_` para escapar do nesting: `admin.clientes.$clientId.fundos.$fundId_.extrato.tsx`.

## Correção (mesmo padrão do admin)

1. Renomear `src/routes/app.fundos_.$fundId.extrato.tsx` → `src/routes/app.fundos_.$fundId_.extrato.tsx` (adiciona `_` em `$fundId` para desnestar do detalhe do fundo).
2. Dentro do arquivo:
   - `createFileRoute("/app/fundos_/$fundId/extrato")` → `createFileRoute("/app/fundos_/$fundId_/extrato")`
   - `useParams({ from: "/app/fundos_/$fundId/extrato" })` → idem com `$fundId_`
3. Em `src/routes/app.fundos.tsx`, atualizar o `<Link>` do botão "Extrato":
   - `to="/app/fundos_/$fundId/extrato"` → `to="/app/fundos_/$fundId_/extrato"`
4. `src/routeTree.gen.ts` é regenerado pelo plugin do Vite — não editar manualmente.

A URL pública final continua `/app/fundos/{id}/extrato`. O botão "Voltar aos fundos" no `ClientExtrato` já aponta para `/app/fundos` e voltará a funcionar assim que o componente passar a montar.

## Fora do escopo

- Nenhuma mudança em `ExtratoFundo`, em `extrato.ts`, no admin, na migração SQL, ou no `app.fundos_.$fundId.tsx`. Só roteamento.