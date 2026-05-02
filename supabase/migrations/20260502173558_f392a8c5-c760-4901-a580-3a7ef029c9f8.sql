-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'client');
CREATE TYPE public.fund_status AS ENUM ('ativo', 'encerrado');
CREATE TYPE public.holding_status AS ENUM ('ativa', 'encerrada');

-- =========================================================================
-- TIMESTAMP HELPER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================================
-- PROFILES (1:1 with auth.users)
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'client',
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- has_role SECURITY DEFINER (avoids RLS recursion on profiles)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role
  );
$$;

-- Profile policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'client'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- CLIENTS
-- =========================================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage clients" ON public.clients FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Client views own record" ON public.clients FOR SELECT
  USING (auth.uid() = id);

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- FUNDS
-- =========================================================================
CREATE TABLE public.funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status public.fund_status NOT NULL DEFAULT 'ativo',
  performance_fee_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  carried_deficit_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_funds_client ON public.funds(client_id);
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage funds" ON public.funds FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Client views own funds" ON public.funds FOR SELECT
  USING (client_id = auth.uid());

CREATE TRIGGER trg_funds_updated_at BEFORE UPDATE ON public.funds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- HOLDINGS
-- =========================================================================
CREATE TABLE public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  coin_symbol TEXT NOT NULL,
  coin_name TEXT,
  quantity NUMERIC(28,8) NOT NULL,
  entry_price_usd NUMERIC(20,8) NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_futures BOOLEAN NOT NULL DEFAULT false,
  status public.holding_status NOT NULL DEFAULT 'ativa',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_holdings_fund ON public.holdings(fund_id);
CREATE INDEX idx_holdings_symbol ON public.holdings(coin_symbol);
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage holdings" ON public.holdings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Client views own holdings" ON public.holdings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.funds f WHERE f.id = fund_id AND f.client_id = auth.uid()));

CREATE TRIGGER trg_holdings_updated_at BEFORE UPDATE ON public.holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- REALIZATIONS (always full sale of a holding)
-- =========================================================================
CREATE TABLE public.realizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  exit_price_usd NUMERIC(20,8) NOT NULL,
  exit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_usd NUMERIC(20,2) NOT NULL,
  profit_usd NUMERIC(20,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_realizations_holding ON public.realizations(holding_id);
ALTER TABLE public.realizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage realizations" ON public.realizations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Client views own realizations" ON public.realizations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.holdings h
    JOIN public.funds f ON f.id = h.fund_id
    WHERE h.id = holding_id AND f.client_id = auth.uid()
  ));

-- =========================================================================
-- DEPOSITS / WITHDRAWALS (cash in/out of client USD wallet)
-- =========================================================================
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount_usd NUMERIC(20,2) NOT NULL,
  deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deposits_client ON public.deposits(client_id);
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage deposits" ON public.deposits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Client views own deposits" ON public.deposits FOR SELECT
  USING (client_id = auth.uid());

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount_usd NUMERIC(20,2) NOT NULL,
  withdraw_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_withdrawals_client ON public.withdrawals(client_id);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage withdrawals" ON public.withdrawals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Client views own withdrawals" ON public.withdrawals FOR SELECT
  USING (client_id = auth.uid());

-- =========================================================================
-- COIN PRICES & FX RATES (shared cache)
-- =========================================================================
CREATE TABLE public.coin_prices (
  symbol TEXT PRIMARY KEY,
  name TEXT,
  price_usd NUMERIC(20,8) NOT NULL,
  percent_change_24h NUMERIC(10,4),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coin_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated reads coin prices" ON public.coin_prices FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Admins write coin prices" ON public.coin_prices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.fx_rates (
  pair TEXT PRIMARY KEY,
  rate NUMERIC(20,8) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated reads fx rates" ON public.fx_rates FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Admins write fx rates" ON public.fx_rates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- MURAL POSTS (monthly briefings - all authenticated clients see them)
-- =========================================================================
CREATE TABLE public.mural_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mural_period ON public.mural_posts(period_year DESC, period_month DESC);
ALTER TABLE public.mural_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated reads mural" ON public.mural_posts FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Admins manage mural" ON public.mural_posts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- PHASE 2 TABLES (created with RLS, used later)
-- =========================================================================
CREATE TABLE public.fixed_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  asset_symbol TEXT,
  valor_aplicado_usd NUMERIC(20,2) NOT NULL,
  taxa_anual_pct NUMERIC(8,4) NOT NULL,
  data_registro DATE NOT NULL,
  preco_entrada_usd NUMERIC(20,8),
  data_saida DATE,
  ultimo_preco_usd NUMERIC(20,8),
  last_price_update_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fixed_income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fixed_income" ON public.fixed_income FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Client views own fixed_income" ON public.fixed_income FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.funds f WHERE f.id = fund_id AND f.client_id = auth.uid()));
CREATE TRIGGER trg_fixed_income_updated_at BEFORE UPDATE ON public.fixed_income
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.futures_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.futures_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage futures" ON public.futures_records FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Client views own futures" ON public.futures_records FOR SELECT
  USING (client_id = auth.uid());

CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  signed_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contracts" ON public.contracts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Client views own contracts" ON public.contracts FOR SELECT
  USING (client_id = auth.uid());

CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  receipt_date DATE,
  amount_usd NUMERIC(20,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage receipts" ON public.receipts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Client views own receipts" ON public.receipts FOR SELECT
  USING (client_id = auth.uid());

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  periodo_inicio DATE,
  periodo_fim DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage invoices" ON public.invoices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Client views own invoices" ON public.invoices FOR SELECT
  USING (client_id = auth.uid());

CREATE TABLE public.performance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL,
  patrimonio_inicio_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  patrimonio_fim_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  alocacoes_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  desalocacoes_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  lucro_bruto_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  deficit_anterior_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  base_calculo_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  taxa_aplicada_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  novo_deficit_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  fechado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fund_id, year, month)
);
ALTER TABLE public.performance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage performance" ON public.performance_history FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Client views own performance" ON public.performance_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.funds f WHERE f.id = fund_id AND f.client_id = auth.uid()));

-- =========================================================================
-- STORAGE BUCKETS (private, 5MB max, allowed mime: pdf/jpg/png)
-- =========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('contracts', 'contracts', false, 5242880, ARRAY['application/pdf','image/jpeg','image/png']),
  ('receipts', 'receipts', false, 5242880, ARRAY['application/pdf','image/jpeg','image/png']),
  ('invoices', 'invoices', false, 5242880, ARRAY['application/pdf','image/jpeg','image/png']),
  ('futures', 'futures', false, 5242880, ARRAY['application/pdf','image/jpeg','image/png']),
  ('mural', 'mural', false, 5242880, ARRAY['application/pdf','image/jpeg','image/png']);

-- Storage policies: admins manage everything; client reads their files (path: <client_id>/...)
CREATE POLICY "Admins all storage select" ON storage.objects FOR SELECT
  USING (bucket_id IN ('contracts','receipts','invoices','futures','mural') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins all storage insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('contracts','receipts','invoices','futures','mural') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins all storage update" ON storage.objects FOR UPDATE
  USING (bucket_id IN ('contracts','receipts','invoices','futures','mural') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins all storage delete" ON storage.objects FOR DELETE
  USING (bucket_id IN ('contracts','receipts','invoices','futures','mural') AND public.has_role(auth.uid(),'admin'));

-- Clients can read their own files in client-scoped buckets (path begins with their uid)
CREATE POLICY "Clients read own files" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('contracts','receipts','invoices','futures')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- All authenticated users can read mural files
CREATE POLICY "Authenticated read mural files" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'mural');