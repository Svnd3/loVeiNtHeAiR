import type { KnowMeMode, KnowMeQuestion } from '../features/surprise/knowMeQuiz'
import type { SongChoice } from '../features/surprise/songs'

// Details.tsx only ever creates a real `surprises` row once the whole form
// passes validation (min photos, letter, gift, song, places all filled) --
// so if she leaves before that, everything she typed is gone with no way to
// get it back. This is a lightweight, this-browser-only safety net: every
// text field autosaves here as she types, and Account.tsx surfaces a "Finish
// up" card if a draft exists.
//
// Deliberately text-only -- File objects picked from disk can't survive a
// localStorage round trip (or a closed tab) at all, so photos/song uploads
// are recorded as counts/flags only, just enough to tell her "you had N
// photos, add them again" rather than silently losing the fact she'd added any.

export type DraftProfile = {
  name: string
  nickname: string
  country: string
  photoCount: number
}

export type DraftGift = {
  type: 'date' | 'ticket' | 'other'
  title: string
  location: string
  when: string
  message: string
  hasPhoto: boolean
  hasAttachment: boolean
  guessQuestion: string
  guessOptions: string[]
  guessCorrectIndex: number
}

export type DraftMemory = {
  prompt: string
  caption: string
  hasPhoto: boolean
}

export type DetailsDraft = {
  savedAt: string
  her: DraftProfile
  him: DraftProfile
  letter: string
  questions: string[]
  knowMeMode: KnowMeMode
  knowMeQuiz: KnowMeQuestion[]
  memories: DraftMemory[]
  placesCount: number
  gift: DraftGift
  // Upload-your-own can't survive the round trip either -- only a library
  // pick is worth restoring.
  song: SongChoice | null
  unlockAt: string
}

const KEY_PREFIX = 'gfbf_details_draft_'

function draftKey(userId: string) {
  return `${KEY_PREFIX}${userId}`
}

export function saveDraft(userId: string, draft: Omit<DetailsDraft, 'savedAt'>) {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify({ ...draft, savedAt: new Date().toISOString() }))
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) -- the draft
    // is a nice-to-have, never worth breaking the actual form over.
  }
}

export function loadDraft(userId: string): DetailsDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as DetailsDraft
  } catch {
    return null
  }
}

export function clearDraft(userId: string) {
  try {
    localStorage.removeItem(draftKey(userId))
  } catch {
    // see saveDraft
  }
}

// Whether a draft is worth showing at all -- skips the case where she opened
// Details.tsx, typed nothing meaningful, and left immediately.
export function isDraftWorthShowing(draft: DetailsDraft) {
  return Boolean(draft.her.name.trim() || draft.him.name.trim() || draft.letter.trim())
}

export function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
