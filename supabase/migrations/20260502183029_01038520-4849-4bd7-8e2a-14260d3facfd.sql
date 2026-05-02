
-- =========================================================
-- AUDIT LOG
-- =========================================================
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  client_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log (actor_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_client ON public.audit_log (client_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log"
  ON public.audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- INSERT só via trigger (sem policy de INSERT para usuários)

-- Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_email text;
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_entity_id uuid;
  v_client_id uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;
  ELSE
    v_email := 'system';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_entity_id := (to_jsonb(NEW)->>'id')::uuid;
    v_client_id := NULLIF(to_jsonb(NEW)->>'client_id','')::uuid;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_entity_id := (to_jsonb(NEW)->>'id')::uuid;
    v_client_id := NULLIF(to_jsonb(NEW)->>'client_id','')::uuid;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_entity_id := (to_jsonb(OLD)->>'id')::uuid;
    v_client_id := NULLIF(to_jsonb(OLD)->>'client_id','')::uuid;
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, entity_id, client_id, before, after)
  VALUES (v_actor, v_email, v_action, TG_TABLE_NAME, v_entity_id, v_client_id, v_before, v_after);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.audit_trigger_func() IS 'Generic audit trigger. Captures actor via auth.uid(); falls back to system for service-role calls.';

-- Anexa triggers nas 12 tabelas
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clients','funds','holdings','realizations',
    'deposits','withdrawals','fixed_income',
    'contracts','receipts','invoices',
    'futures_records','mural_posts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();',
      t, t
    );
  END LOOP;
END $$;

-- =========================================================
-- JOB RUNS (observabilidade de cron / edge functions)
-- =========================================================
CREATE TABLE public.job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running','success','partial','failed')),
  message text,
  items_processed int DEFAULT 0,
  items_failed int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_runs_job_started ON public.job_runs (job_name, started_at DESC);
CREATE INDEX idx_job_runs_status ON public.job_runs (status);

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read job runs"
  ON public.job_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- COIN PRICE ERRORS
-- =========================================================
CREATE TABLE public.coin_price_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  error_message text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coin_price_errors_occurred ON public.coin_price_errors (occurred_at DESC);
CREATE INDEX idx_coin_price_errors_symbol ON public.coin_price_errors (symbol);

ALTER TABLE public.coin_price_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read coin_price_errors"
  ON public.coin_price_errors FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- RATE LIMIT LOG
-- =========================================================
CREATE TABLE public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_user_action_time ON public.rate_limit_log (user_id, action, occurred_at DESC);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read rate_limit_log"
  ON public.rate_limit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Helper: verifica e registra (retorna true se OK, false se excedeu)
CREATE OR REPLACE FUNCTION public.check_rate_limit(_action text, _max_per_minute int DEFAULT 30)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_log
  WHERE user_id = v_user
    AND action = _action
    AND occurred_at > now() - interval '1 minute';

  IF v_count >= _max_per_minute THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_log (user_id, action) VALUES (v_user, _action);
  RETURN true;
END;
$$;

-- Limpeza periódica do rate_limit_log
SELECT cron.schedule(
  'cleanup-rate-limit-log',
  '*/15 * * * *',
  $$ DELETE FROM public.rate_limit_log WHERE occurred_at < now() - interval '1 hour'; $$
);

-- =========================================================
-- DOCUMENTAÇÃO DA DECISÃO DE LINTER (rodada 2)
-- =========================================================
COMMENT ON EXTENSION pg_cron IS
  'Mantida no schema public por padrão da Lovable Cloud / Supabase gerenciado. Mover para schema extensions exigiria acesso de superuser que o ambiente gerenciado não expõe. Risco aceito: aviso informativo do linter, sem impacto de segurança real.';

COMMENT ON EXTENSION pg_net IS
  'Mantida no schema public por padrão da Lovable Cloud / Supabase gerenciado. Mesmo motivo de pg_cron.';

COMMENT ON FUNCTION public.handle_new_user() IS
  'SECURITY DEFINER necessário porque é chamado pelo trigger on_auth_user_created (schema auth) com privilégios mínimos. search_path explicitamente fixado em public; a função apenas insere em profiles com role default client.';
