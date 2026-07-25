import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { sendSignInEmail, signupInProgress } from './notifications'

type AuthState = {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Supabase only fires 'SIGNED_IN' once per real sign-in (a page reload that
  // restores an existing session emits 'INITIAL_SESSION' instead), but guard
  // against React StrictMode's double-invoked effects re-sending it anyway.
  const notifiedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      if (
        event === 'SIGNED_IN' &&
        newSession &&
        !signupInProgress.current &&
        notifiedTokenRef.current !== newSession.access_token
      ) {
        notifiedTokenRef.current = newSession.access_token
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
