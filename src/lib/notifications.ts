import { supabaseUrl, supabaseAnonKey } from './supabaseClient'

// Fire-and-forget calls to the notification edge functions — a failed email
// should never block signup, saving a surprise, or her opening the link, so
// errors here are swallowed rather than surfaced.
async function callFunction(name: string, body: Record<string, unknown>, accessToken?: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken ?? supabaseAnonKey}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    // best-effort — see comment above
  }
}

export function sendWelcomeEmail(email: string) {
  callFunction('send-welcome-email', { email })
}

export function sendSignInEmail(accessToken: string) {
  callFunction('send-signin-email', {}, accessToken)
}

// Login.tsx sets this right before supabase.auth.signUp() so AuthContext's
// SIGNED_IN listener can skip the sign-in email for that one event — a fresh
// signup with email confirmation disabled gets a session (and a SIGNED_IN
// event) immediately, and it already gets its own welcome email.
export const signupInProgress = { current: false }

export function sendSurpriseCreatedEmail(surpriseId: string, accessToken: string) {
  callFunction('send-surprise-created-email', { surpriseId }, accessToken)
}

export function recordSurpriseView(surpriseId: string) {
  callFunction('record-surprise-view', { surpriseId })
}
