
-- =========================================================
-- VIEWS read-only para o cliente (omitem dados sensíveis)
-- =========================================================

-- 1) Funds sem taxa nem déficit (RLS herda da tabela base)
CREATE OR REPLACE VIEW public.client_funds
WITH (security_invoker = true) AS
SELECT
  id,
  client_id,
  name,
  status,
  start_date,
  end_date,
  notes,
  created_at,
  updated_at
FROM public.funds;

-- 2) Performance histórica sem taxa/déficit/base_calculo
CREATE OR REPLACE VIEW public.client_performance_history
WITH (security_invoker = true) AS
SELECT
  id,
  fund_id,
  year,
  month,
  patrimonio_inicio_usd,
  patrimonio_fim_usd,
  alocacoes_usd,
  desalocacoes_usd,
  lucro_bruto_usd,
  fechado_em,
  created_at
FROM public.performance_history;

GRANT SELECT ON public.client_funds TO authenticated;
GRANT SELECT ON public.client_performance_history TO authenticated;

-- =========================================================
-- STORAGE POLICIES
-- Buckets já existentes: contracts, receipts, invoices, futures, mural
-- Convenção de pastas: <client_id>/<filename>
-- =========================================================

-- Limpa policies antigas (idempotente)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'mda_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- ADMIN: controle total nos buckets do app
CREATE POLICY "mda_admin_all_buckets"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id IN ('contracts','receipts','invoices','futures','mural')
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id IN ('contracts','receipts','invoices','futures','mural')
  AND public.has_role(auth.uid(), 'admin')
);

-- CLIENTE: leitura dos próprios arquivos (pasta = uid)
CREATE POLICY "mda_client_read_own_files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('contracts','receipts','invoices','futures')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Mural: qualquer autenticado lê
CREATE POLICY "mda_authenticated_read_mural"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'mural');

-- =========================================================
-- pg_cron schedules
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotência: remove jobs anteriores com o mesmo nome
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobname FROM cron.job
           WHERE jobname IN (
             'mda-update-coin-prices-daily',
             'mda-update-fx-rates-daily',
             'mda-close-monthly-performance'
           )
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

-- Cotações de cripto — diário 10:00 UTC
SELECT cron.schedule(
  'mda-update-coin-prices-daily',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xliplxqwvvtmgfovznzf.supabase.co/functions/v1/update-coin-prices',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Câmbio USD/BRL — diário 10:05 UTC
SELECT cron.schedule(
  'mda-update-fx-rates-daily',
  '5 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xliplxqwvvtmgfovznzf.supabase.co/functions/v1/update-fx-rates',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Fechamento mensal — dia 1, 03:00 UTC
SELECT cron.schedule(
  'mda-close-monthly-performance',
  '0 3 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://xliplxqwvvtmgfovznzf.supabase.co/functions/v1/close-monthly-performance',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
