import { TIMED_LYRICS } from './timedLyrics'
import { PLAIN_LYRICS } from './plainLyrics'

export type LyricLine = { text: string; time: number | null }

// For songs with no per-line timestamps (PLAIN_LYRICS), lines are spaced evenly
// across the track. This lets a song delay that even spacing until playback
// reaches a given second, instead of starting at 0.
const PLAIN_LYRICS_START_OFFSET: Record<string, number> = {
  'mazuri-mabaya': 10,
}

// The on-screen lyrics backdrop is disabled entirely for these songs.
const LYRICS_DISABLED = new Set(['isabella', 'for-lovers', 'kuja-karibu', 'feel-the-love'])

export function getLyricsForSong(songId: string | undefined): LyricLine[] | null {
  if (!songId || LYRICS_DISABLED.has(songId)) return null

  const timed = TIMED_LYRICS[songId]
  if (timed) return timed.map((line) => ({ text: line.text, time: line.time }))

  const plain = PLAIN_LYRICS[songId]
  if (plain) return plain.map((text) => ({ text, time: null }))

  return null
}

// Timed songs use real timestamps; songs with no timed source found are
// spaced evenly across the track's duration so they still track playback and seeking.
export function currentLyricIndex(
  lines: LyricLine[],
  currentTime: number,
  duration: number,
  songId?: string,
): number {
  if (lines.length === 0) return -1

  if (lines[0].time !== null) {
    let index = -1
    for (let i = 0; i < lines.length; i++) {
      const time = lines[i].time
      if (time !== null && time <= currentTime) index = i
      else break
    }
    return index
  }

  if (!duration) return -1
  const startOffset = songId ? PLAIN_LYRICS_START_OFFSET[songId] ?? 0 : 0
  if (currentTime < startOffset) return -1
  const span = Math.max(duration - startOffset, 0.001)
  const ratio = Math.min(Math.max((currentTime - startOffset) / span, 0), 0.999)
  return Math.floor(ratio * lines.length)
}
