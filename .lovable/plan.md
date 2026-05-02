# Correções e Logo Matrix

## 1. Corrigir erro "Could not find an active match from /admin/clientes/$clientId"

**Causa:** O arquivo `admin.clientes.$clientId.index.tsx` está registrado como índice da rota `/admin/clientes/$clientId/` (com barra final, ID gerado pelo TanStack). O hook `useParams({ from: "/admin/clientes/$clientId" })` aponta para um ID inexistente, lançando o invariant.

**Correção:** Trocar o `from` na linha 45 de `src/routes/admin.clientes.$clientId.index.tsx` para `"/admin/clientes/$clientId/"` (com barra final).

## 2. Incluir a logo "MATRIX DIGITAL ASSETS"

A logo enviada (Screenshot_1.jpg) será adicionada como asset oficial e exibida em dois locais.

**Passos:**
1. Copiar `user-uploads://Screenshot_1.jpg` para `src/assets/matrix-logo.png` (asset versionado).
2. **Login (`src/routes/login.tsx`)**: substituir o bloco atual `<img>+span "MATRIX"` no `CardHeader` por um `<img src={matrixLogo}>` maior (h-16, centralizado), removendo o texto duplicado (a logo já contém "MATRIX DIGITAL ASSETS"). Manter `CardTitle` como subtítulo de boas-vindas ou removê-lo para não duplicar.
3. **Dashboard (`src/components/AppShell.tsx`)**:
   - Sidebar (desktop): substituir o cabeçalho atual (logo pequena + textos "MATRIX" / título) pela logo nova ocupando toda a largura útil (h-12, object-contain). Manter abaixo apenas o subtítulo do contexto ("Painel Admin" / "Área do Cliente").
   - Header mobile: trocar o ícone + "MATRIX" pela logo em altura reduzida (h-8).

## Arquivos alterados

- `src/assets/matrix-logo.png` (novo)
- `src/routes/admin.clientes.$clientId.index.tsx` (linha 45)
- `src/routes/login.tsx` (cabeçalho do card)
- `src/components/AppShell.tsx` (sidebar e header mobile)

## Fora de escopo

- Não trocar `public/logo.png` (favicon e og:image continuam como estão).
- Sem mudanças no banco, edge functions ou autenticação.
