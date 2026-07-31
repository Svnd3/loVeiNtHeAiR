import { supabaseUrl, supabaseAnonKey } from './supabaseClient'

// 'basic' / 'super' / 'mixed' / 'custom' are historical values only -- older
// rows in surprise_payments still have whichever of these they actually
// paid for, and SharedSurprise.tsx / songs.ts still honor those
// grandfathered-in tiers via TIER_RANK rather than stripping content
// someone already paid for. 'lite' and 'premium' are the two tiers actually
// on sale now (see TIERS below).
export type Tier = 'basic' | 'super' | 'mixed' | 'premium' | 'custom' | 'lite'

// Accounts that skip Paystack entirely and always get full access for free
// (see TierPaywall.tsx) -- founder/testing accounts only. Visible in the
// shipped bundle either way (client code always is), but that's not the
// actual security boundary: verify-surprise-payment.ts derives the caller's
// identity from their own signed-in session server-side, so this only ever
// helps someone who can already sign in as one of these exact addresses.
// Kept in sync with FREE_ACCESS_EMAILS in
// supabase/functions/verify-surprise-payment/index.ts.
export const FREE_ACCESS_EMAILS = [
  'hezronsande2@gmail.com',
  'clivemuturi@gmail.com',
  'jt@internal.loveintheair.app',
]

export type TierConfig = {
  id: Tier
  name: string
  amount: number
  tagline: string
  features: string[]
}

// Two tiers, same feature set -- Lite just caps how many photos he can add
// per category (see LITE_PHOTO_LIMIT), everything else (song upload,
// attachment, guess-the-gift, know-me quiz, custom questions) is identical
// between them. Kept in sync with the TIERS map in
// supabase/functions/verify-surprise-payment/index.ts, which re-checks
// these amounts server-side against what Paystack actually confirms -- this
// copy only drives what the UI shows and what amount gets sent to Paystack.
export const LITE_PRICE = 199
export const PREMIUM_PRICE = 249
// Kept for any old callers that just want "the" full price.
export const PRICE = PREMIUM_PRICE

export const LITE_PHOTO_LIMIT = 8

// Lite isn't publicly offered right now -- only these exact addresses ever
// see it as an option in TierPaywall; everyone else only sees Premium.
// Kept in sync with LITE_TIER_EMAILS in
// supabase/functions/verify-surprise-payment/index.ts, which is what
// actually enforces this (a request for "lite" from anyone else is
// rejected there regardless of what the client shows).
export const LITE_TIER_EMAILS = ['jenipherkar4nja@gmail.com']

export const TIERS: TierConfig[] = [
  {
    id: 'lite',
    name: 'Basic',
    amount: LITE_PRICE,
    tagline: `Everything included, up to ${LITE_PHOTO_LIMIT} photos per category`,
    features: [
      'Her & your profiles, letter, memories and places',
      `Up to ${LITE_PHOTO_LIMIT} photos each for her, you, and your places`,
      'The scratch-card gift reveal',
      'Every song in the library, or upload your own',
      'Ask her as many of your own questions as you want',
      '"How well do you know me?" mini-quiz',
      'Attach the real ticket, reservation, or invite to the gift card',
    ],
  },
  {
    id: 'premium',
    name: 'Send it',
    amount: PREMIUM_PRICE,
    tagline: 'Everything included, no photo limit',
    features: [
      'Her & your profiles, photos, letter, memories and places',
      'The scratch-card gift reveal',
      'Every song in the library, or upload your own',
      'Ask her as many of your own questions as you want',
      '"How well do you know me?" mini-quiz',
      'Attach the real ticket, reservation, or invite to the gift card',
    ],
  },
]

// 'lite' ranks alongside 'premium' on purpose -- every existing
// TIER_RANK[data.tier] >= TIER_RANK.premium check (attachment, guess-the-gift,
// upload-your-own song) and `tier !== 'basic'` check (know-me quiz, custom
// gate questions) should keep treating it as full access. The only thing
// that actually looks for 'lite' specifically is the photo-count cap in
// SharedSurprise.tsx.
export const TIER_RANK: Record<Tier, number> = {
  basic: 0,
  super: 1,
  mixed: 2,
  premium: 3,
  lite: 3,
  custom: 4,
}

export function tierConfig(id: Tier): TierConfig {
  return TIERS.find((t) => t.id === id) ?? TIERS[0]
}

const VERIFY_PAYMENT_URL = `${supabaseUrl}/functions/v1/verify-surprise-payment`

export function generatePaymentReference(tierId: Tier) {
  return `LOVEINTHEAIR_${tierId.toUpperCase()}_${Date.now()}`
}

export async function verifySurprisePayment({
  reference,
  tier,
  surpriseId,
  accessToken,
}: {
  reference: string
  tier: Tier
  surpriseId: string
  accessToken: string
}) {
  const response = await fetch(VERIFY_PAYMENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ reference, tier, surpriseId }),
    signal: AbortSignal.timeout(20000),
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body?.error || `Payment verification failed (${response.status}).`)
  }

  return body.payment as { tier: Tier; amount: number; paystack_reference: string }
}
