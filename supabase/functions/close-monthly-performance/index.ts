// Edge function: close-monthly-performance
// Calcula o fechamento mensal de cada fundo ativo (mês anterior por padrão).
// Idempotente: se já existe linha em performance_history para (fund_id,year,month), pula.
//
// Regras (briefing Rodada 2 - Matrix Digital Assets):
//   patrimonio_fim    = Σ(holdings ativas no fim do mês × coin_prices.price_usd)
//                       + Σ(fixed_income com data_saida IS NULL ou >= fim_mes, com ultimo_preco_usd ?? valor_aplicado)
//   patrimonio_inicio = patrimonio_fim do mês anterior em performance_history (ou 0)
//   alocacoes_mes     = Σ(holdings.qty × entry_price_usd onde purchase_date no mes)
//                       + Σ(fixed_income.valor_aplicado_usd onde data_registro no mes)
//   desalocacoes_mes  = Σ(realizations.total_usd onde exit_date no mes)
//                       + Σ(fixed_income onde data_saida no mes; valor_aplicado + rendimento_acumulado_até_saida)
//   lucro_bruto       = patrimonio_fim − patrimonio_inicio − alocacoes + desalocacoes
//   deficit_anterior  = funds.carried_deficit_usd (≤ 0)
//   base_calculo      = lucro_bruto + deficit_anterior
//   se base_calculo > 0: taxa_aplicada = base × performance_fee_pct/100; novo_deficit = 0
//   senão:               taxa_aplicada = 0; novo_deficit = base_calculo
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RunBody {
  year?: number;
  month?: number; // 1..12
}

function previousMonth(): { year: number; month: number } {
  const now = new Date();
  // Mês anterior ao corrente
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0..11; subtrair 1 vira -1 = dezembro do ano anterior
  if (m === 0) return { year: y - 1, month: 12 };
  return { year: y, month: m };
}

function monthBoundsISO(year: number, month: number) {
  // Mês 1..12
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1)); // primeiro dia do mês seguinte (exclusivo)
  return {
    startISO: start.toISOString().slice(0, 10),
    endExclusiveISO: end.toISOString().slice(0, 10),
    endLastDayISO: new Date(end.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10),
  };
}

function inRange(d: string | null | undefined, startISO: string, endExclusiveISO: string) {
  if (!d) return false;
  return d >= startISO && d < endExclusiveISO;
}

