
## Diagnóstico

1. **Admin não existe**: `SELECT FROM auth.users` retornou vazio. A migration anterior criou o schema, RLS e o trigger `handle_new_user`, mas nenhum usuário foi inserido. Por isso o login `webrenanlima@gmail.com / Renan!373**` devolve `invalid_credentials`.
2. **Permission denied para `has_role`**: a função foi criada como `SECURITY DEFINER` mas sem `GRANT EXECUTE` para `anon` / `authenticated`. Toda query em tabela com policy que chama `has_role()` quebra com 401 quando o PostgREST tenta avaliar a policy.
3. **`CurrencyContext` busca `fx_rates` na tela de login**, sem sessão. Mesmo com a permissão corrigida, a policy de `fx_rates` exige `authenticated` no SELECT — então essa fetch precisa ser adiada até haver usuário logado.

## Correções

### 1. Edge function `seed-admin` (one-shot)
Criar `supabase/functions/seed-admin/index.ts` que:
- Usa `SUPABASE_SERVICE_ROLE_KEY` para chamar `auth.admin.createUser` com:
  - email: `webrenanlima@gmail.com`
  - password: `Renan!373**`
  - `email_confirm: true` (login imediato sem verificação)
  - `user_metadata: { full_name: "Renan Lima" }`
- Após criar, faz `UPDATE public.profiles SET role = 'admin' WHERE id = <novo_id>` (o trigger `handle_new_user` já cria o profile com role `client`).
- Idempotente: se já existir, apenas garante `role = 'admin'`.
- `verify_jwt = false` no `config.toml` para poder ser chamada uma vez sem sessão.

Disparar via `curl_edge_functions` logo após o deploy.

### 2. Migration de permissões
Nova migration:
```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
```
Isso resolve o 401 `permission denied for function has_role` em todas as tabelas com RLS dependente.

### 3. `CurrencyContext` defensivo
Editar `src/contexts/CurrencyContext.tsx` para:
- Só fazer `supabase.from('fx_rates').select(...)` quando houver `session?.user` (consumir `useAuth()`).
- Enquanto não houver sessão, manter a taxa default (ex.: 5.0) e moeda corrente USD.
- Evita ruído 401 na tela de login e em qualquer rota pública.

### 4. Verificação final
- `SELECT id, email FROM auth.users` deve retornar o admin.
- `SELECT id, role FROM public.profiles` deve mostrar `admin` para o id correspondente.
- Login na UI passa, redireciona para `/admin`.

## Avisos de segurança
- A senha `Renan!373**` foi compartilhada no chat. Recomendo trocar em `Perfil` após o primeiro login.
- A função `seed-admin` deve ser **deletada** (ou ter `verify_jwt` reativado) após o seed para não permitir re-criação por terceiros. Posso remover automaticamente após confirmar que o admin existe.

## Próximo passo
Aprovando este plano, executo na sequência: migration de GRANT → criar+deploy `seed-admin` → invocar a função → patch no `CurrencyContext` → confirmar login → deletar a função de seed.
