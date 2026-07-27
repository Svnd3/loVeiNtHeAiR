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

// Kept in sync with TIERS/MIXED_TIER in src/lib/payments.ts, which only
// drives what the UI shows and what amount gets sent to Paystack -- this
// copy is what actually enforces the price. "mixed" isn't one of the normal
// always-offered tiers (see computeRequiredPricing below for when it applies)
// but is a real value surprise_payments.tier accepts. "custom" is the
// always-offered bespoke tier -- never auto-selected by
// computeRequiredPricing, only ever chosen voluntarily in TierPaywall, same
// as any tier ranked above whatever the content actually requires.
const TIERS: Record<string, number> = {
  basic: 499,
  super: 599,
  mixed: 620,
  premium: 649,
  custom: 4999,
};

const TIER_RANK: Record<string, number> = { basic: 0, super: 1, mixed: 2, premium: 3, custom: 4 };

// Mirrors the `tier: 'super'` entries in src/features/surprise/songs.ts --
// duplicated here (small, stable list) rather than imported since this runs
// in Deno, not the Vite bundle.
const SUPER_TIER_SONG_IDS = ["chai-ya-saa-kumi", "slowly", "beta", "coming-home"];

// Founder/testing accounts -- skip Paystack entirely and always get the full
// Premium experience (full-quality photos, no watermark, unlimited
// questions, everything) at KSh 0, regardless of which tier card they
// actually click. Kept in sync with FREE_ACCESS_EMAILS in
// src/lib/payments.ts. Safe to keep server-side even though the client also
// knows this list: the caller's email still has to come from their own
// signed-in session below, never from anything the client claims.
const FREE_ACCESS_EMAILS = ["hezronsande2@gmail.com", "clivemuturi@gmail.com"];

// Re-derives the same minimum tier + price that TierPaywall.tsx's
// computePricing() shows him client-side, straight from what's actually
// saved on the row -- so paying for a cheaper tier than the surprise's real
// content needs is rejected here regardless of what the client claims.
//
// Song upload and a gift attachment are Premium's real differentiators --
// either one always requires full Premium, no Mixed discount available.
// Mixed exists only for the smaller case: a Super-tier song pick combined
// with more than one question, neither of which alone needs more than Super.
function computeRequiredPricing(surprise: {
  song: { type?: string; id?: string } | null;
  gift: { attachment?: string } | null;
  questions: string[] | null;
}) {
  const questionCount = (surprise.questions ?? []).filter((q) => q.trim()).length;
  const usesSuperOnlyFeature =
    (surprise.song?.type === "library" && SUPER_TIER_SONG_IDS.includes(surprise.song.id ?? "")) ||
    questionCount === 1;
  const usesBigPremiumFeature = surprise.song?.type === "upload" || Boolean(surprise.gift?.attachment);
  const hasExtraQuestions = questionCount >= 2;

  if (usesBigPremiumFeature || (hasExtraQuestions && !usesSuperOnlyFeature)) {
    return { requiredTier: "premium", amount: TIERS.premium };
  }
  if (usesSuperOnlyFeature && hasExtraQuestions) {
    return { requiredTier: "mixed", amount: TIERS.mixed };
  }
  if (usesSuperOnlyFeature) {
    return { requiredTier: "super", amount: TIERS.super };
  }
  return { requiredTier: "basic", amount: TIERS.basic };
}

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
    const { reference, tier, surpriseId } = await req.json();

    if (!reference || typeof reference !== "string") {
      return jsonResponse({ error: "Missing payment reference." }, 400);
    }
    if (!surpriseId || typeof surpriseId !== "string") {
      return jsonResponse({ error: "Missing surprise id." }, 400);
    }
    if (!TIERS[tier]) {
      return jsonResponse({ error: "Unknown tier." }, 400);
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
    // Always Premium for free-access accounts -- whatever card he clicked in
    // TierPaywall, there's no reason a free grant should ever leave him with
    // compressed photos, a watermark, or a capped question count.
    const effectiveTier = isFreeAccess ? "premium" : tier;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") as string,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string,
    );

    // Confirm this surprise actually belongs to the caller before charging
    // anything to it — otherwise anyone signed in could pay to unlock
    // someone else's surprise (or grief them by burning their reference).
    const { data: surprise, error: ownershipError } = await adminClient
      .from("surprises")
      .select("id, her_name, her_nickname, song, gift, questions")
      .eq("id", surpriseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownershipError || !surprise) {
      return jsonResponse({ error: "Surprise not found." }, 404);
    }

    // What he's actually saved may need a higher tier than the one he's
    // trying to pay for -- re-derived here from the row itself, never
    // trusted from the client, same reasoning as the ownership check above.
    const pricing = computeRequiredPricing(surprise);
    if (!isFreeAccess && TIER_RANK[effectiveTier] < TIER_RANK[pricing.requiredTier]) {
      return jsonResponse(
        {
          error: `What you added needs at least the ${pricing.requiredTier} tier — remove the extra song/questions/attachment if you want a cheaper one.`,
        },
        400,
      );
    }
    const expectedAmount =
      effectiveTier === pricing.requiredTier ? pricing.amount : TIERS[effectiveTier];

    let finalAmount = expectedAmount;
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
        verifyBody?.data?.amount === expectedAmount * 100;

      if (!paidSuccessfully) {
        console.error("Paystack verify rejected", {
          tier,
          reference,
          expectedAmount,
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
    // fails here with a unique violation instead of granting a second tier
    // for one charge.
    const { data: payment, error: insertError } = await adminClient
      .from("surprise_payments")
      .insert({
        surprise_id: surpriseId,
        user_id: user.id,
        tier: effectiveTier,
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
        subject: `Payment confirmed — ${effectiveTier} tier`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
            <h1 style="color:#241f27;">You're all set</h1>
            <p style="color:#3d3540; line-height:1.6;">
              Your payment for the <strong>${effectiveTier}</strong> tier (KSh ${finalAmount}) on
              ${herName}'s surprise is confirmed. Her link is live now.
            </p>
            <p style="color:#8a8290; font-size:13px;">Reference: ${paystackReference}</p>
          </div>
        `,
      });
    }

    await sendAdminEmail({
      subject: `New payment — ${effectiveTier} (KSh ${finalAmount})`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="color:#241f27;">New payment received</h1>
          <p style="color:#3d3540; line-height:1.6;">
            <strong>${effectiveTier}</strong> tier — KSh ${finalAmount}${isFreeAccess ? " (free access)" : ""}<br/>
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
