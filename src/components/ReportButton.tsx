import { useState } from 'react'
import { reportSurprise } from '../lib/report'
import './ReportButton.css'

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 21V4a1 1 0 0 1 1-1h11.5a1 1 0 0 1 .8 1.6L15 9l3.3 4.4a1 1 0 0 1-.8 1.6H6" />
    </svg>
  )
}

// Small always-accessible corner button that lets anyone -- her, a random
// visitor, anyone -- flag a page's content to the site owner without needing
// to be signed in. `surpriseId` is passed on the pages that actually show
// one person's uploaded content (SharedSurprise, the /surprise demo); Home
// doesn't have one, and report-surprise.ts is fine with that (just less
// context in the email).
function ReportButton({ surpriseId }: { surpriseId?: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [stage, setStage] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const close = () => {
    if (stage === 'sending') return
    setOpen(false)
    setReason('')
    setStage('idle')
    setErrorMessage('')
  }

  const submit = async () => {
    if (!reason.trim() || stage === 'sending') return
    setStage('sending')
    setErrorMessage('')
    try {
      await reportSurprise({ surpriseId, reason: reason.trim() })
      setStage('sent')
    } catch (err) {
      setStage('error')
      setErrorMessage(err instanceof Error ? err.message : 'Could not submit report. Please try again.')
    }
  }

  return (
    <>
      <button
        type="button"
        className="report-button"
        onClick={() => setOpen(true)}
        aria-label="Report this"
      >
        <FlagIcon />
        Report
      </button>

      {open && (
        <div className="report-modal-overlay" onClick={close}>
          <div className="report-modal" onClick={(event) => event.stopPropagation()}>
            {stage === 'sent' ? (
              <>
                <h2 className="report-modal__title">Report sent</h2>
                <p className="report-modal__text">
                  Thanks for flagging this — we'll take a look.
                </p>
                <button type="button" className="report-modal__close-btn" onClick={close}>
                  Close
                </button>
              </>
            ) : (
              <>
                <h2 className="report-modal__title">Report this</h2>
                <p className="report-modal__text">
                  Tell us what's wrong — abusive content, harassment, spam, anything that
                  shouldn't be here.
                </p>
                <textarea
                  className="report-modal__textarea"
                  placeholder="What's the issue?"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  autoFocus
                />
                {errorMessage && <p className="report-modal__error">{errorMessage}</p>}
                <div className="report-modal__actions">
                  <button type="button" className="report-modal__cancel" onClick={close}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="report-modal__submit"
                    onClick={submit}
                    disabled={!reason.trim() || stage === 'sending'}
                  >
                    {stage === 'sending' ? 'Sending…' : 'Submit report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default ReportButton
