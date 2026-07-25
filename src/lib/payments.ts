import { supabaseUrl, supabaseAnonKey } from './supabaseClient'

export type Tier = 'basic' | 'super' | 'premium'

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
    features: ['Everything in Basic', 'A few extra songs from the library', 'No loveintheair mark on her page'],
  },
  {
    id: 'premium',
    name: 'Premium',
    amount: 759,
    tagline: 'Go all out',
    features: [
      'Everything in Super',
      'Upload your own song instead of the library',
      'Attach the real ticket, reservation, or invite to the gift card',
      'An extra flourish on the final reveal',
    ],
  },
]

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
