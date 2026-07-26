import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import LoveQuiz from '../features/surprise/LoveQuiz'
import AudioPlayer from '../features/surprise/AudioPlayer'
import LyricsBackdrop from '../features/surprise/LyricsBackdrop'
import ScrollStory from '../features/surprise/ScrollStory'
import SenderChip from '../features/surprise/SenderChip'
import LoveLoader from '../components/LoveLoader'
import { isSongAllowedForTier, type SongChoice } from '../features/surprise/songs'
import type { SurpriseGift, SurpriseMemory } from '../features/surprise/useProfile'
import KnowMeQuiz from '../features/surprise/KnowMeQuiz'
import { generateAutoQuestions, type KnowMeMode, type KnowMeQuestion } from '../features/surprise/knowMeQuiz'
import { MIXED_QUESTION_CAP, type Tier } from '../lib/payments'
import { recordSurpriseView } from '../lib/notifications'
import '../features/surprise/Surprise.css'
import './SharedSurprise.css'

type FetchedMemory = {
  prompt: string
  photo?: string
  photo_compressed?: string
  caption?: string
}

type FetchedSurprise = {
  her_name: string
  her_nickname: string
  her_country: string
  him_name: string
  him_nickname: string
  him_country: string
  letter: string
  questions: string[]
  know_me_mode: KnowMeMode
  know_me_quiz: KnowMeQuestion[]
  gift: SurpriseGift
  song: SongChoice | null
  her_photos: string[]
  him_photos: string[]
  her_photos_compressed: string[] | null
  him_photos_compressed: string[] | null
  places_photos_compressed: string[] | null
  memories: FetchedMemory[] | null
  places_photos: string[] | null
  tier: Tier
  unlock_at: string | null
  locked: boolean
}

const POLL_INTERVAL_MS = 4000

// Basic tier shows the smaller "compressed" sibling of each photo; Super/
// Premium always get the full-quality original. Falls back to the original
// per-item when a row was saved before the compressed column existed (or a
// given upload has no compressed counterpart yet).
function pickQuality(originals: string[], compressed: string[] | null, tier: Tier): string[] {
  if (tier !== 'basic') return originals
  return originals.map((url, i) => compressed?.[i] || url)
}

function pickPhotoQuality(original: string, compressed: string | undefined, tier: Tier): string {
  return tier === 'basic' ? compressed || original : original
}

function formatCountdown(msRemaining: number) {
  if (msRemaining <= 0) return 'any moment now'
  const totalSeconds = Math.floor(msRemaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (days || hours) parts.push(`${hours}h`)
  if (days || hours || minutes) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(' ')
}

function LockedCountdown({ unlockAt }: { unlockAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])
  return <>{formatCountdown(new Date(unlockAt).getTime() - now)}</>
}

