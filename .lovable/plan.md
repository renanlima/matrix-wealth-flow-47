Plano de correção:

1. Ajustar as rotas de extrato para manter o arquivo com `_` no nome, mas declarar o path com parâmetro `$fundId`:
   - `/admin/clientes/$clientId/fundos/$fundId/extrato`
   - `/app/fundos_/$fundId/extrato`

2. Ajustar os `useParams` dessas páginas para ler `fundId`, não `fundId_`.

3. Ajustar os links que apontam para o extrato para enviar `params={{ fundId }}` em vez de `fundId_`.

4. Corrigir o botão “Voltar ao fundo” no extrato admin para continuar apontando para `/admin/clientes/$clientId/fundos/$fundId` com o ID correto.

5. Adicionar uma proteção simples no componente `ExtratoFundo`: se `fundId` vier vazio/`undefined`, não executar queries com UUID inválido e mostrar estado vazio/seguro.

Resultado esperado: a URL não terá mais `undefined`, as queries usarão o UUID real do fundo atual, e o extrato carregará movimentações de holdings, renda fixa, performance, aportes e retiradas vinculadas ao fundo.