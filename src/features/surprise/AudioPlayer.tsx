import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { resolveLibrarySong, type SongChoice } from './songs'
import { loadCustomSong } from '../../lib/songStore'
import { PLAYER_COLORS } from './playerColors'
import './AudioPlayer.css'

const DEFAULT_SRC = '/audio/surprise.mp3'
const COLOR_INTERVAL_MS = 2500

function initialSrc(song?: SongChoice) {
  if (song?.type === 'library') return resolveLibrarySong(song)?.src ?? DEFAULT_SRC
  return DEFAULT_SRC
}

function AudioPlayer({
  song,
  onTimeUpdate,
  active = true,
}: {
  song?: SongChoice
  onTimeUpdate?: (currentTime: number, duration: number) => void
  // Lets a caller mount this (and its underlying <audio>) well before playback
  // should start, so the file is already buffering in the background -- set
  // false until the moment it should actually start playing. The <audio> tag
  // always renders regardless (see the bottom of this component) so loading
  // begins the instant a real `src` is set, not when `active` flips true.
  active?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onTimeUpdateRef.current = onTimeUpdate
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [src, setSrc] = useState(() => initialSrc(song))
  const [colorIndex, setColorIndex] = useState(0)

  useEffect(() => {
    if (song?.type !== 'upload') return
    if (song.url) {
      setSrc(song.url)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    loadCustomSong().then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setSrc(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [song])

  // Starts buffering the instant a real src is known, independent of `active`
  // -- this is what lets the file already be loaded by the time playback is
  // actually supposed to start, instead of only beginning the fetch then.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const startAt = song?.type === 'library' ? resolveLibrarySong(song)?.startAt : undefined
    const applyStartAt = () => {
      if (startAt) audio.currentTime = startAt
    }
    audio.addEventListener('loadedmetadata', applyStartAt)
    audio.load()
    return () => {
      audio.removeEventListener('loadedmetadata', applyStartAt)
    }
  }, [src, song])

  // Actually starts playback once `active` flips true -- deliberately a
  // separate effect from the one above so becoming active never re-triggers
  // audio.load() and throws away whatever had already buffered.
  //
  // Re-applies startAt right before play() as a safety net: the seek from
  // the buffering effect above happens on 'loadedmetadata', often long
  // before `active` flips true (e.g. while she's still on the dodge-quiz
  // screen) -- browsers don't reliably hold a seek made before enough data
  // was buffered at that position, so without this, play() can silently
  // resume from 0 instead, throwing lyric sync off by however long the
  // skipped intro was.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !active) return
    const startAt = song?.type === 'library' ? resolveLibrarySong(song)?.startAt : undefined
    if (startAt && Math.abs(audio.currentTime - startAt) > 1) audio.currentTime = startAt
    audio.play().catch(() => {})
  }, [active, src, song])

  useEffect(() => {
    const interval = setInterval(() => {
      setColorIndex((i) => (i + 1) % PLAYER_COLORS.length)
    }, COLOR_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const handleTimeUpdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration)
      onTimeUpdateRef.current?.(audio.currentTime, audio.duration || 0)
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }

  const seek = (event: ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    audio.currentTime = Number(event.target.value) * audio.duration
  }

  const librarySong = song?.type === 'library' ? resolveLibrarySong(song) : null
  const label = librarySong
    ? `${librarySong.title} — ${librarySong.artist}`
    : song?.type === 'upload'
      ? song.name
      : 'our song'

  const color = PLAYER_COLORS[colorIndex]
  const colorVars = { '--player-bg': color.bg, '--player-fg': color.fg } as CSSProperties

  return (
    <div className="audio-player" style={colorVars}>
      <audio ref={audioRef} src={src} loop preload="auto" />

      {active && (!expanded ? (
        <button
          type="button"
          className={`audio-player__disc ${playing ? 'audio-player__disc--spin' : ''}`}
          onClick={() => setExpanded(true)}
          aria-label="Open music player"
        >
          <span className="audio-player__disc-ring" />
          <span className="audio-player__disc-dot" />
        </button>
      ) : (
        <div className="audio-player__box">
          <div className="audio-player__box-header">
            <span className="audio-player__box-title">{label}</span>
            <button
              type="button"
              className="audio-player__close"
              onClick={() => setExpanded(false)}
              aria-label="Minimize player"
            >
              ×
            </button>
          </div>
          <div className="audio-player__box-controls">
            <button
              type="button"
              className="audio-player__play"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={seek}
              className="audio-player__progress"
              aria-label="Seek"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default AudioPlayer
