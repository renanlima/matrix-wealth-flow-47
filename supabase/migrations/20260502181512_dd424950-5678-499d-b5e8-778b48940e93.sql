-- Cron diário para atualizar yields de rendimentos alternativos
SELECT cron.schedule(
  'update-fixed-income-prices-daily',
  '10 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xliplxqwvvtmgfovznzf.supabase.co/functions/v1/update-fixed-income-prices',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsaXBseHF3dnZ0bWdmb3Z6bnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MjkxODMsImV4cCI6MjA5MzMwNTE4M30.xsOllyH0bXKUCmPZ2k2y5wmRr9erPEOcVullaYlDIgw"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);