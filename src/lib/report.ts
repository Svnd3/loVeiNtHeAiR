import { supabaseUrl, supabaseAnonKey } from './supabaseClient'

// Unlike the fire-and-forget notification helpers in notifications.ts, this
// one surfaces success/failure back to ReportButton so it can actually tell
// her whether the report went through.
export async function reportSurprise({
  surpriseId,
  reason,
}: {
  surpriseId?: string
  reason: string
}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/report-surprise`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      surpriseId,
      pageUrl: window.location.href,
      reason,
    }),
    signal: AbortSignal.timeout(15000),
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body?.error || 'Could not submit report.')
  }
}
