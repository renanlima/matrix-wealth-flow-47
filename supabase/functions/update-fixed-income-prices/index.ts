// Recalcula `ultimo_preco_usd` dos rendimentos alternativos (fixed_income).
// Modelo: valor acumulado = valor_aplicado * (1 + taxa_anual_pct/100)^(dias/365)
// Instrumentado com job_runs.
import { corsHeaders, jobRun } from "../_shared/job-runner.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return jobRun("update-fixed-income-prices", async (supabase) => {
    const { data: rows, error } = await supabase
      .from("fixed_income")
      .select("id, valor_aplicado_usd, taxa_anual_pct, data_registro, data_saida, preco_entrada_usd")
      .is("data_saida", null);

    if (error) {
      return { status: "failed", message: error.message };
    }

    const today = new Date();
    let updated = 0;
    let failed = 0;
    for (const r of rows ?? []) {
      const start = new Date(r.data_registro);
      const days = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000));
      const yrs = days / 365;
      const factor = Math.pow(1 + Number(r.taxa_anual_pct) / 100, yrs);
      const newPrice = r.preco_entrada_usd != null
        ? Number(r.preco_entrada_usd) * factor
        : Number(r.valor_aplicado_usd) * factor;
      const { error: uErr } = await supabase
        .from("fixed_income")
        .update({ ultimo_preco_usd: newPrice, last_price_update_at: new Date().toISOString() })
        .eq("id", r.id);
      if (uErr) failed++; else updated++;
    }

    const status = failed === 0 ? "success" : "partial";
    return { status, items_processed: updated, items_failed: failed, payload: { updated, failed } };
  });
});