function SharedSurprise() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<FetchedSurprise | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [believed, setBelieved] = useState(false)
  const [knowMeDone, setKnowMeDone] = useState(false)
  const [audioTime, setAudioTime] = useState({ currentTime: 0, duration: 0 })
  const viewRecordedRef = useRef(false)
  const herPhotos = useMemo(
    () => (data ? pickQuality(data.her_photos, data.her_photos_compressed, data.tier) : []),
    [data],
  )
  const himPhotos = useMemo(
    () => (data ? pickQuality(data.him_photos, data.him_photos_compressed, data.tier) : []),
    [data],
  )
  const placesPhotos = useMemo(
    () => (data ? pickQuality(data.places_photos ?? [], data.places_photos_compressed, data.tier) : []),
    [data],
  )
  const photos = useMemo(() => [...herPhotos, ...himPhotos], [herPhotos, himPhotos])
  const memories = useMemo<SurpriseMemory[]>(
    () =>
      (data?.memories ?? []).map((m) => ({
        prompt: m.prompt,
        photo: m.photo ? pickPhotoQuality(m.photo, m.photo_compressed, data!.tier) : undefined,
        caption: m.caption,
      })),
    [data],
  )
  // Auto-generated questions shuffle their distractor options with
  // Math.random() on every call (see generateAutoQuestions) -- memoized here
  // so that stays fixed for as long as `data` hasn't actually changed,
  // instead of re-shuffling on every re-render (e.g. the frequent audioTime
  // updates while a song is playing).
  const knowMeQuestions = useMemo(() => {
    if (!data) return []
    return data.know_me_mode === 'custom' && data.know_me_quiz.length > 0
      ? data.know_me_quiz
      : generateAutoQuestions({
          her_nickname: data.her_nickname,
          him_nickname: data.him_nickname,
          him_country: data.him_country,
          gift: data.gift,
          song: data.song,
        })
  }, [data])

  // Counts as "she's seen it" once she's clicked past the love-quiz intro and
  // it's actually unlocked -- not on the bare page load (a link preview bot
  // opening the URL shouldn't tell him she's seen it), and not while locked
  // (there's nothing to see yet). Fires once per page load.
  useEffect(() => {
    if (!id || !believed || !data || data.locked || viewRecordedRef.current) return
    viewRecordedRef.current = true
    recordSurpriseView(id)
  }, [id, believed, data])

  useEffect(() => {
    if (!id) {
      setStatus('error')
      return
    }
    let cancelled = false

    const fetchSurprise = (isFirstLoad: boolean) =>
      supabase
        .rpc('get_surprise', { p_surprise_id: id })
        .then(({ data: rows, error }) => {
          if (cancelled) return
          const row = Array.isArray(rows) ? rows[0] : null
          if (error || !row) {
            if (isFirstLoad) setStatus('error')
            return
          }
          setData((prev) => {
            const next = row as FetchedSurprise
            return JSON.stringify(prev) === JSON.stringify(next) ? prev : next
          })
          setStatus('ready')
        })

    fetchSurprise(true)
    // She may already have this page open while his photo/song upload is still
    // filling in the row (see Details.tsx's instant-save flow) — or he edits it
    // later — so keep polling for changes rather than requiring a refresh.
    const interval = setInterval(() => fetchSurprise(false), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [id])

  if (status === 'loading') {
    return (
      <main className="shared-surprise-status">
        <LoveLoader label="opening your surprise…" />
      </main>
    )
  }

  if (status === 'error' || !data) {
    return (
      <main className="shared-surprise-status">
        <p>This link doesn't work — double-check the URL you were sent.</p>
      </main>
    )
  }

  const himName = data.him_nickname || data.him_name
  const herName = data.her_nickname || data.her_name

  if (data.locked && data.unlock_at) {
    return (
      <main className="shared-surprise-locked">
        <p className="shared-surprise-locked__kicker">{himName} has something for you</p>
        <h1>{herName}, it's not time yet</h1>
        <p className="shared-surprise-locked__countdown">
          <LockedCountdown unlockAt={data.unlock_at} />
        </p>
        <p className="shared-surprise-locked__hint">Come back then — this link will just open.</p>
      </main>
    )
  }

  // Uploading your own song is Premium-only, and a handful of library picks
  // need Super or above — fall back to the app's default track otherwise.
  const songForTier = isSongAllowedForTier(data.song, data.tier) ? data.song ?? undefined : undefined

  // A custom gate question is Super/Mixed/Premium-only — Basic always gets
  // the default "Do you believe in love?" even if he wrote some. Super is
  // capped at just the first one, Mixed at the first three, Premium gets all
  // of them (same fill-in-anything-but-gate-at-display pattern as
  // songForTier/giftForTier).
  const questionsForTier =
    data.tier === 'basic'
      ? undefined
      : data.tier === 'super'
        ? data.questions.slice(0, 1)
        : data.tier === 'mixed'
          ? data.questions.slice(0, MIXED_QUESTION_CAP)
          : data.questions

  // The gift attachment (ticket/reservation/document) is a Premium-only
  // reveal — strip it for Basic/Super even if he uploaded one. The gift photo
  // itself follows the same compressed-for-Basic rule as the gallery photos.
  const giftForTier = {
    ...data.gift,
    photo: pickPhotoQuality(data.gift.photo, data.gift.photo_compressed, data.tier),
    attachment: data.tier === 'premium' ? data.gift.attachment : undefined,
  }

  // "How well do you know me?" mini-quiz — Super/Mixed/Premium only (same
  // cascade as every other "Everything in Super" extra). Falls back to the
  // auto-generated set if he picked custom but left it empty/incomplete, so
  // a Super+ buyer never sees a blank quiz.
  const showKnowMeQuiz = data.tier !== 'basic'

  return (
    <div className="surprise">
      <SenderChip name={himName} />

      {/* Mounted as soon as the song is known (not gated on `believed`) so the
          file is already buffering in the background — `active` is what
          actually controls whether it's audible or shows its widget. */}
      <AudioPlayer
        song={songForTier}
        active={believed}
        onTimeUpdate={(currentTime, duration) => setAudioTime({ currentTime, duration })}
      />

      {/* Starts right alongside the audio (as soon as she's answered the love
          quiz) rather than waiting for KnowMeQuiz to finish -- 'ticker' mode
          during that quiz keeps it as a non-interactive background pass, then
          it switches back to the normal reveal once ScrollStory begins. */}
      {believed && (
        <LyricsBackdrop
          song={songForTier}
          currentTime={audioTime.currentTime}
          duration={audioTime.duration}
          variant={showKnowMeQuiz && !knowMeDone ? 'ticker' : 'stack'}
        />
      )}

      {!believed && (
        <LoveQuiz herName={herName} questions={questionsForTier} onBelieve={() => setBelieved(true)} />
      )}
      {believed && showKnowMeQuiz && !knowMeDone && (
        <KnowMeQuiz herName={herName} questions={knowMeQuestions} onDone={() => setKnowMeDone(true)} />
      )}
      {believed && (!showKnowMeQuiz || knowMeDone) && (
        <>
          <ScrollStory
            herName={herName}
            himName={himName}
            photos={photos}
            letter={data.letter}
            gift={giftForTier}
            memories={memories}
            placesPhotos={placesPhotos}
            premium={data.tier === 'premium'}
          />
          {data.tier === 'basic' && <p className="shared-surprise-watermark">made with loveintheair</p>}

          <div className="shared-surprise-cta">
            <p>Want to make one of these for someone?</p>
            <a href="/" className="shared-surprise-cta__btn">
              Start your own →
            </a>
          </div>
        </>
      )}
    </div>
  )
}

export default SharedSurprise
