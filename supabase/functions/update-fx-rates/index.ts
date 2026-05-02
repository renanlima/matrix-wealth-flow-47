// Edge function: update-fx-rates
// Fetches USD/BRL rate from a free public API and upserts into fx_rates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // exchangerate.host is free and key-less
  let rate: number | null = null;
  try {
    const res = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=BRL");
    const json = await res.json();
    rate = json?.rates?.BRL ?? null;
  } catch (e) {
    console.error("FX fetch failed", e);
  }

  // Fallback: open.er-api.com
  if (!rate) {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const json = await res.json();
      rate = json?.rates?.BRL ?? null;
    } catch (e) {
      console.error("FX fallback failed", e);
    }
  }

  if (!rate || typeof rate !== "number") {
    return new Response(JSON.stringify({ error: "Could not fetch USD/BRL rate" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error } = await admin
    .from("fx_rates")
    .upsert({ pair: "USD/BRL", rate, updated_at: new Date().toISOString() }, { onConflict: "pair" });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ pair: "USD/BRL", rate }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
