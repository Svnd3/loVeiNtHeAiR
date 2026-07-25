import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";

// Replaces the client's old direct call to the record_surprise_view() RPC
// (see schema.sql) -- the RPC still does the actual counter bookkeeping in one
// atomic UPDATE...RETURNING (so two near-simultaneous requests can't both
// think they're "the first view"), this just wraps that call so it can also
// email him the moment is_first_view comes back true. Callable by anyone with
// the link (same trust model as the RPC it wraps): it can only ever bump
// counters on the row matching the exact id it's given.

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { surpriseId } = await req.json();
    if (!surpriseId || typeof surpriseId !== "string") {
      return jsonResponse({ error: "Missing surprise id." }, 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") as string,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string,
    );

    const { data, error } = await adminClient
      .rpc("record_surprise_view", { p_surprise_id: surpriseId })
      .single();

    if (error || !data) {
      return jsonResponse({ error: "Surprise not found." }, 404);
    }

    const row = data as {
      user_id: string;
      her_name: string;
      her_nickname: string;
      is_first_view: boolean;
    };

    if (row.is_first_view) {
      const { data: owner } = await adminClient.auth.admin.getUserById(row.user_id);
      const ownerEmail = owner?.user?.email;
      if (ownerEmail) {
        const herName = row.her_nickname || row.her_name || "she";
        await sendEmail({
          to: ownerEmail,
          subject: `${herName} just opened it 👀`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
              <h1 style="color:#241f27;">She's seeing it right now 💗</h1>
              <p style="color:#3d3540; line-height:1.6;">
                ${herName} just opened the surprise you made. This is the only email you'll get
                for this one — check your account page any time to see how many times she's
                come back to it.
              </p>
            </div>
          `,
        });
      }
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Could not record view." },
      500,
    );
  }
});
