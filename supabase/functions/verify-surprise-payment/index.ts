import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, sendAdminEmail } from "../_shared/resend.ts";

// Verifies a Paystack transaction server-side before a surprise's link ever
// works for her — the client's own "payment successful" callback is never
// trusted on its own. Nothing is written to surprise_payments unless
// Paystack itself confirms the charge, and the surprise's public read
// (get_surprise() in schema.sql) requires a row here to exist at all.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// One flat price, everything included -- no more per-feature tier gating.
// "premium" is the only tier this function will ever grant for a real
// payment now; it's kept as a string (rather than dropping the column) only
// because older surprises already have basic/super/mixed/custom rows and
// SharedSurprise.tsx / songs.ts still read those to render exactly what was
// originally paid for. Kept in sync with PRICE in src/lib/payments.ts, which
// only drives what the UI shows -- this copy is what actually enforces it.
const PRICE = 359;
const TIER = "premium";

// Founder/testing accounts -- skip Paystack entirely and get full access for
// free. Kept in sync with FREE_ACCESS_EMAILS in src/lib/payments.ts. Safe to
// keep server-side even though the client also knows this list: the
// caller's email still has to come from their own signed-in session below,
// never from anything the client claims.
const FREE_ACCESS_EMAILS = ["hezronsande2@gmail.com", "clivemuturi@gmail.com"];

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
    const { reference, surpriseId } = await req.json();

    if (!reference || typeof reference !== "string") {
      return jsonResponse({ error: "Missing payment reference." }, 400);
    }
    if (!surpriseId || typeof surpriseId !== "string") {
      return jsonResponse({ error: "Missing surprise id." }, 400);
    }

    // Identify the caller from their own session token — never trust a
    // client-supplied user id.
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") as string,
      Deno.env.get("SUPABASE_ANON_KEY") as string,
      {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      },
    );
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Not signed in." }, 401);
    }

    const isFreeAccess = Boolean(user.email && FREE_ACCESS_EMAILS.includes(user.email.toLowerCase()));

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") as string,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string,
    );

    // Confirm this surprise actually belongs to the caller before charging
    // anything to it — otherwise anyone signed in could pay to unlock
    // someone else's surprise (or grief them by burning their reference).
    const { data: surprise, error: ownershipError } = await adminClient
      .from("surprises")
      .select("id, her_name, her_nickname")
      .eq("id", surpriseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownershipError || !surprise) {
      return jsonResponse({ error: "Surprise not found." }, 404);
    }

    let finalAmount = PRICE;
    let paystackReference = reference;

    if (isFreeAccess) {
      // No charge, no Paystack call at all -- the reference prefix keeps
      // these visibly distinct from real transactions in surprise_payments.
      finalAmount = 0;
      paystackReference = `FREE_ACCESS_${reference}`;
    } else {
      const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (!paystackSecretKey) {
        return jsonResponse({ error: "PAYSTACK_SECRET_KEY is not configured." }, 500);
      }

      const verifyResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${paystackSecretKey}` } },
      );
      const verifyBody = await verifyResponse.json();

      if (!verifyResponse.ok) {
        console.error(
          "Paystack verify HTTP error",
          verifyResponse.status,
          JSON.stringify(verifyBody),
        );
        return jsonResponse({ error: "Payment could not be verified." }, 402);
      }

      const paidSuccessfully =
        verifyBody?.status === true &&
        verifyBody?.data?.status === "success" &&
        verifyBody?.data?.amount === PRICE * 100;

      if (!paidSuccessfully) {
        console.error("Paystack verify rejected", {
          reference,
          expectedAmount: PRICE,
          paystackStatus: verifyBody?.status,
          transactionStatus: verifyBody?.data?.status,
          transactionAmount: verifyBody?.data?.amount,
          gatewayResponse: verifyBody?.data?.gateway_response,
          message: verifyBody?.message,
        });
        return jsonResponse({ error: "Payment could not be verified." }, 402);
      }
    }

    // paystack_reference is unique on surprise_payments — a reused reference
    // fails here with a unique violation instead of granting access twice
    // for one charge.
    const { data: payment, error: insertError } = await adminClient
      .from("surprise_payments")
      .insert({
        surprise_id: surpriseId,
        user_id: user.id,
        tier: TIER,
        amount: finalAmount,
        paystack_reference: paystackReference,
      })
      .select()
      .single();

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 409);
    }

    const herName = surprise.her_nickname || surprise.her_name || "her";

    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: "Payment confirmed",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
            <h1 style="color:#241f27;">You're all set</h1>
            <p style="color:#3d3540; line-height:1.6;">
              Your payment (KSh ${finalAmount}) on ${herName}'s surprise is confirmed. Her link is
              live now.
            </p>
            <p style="color:#8a8290; font-size:13px;">Reference: ${paystackReference}</p>
          </div>
        `,
      });
    }

    await sendAdminEmail({
      subject: `New payment — KSh ${finalAmount}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="color:#241f27;">New payment received</h1>
          <p style="color:#3d3540; line-height:1.6;">
            KSh ${finalAmount}${isFreeAccess ? " (free access)" : ""}<br/>
            Surprise for: ${herName}<br/>
            Paid by: ${user.email ?? user.id}<br/>
            Reference: ${paystackReference}
          </p>
        </div>
      `,
    });

    return jsonResponse({ payment });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Verification failed." },
      500,
    );
  }
});
