import { useMemo } from 'react'
import type { SongChoice } from './songs'
import { getLyricsForSong, currentLyricIndex } from './lyrics'
import './LyricsBackdrop.css'

function LyricsBackdrop({
  song,
  currentTime,
  duration,
}: {
  song?: SongChoice
  currentTime: number
  duration: number
}) {
  const songId = song?.type === 'library' ? song.id : undefined
  const lines = useMemo(() => getLyricsForSong(songId), [songId])

  if (!lines || lines.length === 0) return null

  const index = currentLyricIndex(lines, currentTime, duration, songId)
  if (index < 0) return null

  const prev = lines[index - 1]?.text
  const current = lines[index].text
  const next = lines[index + 1]?.text

  return (
    <div className="lyrics-backdrop" aria-hidden="true">
      <div className="lyrics-backdrop__stack" key={index}>
        {prev && <p className="lyrics-backdrop__line lyrics-backdrop__line--prev">{prev}</p>}
        <p className="lyrics-backdrop__line lyrics-backdrop__line--current">{current}</p>
        {next && <p className="lyrics-backdrop__line lyrics-backdrop__line--next">{next}</p>}
      </div>
    </div>
  )
}

export default LyricsBackdrop
