import { TIER_RANK, type Tier } from '../../lib/payments'

export type SongOption = {
  id: string
  artist: string
  title: string
  src: string
  startAt?: number
  // Omitted = included on every tier. These four require Super or above.
  tier?: 'super'
}

export const SONG_LIBRARY: SongOption[] = [
  { id: 'chai-ya-saa-kumi', artist: 'Ywaya Tajiri', title: 'Chai Ya Saa Kumi', src: '/audio/songs/ywaya-tajiri-chai-ya-saa-kumi.mp3', startAt: 14, tier: 'super' },
  { id: 'love-song', artist: 'Etana', title: 'Love Song', src: '/audio/songs/etana-love-song.mp3' },
  { id: 'for-lovers', artist: 'Hornsphere ft. Mutoriah, Aliye & Noi', title: 'For Lovers', src: '/audio/songs/hornsphere-for-lovers.mp3', startAt: 25 },
  { id: 'feel-the-love', artist: 'Kahuti ft. Kinoti', title: 'Feel the Love', src: '/audio/songs/kahuti-feel-the-love.mp3' },
  { id: 'kuja-karibu', artist: 'Born Spectacle', title: 'Kuja Karibu', src: '/audio/songs/born-spectacle-kuja-karibu.mp3' },
  { id: 'slowly', artist: 'Meddy', title: 'Slowly', src: '/audio/songs/meddy-slowly.mp3', startAt: 12, tier: 'super' },
  { id: 'beta', artist: 'Mutoriah', title: 'Beta', src: '/audio/songs/mutoriah-beta.mp3', startAt: 11, tier: 'super' },
  { id: 'coming-home', artist: 'Sauti Sol', title: 'Coming Home', src: '/audio/songs/sauti-sol-coming-home.mp3', startAt: 25, tier: 'super' },
  { id: 'isabella', artist: 'Sauti Sol', title: 'Isabella', src: '/audio/songs/sauti-sol-isabella.mp3', startAt: 42 },
  { id: 'wema', artist: 'nk_njoroge ft. Fedora', title: 'Wema', src: '/audio/songs/wema-nk-njoroge-fedora.mp3' },
  { id: 'mazuri-mabaya', artist: 'Ywaya Tajiri', title: 'Mazuri Mabaya', src: '/audio/songs/ywaya-tajiri-mazuri-mabaya.mp3' },
  { id: 'chikwere', artist: 'Bien', title: 'Chikwere', src: '/audio/songs/bien-chikwere.mp3', startAt: 20 },
]

export type SongChoice =
  | { type: 'library'; id: string }
  | { type: 'upload'; name: string; url?: string }

export function resolveLibrarySong(choice: SongChoice | undefined): SongOption | null {
  if (!choice || choice.type !== 'library') return null
  return SONG_LIBRARY.find((song) => song.id === choice.id) ?? null
}

// Upload-your-own is Premium-and-up; a handful of library picks need Super or
// above; everything else in the library plays on every tier.
export function isSongAllowedForTier(song: SongChoice | null | undefined, tier: Tier): boolean {
  if (!song) return true
  if (song.type === 'upload') return TIER_RANK[tier] >= TIER_RANK.premium
  const option = resolveLibrarySong(song)
  if (option?.tier === 'super') return tier !== 'basic'
  return true
}
