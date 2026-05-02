// Edge function: update-fx-rates
// Fetches USD/BRL rate from public APIs and upserts into fx_rates.
// Instrumentado com job_runs.
import { corsHeaders, jobRun, retryWithBackoff } from "../_shared/job-runner.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return jobRun("update-fx-rates", async (admin) => {
    let rate: number | null = null;
    try {
      rate = await retryWithBackoff(async () => {
        const res = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=BRL");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const r = json?.rates?.BRL;
        if (typeof r !== "number") throw new Error("Missing BRL rate");
        return r;
      });
    } catch (e) {
      console.error("Primary FX failed", e);
    }

    if (!rate) {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const json = await res.json();
        rate = typeof json?.rates?.BRL === "number" ? json.rates.BRL : null;
      } catch (e) {
        console.error("Fallback FX failed", e);
      }
    }

    if (!rate) {
      return { status: "failed", message: "Could not fetch USD/BRL", items_failed: 1 };
    }

    const { error } = await admin
      .from("fx_rates")
      .upsert({ pair: "USD/BRL", rate, updated_at: new Date().toISOString() }, { onConflict: "pair" });

    if (error) {
      return { status: "failed", message: error.message, items_failed: 1 };
    }
    return { status: "success", items_processed: 1, payload: { pair: "USD/BRL", rate } };
  });
});
