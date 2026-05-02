// Recalcula `ultimo_preco_usd` dos rendimentos alternativos (fixed_income).
// Modelo simples: valor acumulado = valor_aplicado * (1 + taxa_anual_pct/100)^(dias/365)
// Para registros com `preco_entrada_usd` e `asset_symbol`, aplica o mesmo crescimento ao preço de entrada.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows, error } = await supabase
    .from("fixed_income")
    .select("id, valor_aplicado_usd, taxa_anual_pct, data_registro, data_saida, preco_entrada_usd")
    .is("data_saida", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const today = new Date();
  let updated = 0;
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
      .update({
        ultimo_preco_usd: newPrice,
        last_price_update_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (!uErr) updated++;
  }

  return new Response(JSON.stringify({ ok: true, updated }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
