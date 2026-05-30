# Security Memory

## App overview
Wealth-management app with two roles: `admin` (Matrix team) and `client`.
Admins manage funds, holdings, deposits/withdrawals, and monthly performance
closures. Clients read their own portfolio and statements.

Roles live in `public.profiles.role` (app_role enum). RLS uses
`public.has_role(uid, role)` SECURITY DEFINER helper. Client-only views
(`client_funds`, `client_performance_history`) are SECURITY DEFINER views
that filter by `auth.uid()` (or admin) and intentionally omit sensitive
fee / deficit fields.

## What must never happen
- A client must never set their own `profiles.role` to `admin`.
  Enforced by `Users can update own profile` policy WITH CHECK clause.
- Clients must never read these columns from the base tables:
  - `funds.performance_fee_pct`, `funds.carried_deficit_usd`
  - `performance_history.deficit_anterior_usd`, `performance_history.novo_deficit_usd`
  Direct client SELECT on `funds` and `performance_history` is revoked; access
  is only through the scoped views above.
- Edge function `update-client` and `realize_partial` RPC must verify
  caller is admin before performing privileged writes.

## Accepted risks / intentional design
- `client_funds` and `client_performance_history` are SECURITY DEFINER views
  on purpose — they implement the column-level restriction the linter cannot
  express otherwise. Each view filters by `auth.uid()` or admin role.
- `has_role`, `check_rate_limit`, `realize_partial` remain SECURITY DEFINER
  callable by `authenticated`. `has_role` powers RLS, the others self-check
  the caller.
- Extensions installed in `public` schema are kept there (pg_net / pgcrypto)
  to avoid breaking dependent triggers and edge functions.
