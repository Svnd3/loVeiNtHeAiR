import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";

// Sent to the creator right after Details.tsx finishes the initial insert for
// a brand-new surprise (not on edits) -- a backup copy of the share link, in
// case they navigate away before copying it. Recipient is always the caller's
// own verified email (from their JWT), never a client-supplied address, and
// her_name/him_name are re-read from the row rather than trusted from the
// client -- same ownership-check pattern as verify-surprise-payment.

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

    const { data: surprise, error: fetchError } = await adminClient
      .from("surprises")
      .select("her_name, her_nickname")
      .eq("id", surpriseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError || !surprise) {
      return jsonResponse({ error: "Surprise not found." }, 404);
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "";
    const shareUrl = `${siteUrl}/s/${surpriseId}`;
    const herName = surprise.her_nickname || surprise.her_name || "her";

    await sendEmail({
      to: user.email,
      subject: "Her surprise is ready 💌",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="color:#241f27;">It's ready for ${herName}</h1>
          <p style="color:#3d3540; line-height:1.6;">
            Your surprise is saved. Send her this link whenever you're ready:
          </p>
          <p style="margin: 24px 0;">
            <a href="${shareUrl}" style="background:#fbd1e8;color:#241f27;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">
              Open the link
            </a>
          </p>
          <p style="color:#8a8290; font-size:13px;">${shareUrl}</p>
        </div>
      `,
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Could not send email." },
      500,
    );
  }
});
