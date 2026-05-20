// One-shot: cria usuário admin Caio.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const EMAIL = "caio.admin@rededaltro.com.br";
const PASSWORD = "87654321";
const NAME = "Caio Daltro (Admin)";

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
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === EMAIL);

    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: NAME },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(
        { id: userId, email: EMAIL, full_name: NAME, role: "admin" },
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
