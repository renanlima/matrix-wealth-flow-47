
-- Funções de trigger / sistema: revoga EXECUTE de anon e authenticated
REVOKE EXECUTE ON FUNCTION public.audit_trigger_func() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, int) FROM PUBLIC, anon;

-- check_rate_limit pode ser chamada por authenticated (admin protegido por role check no caller)
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int) TO authenticated;

-- has_role permanece executável para verificações de RLS/UI
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
