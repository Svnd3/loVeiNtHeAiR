import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './ResetPassword.css'

function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setError('')
    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <main className="reset-password-page">
        <div className="reset-password-card">
          <h1>Password updated</h1>
          <p>You're all set — that's your new password from now on.</p>
          <button type="button" className="reset-password-card__submit" onClick={() => navigate('/account')}>
            Continue to your account
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="reset-password-page">
      <div className="reset-password-card">
        <h1>Set a new password</h1>
        <p>Choose something you haven't used here before.</p>

        <form onSubmit={handleSubmit}>
          <label className="reset-password-card__field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </label>
          <label className="reset-password-card__field">
            <span>Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>

          {error && <p className="reset-password-card__error">{error}</p>}

          <button type="submit" className="reset-password-card__submit" disabled={submitting}>
            {submitting ? 'saving…' : 'save new password'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default ResetPassword
