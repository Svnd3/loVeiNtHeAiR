// Bridges a simple username/password (what he actually types) to a real
// Supabase account underneath -- Supabase requires an email + a password
// meeting its minimum length, neither of which "JT"/"JT" satisfies on its
// own. The real account (jt@internal.loveintheair.app) was created once via
// a one-off admin script; this is just the lookup used at sign-in time.
export type UsernameAccount = {
  password: string
  email: string
  realPassword: string
}

export const USERNAME_ACCOUNTS: Record<string, UsernameAccount> = {
  JT: {
    password: 'JT',
    email: 'jt@internal.loveintheair.app',
    realPassword: 'jt-free-2026',
  },
}

export function resolveUsernameLogin(username: string, password: string) {
  const account = USERNAME_ACCOUNTS[username.trim()]
  if (!account || account.password !== password) return null
  return account
}