function fixedIncomeAccrued(
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: RunBody = {};
  if (req.method === "POST") {
    try {
      body = (await req.json()) as RunBody;
    } catch {
      body = {};
    }
  }

  const target = body.year && body.month ? { year: body.year, month: body.month } : previousMonth();
  const { startISO, endExclusiveISO, endLastDayISO } = monthBoundsISO(target.year, target.month);

  // Buscar fundos ativos
  const { data: funds, error: fErr } = await admin
    .from("funds")
    .select("id, performance_fee_pct, carried_deficit_usd")
    .eq("status", "ativo");
  if (fErr) {
    return new Response(JSON.stringify({ error: fErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Tabela de preços (snapshot atual)
  const { data: pricesData } = await admin.from("coin_prices").select("symbol, price_usd");
  const priceMap = new Map(
    (pricesData ?? []).map((p) => [String(p.symbol).toUpperCase(), Number(p.price_usd)]),
  );

  const results: Array<Record<string, unknown>> = [];

  for (const fund of funds ?? []) {
    // Skip se já existe
    const { data: existing } = await admin
      .from("performance_history")
      .select("id")
      .eq("fund_id", fund.id)
      .eq("year", target.year)
      .eq("month", target.month)
      .maybeSingle();
    if (existing) {
      results.push({ fund_id: fund.id, status: "skipped" });
      continue;
    }

    // Holdings do fundo
    const { data: holdings } = await admin
      .from("holdings")
      .select("id, coin_symbol, quantity, entry_price_usd, purchase_date, status")
      .eq("fund_id", fund.id);

    // Realizations do fundo dentro do período
    const holdingIds = (holdings ?? []).map((h) => h.id);
    let realizations: Array<{ total_usd: number; exit_date: string }> = [];
    if (holdingIds.length) {
      const { data: r } = await admin
        .from("realizations")
        .select("total_usd, exit_date, holding_id")
        .in("holding_id", holdingIds);
      realizations = (r ?? []) as typeof realizations;
    }

    // Fixed income do fundo
    const { data: fixedIncome } = await admin
      .from("fixed_income")
      .select(
        "id, asset_symbol, valor_aplicado_usd, taxa_anual_pct, data_registro, data_saida, ultimo_preco_usd",
      )
      .eq("fund_id", fund.id);

    // patrimonio_fim
    let patrimonioFim = 0;
    for (const h of holdings ?? []) {
      // Considerar holding "viva" no fim do mês: status ativa OU encerrada após endLastDay
      // Como não temos data de encerramento direta, aproximamos: se realização existir e exit_date <= endLastDay, exclui.
      const realizedBefore = realizations.find(
        (r) => (r as any).holding_id === h.id && r.exit_date <= endLastDayISO,
      );
      if (h.status === "encerrada" && realizedBefore) continue;
      const sym = String(h.coin_symbol).toUpperCase();
      const price = priceMap.get(sym) ?? Number(h.entry_price_usd);
      patrimonioFim += Number(h.quantity) * price;
    }
    for (const fi of fixedIncome ?? []) {
      const exitedBefore = fi.data_saida && fi.data_saida <= endLastDayISO;
      if (exitedBefore) continue;
      const valor = Number(fi.valor_aplicado_usd);
      const accrued = fixedIncomeAccrued(
        valor,
        Number(fi.taxa_anual_pct),
        fi.data_registro,
        endLastDayISO,
      );
      // Para tokens com último preço (ex: stablecoins ou ativos), poderíamos usar preço atual,
      // mas o briefing pede "valor_aplicado + rendimento". Mantemos consistência.
      patrimonioFim += valor + accrued;
    }

    // patrimonio_inicio = patrimonio_fim do mês anterior na própria tabela
    const prev = target.month === 1
      ? { year: target.year - 1, month: 12 }
      : { year: target.year, month: target.month - 1 };
    const { data: prevRow } = await admin
      .from("performance_history")
      .select("patrimonio_fim_usd")
      .eq("fund_id", fund.id)
      .eq("year", prev.year)
      .eq("month", prev.month)
      .maybeSingle();
    const patrimonioInicio = prevRow ? Number(prevRow.patrimonio_fim_usd) : 0;

    // alocações no mês
    let alocacoes = 0;
    for (const h of holdings ?? []) {
      if (inRange(h.purchase_date, startISO, endExclusiveISO)) {
        alocacoes += Number(h.quantity) * Number(h.entry_price_usd);
      }
    }
    for (const fi of fixedIncome ?? []) {
      if (inRange(fi.data_registro, startISO, endExclusiveISO)) {
        alocacoes += Number(fi.valor_aplicado_usd);
      }
    }

    // desalocações no mês
    let desalocacoes = 0;
    for (const r of realizations) {
      if (inRange(r.exit_date, startISO, endExclusiveISO)) {
        desalocacoes += Number(r.total_usd);
      }
    }
    for (const fi of fixedIncome ?? []) {
      if (fi.data_saida && inRange(fi.data_saida, startISO, endExclusiveISO)) {
        const valor = Number(fi.valor_aplicado_usd);
        const accrued = fixedIncomeAccrued(
          valor,
          Number(fi.taxa_anual_pct),
          fi.data_registro,
          fi.data_saida,
        );
        desalocacoes += valor + accrued;
      }
    }

    const lucroBruto = patrimonioFim - patrimonioInicio - alocacoes + desalocacoes;
    const deficitAnterior = Number(fund.carried_deficit_usd ?? 0); // ≤ 0
    const baseCalculo = lucroBruto + deficitAnterior;
    let taxaAplicada = 0;
    let novoDeficit = 0;
    if (baseCalculo > 0) {
      taxaAplicada = baseCalculo * (Number(fund.performance_fee_pct) / 100);
      novoDeficit = 0;
    } else {
      taxaAplicada = 0;
      novoDeficit = baseCalculo; // negativo
    }

    const insertRow = {
      fund_id: fund.id,
      year: target.year,
      month: target.month,
      patrimonio_inicio_usd: patrimonioInicio,
      patrimonio_fim_usd: patrimonioFim,
      alocacoes_usd: alocacoes,
      desalocacoes_usd: desalocacoes,
      lucro_bruto_usd: lucroBruto,
      deficit_anterior_usd: deficitAnterior,
      base_calculo_usd: baseCalculo,
      taxa_aplicada_usd: taxaAplicada,
      novo_deficit_usd: novoDeficit,
      fechado_em: new Date().toISOString(),
    };

    const { error: insErr } = await admin.from("performance_history").insert(insertRow);
    if (insErr) {
      results.push({ fund_id: fund.id, status: "error", error: insErr.message });
      continue;
    }

    const { error: updErr } = await admin
      .from("funds")
      .update({ carried_deficit_usd: novoDeficit })
      .eq("id", fund.id);
    if (updErr) {
      results.push({ fund_id: fund.id, status: "inserted_but_update_failed", error: updErr.message });
      continue;
    }

    results.push({ fund_id: fund.id, status: "closed", taxa_aplicada: taxaAplicada });
  }

  return new Response(
    JSON.stringify({ target, processed: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
