
-- Security definer helper to check fund ownership, bypassing RLS on funds
CREATE OR REPLACE FUNCTION public.user_owns_fund(_fund_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.funds
    WHERE id = _fund_id AND client_id = auth.uid()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.user_owns_fund(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_owns_fund(uuid) TO authenticated;

-- Replace holdings client SELECT policy
DROP POLICY IF EXISTS "Client views own holdings" ON public.holdings;
CREATE POLICY "Client views own holdings"
ON public.holdings FOR SELECT
TO authenticated
USING (public.user_owns_fund(fund_id));

-- Replace realizations client SELECT policy
DROP POLICY IF EXISTS "Client views own realizations" ON public.realizations;
CREATE POLICY "Client views own realizations"
ON public.realizations FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.holdings h
  WHERE h.id = realizations.holding_id
    AND public.user_owns_fund(h.fund_id)
));

-- Same fix for fixed_income (likely affected too)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid='public.fixed_income'::regclass AND polname ILIKE '%client%' LOOP
    EXECUTE format('DROP POLICY %I ON public.fixed_income', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "Client views own fixed_income"
ON public.fixed_income FOR SELECT
TO authenticated
USING (public.user_owns_fund(fund_id));
