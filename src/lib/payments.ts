import { supabaseUrl, supabaseAnonKey } from './supabaseClient'

// Historical values only -- every surprise now costs the same flat PRICE
// (see below), but older rows in surprise_payments still have whichever of
// these they actually paid for, and SharedSurprise.tsx / songs.ts still
// honor those grandfathered-in tiers via TIER_RANK rather than stripping
// content someone already paid for.
export type Tier = 'basic' | 'super' | 'mixed' | 'premium' | 'custom'

// Accounts that skip Paystack entirely and always get full access for free
// (see TierPaywall.tsx) -- founder/testing accounts only. Visible in the
// shipped bundle either way (client code always is), but that's not the
// actual security boundary: verify-surprise-payment.ts derives the caller's
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

// One flat price, everything included -- no more per-feature tier gating.
// Kept in sync with TIERS in supabase/functions/verify-surprise-payment/index.ts,
// which re-checks this amount server-side against what Paystack actually
// confirms -- this copy only drives what the UI shows and what amount gets
// sent to Paystack.
export const PRICE = 359

export const TIERS: TierConfig[] = [
  {
    id: 'premium',
    name: 'Send it',
    amount: PRICE,
    tagline: 'Everything included, no tiers to think about',
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

export const TIER_RANK: Record<Tier, number> = { basic: 0, super: 1, mixed: 2, premium: 3, custom: 4 }

export function tierConfig(id: Tier): TierConfig {
  return TIERS.find((t) => t.id === id) ?? TIERS[0]
}

export type PricingResult = {
  requiredTier: Tier
  amount: number
}

// Every surprise costs the same flat PRICE now, regardless of what he filled
// in -- TierPaywall just shows the one option. (Older surprises paid for
// under the previous tiered system keep whatever they already bought; see
// TIER_RANK usage in SharedSurprise.tsx / songs.ts.)
export function computePricing(): PricingResult {
  return { requiredTier: 'premium', amount: PRICE }
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
