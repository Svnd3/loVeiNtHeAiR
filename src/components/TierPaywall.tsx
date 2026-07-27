import { useRef, useState } from 'react'
import {
  TIERS,
  FREE_ACCESS_EMAILS,
  generatePaymentReference,
  verifySurprisePayment,
  type PricingResult,
  type Tier,
} from '../lib/payments'
import './TierPaywall.css'

declare global {
  interface Window {
    // v2 Inline JS (required for Apple Pay — v1 doesn't support it). The
    // checkout() method auto-detects Apple devices/Safari and shows an Apple
    // Pay button ahead of the normal checkout, with no extra markup needed.
    PaystackPop?: new () => {
      checkout: (config: {
        key: string
        email: string
        amount: number
        currency: string
        channels: string[]
        ref: string
        onSuccess: (transaction: { reference: string }) => void
        onCancel: () => void
        onError?: (error: { message: string }) => void
      }) => Promise<void>
    }
  }
}

const TIER = TIERS[0]

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
  // Unused now that there's a single flat price -- kept so callers (Details.tsx,
  // Account.tsx) don't need to change what they pass in.
  pricing?: PricingResult
  onSuccess: (tier: Tier) => void
  onClose?: () => void
}) {
  const [stage, setStage] = useState<'idle' | 'paying' | 'confirming' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const confirmingRef = useRef(false)

  const isFreeAccess = FREE_ACCESS_EMAILS.includes(userEmail.toLowerCase())

  const confirmPayment = (reference: string) => {
    confirmingRef.current = true
    setStage('confirming')
    verifySurprisePayment({ reference, tier: TIER.id, surpriseId, accessToken })
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

  const handlePay = () => {
    if (stage === 'paying' || stage === 'confirming') return
    setStage('paying')
    setErrorMessage('')

    // Founder/testing accounts (see FREE_ACCESS_EMAILS) skip Paystack
    // entirely -- verify-surprise-payment recognizes the same address
    // server-side and grants access without ever checking a reference.
    if (isFreeAccess) {
      confirmPayment(generatePaymentReference(TIER.id))
      return
    }

    if (!window.PaystackPop) {
      setStage('error')
      setErrorMessage('Payment is unavailable right now. Please try again shortly.')
      return
    }

    const reference = generatePaymentReference(TIER.id)
    const paystackPop = new window.PaystackPop()

    paystackPop.checkout({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: userEmail || 'creator@loveintheair.app',
      amount: TIER.amount * 100,
      currency: 'KES',
      // Apple Pay only shows up on Apple devices/Safari; everyone else still
      // sees the normal checkout with these channels.
      channels: ['mobile_money', 'card'],
      ref: reference,
      onSuccess: (transaction) => {
        confirmPayment(transaction.reference)
      },
      onCancel: () => {
        if (!confirmingRef.current) setStage('idle')
      },
      onError: (error) => {
        setStage('error')
        setErrorMessage(error.message || "We couldn't start this payment. Please try again.")
      },
    })
  }

  return (
    <div className="tier-paywall">
      <div className="tier-paywall__card">
        <div className="tier-paywall__header">
          <div>
            <p className="tier-paywall__eyebrow">One last step</p>
            <h2 className="tier-paywall__title">Send her the link</h2>
            <p className="tier-paywall__subtitle">Everything you just filled in is saved.</p>
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

        <div className="tier-paywall__single">
          <div className="tier-paywall__tier-head">
            <span className="tier-paywall__tier-name">{TIER.tagline}</span>
            <span className="tier-paywall__tier-amount">KSh {TIER.amount}</span>
          </div>
          <ul className="tier-paywall__tier-features">
            {TIER.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          className="tier-paywall__pay-btn"
          onClick={handlePay}
          disabled={stage === 'paying' || stage === 'confirming'}
        >
          {stage === 'confirming' ? 'Confirming payment…' : `Pay KSh ${TIER.amount}`}
        </button>

        {errorMessage && <p className="tier-paywall__error">{errorMessage}</p>}

        <p className="tier-paywall__footnote">Secured by Paystack · SSL encrypted</p>
      </div>
    </div>
  )
}
