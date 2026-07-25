import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";

// Called right after supabase.auth.signUp() succeeds (see src/lib/notifications.ts
// / src/pages/Login.tsx) -- signUp() returns the new user's email even before
// they've confirmed it, so this doesn't need a session/JWT to identify who to
// email. Only covers the email+password signup form; Google's "Continue with
// Google" button reuses the same signInWithOAuth call for sign-in and signup,
// so there's no clean client-side signal to distinguish a brand-new account
// there without extra bookkeeping (e.g. a profiles table + DB trigger).

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
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "Missing email." }, 400);
    }

    await sendEmail({
      to: email,
      subject: "Welcome to loveintheair 💌",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="color:#241f27;">You're in 💗</h1>
          <p style="color:#3d3540; line-height:1.6;">
            Welcome to loveintheair. Head back in whenever you're ready and build something
            she'll actually remember — her details, your letter, a song, and a little surprise
            at the end.
          </p>
          <p style="color:#3d3540; line-height:1.6;">Let's make it count.</p>
        </div>
      `,
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Could not send welcome email." },
      500,
    );
  }
});
