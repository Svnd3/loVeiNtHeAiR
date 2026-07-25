import { useRef, useState } from 'react'
import { TIERS, generatePaymentReference, verifySurprisePayment, type Tier } from '../lib/payments'
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
  onSuccess,
  onClose,
}: {
  surpriseId: string
  userEmail: string
  accessToken: string
  onSuccess: (tier: Tier) => void
  onClose?: () => void
}) {
  const [selectedTierId, setSelectedTierId] = useState<Tier | null>(null)
  const [stage, setStage] = useState<'idle' | 'confirming' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const confirmingRef = useRef(false)

  const handlePickTier = (tier: (typeof TIERS)[number]) => {
    if (stage === 'confirming') return
    setSelectedTierId(tier.id)
    setErrorMessage('')

    if (!window.PaystackPop) {
      setErrorMessage('Payment is unavailable right now. Please try again shortly.')
      return
    }

    const reference = generatePaymentReference(tier.id)

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: userEmail || 'creator@loveintheair.app',
      amount: tier.amount * 100,
      currency: 'KES',
      channels: ['mobile_money', 'card'],
      ref: reference,
      label: `loveintheair — ${tier.name}`,
      callback: (response) => {
        confirmingRef.current = true
        setStage('confirming')
        verifySurprisePayment({ reference: response.reference, tier: tier.id, surpriseId, accessToken })
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
          {TIERS.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => handlePickTier(tier)}
              disabled={stage === 'confirming'}
              className={`tier-paywall__tier ${selectedTierId === tier.id ? 'tier-paywall__tier--selected' : ''}`}
            >
              <div className="tier-paywall__tier-head">
                <span className="tier-paywall__tier-name">{tier.name}</span>
                <span className="tier-paywall__tier-amount">KSh {tier.amount}</span>
              </div>
              <p className="tier-paywall__tier-tagline">{tier.tagline}</p>
              <ul className="tier-paywall__tier-features">
                {tier.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </button>
          ))}
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
