import { useMemo } from 'react'
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

export function useProfile(): SurpriseProfile {
  return useMemo(() => {
    const stored = readProfile()

    if (!stored) {
      return {
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
    }

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
  }, [])
}
