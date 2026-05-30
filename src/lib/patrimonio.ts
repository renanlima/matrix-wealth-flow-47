// Núcleo compartilhado de cálculos de patrimônio. Quem usa:
// - lib/extrato.ts (ledger)
// - components/positions/PositionHistoryDialog.tsx
// - components/client/ClientHoldingsTable.tsx
// - routes/admin.../fundos/$fundId.tsx (prévia mensal)
//
// A edge function supabase/functions/close-monthly-performance/index.ts mantém cópias inline
// destas mesmas fórmulas (Deno não compartilha módulos com src/). QUALQUER mudança aqui
// deve ser refletida lá manualmente. Marcado com comentário "MIRRORED FROM lib/patrimonio.ts".

export interface HoldingLike {
  id: string;
  status?: string;
  quantity: number | string;
  entry_price_usd: number | string;
  coin_symbol: string;
  purchase_date: string;
}

export interface RealizationLike {
  id: string;
  holding_id: string;
  quantity: number | string;
  exit_date: string;
  total_usd: number | string;
  profit_usd: number | string;
}

export interface FixedIncomeLike {
  valor_aplicado_usd: number | string;
  taxa_anual_pct: number | string;
  data_registro: string;
  data_saida: string | null;
}

/**
 * Quantidade originalmente comprada de um lote, reconstruída a partir do estado atual.
 *
 * O RPC realize_partial decrementa holdings.quantity em vendas parciais, mas NÃO em vendas
 * de fechamento (mantém o resíduo). Portanto, para recuperar a qty original:
 * - Lote encerrado: soma de TODAS as realizações daquele holding (preferencial), fallback p/ current.
 * - Lote ativo: qty atual + Σ(vendas parciais).
 */
export function originalQtyOf(holding: HoldingLike, soldByHolding: Map<string, number>): number {
  const current = Number(holding.quantity);
  const sold = soldByHolding.get(holding.id) ?? 0;
  if (holding.status === "encerrada") {
    return sold > 0 ? sold : current;
  }
  return current + sold;
}

/**
 * Constrói o mapa holding_id → soma de quantidades vendidas. Reutilizado por originalQtyOf
 * e detecção de venda de fechamento.
 */
export function soldByHoldingMap(realizations: RealizationLike[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of realizations) {
    m.set(r.holding_id, (m.get(r.holding_id) ?? 0) + Number(r.quantity));
  }
  return m;
}

/**
 * Para cada holding encerrado com realizações, identifica qual realização foi a de
 * fechamento (última por exit_date; id como desempate estável). Realizações restantes
 * são parciais.
 */
export function closingRealizationMap(
  holdings: HoldingLike[],
  realizations: RealizationLike[],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const h of holdings) {
    if (h.status !== "encerrada") continue;
    const rs = realizations.filter((r) => r.holding_id === h.id);
    if (rs.length === 0) continue;
    const latest = rs.reduce((a, b) =>
      a.exit_date > b.exit_date ? a : a.exit_date < b.exit_date ? b : (a.id > b.id ? a : b)
    );
    m.set(h.id, latest.id);
  }
  return m;
}

/**
 * Determina se um holding estava "vivo" (gerando patrimônio) em uma data específica.
 * Critério unificado: o holding está vivo se ainda há quantidade não realizada até essa data.
 *
 * Para o fechamento mensal, "vivo no fim do mês" = não tem realização de fechamento com
 * exit_date <= refDateISO. Mesmo critério usado pela edge function de fechamento.
 *
 * Aceita qualquer formato de realização que tenha holding_id + exit_date — não exige
 * os campos completos de RealizationLike (calldades em call sites com dados parciais).
 */
export function isHoldingLiveOn(
  holding: HoldingLike,
  realizations: Array<{ holding_id: string; exit_date: string }>,
  refDateISO: string,
): boolean {
  // Realizações desse holding até a data ref
  const upToRef = realizations.filter(
    (r) => r.holding_id === holding.id && r.exit_date <= refDateISO,
  );
  // Se encerrado e há realização anterior à data ref → já estava encerrado
  if (holding.status === "encerrada" && upToRef.length > 0) return false;
  // Caso geral: vivo se ainda há saldo (current_qty > 0 e status != encerrada)
  if (holding.status === "encerrada") return false;
  return Number(holding.quantity) > 0;
}

/**
 * Accrual de rendimento de aplicação fixed_income.
 * MIRRORED FROM supabase/functions/close-monthly-performance/index.ts
 *
 * Fórmula: valor × taxa_anual_pct × (dias / 365) / 100.
 * Convenção do briefing: ignora ultimo_preco_usd, sempre usa accrual contratual.
 */
export function fixedIncomeAccrued(
  valor: number,
  taxaAnualPct: number,
  dataRegistroISO: string,
  refDateISO: string,
): number {
  const start = new Date(dataRegistroISO + "T00:00:00Z").getTime();
  const ref = new Date(refDateISO + "T00:00:00Z").getTime();
  const days = Math.max(0, (ref - start) / (24 * 3600 * 1000));
  const rendimentoPct = taxaAnualPct * (days / 365);
  return valor * (rendimentoPct / 100);
}

/**
 * Preço médio ponderado de cost basis dos lotes ATIVOS.
 * Σ(qty_ativo × entry_price) / Σ(qty_ativo). Retorna 0 se não houver qty ativa.
 */
export function weightedAvgEntry(activeLots: HoldingLike[]): number {
  let totalQty = 0;
  let totalCost = 0;
  for (const l of activeLots) {
    const q = Number(l.quantity);
    totalQty += q;
    totalCost += q * Number(l.entry_price_usd);
  }
  return totalQty > 0 ? totalCost / totalQty : 0;
}

/**
 * Valor de mercado total de um conjunto de lotes ativos, dada a tabela de preços.
 * Se símbolo não tiver cotação, fallback para entry_price (sinaliza no `priced` field).
 */
export function marketValueOf(
  activeLots: HoldingLike[],
  prices: Map<string, number>,
): { value: number; allPriced: boolean } {
  let value = 0;
  let allPriced = true;
  for (const l of activeLots) {
    const sym = l.coin_symbol.toUpperCase();
    const price = prices.get(sym);
    if (price == null) {
      allPriced = false;
      value += Number(l.quantity) * Number(l.entry_price_usd);
    } else {
      value += Number(l.quantity) * price;
    }
  }
  return { value, allPriced };
}
