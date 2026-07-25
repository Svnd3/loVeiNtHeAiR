import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import LoveQuiz from '../features/surprise/LoveQuiz'
import AudioPlayer from '../features/surprise/AudioPlayer'
import LyricsBackdrop from '../features/surprise/LyricsBackdrop'
import ScrollStory from '../features/surprise/ScrollStory'
import SenderChip from '../features/surprise/SenderChip'
import type { SongChoice } from '../features/surprise/songs'
import type { SurpriseGift } from '../features/surprise/useProfile'
import type { Tier } from '../lib/payments'
import '../features/surprise/Surprise.css'
import './SharedSurprise.css'

type FetchedSurprise = {
  her_name: string
  her_nickname: string
  him_name: string
  him_nickname: string
  letter: string
  gift: SurpriseGift
  song: SongChoice | null
  her_photos: string[]
  him_photos: string[]
  memories: string[] | null
  places_photos: string[] | null
  tier: Tier
}

const POLL_INTERVAL_MS = 4000

function SharedSurprise() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<FetchedSurprise | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [believed, setBelieved] = useState(false)
  const [audioTime, setAudioTime] = useState({ currentTime: 0, duration: 0 })
  const photos = useMemo(
    () => (data ? [...data.her_photos, ...data.him_photos] : []),
    [data],
  )

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
        <p>opening your surprise…</p>
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

  // Basic doesn't include a custom song upload — fall back to the app's
  // default track instead of playing what he uploaded. Library picks always
  // play regardless of tier.
  const songForTier =
    data.tier === 'basic' && data.song?.type === 'upload' ? undefined : data.song ?? undefined

  // The gift attachment (ticket/reservation/document) is a Premium-only
  // reveal — strip it for Basic/Super even if he uploaded one.
  const giftForTier =
    data.tier === 'premium' ? data.gift : { ...data.gift, attachment: undefined }

  return (
    <div className="surprise">
      <SenderChip name={himName} />

      {!believed && <LoveQuiz onBelieve={() => setBelieved(true)} />}
      {believed && (
        <>
          <LyricsBackdrop
            song={songForTier}
            currentTime={audioTime.currentTime}
            duration={audioTime.duration}
          />
          <AudioPlayer
            song={songForTier}
            onTimeUpdate={(currentTime, duration) => setAudioTime({ currentTime, duration })}
          />
          <ScrollStory
            herName={data.her_nickname || data.her_name}
            himName={himName}
            photos={photos}
            himPhotos={data.him_photos}
            letter={data.letter}
            gift={giftForTier}
            memories={data.memories ?? []}
            placesPhotos={data.places_photos ?? []}
            premium={data.tier === 'premium'}
          />
          {data.tier === 'basic' && <p className="shared-surprise-watermark">made with loveintheair</p>}
        </>
      )}
    </div>
  )
}

export default SharedSurprise
