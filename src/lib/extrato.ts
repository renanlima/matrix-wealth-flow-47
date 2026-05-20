// Pure helper: builds a chronological ledger of fund movements
// from raw rows of holdings, realizations, fixed_income, performance_history.

export type ExtratoEventType =
  | "Compra"
  | "Venda"
  | "Rendimento"
  | "Encerramento"
  | "Taxa"
  | "Aporte"
  | "Retirada";

export interface ExtratoEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: ExtratoEventType;
  description: string;
  quantity: number | null;
  symbol: string | null;
  /** Positive = entra no fundo (venda, rendimento encerrado).
   *  Negative = sai do fundo (compra, abertura de rendimento, taxa). */
  valueUsd: number;
  /** For sell events: realized profit, signed. Used for badge color. */
  profit?: number;
}

interface HoldingRow {
  id: string;
  fund_id: string;
  coin_symbol: string;
  coin_name: string | null;
  quantity: number | string;
  entry_price_usd: number | string;
  purchase_date: string;
}

interface RealizationRow {
  id: string;
  holding_id: string;
  exit_date: string;
  exit_price_usd: number | string;
  quantity: number | string;
  total_usd: number | string;
  profit_usd: number | string;
}

interface FixedIncomeRow {
  id: string;
  product_name: string;
  asset_symbol: string | null;
  valor_aplicado_usd: number | string;
  ultimo_preco_usd: number | string | null;
  data_registro: string;
  data_saida: string | null;
}

interface PerformanceHistoryRow {
  id: string;
  year: number;
  month: number;
  taxa_aplicada_usd: number | string;
  base_calculo_usd: number | string;
  fund_id: string;
}

interface DepositRow {
  id: string;
  deposit_date: string;
  amount_usd: number | string;
  notes: string | null;
}

interface WithdrawalRow {
  id: string;
  withdraw_date: string;
  amount_usd: number | string;
  notes: string | null;
}

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtQty(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}
function eom(year: number, month: number) {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

export function buildExtratoEvents(input: {
  holdings: HoldingRow[];
  realizations: RealizationRow[];
  fixedIncome: FixedIncomeRow[];
  fees: PerformanceHistoryRow[];
  deposits?: DepositRow[];
  withdrawals?: WithdrawalRow[];
}): ExtratoEvent[] {
  const holdingById = new Map(input.holdings.map((h) => [h.id, h]));
  const events: ExtratoEvent[] = [];

  // Compras
  for (const h of input.holdings) {
    const qty = Number(h.quantity);
    const price = Number(h.entry_price_usd);
    const value = -(qty * price);
    events.push({
      id: `buy-${h.id}`,
      date: h.purchase_date,
      type: "Compra",
      description: `Compra de ${fmtQty(qty)} ${h.coin_symbol} @ ${fmtUsd(price)}`,
      quantity: qty,
      symbol: h.coin_symbol,
      valueUsd: value,
    });
  }

  // Vendas
  for (const r of input.realizations) {
    const h = holdingById.get(r.holding_id);
    const sym = h?.coin_symbol ?? "—";
    const qty = Number(r.quantity);
    const price = Number(r.exit_price_usd);
    const total = Number(r.total_usd);
    const profit = Number(r.profit_usd);
    const profitLabel = profit >= 0 ? `lucro ${fmtUsd(profit)}` : `prejuízo ${fmtUsd(Math.abs(profit))}`;
    const partial = h && Number(h.quantity) > qty ? "parcial " : "";
    events.push({
      id: `sell-${r.id}`,
      date: r.exit_date,
      type: "Venda",
      description: `Venda ${partial}de ${fmtQty(qty)} ${sym} @ ${fmtUsd(price)} (${profitLabel})`,
      quantity: qty,
      symbol: sym,
      valueUsd: total,
      profit,
    });
  }

  // Rendimentos: abertura + encerramento (se houver)
  for (const f of input.fixedIncome) {
    const aplicado = Number(f.valor_aplicado_usd);
    const sym = f.asset_symbol;
    events.push({
      id: `fi-open-${f.id}`,
      date: f.data_registro,
      type: "Rendimento",
      description: `${f.product_name}${sym ? ` (${sym})` : ""} — aplicação`,
      quantity: null,
      symbol: sym,
      valueUsd: -aplicado,
    });
    if (f.data_saida) {
      const fim = Number(f.ultimo_preco_usd ?? f.valor_aplicado_usd);
      events.push({
        id: `fi-close-${f.id}`,
        date: f.data_saida,
        type: "Encerramento",
        description: `${f.product_name}${sym ? ` (${sym})` : ""} — encerramento`,
        quantity: null,
        symbol: sym,
        valueUsd: fim,
      });
    }
  }

  // Taxas (performance_history) — eom do mês de referência
  for (const t of input.fees) {
    const taxa = Number(t.taxa_aplicada_usd);
    if (taxa <= 0) continue;
    const base = Number(t.base_calculo_usd);
    events.push({
      id: `fee-${t.id}`,
      date: eom(t.year, t.month),
      type: "Taxa",
      description: `Taxa de performance — ${MONTHS_PT[t.month - 1]}/${t.year} (sobre ${fmtUsd(base)})`,
      quantity: null,
      symbol: null,
      valueUsd: -taxa,
    });
  }

  // DESC por data, depois por tipo (estável)
  events.sort((a, b) => {
    if (a.date === b.date) return a.type.localeCompare(b.type);
    return a.date < b.date ? 1 : -1;
  });

  return events;
}
