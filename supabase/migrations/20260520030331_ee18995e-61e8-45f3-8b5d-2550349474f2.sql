-- a) Add quantity column to realizations + backfill
ALTER TABLE public.realizations
  ADD COLUMN IF NOT EXISTS quantity numeric;

UPDATE public.realizations r
SET quantity = h.quantity
FROM public.holdings h
WHERE r.holding_id = h.id AND r.quantity IS NULL;

ALTER TABLE public.realizations
  ALTER COLUMN quantity SET NOT NULL;

ALTER TABLE public.realizations
  ADD CONSTRAINT realizations_quantity_positive CHECK (quantity > 0);

-- b) RPC realize_partial: atomic insert into realizations + adjust holding
CREATE OR REPLACE FUNCTION public.realize_partial(
  _holding_id uuid,
  _qty numeric,
  _exit_price numeric,
  _exit_date date,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_holding holdings%ROWTYPE;
  v_total numeric;
  v_profit numeric;
  v_realization_id uuid;
BEGIN
  -- Authorization: only admins (matches existing RLS on holdings/realizations)
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Lock the holding row to prevent concurrent partial sales
  SELECT * INTO v_holding FROM public.holdings WHERE id = _holding_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Holding não encontrado';
  END IF;

  IF v_holding.status <> 'ativa' THEN
    RAISE EXCEPTION 'Holding não está ativo';
  END IF;

  IF _qty IS NULL OR _qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;

  IF _qty > v_holding.quantity THEN
    RAISE EXCEPTION 'Quantidade (%) excede disponível (%)', _qty, v_holding.quantity;
  END IF;

  IF _exit_price IS NULL OR _exit_price < 0 THEN
    RAISE EXCEPTION 'Preço de saída inválido';
  END IF;

  v_total := _exit_price * _qty;
  v_profit := (_exit_price - v_holding.entry_price_usd) * _qty;

  INSERT INTO public.realizations (holding_id, quantity, exit_price_usd, exit_date, total_usd, profit_usd, notes)
  VALUES (_holding_id, _qty, _exit_price, _exit_date, v_total, v_profit, _notes)
  RETURNING id INTO v_realization_id;

  IF _qty = v_holding.quantity THEN
    UPDATE public.holdings SET status = 'encerrada', updated_at = now() WHERE id = _holding_id;
  ELSE
    UPDATE public.holdings SET quantity = quantity - _qty, updated_at = now() WHERE id = _holding_id;
  END IF;

  RETURN v_realization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.realize_partial(uuid, numeric, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realize_partial(uuid, numeric, numeric, date, text) TO authenticated;