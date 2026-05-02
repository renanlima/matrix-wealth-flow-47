// Helpers compartilhados para edge functions agendadas.
// - jobRun(): grava início/fim em job_runs com status
// - retryWithBackoff(): tenta uma chamada com backoff 5s/30s/120s
// - logCoinError(): registra falha de símbolo em coin_price_errors
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type JobStatus = "success" | "partial" | "failed";

export interface JobResult {
  status: JobStatus;
  message?: string;
  items_processed?: number;
  items_failed?: number;
  payload?: unknown;
}

export async function jobRun(
  jobName: string,
  fn: (admin: SupabaseClient) => Promise<JobResult>,
): Promise<Response> {
  const admin = adminClient();
  const { data: started } = await admin
    .from("job_runs")
    .insert({ job_name: jobName, status: "running" })
    .select("id")
    .single();
  const runId = started?.id ?? null;

  let result: JobResult;
  try {
    result = await fn(admin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) {
      await admin.from("job_runs").update({
        finished_at: new Date().toISOString(),
        status: "failed",
        message: msg,
      }).eq("id", runId);
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (runId) {
    await admin.from("job_runs").update({
      finished_at: new Date().toISOString(),
      status: result.status,
      message: result.message ?? null,
      items_processed: result.items_processed ?? 0,
      items_failed: result.items_failed ?? 0,
    }).eq("id", runId);
  }

  return new Response(
    JSON.stringify({ ok: true, status: result.status, ...result.payload as object }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

const BACKOFF_DELAYS_MS = [5_000, 30_000, 120_000];

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  shouldRetry: (err: unknown) => boolean = () => true,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= BACKOFF_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === BACKOFF_DELAYS_MS.length || !shouldRetry(err)) break;
      await new Promise((r) => setTimeout(r, BACKOFF_DELAYS_MS[attempt]));
    }
  }
  throw lastErr;
}

export async function logCoinError(
  admin: SupabaseClient,
  symbol: string,
  message: string,
): Promise<void> {
  await admin.from("coin_price_errors").insert({ symbol, error_message: message });
}
