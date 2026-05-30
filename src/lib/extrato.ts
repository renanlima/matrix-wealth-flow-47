// Pure helper: builds a chronological ledger of fund movements
// from raw rows of holdings, realizations, fixed_income, performance_history.

export type ExtratoEventType =
  | "Compra"
  | "Venda"
  | "Rendimento"
  | "Encerramento"
  | "Taxa"
  | "Aporte"
  | "Retirada"
  | "Início do fundo"
  | "Encerramento do fundo"
  | "Edição";

export interface ExtratoEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: ExtratoEventType;
  description: string;
  quantity: number | null;
  symbol: string | null;
  /** Positive = entra no fundo (venda, rendimento encerrado).
   *  Negative = sai do fundo (compra, abertura de rendimento, taxa).
   *  Zero = evento informativo (início/encerramento de fundo). */
  valueUsd: number;
  /** Saldo de caixa acumulado APÓS este evento. Preenchido pelo builder. */
  runningBalance?: number;
  /** For sell events: realized profit, signed. Used for badge color. */
  profit?: number;
  /** Observações da operação (notes) — exibido abaixo da descrição se presente. */
  notes?: string | null;
}

interface FundRow {
  id: string;
  name?: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
}

interface AuditRow {
  id: string;
  action: string; // 'INSERT' | 'UPDATE' | 'DELETE'
  entity_type: string;
  entity_id: string | null;
  actor_email: string | null;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  created_at: string; // ISO
}

interface HoldingRow {
  id: string;
  fund_id: string;
  coin_symbol: string;
  coin_name: string | null;
  quantity: number | string;
  entry_price_usd: number | string;
  purchase_date: string;
  status?: string;
  notes?: string | null;
}

interface RealizationRow {
  id: string;
  holding_id: string;
  exit_date: string;
  exit_price_usd: number | string;
  quantity: number | string;
  total_usd: number | string;
  profit_usd: number | string;
  notes?: string | null;
}

