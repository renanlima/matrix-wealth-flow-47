// Edge function: update-client
// Admin-only. Updates profile (name/email), client (phone/notes), and optionally password.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  client_id: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  notes?: string | null;
  password?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!callerProfile || callerProfile.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { client_id, full_name, email, phone, notes, password } = body;
  if (!client_id) {
    return new Response(JSON.stringify({ error: "client_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Update auth user (email and/or password)
  if (email || password) {
    const upd: Record<string, unknown> = {};
    if (email) {
      upd.email = email;
      upd.email_confirm = true;
    }
    if (password) {
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Senha deve ter ao menos 6 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      upd.password = password;
    }
    const { error: authErr } = await admin.auth.admin.updateUserById(client_id, upd);
    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Update profile
  const profileUpd: Record<string, unknown> = {};
  if (full_name !== undefined) profileUpd.full_name = full_name;
  if (email !== undefined) profileUpd.email = email;
  if (Object.keys(profileUpd).length > 0) {
    const { error: pErr } = await admin.from("profiles").update(profileUpd).eq("id", client_id);
    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Update client
  const clientUpd: Record<string, unknown> = {};
  if (phone !== undefined) clientUpd.phone = phone;
  if (notes !== undefined) clientUpd.notes = notes;
  if (Object.keys(clientUpd).length > 0) {
    const { error: cErr } = await admin.from("clients").update(clientUpd).eq("id", client_id);
    if (cErr) {
      return new Response(JSON.stringify({ error: cErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
