import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { sendSignInEmail, signupInProgress } from './notifications'

type AuthState = {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

// Persisted (not a ref) because a ref resets on every page reload -- and in
// practice Supabase does refire 'SIGNED_IN' when a reload restores an
// existing session from storage, not just on an actual fresh sign-in. A ref
// alone can't tell "the same session as last time this tab loaded" from "a
// genuinely new sign-in", so it was emailing on every refresh. Keyed by user
// id and cleared on sign-out so signing in again for real still notifies.
const SIGNIN_NOTIFIED_KEY = 'gfbf_signin_notified_uid'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Still guards within a single tab's lifetime against React StrictMode's
  // double-invoked effects, ahead of the persisted check below.
  const notifiedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(SIGNIN_NOTIFIED_KEY)
        return
      }

      if (
        event === 'SIGNED_IN' &&
        newSession &&
        !signupInProgress.current &&
        notifiedTokenRef.current !== newSession.access_token &&
        localStorage.getItem(SIGNIN_NOTIFIED_KEY) !== newSession.user.id
      ) {
        notifiedTokenRef.current = newSession.access_token
        localStorage.setItem(SIGNIN_NOTIFIED_KEY, newSession.user.id)
        sendSignInEmail(newSession.access_token)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
