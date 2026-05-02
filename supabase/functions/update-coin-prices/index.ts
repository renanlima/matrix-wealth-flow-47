// Edge function: update-coin-prices
// Reads unique symbols from active holdings (+ fixed_income.asset_symbol),
// fetches prices from CoinMarketCap v2, upserts coin_prices.
// - Instrumentado com job_runs e coin_price_errors.
// - Retry 5s/30s/120s para 429 e 5xx.
// Schedule daily 10:00 UTC via pg_cron.
import { corsHeaders, jobRun, retryWithBackoff, logCoinError } from "../_shared/job-runner.ts";

class CmcRetryableError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return jobRun("update-coin-prices", async (admin) => {
    const CMC_KEY = Deno.env.get("CMC_API_KEY");
    if (!CMC_KEY) {
      return { status: "failed", message: "CMC_API_KEY missing" };
    }

    // Collect unique symbols
    const symbols = new Set<string>();
    const { data: holdings } = await admin
      .from("holdings").select("coin_symbol").eq("status", "ativa");
    holdings?.forEach((h) => h.coin_symbol && symbols.add(h.coin_symbol.toUpperCase()));

    const { data: fis } = await admin
      .from("fixed_income").select("asset_symbol").is("data_saida", null);
    fis?.forEach((f) => f.asset_symbol && symbols.add(f.asset_symbol.toUpperCase()));

    if (symbols.size === 0) {
      return { status: "success", message: "No symbols", items_processed: 0, payload: { updated: 0 } };
    }

    const symbolList = Array.from(symbols).join(",");
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbolList)}&convert=USD`;

    let cmcJson: any;
    try {
      cmcJson = await retryWithBackoff(async () => {
        const res = await fetch(url, {
          headers: { "X-CMC_PRO_API_KEY": CMC_KEY, Accept: "application/json" },
        });
        if (res.status === 429 || res.status >= 500) {
          throw new CmcRetryableError(res.status, `CMC ${res.status}`);
        }
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`CMC ${res.status}: ${t}`);
        }
        return await res.json();
      }, (err) => err instanceof CmcRetryableError);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: "failed", message: `CMC fetch failed: ${msg}`, items_failed: symbols.size };
    }

    const data = cmcJson.data ?? {};
    const upserts: Array<any> = [];
    const failedSymbols: string[] = [];

    for (const sym of symbols) {
      const arr = Array.isArray(data[sym]) ? data[sym] : data[sym] ? [data[sym]] : [];
      if (!arr.length) {
        failedSymbols.push(sym);
        await logCoinError(admin, sym, "Symbol not found in CMC response");
        continue;
      }
      const item = arr[0];
      const quote = item?.quote?.USD;
      if (!quote || typeof quote.price !== "number") {
        failedSymbols.push(sym);
        await logCoinError(admin, sym, "Missing USD quote");
        continue;
      }
      upserts.push({
        symbol: sym,
        name: item.name ?? null,
        price_usd: quote.price,
        percent_change_24h: typeof quote.percent_change_24h === "number" ? quote.percent_change_24h : null,
        updated_at: new Date().toISOString(),
      });
    }

    if (upserts.length > 0) {
      const { error } = await admin.from("coin_prices").upsert(upserts, { onConflict: "symbol" });
      if (error) {
        return { status: "failed", message: `Upsert error: ${error.message}`, items_failed: symbols.size };
      }
      // Also refresh fixed_income.ultimo_preco_usd for matching symbols
      for (const u of upserts) {
        await admin.from("fixed_income")
          .update({ ultimo_preco_usd: u.price_usd, last_price_update_at: u.updated_at })
          .eq("asset_symbol", u.symbol);
      }
    }

    const status = failedSymbols.length === 0 ? "success" : "partial";
    return {
      status,
      message: failedSymbols.length ? `Failed: ${failedSymbols.join(",")}` : undefined,
      items_processed: upserts.length,
      items_failed: failedSymbols.length,
      payload: { updated: upserts.length, failed: failedSymbols },
    };
  });
});
