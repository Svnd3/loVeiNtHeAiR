import { supabaseUrl, supabaseAnonKey } from './supabaseClient'
import { resolveLibrarySong, type SongChoice } from '../features/surprise/songs'

export type Tier = 'basic' | 'super' | 'mixed' | 'premium' | 'custom'

// Accounts that skip Paystack entirely and always get the full Premium
// experience for free (see TierPaywall.tsx / verify-surprise-payment, which
// forces the granted tier to 'premium' server-side regardless of which card
// they click) -- founder/testing accounts only. Visible in the shipped
// bundle either way (client code always is), but that's not the actual
// security boundary: verify-surprise-payment.ts derives the caller's
// identity from their own signed-in session server-side, so this only ever
// helps someone who can already sign in as one of these exact addresses.
// Kept in sync with FREE_ACCESS_EMAILS in
// supabase/functions/verify-surprise-payment/index.ts.
export const FREE_ACCESS_EMAILS = ['hezronsande2@gmail.com', 'clivemuturi@gmail.com']

export type TierConfig = {
  id: Tier
  name: string
  amount: number
  tagline: string
  features: string[]
}

// Kept in sync with the TIERS map in
// supabase/functions/verify-surprise-payment/index.ts, which re-checks this
// amount server-side against what Paystack actually confirms — this copy
// only drives what the UI shows and what amount gets sent to Paystack.
//
// The gate question (see LoveQuiz.tsx / SharedSurprise.tsx) scales with
// tier: Basic always gets the fixed "Do you believe in love?", Super gets
// exactly one of his own, Premium gets as many as he writes.
export const TIERS: TierConfig[] = [
  {
    id: 'basic',
    name: 'Basic',
    amount: 499,
    tagline: 'Everything you wrote, beautifully told',
    features: [
      'Her & your profiles, photos, letter, memories and places',
      'The scratch-card gift reveal',
      'Most songs from the library',
    ],
  },
  {
    id: 'super',
    name: 'Super',
    amount: 599,
    tagline: 'Make it sound like the two of you',
    features: [
      'Everything in Basic',
      'A few extra songs from the library',
      'No loveintheair mark on her page',
      'Ask her your own yes/no question instead of the default one',
      '"How well do you know me?" 3-question mini-quiz',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    amount: 649,
    tagline: 'Go all out',
    features: [
      'Everything in Super',
      'Ask her as many of your own questions as you want',
      'Upload your own song instead of the library',
      'Attach the real ticket, reservation, or invite to the gift card',
      'An extra flourish on the final reveal',
    ],
  },
  {
    id: 'custom',
    name: 'Custom',
    amount: 4999,
    tagline: "Let us build it with you",
    features: [
      'Everything in Premium',
      'Completely redesigned around exactly what you want',
      'Direct back-and-forth with the creator until it feels right',
    ],
  },
]

// Not one of the always-offered TIERS above -- Mixed only ever shows up in
// TierPaywall when computePricing() below actually lands on it, for content
// that genuinely spans a Super-only extra and a Premium-only one at once. Its
// cap (3 questions, no song upload/attachment/final-reveal flourish) is what
// keeps it a real notch below Premium rather than Premium at a discount.
export const MIXED_TIER: TierConfig = {
  id: 'mixed',
  name: 'Mixed',
  amount: 620,
  tagline: 'A bit of both',
  features: [
    'Everything in Super',
    'A couple of extra questions (up to 3)',
  ],
}

export const MIXED_QUESTION_CAP = 3

export const TIER_RANK: Record<Tier, number> = { basic: 0, super: 1, mixed: 2, premium: 3, custom: 4 }

export function tierConfig(id: Tier): TierConfig {
  return id === 'mixed' ? MIXED_TIER : TIERS.find((t) => t.id === id)!
}

export type PricingResult = {
  // The cheapest tier this content actually qualifies for -- TierPaywall
  // disables any tier ranked below this and points him at what to remove if
  // he wants a cheaper one instead.
  requiredTier: Tier
  amount: number
}

// Determines the minimum tier (and its price) that what he's actually filled
// in requires, so the paywall can refuse to sell a tier that would silently
// get its content stripped at display time (see songForTier/giftForTier/
// questionsForTier in SharedSurprise.tsx).
//
// Song upload and a gift attachment are Premium's real differentiators --
// either one always requires full Premium, no Mixed discount available.
// Mixed exists only for the smaller case: a Super-tier song pick combined
// with more than one question, neither of which alone needs more than Super.
export function computePricing({
  song,
  hasGiftAttachment,
  questionCount,
}: {
  song: SongChoice | null | undefined
  hasGiftAttachment: boolean
  questionCount: number
}): PricingResult {
  const librarySongTier = resolveLibrarySong(song ?? undefined)?.tier
  const usesSuperOnlyFeature = librarySongTier === 'super' || questionCount === 1
  const usesBigPremiumFeature = song?.type === 'upload' || hasGiftAttachment
  const hasExtraQuestions = questionCount >= 2

  if (usesBigPremiumFeature || (hasExtraQuestions && !usesSuperOnlyFeature)) {
    return { requiredTier: 'premium', amount: tierConfig('premium').amount }
  }
  if (usesSuperOnlyFeature && hasExtraQuestions) {
    return { requiredTier: 'mixed', amount: MIXED_TIER.amount }
  }
  if (usesSuperOnlyFeature) {
    return { requiredTier: 'super', amount: tierConfig('super').amount }
  }
  return { requiredTier: 'basic', amount: tierConfig('basic').amount }
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
