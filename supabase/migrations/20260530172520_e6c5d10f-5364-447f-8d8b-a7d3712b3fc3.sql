
-- 1. Prevent privilege escalation via profile self-update
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = 'client'::app_role);

-- 2. Recreate client_funds view as SECURITY DEFINER with explicit access scoping
DROP VIEW IF EXISTS public.client_funds;
CREATE VIEW public.client_funds
WITH (security_invoker = false) AS
SELECT id, client_id, name, status, start_date, end_date, notes, created_at, updated_at
FROM public.funds
WHERE client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role);

GRANT SELECT ON public.client_funds TO authenticated;

-- 3. Recreate client_performance_history with scoping; expose taxa/base (already shown
--    in UI) but never deficit_anterior_usd / novo_deficit_usd
DROP VIEW IF EXISTS public.client_performance_history;
CREATE VIEW public.client_performance_history
WITH (security_invoker = false) AS
SELECT ph.id, ph.fund_id, ph.year, ph.month,
       ph.patrimonio_inicio_usd, ph.patrimonio_fim_usd,
       ph.alocacoes_usd, ph.desalocacoes_usd, ph.lucro_bruto_usd,
       ph.taxa_aplicada_usd, ph.base_calculo_usd,
       ph.fechado_em, ph.created_at
FROM public.performance_history ph
WHERE EXISTS (
  SELECT 1 FROM public.funds f
  WHERE f.id = ph.fund_id
    AND (f.client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

GRANT SELECT ON public.client_performance_history TO authenticated;

-- 4. Remove client direct SELECT on sensitive tables — clients must use views
DROP POLICY IF EXISTS "Client views own funds" ON public.funds;
DROP POLICY IF EXISTS "Client views own performance" ON public.performance_history;

-- 5. Tighten SECURITY DEFINER function execute grants (revoke anon)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.realize_partial(uuid, numeric, numeric, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger_func() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realize_partial(uuid, numeric, numeric, date, text) TO authenticated;