interface FixedIncomeRow {
  id: string;
  product_name: string;
  asset_symbol: string | null;
  valor_aplicado_usd: number | string;
  ultimo_preco_usd: number | string | null;
  data_registro: string;
  data_saida: string | null;
  notes?: string | null;
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
  fund?: FundRow | null;
  audit?: AuditRow[];
}): ExtratoEvent[] {
  const holdingById = new Map(input.holdings.map((h) => [h.id, h]));
  const events: ExtratoEvent[] = [];

  // Agrega vendas por holding para reconstruir quantidade original e detectar a venda de fechamento.
  // O schema atual decrementa holdings.quantity em vendas parciais (RPC realize_partial), então a
  // quantity persistida NÃO é a quantidade original comprada. Sem isso, a "Compra" no extrato
  // muda de valor toda vez que há venda parcial.
  const soldByHolding = new Map<string, number>();
  const closingRealizationId = new Map<string, string>();
  for (const r of input.realizations) {
    soldByHolding.set(r.holding_id, (soldByHolding.get(r.holding_id) ?? 0) + Number(r.quantity));
  }
  for (const h of input.holdings) {
    if (h.status !== "encerrada") continue;
    const rs = input.realizations.filter((r) => r.holding_id === h.id);
    if (rs.length === 0) continue;
    // Última por exit_date (id como desempate estável)
    const latest = rs.reduce((a, b) =>
      a.exit_date > b.exit_date ? a : a.exit_date < b.exit_date ? b : (a.id > b.id ? a : b)
    );
    closingRealizationId.set(h.id, latest.id);
  }

  const originalQtyOf = (h: HoldingRow) => {
    const current = Number(h.quantity);
    const sold = soldByHolding.get(h.id) ?? 0;
    if (h.status === "encerrada") {
      // Em holdings encerrados, holdings.quantity guarda o resíduo da ÚLTIMA venda (não foi decrementado).
      // A quantidade original = soma de todas as vendas. Fallback para current se não houver vendas.
      return sold > 0 ? sold : current;
    }
    return current + sold;
  };

  // Compras (quantidade original, não a residual)
  for (const h of input.holdings) {
    const originalQty = originalQtyOf(h);
    const price = Number(h.entry_price_usd);
    const value = -(originalQty * price);
    events.push({
      id: `buy-${h.id}`,
      date: h.purchase_date,
      type: "Compra",
      description: `Compra de ${fmtQty(originalQty)} ${h.coin_symbol} @ ${fmtUsd(price)}`,
      quantity: originalQty,
      symbol: h.coin_symbol,
      valueUsd: value,
      notes: h.notes ?? null,
    });
  }

  // Vendas — "parcial" só se NÃO for a venda de fechamento (holding ainda ativo ou foi pré-fechamento)
  for (const r of input.realizations) {
    const h = holdingById.get(r.holding_id);
    const sym = h?.coin_symbol ?? "—";
    const qty = Number(r.quantity);
    const price = Number(r.exit_price_usd);
    const total = Number(r.total_usd);
    const profit = Number(r.profit_usd);
    const profitLabel = profit >= 0 ? `lucro ${fmtUsd(profit)}` : `prejuízo ${fmtUsd(Math.abs(profit))}`;
    const isClosing = closingRealizationId.get(r.holding_id) === r.id;
    const partial = !isClosing ? "parcial " : "";
    events.push({
      id: `sell-${r.id}`,
      date: r.exit_date,
      type: "Venda",
      description: `Venda ${partial}de ${fmtQty(qty)} ${sym} @ ${fmtUsd(price)} (${profitLabel})`,
      quantity: qty,
      symbol: sym,
      valueUsd: total,
      profit,
      notes: r.notes ?? null,
    });
  }

  // Rendimentos: abertura + encerramento (com rendimento auferido na descrição se houver)
  for (const f of input.fixedIncome) {
    const aplicado = Number(f.valor_aplicado_usd);
    const sym = f.asset_symbol;
    events.push({
      id: `fi-open-${f.id}`,
      date: f.data_registro,
      type: "Rendimento",
      description: `${f.product_name}${sym ? ` (${sym})` : ""} — aplicação de ${fmtUsd(aplicado)}`,
      quantity: null,
      symbol: sym,
      valueUsd: -aplicado,
      notes: f.notes ?? null,
    });
    if (f.data_saida) {
      const fim = Number(f.ultimo_preco_usd ?? f.valor_aplicado_usd);
      const yieldAmount = fim - aplicado;
      const yieldLabel =
        yieldAmount > 0
          ? `rendimento +${fmtUsd(yieldAmount)}`
          : yieldAmount < 0
          ? `prejuízo ${fmtUsd(yieldAmount)}`
          : "sem rendimento";
      events.push({
        id: `fi-close-${f.id}`,
        date: f.data_saida,
        type: "Encerramento",
        description: `${f.product_name}${sym ? ` (${sym})` : ""} — recuperado ${fmtUsd(fim)} (${yieldLabel})`,
        quantity: null,
        symbol: sym,
        valueUsd: fim,
        profit: yieldAmount,
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

  // Aportes (deposits alocados a este fundo)
  for (const d of input.deposits ?? []) {
    const amount = Number(d.amount_usd);
    events.push({
      id: `dep-${d.id}`,
      date: d.deposit_date,
      type: "Aporte",
      description: `Aporte de ${fmtUsd(amount)}`,
      quantity: null,
      symbol: null,
      valueUsd: amount,
      notes: d.notes ?? null,
    });
  }

  // Retiradas (withdrawals alocadas a este fundo)
  for (const w of input.withdrawals ?? []) {
    const amount = Number(w.amount_usd);
    events.push({
      id: `wd-${w.id}`,
      date: w.withdraw_date,
      type: "Retirada",
      description: `Retirada de ${fmtUsd(amount)}`,
      quantity: null,
      symbol: null,
      valueUsd: -amount,
      notes: w.notes ?? null,
    });
  }


  // Edições manuais admin (audit_log). Cliente recebe array vazio via RLS — naturalmente filtrado.
  // Só surfaceia mudanças financeiras (quantity / entry_price_usd / purchase_date / coin_symbol);
  // status change já é representado por venda/encerramento.
  const FIN_FIELDS = ["quantity", "entry_price_usd", "purchase_date", "coin_symbol", "coin_name", "notes"] as const;
  for (const a of input.audit ?? []) {
    if (a.entity_type !== "holdings") continue;
    if (a.action === "UPDATE") {
      const before = a.before ?? {};
      const after = a.after ?? {};
      const diffs: string[] = [];
      for (const f of FIN_FIELDS) {
        const b = before[f];
        const v = after[f];
        if (b === v) continue;
        const bStr = b == null ? "—" : String(b);
        const vStr = v == null ? "—" : String(v);
        diffs.push(`${f}: ${bStr} → ${vStr}`);
      }
      if (diffs.length === 0) continue;
      const sym = (after.coin_symbol ?? before.coin_symbol ?? "—") as string;
      const date = a.created_at.slice(0, 10);
      const actor = a.actor_email ? ` por ${a.actor_email}` : "";
      events.push({
        id: `audit-${a.id}`,
        date,
        type: "Edição",
        description: `Edição de holding ${sym}${actor} — ${diffs.join("; ")}`,
        quantity: null,
        symbol: sym,
        valueUsd: 0,
      });
    } else if (a.action === "DELETE") {
      const before = a.before ?? {};
      const sym = (before.coin_symbol ?? "—") as string;
      const date = a.created_at.slice(0, 10);
      const actor = a.actor_email ? ` por ${a.actor_email}` : "";
      events.push({
        id: `audit-${a.id}`,
        date,
        type: "Edição",
        description: `Exclusão de holding ${sym}${actor} (qtd ${before.quantity ?? "?"} @ ${before.entry_price_usd ?? "?"})`,
        quantity: null,
        symbol: sym,
        valueUsd: 0,
      });
    }
  }

  // Eventos do ciclo de vida do fundo (informativos, valueUsd=0 — não afetam saldo)
  if (input.fund) {
    const { id, name, start_date, end_date, status } = input.fund;
    if (start_date) {
      events.push({
        id: `fund-start-${id}`,
        date: start_date,
        type: "Início do fundo",
        description: `Abertura do fundo${name ? ` — ${name}` : ""}`,
        quantity: null,
        symbol: null,
        valueUsd: 0,
      });
    }
    if (status === "encerrado" && end_date) {
      events.push({
        id: `fund-end-${id}`,
        date: end_date,
        type: "Encerramento do fundo",
        description: `Encerramento do fundo${name ? ` — ${name}` : ""}`,
        quantity: null,
        symbol: null,
        valueUsd: 0,
      });
    }
  }

  // Ordena ASC para acumular saldo, ASC estável por tipo em mesma data:
  // "Início do fundo" sempre primeiro; "Encerramento do fundo" sempre por último.
  const typeOrder: Record<ExtratoEventType, number> = {
    "Início do fundo": 0,
    "Aporte": 1,
    "Compra": 2,
    "Rendimento": 3,
    "Venda": 4,
    "Encerramento": 5,
    "Taxa": 6,
    "Retirada": 7,
    "Edição": 8,
    "Encerramento do fundo": 9,
  };
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (typeOrder[a.type] ?? 8) - (typeOrder[b.type] ?? 8);
  });

  // Acumula saldo de caixa
  let balance = 0;
  for (const e of events) {
    balance += e.valueUsd;
    e.runningBalance = balance;
  }

  // Reverte para DESC (mais recente primeiro) — UX padrão de extrato
  events.reverse();

  return events;
}
