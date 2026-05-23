## Plano

1. **Corrigir a rota admin do extrato**
   - A definição atual ainda está como `/admin/clientes/$clientId/fundos/$fundId_/extrato`, mas o componente tenta ler `/admin/clientes/$clientId/fundos/$fundId/extrato`.
   - Vou ajustar para uma única forma consistente: parâmetro `fundId`, sem underscore.

2. **Corrigir a rota do app/cliente do extrato**
   - A página do cliente tem o mesmo padrão quebrado: rota declarada com `$fundId_`, mas leitura/link usando `$fundId`.
   - Vou alinhar a declaração, o `useParams` e os links.

3. **Renomear arquivos de rota se necessário**
   - O nome do arquivo com `$fundId_` faz o TanStack Router gerar um parâmetro chamado `fundId_`.
   - Para evitar o erro `Could not find an active match`, vou renomear as rotas de extrato para usar `$fundId.extrato.tsx` quando isso for o padrão correto.

4. **Remover links antigos com caminhos incompatíveis**
   - Vou revisar os botões “Extrato” e “Voltar ao fundo” para garantir que todos apontem para rotas existentes.

5. **Não editar `routeTree.gen.ts` manualmente**
   - Esse arquivo é gerado automaticamente. A correção será feita nos arquivos dentro de `src/routes/`, deixando o gerador atualizar a árvore de rotas.

## Resultado esperado

A URL `/admin/clientes/:clientId/fundos/:fundId/extrato` deve abrir sem erro, ler o `fundId` correto e carregar os dados do fundo no extrato.