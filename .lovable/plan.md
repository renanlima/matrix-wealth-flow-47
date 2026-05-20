# Corrigir botão "Extrato" que não abre

## Diagnóstico

No TanStack Router file-based, segmentos separados por `.` viram **rotas aninhadas**. Os arquivos atuais:

- `src/routes/admin.clientes.$clientId.fundos.$fundId.extrato.tsx` vira filho de `admin.clientes.$clientId.fundos.$fundId.tsx`
- `src/routes/app.fundos.$fundId.extrato.tsx` vira filho de `app.fundos.tsx`

Ambos os pais são páginas finais (sem `<Outlet />`). Quando o usuário clica em **Extrato**, a URL muda, mas o componente filho nunca é montado — o pai continua renderizando seu próprio conteúdo sem outlet. Visualmente parece que "o botão não abre".

O erro no console (`_nonReactive` durante `preloadRoute`) é um efeito colateral do preload em uma árvore inconsistente.

## Correção

Usar a convenção do TanStack de **underscore final** no segmento para "escapar" do aninhamento — a URL fica idêntica, mas a rota deixa de ser filha do layout pai.

### Renomeações

1. `src/routes/admin.clientes.$clientId.fundos.$fundId.extrato.tsx`
   → `src/routes/admin.clientes.$clientId.fundos.$fundId_.extrato.tsx`
   - Atualizar `createFileRoute("/admin/clientes/$clientId/fundos/$fundId_/extrato")`
   - URL final permanece `/admin/clientes/:clientId/fundos/:fundId/extrato`

2. `src/routes/app.fundos.$fundId.extrato.tsx`
   → `src/routes/app.fundos_.$fundId.extrato.tsx`
   - Atualizar `createFileRoute("/app/fundos_/$fundId/extrato")`
   - URL final permanece `/app/fundos/:fundId/extrato`

Os `<Link>` que apontam para essas rotas (no header do fundo admin e no card de fundo do cliente) **não mudam** — TanStack mapeia pelo `id` da rota e os params são os mesmos. A única coisa que pode precisar de ajuste é o `to=` se ele referenciar o id antigo; vou conferir e ajustar para o novo id se necessário.

## Verificação

- Abrir `/admin/clientes/.../fundos/.../extrato` → tela do extrato renderiza completa, sem o cabeçalho do fundo por cima.
- Abrir `/app/fundos/.../extrato` como cliente → mesma coisa.
- Console limpo do erro `_nonReactive` no preload.
