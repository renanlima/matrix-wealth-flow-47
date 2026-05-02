// One-shot seed: cria/promove o admin único da plataforma.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ADMIN_EMAIL = "webrenanlima@gmail.com";
const ADMIN_PASSWORD = "Renan!373**";
const ADMIN_NAME = "Renan Lima";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Tenta achar usuário existente
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === ADMIN_EMAIL);

    if (existing) {
      userId = existing.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: ADMIN_NAME },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // 2. Garante profile com role admin
    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(
        { id: userId, email: ADMIN_EMAIL, full_name: ADMIN_NAME, role: "admin" },
        { onConflict: "id" },
      );
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, created: !existing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
