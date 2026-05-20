ALTER TABLE public.deposits   ADD COLUMN fund_id uuid REFERENCES public.funds(id);
ALTER TABLE public.withdrawals ADD COLUMN fund_id uuid REFERENCES public.funds(id);
CREATE INDEX IF NOT EXISTS deposits_fund_id_idx    ON public.deposits(fund_id);
CREATE INDEX IF NOT EXISTS withdrawals_fund_id_idx ON public.withdrawals(fund_id);