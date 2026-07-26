import { useMemo } from 'react'
import type { SongChoice } from './songs'
import { getLyricsForSong, currentLyricIndex } from './lyrics'
import './LyricsBackdrop.css'

function LyricsBackdrop({
  song,
  currentTime,
  duration,
  // 'stack' (default) is the usual prev/current/next reveal used during
  // ScrollStory. 'ticker' is a continuously scrolling, non-interactive
  // background pass used behind KnowMeQuiz -- see SharedSurprise.tsx --
  // ignores currentTime/duration entirely since it just loops on its own.
  variant = 'stack',
}: {
  song?: SongChoice
  currentTime: number
  duration: number
  variant?: 'stack' | 'ticker'
}) {
  const songId = song?.type === 'library' ? song.id : undefined
  const lines = useMemo(() => getLyricsForSong(songId), [songId])

  if (!lines || lines.length === 0) return null

  if (variant === 'ticker') {
    return (
      <div className="lyrics-backdrop lyrics-backdrop--ticker" aria-hidden="true">
        <div className="lyrics-ticker">
          {[0, 1].map((copy) => (
            <div className="lyrics-ticker__copy" key={copy}>
              {lines.map((line, i) => (
                <p className="lyrics-ticker__line" key={i}>
                  {line.text}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

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
