import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { sendEmail, sendAdminEmail } from "../_shared/resend.ts";

// Called from AuthContext.tsx right after Supabase emits a real "SIGNED_IN"
// event (password sign-in, Google OAuth, or a fresh signup that lands with an
// immediate session) -- so it fires for every way into the account, not just
// the email+password form. Caller is identified from their own access token,
// same trust model as the other authed functions here.

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
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") as string,
      Deno.env.get("SUPABASE_ANON_KEY") as string,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user || !user.email) {
      return jsonResponse({ error: "Not signed in." }, 401);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") as string,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string,
    );

    // Package history so the admin email doubles as "who is this and what
    // have they bought" without needing to look anything up by hand.
    const { data: payments } = await adminClient
      .from("surprise_payments")
      .select("tier, amount, created_at, surprises(her_name, her_nickname)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const purchasesHtml = payments?.length
      ? `<ul style="color:#3d3540; line-height:1.6; padding-left:20px;">${payments
          .map((p) => {
            const surprise = Array.isArray(p.surprises) ? p.surprises[0] : p.surprises;
            const herName = surprise?.her_nickname || surprise?.her_name || "unnamed";
            const when = new Date(p.created_at as string).toLocaleString("en-GB", {
              timeZone: "Africa/Nairobi",
            });
            return `<li><strong>${p.tier}</strong> — KSh ${p.amount} — for ${herName} — ${when}</li>`;
          })
          .join("")}</ul>`
      : `<p style="color:#3d3540; line-height:1.6;">No purchases yet.</p>`;

    const userAgent = req.headers.get("user-agent") ?? "unknown device";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown IP";
    const signedInAt = new Date().toLocaleString("en-GB", { timeZone: "Africa/Nairobi" });

    await sendEmail({
      to: user.email,
      subject: "New sign-in to your loveintheair account",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="color:#241f27;">You just signed in</h1>
          <p style="color:#3d3540; line-height:1.6;">
            ${signedInAt} (EAT)<br/>
            ${userAgent}
          </p>
          <p style="color:#8a8290; font-size:13px;">
            Wasn't you? Change your password from the account page right away.
          </p>
        </div>
      `,
    });

    await sendAdminEmail({
      subject: `Sign-in — ${user.email}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="color:#241f27;">Someone signed in</h1>
          <p style="color:#3d3540; line-height:1.6;">
            ${user.email}<br/>
            ${signedInAt} (EAT) — ${ip}<br/>
            ${userAgent}
          </p>
          <h2 style="color:#241f27; font-size:16px;">Packages bought</h2>
          ${purchasesHtml}
        </div>
      `,
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Could not send sign-in email." },
      500,
    );
  }
});
