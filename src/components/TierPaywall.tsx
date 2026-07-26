import { useRef, useState } from 'react'
import {
  TIERS,
  TIER_RANK,
  FREE_ACCESS_EMAILS,
  generatePaymentReference,
  verifySurprisePayment,
  type PricingResult,
  type Tier,
} from '../lib/payments'
import './TierPaywall.css'

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: {
        key: string
        email: string
        amount: number
        currency: string
        channels: string[]
        ref: string
        label: string
        callback: (response: { reference: string }) => void
        onClose: () => void
      }) => { openIframe: () => void }
    }
  }
}

// Mounted by the parent only while the paywall should be visible — that way
// each appearance starts from fresh state instead of needing an effect to
// reset it on reopen (same pattern as shareitt's TierPaywall).
export default function TierPaywall({
  surpriseId,
  userEmail,
  accessToken,
  pricing,
  onSuccess,
  onClose,
}: {
  surpriseId: string
  userEmail: string
  accessToken: string
  // What he actually filled in requires at least `pricing.requiredTier` —
  // any tier ranked below that gets disabled below rather than sold for a
  // price that wouldn't actually show everything he added.
  pricing: PricingResult
  onSuccess: (tier: Tier) => void
  onClose?: () => void
}) {
  const [selectedTierId, setSelectedTierId] = useState<Tier | null>(null)
  const [stage, setStage] = useState<'idle' | 'confirming' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const confirmingRef = useRef(false)

  // Only the exact required tier can carry the mixed-pricing discount —
  // choosing to pay for something ranked above the minimum is a voluntary
  // upgrade and always costs that tier's normal listed price.
  const amountFor = (tier: (typeof TIERS)[number]) =>
    tier.id === pricing.requiredTier ? pricing.amount : tier.amount

  const isFreeAccess = FREE_ACCESS_EMAILS.includes(userEmail.toLowerCase())

  const confirmPayment = (reference: string, tier: Tier) => {
    confirmingRef.current = true
    setStage('confirming')
    verifySurprisePayment({ reference, tier, surpriseId, accessToken })
      .then((payment) => {
        confirmingRef.current = false
        setStage('idle')
        onSuccess(payment.tier)
      })
      .catch((error: Error) => {
        confirmingRef.current = false
        setStage('error')
        setErrorMessage(error.message || "We couldn't confirm this payment. Please try again.")
      })
  }

  const handlePickTier = (tier: (typeof TIERS)[number]) => {
    if (stage === 'confirming') return
    if (TIER_RANK[tier.id] < TIER_RANK[pricing.requiredTier]) return
    setSelectedTierId(tier.id)
    setErrorMessage('')

    // Founder/testing accounts (see FREE_ACCESS_EMAILS) skip Paystack
    // entirely -- verify-surprise-payment recognizes the same address
    // server-side and grants the tier without ever checking a reference.
    if (isFreeAccess) {
      confirmPayment(generatePaymentReference(tier.id), tier.id)
      return
    }

    if (!window.PaystackPop) {
      setErrorMessage('Payment is unavailable right now. Please try again shortly.')
      return
    }

    const reference = generatePaymentReference(tier.id)

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: userEmail || 'creator@loveintheair.app',
      amount: amountFor(tier) * 100,
      currency: 'KES',
      channels: ['mobile_money', 'card'],
      ref: reference,
      label: `loveintheair — ${tier.name}`,
      callback: (response) => {
        confirmPayment(response.reference, tier.id)
      },
      onClose: () => {
        if (!confirmingRef.current) setSelectedTierId(null)
      },
    })

    handler.openIframe()
  }

  return (
    <div className="tier-paywall">
      <div className="tier-paywall__card">
        <div className="tier-paywall__header">
          <div>
            <p className="tier-paywall__eyebrow">One last step</p>
            <h2 className="tier-paywall__title">Pick how you want to send it</h2>
            <p className="tier-paywall__subtitle">
              Everything you just filled in is saved. Choose a tier to get her link.
            </p>
            {pricing.requiredTier !== 'basic' && (
              <p className="tier-paywall__subtitle">
                What you added needs at least <strong>{TIERS.find((t) => t.id === pricing.requiredTier)?.name}</strong> to
                show — go back and remove the extra song/questions/attachment if you want a cheaper tier instead.
              </p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={stage === 'confirming'}
              className="tier-paywall__close"
              aria-label="Finish later"
            >
              ×
            </button>
          )}
        </div>

        <div className="tier-paywall__tiers">
          {TIERS.map((tier) => {
            const locked = TIER_RANK[tier.id] < TIER_RANK[pricing.requiredTier]
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => handlePickTier(tier)}
                disabled={stage === 'confirming' || locked}
                aria-disabled={locked}
                className={`tier-paywall__tier ${selectedTierId === tier.id ? 'tier-paywall__tier--selected' : ''} ${locked ? 'tier-paywall__tier--locked' : ''}`}
              >
                <div className="tier-paywall__tier-head">
                  <span className="tier-paywall__tier-name">{tier.name}</span>
                  <span className="tier-paywall__tier-amount">KSh {amountFor(tier)}</span>
                </div>
                <p className="tier-paywall__tier-tagline">{tier.tagline}</p>
                <ul className="tier-paywall__tier-features">
                  {tier.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                {locked && (
                  <p className="tier-paywall__tier-locked-note">
                    Needs what you added — pick {TIERS.find((t) => t.id === pricing.requiredTier)?.name} instead
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {stage === 'confirming' && (
          <p className="tier-paywall__status">Confirming payment…</p>
        )}
        {errorMessage && <p className="tier-paywall__error">{errorMessage}</p>}

        <p className="tier-paywall__footnote">Secured by Paystack · SSL encrypted</p>
      </div>
    </div>
  )
}
