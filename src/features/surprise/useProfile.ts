import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { SongChoice } from './songs'

// What plays on the unauthenticated "/surprise" demo preview (no real saved
// profile in localStorage yet) -- picked as the one that should make the
// best first impression, independent of whatever's in the real SONG_LIBRARY
// order.
const PLACEHOLDER_SONG: SongChoice = { type: 'library', id: 'chikwere' }

const PROFILE_KEY = 'gfbf_profile'

export type GiftType = 'date' | 'ticket' | 'other'

type StoredGift = {
  type: GiftType
  title: string
  location: string
  when: string
  message: string
  photo: string
  photo_compressed?: string
  attachment?: string
  // Optional "guess the gift" mini-game (see GuessGiftQuiz.tsx) -- only
  // ever shown when all three are present alongside `attachment` itself.
  guess_question?: string
  guess_options?: string[]
  guess_correct_index?: number
}

// Rendered as a 3-slide swipeable card (MemoryCard.tsx): the prompt, then
// an optional photo, then an optional caption -- a missing photo/caption
// just skips that slide.
export type SurpriseMemory = {
  prompt: string
  photo?: string
  caption?: string
}

type StoredProfile = {
  her: { country: string; name: string; photos: string[] }
  him: { country: string; name: string; photos: string[] }
  letter: string
  memories?: SurpriseMemory[]
  places?: string[]
  gift?: StoredGift
  song?: SongChoice
}

export type SurpriseGift = StoredGift

export type SurpriseProfile = {
  herName: string
  himName: string
  photos: string[]
  himPhotos: string[]
  letter: string
  memories: SurpriseMemory[]
  placesPhotos: string[]
  gift: SurpriseGift
  song?: SongChoice
  isPlaceholder: boolean
}

const PLACEHOLDER_PHOTOS = Array.from(
  { length: 19 },
  (_, i) => `/gallery-placeholder/${i + 1}.webp`,
)

const PLACEHOLDER_LETTER = `I never know how to start these things, but I know I wanted today to feel
like something you'd remember. Every photo in that gallery is a piece of
"us" — and there's a lot more where that came from.

Thank you for believing in this, even for a second.

Yours,
Kevin`

const PLACEHOLDER_MEMORIES: SurpriseMemory[] = [
  {
    prompt: 'the night it poured and we still walked home anyway?',
    photo: PLACEHOLDER_PHOTOS[1],
    caption: "I was so scared but nikajikaza 😂",
  },
  {
    prompt: 'the playlist you made me that I never told you I replay?',
  },
]

const PLACEHOLDER_GIFT: SurpriseGift = {
  type: 'date',
  title: 'Dinner, just the two of us',
  location: 'Our favorite little spot downtown',
  when: 'This Saturday, 7pm',
  message: "Get dressed up — I'm taking you out. Meet me at yours and I'll do the rest.",
  photo: PLACEHOLDER_PHOTOS[0],
  attachment: PLACEHOLDER_PHOTOS[2],
  guess_question: 'What am I actually surprising you with?',
  guess_options: ['Dinner reservations', 'Concert tickets', 'A spa day'],
  guess_correct_index: 0,
}

function readProfile(): StoredProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.her?.name && parsed?.him?.name) return parsed as StoredProfile
    return null
  } catch {
    return null
  }
}

const PLACEHOLDER_PROFILE: SurpriseProfile = {
  herName: 'Abbie',
  himName: 'Kevin',
  photos: PLACEHOLDER_PHOTOS,
  himPhotos: PLACEHOLDER_PHOTOS,
  letter: PLACEHOLDER_LETTER,
  memories: PLACEHOLDER_MEMORIES,
  placesPhotos: PLACEHOLDER_PHOTOS.slice(0, 3),
  gift: PLACEHOLDER_GIFT,
  song: PLACEHOLDER_SONG,
  isPlaceholder: true,
}

function fromStoredProfile(stored: StoredProfile): SurpriseProfile {
  const photos = [...(stored.her.photos ?? []), ...(stored.him.photos ?? [])]
  const himPhotos = stored.him.photos ?? []

  return {
    herName: stored.her.name,
    himName: stored.him.name,
    photos: photos.length > 0 ? photos : PLACEHOLDER_PHOTOS,
    himPhotos: himPhotos.length > 0 ? himPhotos : PLACEHOLDER_PHOTOS,
    letter: stored.letter?.trim() || PLACEHOLDER_LETTER,
    memories: stored.memories?.filter((m) => m.prompt?.trim()) ?? [],
    placesPhotos: stored.places?.filter(Boolean) ?? [],
    gift: stored.gift?.photo ? stored.gift : PLACEHOLDER_GIFT,
    song: stored.song,
    isPlaceholder: false,
  }
}

type RemoteTemplateRow = {
  her_name: string
  her_nickname: string
  him_name: string
  him_nickname: string
  letter: string
  gift: SurpriseGift
  song: SongChoice | null
  her_photos: string[]
  him_photos: string[]
  memories: SurpriseMemory[]
  places_photos: string[]
}

function fromRemoteTemplate(row: RemoteTemplateRow): SurpriseProfile {
  return {
    herName: row.her_nickname || row.her_name || 'Abbie',
    himName: row.him_nickname || row.him_name || 'Kevin',
    photos: [...(row.her_photos ?? []), ...(row.him_photos ?? [])],
    himPhotos: row.him_photos ?? [],
    letter: row.letter || PLACEHOLDER_LETTER,
    memories: row.memories ?? [],
    placesPhotos: row.places_photos ?? [],
    gift: row.gift?.photo ? row.gift : PLACEHOLDER_GIFT,
    song: row.song ?? undefined,
    isPlaceholder: false,
  }
}

// The unauthenticated /surprise demo: a real surprise the admin picked (see
// set_preview_template() in schema.sql, wired up via Admin.tsx's "Canon it")
// if one exists, else whatever's in localStorage from an old in-progress
// build, else the hardcoded placeholder content above. Async now because the
// admin-picked case needs a network round trip -- Surprise.tsx shows a
// loader for the (usually brief) `null` it returns while that resolves.
export function useProfile(): SurpriseProfile | null {
  const [profile, setProfile] = useState<SurpriseProfile | null>(null)

  useEffect(() => {
    let cancelled = false
    const stored = readProfile()
    if (stored) {
      setProfile(fromStoredProfile(stored))
      return
    }

    supabase
      .rpc('get_preview_surprise')
      .then(({ data, error }) => {
        if (cancelled) return
        const row = Array.isArray(data) ? (data[0] as RemoteTemplateRow | undefined) : undefined
        setProfile(!error && row ? fromRemoteTemplate(row) : PLACEHOLDER_PROFILE)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return profile
}
