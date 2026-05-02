// Edge function: update-coin-prices
// Reads unique symbols from active holdings (+ fixed_income.asset_symbol),
// fetches prices from CoinMarketCap v2, upserts coin_prices.
// Schedule daily 10:00 UTC via pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CMC_KEY = Deno.env.get("CMC_API_KEY");

  if (!CMC_KEY) {
    return new Response(JSON.stringify({ error: "CMC_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Collect unique symbols
  const symbols = new Set<string>();
  const { data: holdings } = await admin
    .from("holdings")
    .select("coin_symbol")
    .eq("status", "ativa");
  holdings?.forEach((h) => h.coin_symbol && symbols.add(h.coin_symbol.toUpperCase()));

  const { data: fis } = await admin
    .from("fixed_income")
    .select("asset_symbol")
    .is("data_saida", null);
  fis?.forEach((f) => f.asset_symbol && symbols.add(f.asset_symbol.toUpperCase()));

  if (symbols.size === 0) {
    return new Response(JSON.stringify({ updated: 0, message: "No symbols to update" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const symbolList = Array.from(symbols).join(",");
  const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbolList)}&convert=USD`;

  const cmcRes = await fetch(url, {
    headers: { "X-CMC_PRO_API_KEY": CMC_KEY, Accept: "application/json" },
  });

  if (!cmcRes.ok) {
    const text = await cmcRes.text();
    console.error("CMC error", cmcRes.status, text);
    return new Response(JSON.stringify({ error: "CMC fetch failed", status: cmcRes.status }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cmcJson = await cmcRes.json();
  const data = cmcJson.data ?? {};

  const upserts: Array<{
    symbol: string;
    name: string | null;
    price_usd: number;
    percent_change_24h: number | null;
    updated_at: string;
  }> = [];

  for (const sym of Object.keys(data)) {
    const arr = Array.isArray(data[sym]) ? data[sym] : [data[sym]];
    if (!arr.length) continue;
    // Take first match (most relevant)
    const item = arr[0];
    const quote = item?.quote?.USD;
    if (!quote || typeof quote.price !== "number") continue;
    upserts.push({
      symbol: sym.toUpperCase(),
      name: item.name ?? null,
      price_usd: quote.price,
      percent_change_24h: typeof quote.percent_change_24h === "number" ? quote.percent_change_24h : null,
      updated_at: new Date().toISOString(),
    });
  }

  if (upserts.length > 0) {
    const { error } = await admin.from("coin_prices").upsert(upserts, { onConflict: "symbol" });
    if (error) {
      console.error("Upsert error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also refresh fixed_income.ultimo_preco_usd
    for (const u of upserts) {
      await admin
        .from("fixed_income")
        .update({ ultimo_preco_usd: u.price_usd, last_price_update_at: u.updated_at })
        .eq("asset_symbol", u.symbol);
    }
  }

  return new Response(JSON.stringify({ updated: upserts.length, symbols: upserts.map((u) => u.symbol) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
