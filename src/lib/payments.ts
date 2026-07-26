import { supabaseUrl, supabaseAnonKey } from './supabaseClient'
import { resolveLibrarySong, type SongChoice } from '../features/surprise/songs'

export type Tier = 'basic' | 'super' | 'premium'

// Accounts that skip Paystack entirely and get whatever tier they pick for
// free (see TierPaywall.tsx) -- founder/testing accounts only. Visible in the
// shipped bundle either way (client code always is), but that's not the
// actual security boundary: verify-surprise-payment.ts derives the caller's
// identity from their own signed-in session server-side, so this only ever
// helps someone who can already sign in as one of these exact addresses.
// Kept in sync with FREE_ACCESS_EMAILS in
// supabase/functions/verify-surprise-payment/index.ts.
export const FREE_ACCESS_EMAILS = ['hezronsande2@gmail.com']

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
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    amount: 759,
    tagline: 'Go all out',
    features: [
      'Everything in Super',
      'Ask her as many of your own questions as you want',
      'Upload your own song instead of the library',
      'Attach the real ticket, reservation, or invite to the gift card',
      'An extra flourish on the final reveal',
    ],
  },
]

export const TIER_RANK: Record<Tier, number> = { basic: 0, super: 1, premium: 2 }

// Charged instead of the normal 759 when content needs Premium only because
// it mixes a Super-only extra with a Premium-only one at the same time (e.g.
// a Super-tier library song plus a second question) -- not because he
// actually used Premium's own big extras (uploaded song, gift attachment).
// Kept in sync with supabase/functions/verify-surprise-payment/index.ts,
// which re-derives and enforces this same amount server-side.
export const MIXED_TIER_AMOUNT = 620

export type PricingResult = {
  // The cheapest tier this content actually qualifies for -- TierPaywall
  // disables any tier ranked below this and points him at what to remove if
  // he wants a cheaper one instead.
  requiredTier: Tier
  amount: number
  mixed: boolean
}

// Determines the minimum tier (and its price) that what he's actually filled
// in requires, so the paywall can refuse to sell a tier that would silently
// get its content stripped at display time (see songForTier/giftForTier/
// questionsForTier in SharedSurprise.tsx).
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
  const usesPremiumOnlyFeature = song?.type === 'upload' || hasGiftAttachment || questionCount >= 2

  const priceOf = (tier: Tier) => TIERS.find((t) => t.id === tier)!.amount

  if (usesPremiumOnlyFeature && usesSuperOnlyFeature) {
    return { requiredTier: 'premium', amount: MIXED_TIER_AMOUNT, mixed: true }
  }
  if (usesPremiumOnlyFeature) {
    return { requiredTier: 'premium', amount: priceOf('premium'), mixed: false }
  }
  if (usesSuperOnlyFeature) {
    return { requiredTier: 'super', amount: priceOf('super'), mixed: false }
  }
  return { requiredTier: 'basic', amount: priceOf('basic'), mixed: false }
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
