import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { sendAdminEmail } from "../_shared/resend.ts";

// Lets anyone viewing a surprise (her, or any visitor) flag it for the site
// owner -- deliberately no auth required, since the person reporting is
// often the recipient who never signed in at all. Best-effort lookup of
// who/what the surprise is (if a real id was given) just to make the report
// email actually useful; a bad/missing id still sends the report, just
// without that context.

const MAX_REASON_LENGTH = 2000;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { surpriseId, pageUrl, reason } = await req.json();

    if (typeof reason !== "string" || !reason.trim()) {
      return jsonResponse({ error: "Tell us what's wrong before submitting." }, 400);
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return jsonResponse({ error: "That's a bit long -- please shorten it." }, 400);
    }

    let context = "";
    if (typeof surpriseId === "string" && surpriseId) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") as string,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string,
      );
      const { data: surprise } = await adminClient
        .from("surprises")
        .select("her_name, her_nickname, him_name, him_nickname")
        .eq("id", surpriseId)
        .maybeSingle();
      if (surprise) {
        const her = surprise.her_nickname || surprise.her_name || "unknown";
        const him = surprise.him_nickname || surprise.him_name || "unknown";
        context = `<p style="color:#3d3540;">For: ${escapeHtml(her)} · From: ${escapeHtml(him)}</p>`;
      }
    }

    await sendAdminEmail({
      subject: "New report submitted",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="color:#7A0001;">Someone reported a surprise</h1>
          ${context}
          <p style="color:#8a8290; font-size:13px;">
            Page: ${typeof pageUrl === "string" && pageUrl ? escapeHtml(pageUrl) : "unknown"}<br/>
            Surprise ID: ${typeof surpriseId === "string" && surpriseId ? escapeHtml(surpriseId) : "n/a"}
          </p>
          <p style="color:#3d3540; line-height:1.6; white-space:pre-wrap;">${escapeHtml(reason.trim())}</p>
        </div>
      `,
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Could not submit report." },
      500,
    );
  }
});
