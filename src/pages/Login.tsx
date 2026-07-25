import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { sendWelcomeEmail } from '../lib/notifications'
import './Login.css'

function maskEmail(value: string) {
  const at = value.indexOf('@')
  if (at <= 0) return value
  const name = value.slice(0, at)
  const domain = value.slice(at)
  if (name.length <= 2) return `${name[0]}*${domain}`
  const stars = '*'.repeat(Math.min(name.length - 2, 4))
  return `${name[0]}${stars}${name[name.length - 1]}${domain}`
}

function throttle<T extends (event: Event) => void>(fn: T, wait: number) {
  let last = 0
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (event: Event) => {
    const now = Date.now()
    const remaining = wait - (now - last)
    if (remaining <= 0) {
      last = now
      fn(event)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        last = Date.now()
        timeout = null
        fn(event)
      }, remaining)
    }
  }
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg
      className="field-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      className="field-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

function Login() {
  const navigate = useNavigate()
  const { session } = useAuth()

  const faceRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (session) navigate('/details', { replace: true })
  }, [session, navigate])

  // Wires up the dog animation: head turn on typing, hands cover eyes on password focus.
  useEffect(() => {
    const container = containerRef.current
    const face = faceRef.current
    const emailInput = emailRef.current
    const passwordInput = passwordRef.current
    if (!container || !face || !emailInput || !passwordInput) return

    const hands = Array.from(container.querySelectorAll<HTMLElement>('.hand'))
    const tongue = container.querySelector<HTMLElement>('.tongue')

    const onPasswordFocus = () => {
      hands.forEach((hand) => hand.classList.add('hide'))
      tongue?.classList.remove('breath')
    }
    const onPasswordBlur = () => {
      hands.forEach((hand) => {
        hand.classList.remove('hide')
        hand.classList.remove('peek')
      })
      tongue?.classList.add('breath')
    }

    const rotateFromLength = (value: string) => {
      const length = Math.min(value.length - 16, 19)
      face.style.setProperty('--rotate-head', `${-length}deg`)
    }

    const onEmailFocus = () => {
      hands.forEach((hand) => {
        hand.classList.remove('hide')
        hand.classList.remove('peek')
      })
      rotateFromLength(emailInput.value)
    }
    const onEmailBlur = () => {
      face.style.setProperty('--rotate-head', '0deg')
    }
    const onEmailInput = throttle((event: Event) => {
      rotateFromLength((event.target as HTMLInputElement).value)
    }, 100)

    passwordInput.addEventListener('focus', onPasswordFocus)
    passwordInput.addEventListener('blur', onPasswordBlur)
    emailInput.addEventListener('focus', onEmailFocus)
    emailInput.addEventListener('blur', onEmailBlur)
    emailInput.addEventListener('input', onEmailInput)

    return () => {
      passwordInput.removeEventListener('focus', onPasswordFocus)
      passwordInput.removeEventListener('blur', onPasswordBlur)
      emailInput.removeEventListener('focus', onEmailFocus)
      emailInput.removeEventListener('blur', onEmailBlur)
      emailInput.removeEventListener('input', onEmailInput)
    }
  }, [])

  const togglePassword = () => {
    const hands = containerRef.current?.querySelectorAll<HTMLElement>('.hand')
    hands?.forEach((hand) => {
      if (showPassword) {
        hand.classList.remove('peek')
        hand.classList.add('hide')
      } else {
        hand.classList.remove('hide')
        hand.classList.add('peek')
      }
    })
    setShowPassword((prev) => !prev)
  }

  const handleGoogle = async () => {
    if (mode === 'signup' && !agreed) {
      setError('Please agree to the terms to continue.')
      return
    }
    setError('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/details` },
    })
    if (oauthError) setError(oauthError.message)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    if (mode === 'signup' && !agreed) {
      setError('Please agree to the terms to continue.')
      return
    }
    setError('')
    setInfo('')
    setSubmitting(true)

    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) setError(signInError.message)
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (signUpError) {
        setError(signUpError.message)
      } else {
        if (data.user?.email) sendWelcomeEmail(data.user.email)
        if (!data.session) {
          setInfo('Check your email to confirm your account, then sign in.')
          setMode('signin')
        }
      }
    }

    setSubmitting(false)
  }

  const handleForgotPassword = () => {
    setError('')
    if (!email.trim()) {
      setError('Enter your email above first.')
      return
    }
    setForgotOpen(true)
  }

  const confirmReset = async () => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (resetError) {
      setError(resetError.message)
    } else {
      setResetSent(true)
    }
    setForgotOpen(false)
  }

  return (
    <main className="login-page">
      <div className="ear ear--left"></div>
      <div className="ear ear--right"></div>

      <div className="login-page__scroll" ref={containerRef}>
        <div className="face" ref={faceRef}>
          <div className="eyes">
            <div className="eye eye--left">
              <div className="glow"></div>
            </div>
            <div className="eye eye--right">
              <div className="glow"></div>
            </div>
          </div>
          <div className="nose">
            <svg width="38.161" height="22.03">
              <path
                d="M2.017 10.987Q-.563 7.513.157 4.754C.877 1.994 2.976.135 6.164.093 16.4-.04 22.293-.022 32.048.093c3.501.042 5.48 2.081 6.02 4.661q.54 2.579-2.051 6.233-8.612 10.979-16.664 11.043-8.053.063-17.336-11.043z"
                fill="#243946"
              ></path>
            </svg>
            <div className="glow"></div>
          </div>
          <div className="mouth">
            <svg className="smile" viewBox="-2 -2 84 23" width="84" height="23">
              <path
                d="M0 0c3.76 9.279 9.69 18.98 26.712 19.238 17.022.258 10.72.258 28 0S75.959 9.182 79.987.161"
                fill="none"
                strokeWidth={3}
                strokeLinecap="square"
                strokeMiterlimit={3}
              ></path>
            </svg>
            <div className="mouth-hole"></div>
            <div className="tongue breath">
              <div className="tongue-top"></div>
              <div className="line"></div>
              <div className="median"></div>
            </div>
          </div>
        </div>

        <div className="tengah">
          <div className="hands">
            <div className="hand hand--left">
              <div className="finger">
                <div className="bone"></div>
                <div className="nail"></div>
              </div>
              <div className="finger">
                <div className="bone"></div>
                <div className="nail"></div>
              </div>
              <div className="finger">
                <div className="bone"></div>
                <div className="nail"></div>
              </div>
            </div>
            <div className="hand hand--right">
              <div className="finger">
                <div className="bone"></div>
                <div className="nail"></div>
              </div>
              <div className="finger">
                <div className="bone"></div>
                <div className="nail"></div>
              </div>
              <div className="finger">
                <div className="bone"></div>
                <div className="nail"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="tengah">
          <form className="login" onSubmit={handleSubmit}>
            <button type="button" className="google-button" onClick={handleGoogle}>
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="login__divider">
              <span>or</span>
            </div>

            <label>
              <UserIcon />
              <input
                ref={emailRef}
                className="username"
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              <LockIcon />
              <input
                ref={passwordRef}
                className="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="button" className="password-button" onClick={togglePassword}>
                {showPassword ? 'hide' : 'show'}
              </button>
            </label>

            {mode === 'signin' && (
              <button type="button" className="login__forgot" onClick={handleForgotPassword}>
                forgot password?
              </button>
            )}

            {forgotOpen && (
              <div className="login__reset-confirm">
                <p>Send a password reset link to {maskEmail(email.trim())}?</p>
                <div className="login__reset-actions">
                  <button type="button" onClick={() => setForgotOpen(false)}>
                    cancel
                  </button>
                  <button type="button" className="login__reset-confirm-btn" onClick={confirmReset}>
                    send link
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <label className="login__terms">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => {
                    setAgreed(event.target.checked)
                    setError('')
                  }}
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms">Terms &amp; Privacy Policy</Link>
                </span>
              </label>
            )}

            {resetSent && !error && (
              <p className="login__notice">Password reset link sent — check your email.</p>
            )}
            {info && !error && <p className="login__notice">{info}</p>}
            {error && <p className="login__error">{error}</p>}

            <button type="submit" className="login-button" disabled={submitting}>
              {submitting ? 'please wait…' : mode === 'signin' ? 'sign in' : 'create account'}
            </button>
          </form>
        </div>

        <div className="footer">
          <p>
            {mode === 'signin' ? (
              <>
                New here?{' '}
                <button
                  type="button"
                  className="login__cancel"
                  onClick={() => {
                    setMode('signup')
                    setError('')
                    setInfo('')
                  }}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="login__cancel"
                  onClick={() => {
                    setMode('signin')
                    setError('')
                    setInfo('')
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  )
}

export default Login
