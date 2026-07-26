import { useMemo, useRef, useState, useEffect, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { compressImageToBlob } from '../lib/image'
import { SONG_LIBRARY, type SongChoice } from '../features/surprise/songs'
import TierPaywall from '../components/TierPaywall'
import LoveLoader from '../components/LoveLoader'
import { computePricing } from '../lib/payments'
import { sendSurpriseCreatedEmail } from '../lib/notifications'
import './Details.css'

// A photo is either one already uploaded (edit mode, loaded from the saved
// surprise -- carries both quality URLs so re-saving without touching this
// photo doesn't lose the compressed sibling) or one freshly picked from disk
// that still needs uploading (both versions get produced at upload time).
type PhotoItem = { url: string; compressedUrl: string } | { file: File }

function isExistingPhoto(item: PhotoItem): item is { url: string; compressedUrl: string } {
  return 'url' in item
}

function photoPreviewUrl(item: PhotoItem) {
  return isExistingPhoto(item) ? item.url : URL.createObjectURL(item.file)
}

// Pairs up a *_photos array with its *_photos_compressed sibling by index --
// falls back to the original URL for any row saved before compressed copies
// existed (shorter/empty compressed array).
function zipPhotos(originals: string[], compressed: string[]): PhotoItem[] {
  return originals.map((url, i) => ({ url, compressedUrl: compressed[i] || url }))
}

function usePhotoPreviews(photos: PhotoItem[]) {
  const previews = useMemo(() => photos.map(photoPreviewUrl), [photos])
  useEffect(() => {
    return () => {
      photos.forEach((item, i) => {
        if (!isExistingPhoto(item)) URL.revokeObjectURL(previews[i])
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews])
  return previews
}

const MIN_PHOTOS_HER = 8
const MAX_PHOTOS_HER = 15
const MIN_PHOTOS_HIM = 2
const MAX_PHOTOS_HIM = 6

const COUNTRIES = [
  'Kenya', 'Nigeria', 'South Africa', 'Ghana', 'Uganda', 'Tanzania', 'Ethiopia',
  'Rwanda', 'Egypt', 'Morocco', 'United States', 'Canada', 'United Kingdom',
  'Ireland', 'France', 'Germany', 'Spain', 'Italy', 'Portugal', 'Netherlands',
  'Belgium', 'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Poland', 'Greece',
  'India', 'Pakistan', 'Bangladesh', 'China', 'Japan', 'South Korea',
  'Philippines', 'Indonesia', 'Malaysia', 'Singapore', 'Thailand', 'Vietnam',
  'Australia', 'New Zealand', 'Brazil', 'Mexico', 'Argentina', 'Colombia',
  'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Turkey',
]

type Profile = {
  country: string
  name: string
  nickname: string
  photos: PhotoItem[]
}

const emptyProfile: Profile = { country: '', name: '', nickname: '', photos: [] }

function displayName(profile: Profile) {
  return profile.nickname.trim() || profile.name.trim() || 'My love'
}

const LETTER_TEMPLATES: { title: string; text: (name: string) => string }[] = [
  {
    title: 'Romantic',
    text: (name) =>
      `${name}, from the moment you walked into my life, everything made a little more sense. Every day with you feels like a gift I get to unwrap all over again. I love you more than words can hold.`,
  },
  {
    title: 'Grateful',
    text: (name) =>
      `${name}, I don't say this enough — thank you. Thank you for your patience, your laughter, and the way you make ordinary days feel special. I'm endlessly grateful you chose me.`,
  },
  {
    title: 'Playful',
    text: (name) =>
      `${name}, warning: this letter contains extreme amounts of cheesiness. You're my favorite person, my best friend, and the only one who can make me laugh and blush in the same sentence.`,
  },
  {
    title: 'Poetic',
    text: (name) =>
      `${name}, you are the quiet in my noise, the calm after every storm. If love were a season, you'd be the one I never want to end.`,
  },
  {
    title: 'Simple & Sweet',
    text: (name) => `${name}, I just want you to know — I love you, I'm proud of you, and I'm so lucky to have you.`,
  },
  {
    title: 'Anniversary',
    text: (name) =>
      `${name}, another year with you and I'd choose it all over again — every memory, every moment. Here's to more of "us." Happy anniversary, my love.`,
  },
  {
    title: 'Missing You',
    text: (name) =>
      `${name}, the distance doesn't make me miss you less, it just makes me appreciate every moment we do get together. Can't wait to hold you again.`,
  },
  {
    title: 'Forever',
    text: (name) =>
      `${name}, whatever life throws our way, I want to face it next to you. You're not just my today — you're every tomorrow I'm looking forward to.`,
  },
]

function TierBadge({ tier }: { tier: 'basic' | 'super' | 'premium' }) {
  const label = tier === 'basic' ? 'Basic' : tier === 'super' ? 'Super+' : 'Premium'
  return <span className={`tier-badge tier-badge--${tier}`}>{label}</span>
}

function isoToDatetimeLocal(iso: string) {
  const date = new Date(iso)
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function ScheduleSection({
  unlockAt,
  onChange,
}: {
  unlockAt: string
  onChange: (next: string) => void
}) {
  return (
    <div className="schedule-section">
      <h2 className="profile-section__title">
        Schedule it (optional) <TierBadge tier="basic" />
      </h2>
      <p className="profile-section__hint">
        Send her the link whenever, but keep it locked until a moment you pick — her birthday
        midnight, an anniversary, whenever you want this to actually open.
      </p>
      <label className="profile-field">
        <span>Unlocks at</span>
        <input
          type="datetime-local"
          value={unlockAt}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {unlockAt && (
        <button type="button" className="letter-templates-btn" onClick={() => onChange('')}>
          Unlock immediately instead
        </button>
      )}
    </div>
  )
}

const MIN_PLACE_PHOTOS = 1
const MAX_PLACE_PHOTOS = 3

function PlacesSection({
  photos,
  onChange,
}: {
  photos: PhotoItem[]
  onChange: (next: PhotoItem[]) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const previews = usePhotoPreviews(photos)

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? [])
    if (picked.length === 0) return
    const room = MAX_PLACE_PHOTOS - photos.length
    onChange([...photos, ...picked.slice(0, room).map((file) => ({ file }))])
    event.target.value = ''
  }

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index))
  }

  const atMax = photos.length >= MAX_PLACE_PHOTOS

  return (
    <div className="places-section">
      <h2 className="profile-section__title">
        Places you've both been <TierBadge tier="basic" />
      </h2>
      <p className="profile-section__hint">
        Add 1–3 photos from somewhere you've been together. She'll be asked if she remembers,
        then see it revealed.
      </p>

      <div className="photo-grid">
        {photos.map((_, index) => (
          <div className="photo-grid__item" key={index}>
            <img src={previews[index]} alt="" />
            <button
              type="button"
              className="photo-grid__remove"
              onClick={() => removePhoto(index)}
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
        ))}

        {!atMax && (
          <button
            type="button"
            className="photo-grid__add"
            onClick={() => fileInputRef.current?.click()}
          >
            <span>+</span>
            Add photo
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={addPhotos}
      />
    </div>
  )
}

const MAX_QUESTIONS = 10

function QuestionSection({
  questions,
  onChange,
}: {
  questions: string[]
  onChange: (next: string[]) => void
}) {
  const updateAt = (index: number, value: string) => {
    onChange(questions.map((q, i) => (i === index ? value : q)))
  }

  const removeAt = (index: number) => {
    onChange(questions.filter((_, i) => i !== index))
  }

  return (
    <div className="letter-section">
      <h2 className="profile-section__title">
        Ask her your own question <TierBadge tier="super" />
      </h2>
      <p className="profile-section__hint">
        Replaces "Do you believe in love?" as the yes/no she has to get past before it opens. Super
        gets one question, Premium can add as many as you want — leave blank to keep the default.
      </p>

      {questions.map((question, index) => (
        <div className="memory-entry" key={index}>
          <input
            className="letter-textarea"
            type="text"
            placeholder='e.g. "Will you be my girlfriend?"'
            value={question}
            onChange={(event) => updateAt(index, event.target.value)}
            maxLength={120}
          />
          <button
            type="button"
            className="photo-grid__remove memory-entry__remove"
            onClick={() => removeAt(index)}
            aria-label="Remove question"
          >
            ×
          </button>
        </div>
      ))}

      {questions.length < MAX_QUESTIONS && (
        <button
          type="button"
          className="letter-templates-btn"
          onClick={() => onChange([...questions, ''])}
        >
          + Add a question
        </button>
      )}
    </div>
  )
}

const MAX_MEMORIES = 6

function MemorySection({
  memories,
  onChange,
}: {
  memories: string[]
  onChange: (next: string[]) => void
}) {
  const updateAt = (index: number, value: string) => {
    onChange(memories.map((m, i) => (i === index ? value : m)))
  }

  const removeAt = (index: number) => {
    onChange(memories.filter((_, i) => i !== index))
  }

  return (
    <div className="memory-section">
      <h2 className="profile-section__title">
        Do you remember? <TierBadge tier="basic" />
      </h2>
      <p className="profile-section__hint">
        A special moment, or something you think she's forgotten. Each one shows up mid-scroll as
        your photo — she swipes it to reveal what you wrote.
      </p>

      {memories.map((memory, index) => (
        <div className="memory-entry" key={index}>
          <textarea
            className="memory-entry__textarea"
            placeholder="e.g. Do you remember the night it poured and we still walked home anyway?"
            value={memory}
            onChange={(event) => updateAt(index, event.target.value)}
            rows={3}
          />
          <button
            type="button"
            className="photo-grid__remove memory-entry__remove"
            onClick={() => removeAt(index)}
            aria-label="Remove memory"
          >
            ×
          </button>
        </div>
      ))}

      {memories.length < MAX_MEMORIES && (
        <button
          type="button"
          className="letter-templates-btn"
          onClick={() => onChange([...memories, ''])}
        >
          + Add a memory
        </button>
      )}
    </div>
  )
}

type GiftType = 'date' | 'ticket' | 'other'

type GiftDraft = {
  type: GiftType
  title: string
  location: string
  when: string
  message: string
  photo: PhotoItem | null
  attachment: PhotoItem | null
}

const emptyGift: GiftDraft = {
  type: 'date',
  title: '',
  location: '',
  when: '',
  message: '',
  photo: null,
  attachment: null,
}

const GIFT_TYPES: { value: GiftType; label: string }[] = [
  { value: 'date', label: 'A date' },
  { value: 'ticket', label: 'A ticket / event' },
  { value: 'other', label: 'Something else' },
]

const GIFT_LABELS: Record<
  GiftType,
  {
    title: string
    titlePlaceholder: string
    location: string
    locationPlaceholder: string
    when: string
    whenPlaceholder: string
  }
> = {
  date: {
    title: "What's the date?",
    titlePlaceholder: 'e.g. Dinner & a movie',
    location: 'Where',
    locationPlaceholder: 'e.g. That Italian place downtown',
    when: 'When',
    whenPlaceholder: 'e.g. Saturday, 7pm',
  },
  ticket: {
    title: "What's the ticket for?",
    titlePlaceholder: 'e.g. Coldplay, tour 2026',
    location: 'Venue',
    locationPlaceholder: 'e.g. City Arena',
    when: 'Date & time',
    whenPlaceholder: 'e.g. Fri 14 Aug, doors 7pm',
  },
  other: {
    title: "What's the surprise?",
    titlePlaceholder: 'e.g. A weekend trip to the coast',
    location: '',
    locationPlaceholder: '',
    when: '',
    whenPlaceholder: '',
  },
}

function isGiftComplete(gift: GiftDraft) {
  if (!gift.title.trim() || !gift.message.trim() || !gift.photo) return false
  if (gift.type !== 'other' && (!gift.location.trim() || !gift.when.trim())) return false
  return true
}

function GiftSection({
  gift,
  onChange,
}: {
  gift: GiftDraft
  onChange: (next: GiftDraft) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (gift.photo ? photoPreviewUrl(gift.photo) : null), [gift.photo])
  useEffect(() => {
    return () => {
      if (preview && !(gift.photo && isExistingPhoto(gift.photo))) URL.revokeObjectURL(preview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview])

  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const attachmentPreview = useMemo(
    () => (gift.attachment ? photoPreviewUrl(gift.attachment) : null),
    [gift.attachment],
  )
  useEffect(() => {
    return () => {
      if (attachmentPreview && !(gift.attachment && isExistingPhoto(gift.attachment))) {
        URL.revokeObjectURL(attachmentPreview)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentPreview])

  const labels = GIFT_LABELS[gift.type]

  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onChange({ ...gift, photo: { file } })
    event.target.value = ''
  }

  const pickAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onChange({ ...gift, attachment: { file } })
    event.target.value = ''
  }

  return (
    <div className="gift-section">
      <h2 className="profile-section__title">
        Plan her surprise <TierBadge tier="basic" />
      </h2>
      <p className="profile-section__hint">
        What are you actually surprising her with? This is what she'll scratch to reveal at the
        very end.
      </p>

      <div className="gift-type">
        {GIFT_TYPES.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`gift-type__option ${
              gift.type === option.value ? 'gift-type__option--active' : ''
            }`}
            onClick={() => onChange({ ...gift, type: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="profile-field">
        <span>{labels.title}</span>
        <input
          type="text"
          placeholder={labels.titlePlaceholder}
          value={gift.title}
          onChange={(event) => onChange({ ...gift, title: event.target.value })}
        />
      </label>

      {gift.type !== 'other' && (
        <>
          <label className="profile-field">
            <span>{labels.location}</span>
            <input
              type="text"
              placeholder={labels.locationPlaceholder}
              value={gift.location}
              onChange={(event) => onChange({ ...gift, location: event.target.value })}
            />
          </label>

          <label className="profile-field">
            <span>{labels.when}</span>
            <input
              type="text"
              placeholder={labels.whenPlaceholder}
              value={gift.when}
              onChange={(event) => onChange({ ...gift, when: event.target.value })}
            />
          </label>
        </>
      )}

      <label className="profile-field">
        <span>Message for her</span>
        <textarea
          className="gift-message"
          placeholder="e.g. Meet me at the front gate at 7 — wear something comfortable."
          value={gift.message}
          onChange={(event) => onChange({ ...gift, message: event.target.value })}
          rows={4}
        />
      </label>

      <div className="gift-photo">
        <span className="gift-photo__label">Your best picture</span>
        {preview ? (
          <div className="gift-photo__preview">
            <img src={preview} alt="" />
            <button
              type="button"
              className="photo-grid__remove"
              onClick={() => onChange({ ...gift, photo: null })}
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="photo-grid__add gift-photo__add"
            onClick={() => fileInputRef.current?.click()}
          >
            <span>+</span>
            Add photo
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
      </div>

      <div className="gift-attachment">
        <span className="gift-photo__label">
          Ticket, reservation, or document (optional) <TierBadge tier="premium" />
        </span>
        <p className="gift-attachment__hint">
          Got an actual ticket, booking confirmation, or invite? Attach a photo of it — she'll be
          able to flip the card to see it.
        </p>
        {attachmentPreview ? (
          <div className="gift-attachment__preview">
            <img src={attachmentPreview} alt="" />
            <button
              type="button"
              className="photo-grid__remove"
              onClick={() => onChange({ ...gift, attachment: null })}
              aria-label="Remove attachment"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="photo-grid__add gift-attachment__add"
            onClick={() => attachmentInputRef.current?.click()}
          >
            <span>+</span>
            Add attachment
          </button>
        )}
        <input
          ref={attachmentInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={pickAttachment}
        />
      </div>
    </div>
  )
}

function SongSection({
  song,
  songFile,
  onSelectLibrary,
  onUpload,
  onClearUpload,
}: {
  song: SongChoice | null
  songFile: File | null
  onSelectLibrary: (id: string) => void
  onUpload: (file: File) => void
  onClearUpload: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
    }
    const audio = audioRef.current
    const stop = () => setPreviewingId(null)
    audio.addEventListener('ended', stop)
    audio.addEventListener('pause', stop)
    return () => {
      audio.removeEventListener('ended', stop)
      audio.removeEventListener('pause', stop)
      audio.pause()
    }
  }, [])

  const uploadPreviewUrl = useMemo(
    () => (songFile ? URL.createObjectURL(songFile) : null),
    [songFile]
  )
  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    }
  }, [uploadPreviewUrl])

  const togglePreview = (id: string, src: string, startAt?: number) => {
    const audio = audioRef.current
    if (!audio) return
    if (previewingId === id) {
      audio.pause()
      return
    }
    if (audio.src !== new URL(src, window.location.href).href) {
      audio.src = src
    }
    audio.currentTime = startAt ?? 0
    audio.play().catch(() => {})
    setPreviewingId(id)
  }

  const pickSong = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onUpload(file)
    event.target.value = ''
  }

  return (
    <div className="song-section">
      <h2 className="profile-section__title">
        Pick a song <TierBadge tier="basic" />
      </h2>
      <p className="profile-section__hint">
        What should be playing while she scrolls through your memories?
      </p>

      <div className="song-grid">
        {SONG_LIBRARY.map((option) => (
          <button
            type="button"
            key={option.id}
            className={`song-card ${
              song?.type === 'library' && song.id === option.id ? 'song-card--active' : ''
            }`}
            onClick={() => onSelectLibrary(option.id)}
          >
            <span
              role="button"
              tabIndex={0}
              className={`song-card__preview ${previewingId === option.id ? 'song-card__preview--playing' : ''}`}
              onClick={(event) => {
                event.stopPropagation()
                togglePreview(option.id, option.src, option.startAt)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                event.stopPropagation()
                togglePreview(option.id, option.src, option.startAt)
              }}
              aria-label={previewingId === option.id ? `Pause ${option.title}` : `Preview ${option.title}`}
            >
              {previewingId === option.id ? '❚❚' : '▶'}
            </span>
            <span className="song-card__title">
              {option.title} {option.tier === 'super' && <TierBadge tier="super" />}
            </span>
            <span className="song-card__artist">{option.artist}</span>
          </button>
        ))}
      </div>

      <div className="song-upload">
        <span className="song-upload__divider">or</span>
        {songFile ? (
          <div className="song-upload__file">
            {uploadPreviewUrl && (
              <button
                type="button"
                className="song-card__preview"
                onClick={() => togglePreview('__upload__', uploadPreviewUrl)}
                aria-label={previewingId === '__upload__' ? 'Pause preview' : 'Preview song'}
              >
                {previewingId === '__upload__' ? '❚❚' : '▶'}
              </button>
            )}
            <span>{songFile.name}</span>
            <button
              type="button"
              className="photo-grid__remove"
              onClick={onClearUpload}
              aria-label="Remove song"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="letter-templates-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Can't find one? Upload your own <TierBadge tier="premium" />
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={pickSong} />
      </div>
    </div>
  )
}

function isProfileComplete(profile: Profile, minPhotos: number, maxPhotos: number) {
  return (
    profile.country.trim() !== '' &&
    profile.name.trim() !== '' &&
    profile.photos.length >= minPhotos &&
    profile.photos.length <= maxPhotos
  )
}

function ProfileSection({
  title,
  hint,
  photoHint,
  profile,
  onChange,
  minPhotos,
  maxPhotos,
  showNickname = false,
  nicknameLabel = 'Nickname',
  nicknamePlaceholder = 'What you actually call her',
}: {
  title: string
  hint: string
  photoHint?: string
  profile: Profile
  onChange: (next: Profile) => void
  minPhotos: number
  maxPhotos: number
  showNickname?: boolean
  nicknameLabel?: string
  nicknamePlaceholder?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const previews = usePhotoPreviews(profile.photos)

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? [])
    if (picked.length === 0) return
    const room = maxPhotos - profile.photos.length
    onChange({
      ...profile,
      photos: [...profile.photos, ...picked.slice(0, room).map((file) => ({ file }))],
    })
    event.target.value = ''
  }

  const removePhoto = (index: number) => {
    onChange({ ...profile, photos: profile.photos.filter((_, i) => i !== index) })
  }

  const count = profile.photos.length
  const atMax = count >= maxPhotos

  return (
    <div className="profile-section">
      <h2 className="profile-section__title">
        {title} <TierBadge tier="basic" />
      </h2>
      <p className="profile-section__hint">{hint}</p>

      <label className="profile-field">
        <span>Country</span>
        <input
          type="text"
          list="details-countries"
          placeholder="e.g. Kenya"
          value={profile.country}
          onChange={(event) => onChange({ ...profile, country: event.target.value })}
        />
      </label>

      <label className="profile-field">
        <span>Name</span>
        <input
          type="text"
          placeholder="Their name"
          value={profile.name}
          onChange={(event) => onChange({ ...profile, name: event.target.value })}
        />
      </label>

      {showNickname && (
        <label className="profile-field">
          <span>{nicknameLabel}</span>
          <input
            type="text"
            placeholder={nicknamePlaceholder}
            value={profile.nickname}
            onChange={(event) => onChange({ ...profile, nickname: event.target.value })}
          />
        </label>
      )}

      <div className="photo-uploader">
        <div className="photo-uploader__header">
          <span>Best moments</span>
          <span
            className={
              count >= minPhotos ? 'photo-uploader__count ok' : 'photo-uploader__count'
            }
          >
            {count}/{maxPhotos} · min {minPhotos}
          </span>
        </div>
        {photoHint && <p className="photo-uploader__hint">{photoHint}</p>}

        <div className="photo-grid">
          {profile.photos.map((_, index) => (
            <div className="photo-grid__item" key={index}>
              <img src={previews[index]} alt="" />
              <button
                type="button"
                className="photo-grid__remove"
                onClick={() => removePhoto(index)}
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}

          {!atMax && (
            <button
              type="button"
              className="photo-grid__add"
              onClick={() => fileInputRef.current?.click()}
            >
              <span>+</span>
              Add photos
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={addPhotos}
        />
      </div>
    </div>
  )
}

function SuccessFace() {
  return (
    <div className="success-face">
      <div className="success-face__ear success-face__ear--left" />
      <div className="success-face__ear success-face__ear--right" />
      <div className="success-face__eyes">
        <svg className="success-face__eye" viewBox="0 0 24 14" aria-hidden="true">
          <path d="M2 12 Q12 -2 22 12" fill="none" stroke="#243946" strokeWidth={3.5} strokeLinecap="round" />
        </svg>
        <svg className="success-face__eye" viewBox="0 0 24 14" aria-hidden="true">
          <path d="M2 12 Q12 -2 22 12" fill="none" stroke="#243946" strokeWidth={3.5} strokeLinecap="round" />
        </svg>
      </div>
      <div className="success-face__nose">
        <svg width="38" height="22" viewBox="0 0 38.161 22.03" aria-hidden="true">
          <path
            d="M2.017 10.987Q-.563 7.513.157 4.754C.877 1.994 2.976.135 6.164.093 16.4-.04 22.293-.022 32.048.093c3.501.042 5.48 2.081 6.02 4.661q.54 2.579-2.051 6.233-8.612 10.979-16.664 11.043-8.053.063-17.336-11.043z"
            fill="#243946"
          />
        </svg>
      </div>
      <div className="success-face__mouth">
        <svg viewBox="-2 -2 84 34" width="84" height="34" aria-hidden="true">
          <path
            d="M0 0c3.76 9.279 9.69 18.98 26.712 19.238 17.022.258 10.72.258 28 0S75.959 9.182 79.987.161"
            fill="none"
            stroke="#243946"
            strokeWidth={3}
            strokeLinecap="square"
          />
        </svg>
        <div className="success-face__tongue" />
      </div>
    </div>
  )
}

function Details() {
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
  const isEditing = Boolean(editId)
  const { session } = useAuth()
  const [her, setHer] = useState<Profile>(emptyProfile)
  const [him, setHim] = useState<Profile>(emptyProfile)
  const [letter, setLetter] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [memories, setMemories] = useState<string[]>([])
  const [places, setPlaces] = useState<PhotoItem[]>([])
  const [gift, setGift] = useState<GiftDraft>(emptyGift)
  const [song, setSong] = useState<SongChoice | null>(null)
  const [songFile, setSongFile] = useState<File | null>(null)
  const [unlockAt, setUnlockAt] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [surpriseId, setSurpriseId] = useState('')
  const [showPaywall, setShowPaywall] = useState(false)
  const [uploadTotal, setUploadTotal] = useState(0)
  const [uploadDone, setUploadDone] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [loadingExisting, setLoadingExisting] = useState(isEditing)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!editId || !session?.user.id) return
    let cancelled = false

    supabase
      .from('surprises')
      .select('*')
      .eq('id', editId)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError || !data) {
          setLoadError(fetchError?.message ?? "Couldn't find that surprise.")
          setLoadingExisting(false)
          return
        }
        setHer({
          country: data.her_country ?? '',
          name: data.her_name ?? '',
          nickname: data.her_nickname ?? '',
          photos: zipPhotos(
            (data.her_photos as string[]) ?? [],
            (data.her_photos_compressed as string[]) ?? [],
          ),
        })
        setHim({
          country: data.him_country ?? '',
          name: data.him_name ?? '',
          nickname: data.him_nickname ?? '',
          photos: zipPhotos(
            (data.him_photos as string[]) ?? [],
            (data.him_photos_compressed as string[]) ?? [],
          ),
        })
        setLetter(data.letter ?? '')
        setQuestions((data.questions as string[]) ?? [])
        setMemories((data.memories as string[]) ?? [])
        setPlaces(
          zipPhotos(
            (data.places_photos as string[]) ?? [],
            (data.places_photos_compressed as string[]) ?? [],
          ),
        )
        setSong((data.song as SongChoice) ?? null)
        setUnlockAt(data.unlock_at ? isoToDatetimeLocal(data.unlock_at as string) : '')
        const giftData = (data.gift ?? {}) as {
          type?: GiftType
          title?: string
          location?: string
          when?: string
          message?: string
          photo?: string
          photo_compressed?: string
          attachment?: string
        }
        setGift({
          type: giftData.type ?? 'date',
          title: giftData.title ?? '',
          location: giftData.location ?? '',
          when: giftData.when ?? '',
          message: giftData.message ?? '',
          photo: giftData.photo
            ? { url: giftData.photo, compressedUrl: giftData.photo_compressed || giftData.photo }
            : null,
          attachment: giftData.attachment
            ? { url: giftData.attachment, compressedUrl: giftData.attachment }
            : null,
        })
        setSurpriseId(editId)
        setLoadingExisting(false)
      })

    return () => {
      cancelled = true
    }
  }, [editId, session?.user.id])

  const applyTemplate = (template: (name: string) => string) => {
    setLetter(template(displayName(her)))
    setTemplatesOpen(false)
  }

  const selectLibrarySong = (id: string) => {
    setSongFile(null)
    setSong({ type: 'library', id })
  }

  const uploadSong = (file: File) => {
    setSong({ type: 'upload', name: file.name })
    setSongFile(file)
  }

  const clearUploadSong = () => {
    setSong(null)
    setSongFile(null)
  }

  const runUploads = async (id: string, userId: string) => {
    const total = her.photos.length + him.photos.length + places.length + 3 // +1 gift photo, +1 gift attachment, +1 song
    setUploadTotal(total)
    setUploadDone(0)
    setUploadError('')

    const bumpDone = () => setUploadDone((prev) => prev + 1)

    try {
      // Uploads the file exactly as picked (original quality, no resize) and,
      // unless told not to, a compressed JPEG sibling alongside it -- Basic
      // tier shows the compressed one, Super/Premium always show the
      // original (see SharedSurprise.tsx). Extension on the original follows
      // the real file rather than a hardcoded .jpg.
      const uploadImage = async (
        file: File,
        name: string,
        { withCompressed = true }: { withCompressed?: boolean } = {},
      ) => {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${userId}/${id}/${name}.${extension}`

        const uploadOriginal = supabase.storage
          .from('surprise-photos')
          .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true })
          .then(({ error: uploadErr }) => {
            if (uploadErr) throw uploadErr
            return supabase.storage.from('surprise-photos').getPublicUrl(path).data.publicUrl
          })

        const uploadCompressed = withCompressed
          ? compressImageToBlob(file).then((blob) => {
              const compressedPath = `${userId}/${id}/${name}-compressed.jpg`
              return supabase.storage
                .from('surprise-photos')
                .upload(compressedPath, blob, { contentType: 'image/jpeg', upsert: true })
                .then(({ error: uploadErr }) => {
                  if (uploadErr) throw uploadErr
                  return supabase.storage.from('surprise-photos').getPublicUrl(compressedPath).data
                    .publicUrl
                })
            })
          : Promise.resolve('')

        const [original, compressed] = await Promise.all([uploadOriginal, uploadCompressed])
        bumpDone()
        return { original, compressed: compressed || original }
      }

      // Existing (already-uploaded) photos are kept as-is; only freshly
      // picked files get uploaded. Order is preserved either way.
      const resolvePhotos = (items: PhotoItem[], prefix: string) =>
        Promise.all(
          items.map((item) => {
            if (isExistingPhoto(item)) {
              bumpDone()
              return Promise.resolve({ original: item.url, compressed: item.compressedUrl })
            }
            return uploadImage(item.file, `${prefix}-${crypto.randomUUID()}`)
          }),
        )

      const resolveGiftPhoto = () => {
        if (!gift.photo) return Promise.resolve({ original: '', compressed: '' })
        if (isExistingPhoto(gift.photo)) {
          bumpDone()
          return Promise.resolve({ original: gift.photo.url, compressed: gift.photo.compressedUrl })
        }
        return uploadImage(gift.photo.file, `gift-${crypto.randomUUID()}`)
      }

      // The gift attachment only ever shows on Premium (see SharedSurprise.tsx),
      // and Premium always gets full quality, so there's no point producing a
      // compressed copy of it.
      const resolveGiftAttachment = () => {
        if (!gift.attachment) {
          bumpDone()
          return Promise.resolve('')
        }
        if (isExistingPhoto(gift.attachment)) {
          bumpDone()
          return Promise.resolve(gift.attachment.url)
        }
        return uploadImage(gift.attachment.file, `gift-attachment-${crypto.randomUUID()}`, {
          withCompressed: false,
        }).then((result) => result.original)
      }

      const [herPhotosResult, himPhotosResult, placesPhotosResult, giftPhotoResult, giftAttachment] =
        await Promise.all([
          resolvePhotos(her.photos, 'her'),
          resolvePhotos(him.photos, 'him'),
          resolvePhotos(places, 'place'),
          resolveGiftPhoto(),
          resolveGiftAttachment(),
        ])

      const herPhotos = herPhotosResult.map((p) => p.original)
      const herPhotosCompressed = herPhotosResult.map((p) => p.compressed)
      const himPhotos = himPhotosResult.map((p) => p.original)
      const himPhotosCompressed = himPhotosResult.map((p) => p.compressed)
      const placesPhotos = placesPhotosResult.map((p) => p.original)
      const placesPhotosCompressed = placesPhotosResult.map((p) => p.compressed)

      let songPayload: SongChoice = song!
      if (song?.type === 'upload' && songFile) {
        const songPath = `${userId}/${id}/song-${crypto.randomUUID()}-${songFile.name}`
        const { error: songUploadError } = await supabase.storage
          .from('surprise-photos')
          .upload(songPath, songFile, { upsert: true })
        if (songUploadError) throw songUploadError
        const { publicUrl } = supabase.storage.from('surprise-photos').getPublicUrl(songPath).data
        songPayload = { type: 'upload', name: songFile.name, url: publicUrl }
      }
      bumpDone()

      const { error: updateError } = await supabase
        .from('surprises')
        .update({
          her_photos: herPhotos,
          her_photos_compressed: herPhotosCompressed,
          him_photos: himPhotos,
          him_photos_compressed: himPhotosCompressed,
          places_photos: placesPhotos,
          places_photos_compressed: placesPhotosCompressed,
          song: songPayload,
          gift: {
            type: gift.type,
            title: gift.title.trim(),
            location: gift.location.trim(),
            when: gift.when.trim(),
            message: gift.message.trim(),
            photo: giftPhotoResult.original,
            photo_compressed: giftPhotoResult.compressed,
            attachment: giftAttachment,
          },
        })
        .eq('id', id)
      if (updateError) throw updateError
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Some photos failed to upload. Please retry.',
      )
    }
  }

  const handleSubmit = async () => {
    if (!isProfileComplete(her, MIN_PHOTOS_HER, MAX_PHOTOS_HER) || !isProfileComplete(him, MIN_PHOTOS_HIM, MAX_PHOTOS_HIM)) {
      setError(
        `Fill in both names & countries. Add ${MIN_PHOTOS_HER}–${MAX_PHOTOS_HER} photos of her ` +
          `(photos of you two together count too) and ${MIN_PHOTOS_HIM}–${MAX_PHOTOS_HIM} of you.`,
      )
      return
    }
    if (!letter.trim()) {
      setError('Write her something before continuing.')
      return
    }
    if (places.length < MIN_PLACE_PHOTOS) {
      setError("Add at least one photo of somewhere you've been together.")
      return
    }
    if (!song) {
      setError('Pick a song for her to listen to.')
      return
    }
    if (!isGiftComplete(gift)) {
      setError("Fill in what you're surprising her with, a message, and your best picture.")
      return
    }
    const userId = session?.user.id
    if (!userId) {
      setError('Your session expired — sign in again.')
      return
    }

    setError('')
    setSaving(true)
    try {
      const id = editId ?? crypto.randomUUID()
      const textFields = {
        her_name: her.name.trim(),
        her_nickname: her.nickname.trim(),
        her_country: her.country.trim(),
        him_name: him.name.trim(),
        him_nickname: him.nickname.trim(),
        him_country: him.country.trim(),
        letter: letter.trim(),
        questions: questions.map((q) => q.trim()).filter(Boolean),
        memories: memories.map((m) => m.trim()).filter(Boolean),
        song: song.type === 'library' ? song : null,
        unlock_at: unlockAt ? new Date(unlockAt).toISOString() : null,
      }

      if (isEditing) {
        // Save the text fields immediately; runUploads (below) patches in
        // photos/song once any newly picked files finish uploading.
        const { error: updateError } = await supabase
          .from('surprises')
          .update(textFields)
          .eq('id', id)
        if (updateError) throw updateError
      } else {
        // Insert the text-only fields first so the share link is live immediately —
        // photos/song upload in the background and patch this row (runUploads below).
        const { error: insertError } = await supabase.from('surprises').insert({
          id,
          user_id: userId,
          ...textFields,
          gift: {
            type: gift.type,
            title: gift.title.trim(),
            location: gift.location.trim(),
            when: gift.when.trim(),
            message: gift.message.trim(),
            photo: '',
            photo_compressed: '',
            attachment: '',
          },
          her_photos: [],
          her_photos_compressed: [],
          him_photos: [],
          him_photos_compressed: [],
          places_photos: [],
          places_photos_compressed: [],
        })
        if (insertError) throw insertError
      }

      setSurpriseId(id)
      setShareUrl(`${window.location.origin}/s/${id}`)
      runUploads(id, userId)
      // Editing an already-paid surprise doesn't re-charge — only a brand
      // new surprise needs to clear the paywall before its link is usable.
      if (isEditing) {
        setDone(true)
      } else {
        setShowPaywall(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong saving your surprise. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const retryUploads = () => {
    const userId = session?.user.id
    if (!userId || !surpriseId) return
    runUploads(surpriseId, userId)
  }

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable — she can still select & copy the input manually
    }
  }

  if (showPaywall && surpriseId && session) {
    const pricing = computePricing({
      song,
      hasGiftAttachment: Boolean(gift.attachment),
      questionCount: questions.map((q) => q.trim()).filter(Boolean).length,
    })
    return (
      <TierPaywall
        surpriseId={surpriseId}
        userEmail={session.user.email ?? ''}
        accessToken={session.access_token}
        pricing={pricing}
        onSuccess={() => {
          // Only now — payment actually confirmed — does he get the "her link
          // is ready" email. Sending it any earlier (e.g. right after the
          // insert) would hand him a link that doesn't even work yet, since
          // get_surprise() requires a surprise_payments row to exist at all.
          sendSurpriseCreatedEmail(surpriseId, session.access_token)
          setShowPaywall(false)
          setDone(true)
        }}
        onClose={() => navigate('/account')}
      />
    )
  }

  if (done) {
    const uploading = !uploadError && uploadDone < uploadTotal
    return (
      <main className="details-page details-page--done">
        <SuccessFace />
        <h1>{isEditing ? 'Changes saved!' : "You're all set!"}</h1>
        <p>
          {isEditing
            ? 'Her link stays the same — it now reflects what you just changed.'
            : 'Send her this link — she can open it straight away, no sign-in needed.'}
        </p>
        <div className="details__share-link">
          <input
            readOnly
            value={shareUrl}
            onFocus={(event) => event.target.select()}
          />
          <button type="button" onClick={copyShareLink}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {uploading && (
          <div className="details__upload-status">
            <div className="details__upload-bar">
              <div
                className="details__upload-bar-fill"
                style={{ width: `${uploadTotal ? (uploadDone / uploadTotal) * 100 : 0}%` }}
              />
            </div>
            <p>
              Uploading photos & song… {uploadDone}/{uploadTotal}
              <br />
              The link already works — this fills itself in as it finishes.
            </p>
          </div>
        )}

        {uploadError && (
          <div className="details__upload-status details__upload-status--error">
            <p>{uploadError}</p>
            <button type="button" className="letter-templates-btn" onClick={retryUploads}>
              Retry upload
            </button>
          </div>
        )}

        <button
          type="button"
          className="details__continue"
          onClick={() => navigate(isEditing ? '/account' : '/')}
        >
          {isEditing ? 'Back to account' : 'Back home'}
        </button>
      </main>
    )
  }

  if (loadingExisting) {
    return (
      <main className="details-page details-page--done">
        <LoveLoader label="Loading your surprise…" />
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="details-page details-page--done">
        <h1>Couldn't load that surprise</h1>
        <p>{loadError}</p>
        <button type="button" className="details__continue" onClick={() => navigate('/account')}>
          Back to account
        </button>
      </main>
    )
  }

  return (
    <main className="details-page">
      <datalist id="details-countries">
        {COUNTRIES.map((c) => (
          <option value={c} key={c} />
        ))}
      </datalist>

      <div className="details-page__intro">
        <h1>{isEditing ? 'Edit your surprise' : 'Tell us about you two'}</h1>
        <p>
          {isEditing
            ? 'Change whatever you like — the share link stays the same.'
            : 'Add her details and yours — country, name, and your best photos together.'}
        </p>
      </div>

      <div className="details-page__sections">
        <ProfileSection
          title="Her"
          hint="Your girlfriend or wife"
          photoHint="Solo shots of her, or of the two of you together — both count, and photos of you two together are even better."
          profile={her}
          onChange={setHer}
          minPhotos={MIN_PHOTOS_HER}
          maxPhotos={MAX_PHOTOS_HER}
          showNickname
        />
        <ProfileSection
          title="You"
          hint="The male in the story"
          profile={him}
          onChange={setHim}
          minPhotos={MIN_PHOTOS_HIM}
          maxPhotos={MAX_PHOTOS_HIM}
          showNickname
          nicknameLabel="Nickname (optional)"
          nicknamePlaceholder="What should she call you? Defaults to your name"
        />
      </div>

      <div className="letter-section">
        <div className="letter-section__header">
          <div>
            <h2 className="profile-section__title">
              Write her something <TierBadge tier="basic" />
            </h2>
          </div>
          <button
            type="button"
            className="letter-templates-btn"
            onClick={() => setTemplatesOpen(true)}
          >
            Use a template
          </button>
        </div>
        <textarea
          className="letter-textarea"
          placeholder={`Dear ${her.nickname.trim() || her.name || 'her'}...`}
          value={letter}
          onChange={(event) => setLetter(event.target.value)}
          rows={8}
        />
      </div>

      <QuestionSection questions={questions} onChange={setQuestions} />

      <MemorySection memories={memories} onChange={setMemories} />

      <PlacesSection photos={places} onChange={setPlaces} />

      {templatesOpen && (
        <div className="templates-overlay" onClick={() => setTemplatesOpen(false)}>
          <div className="templates-modal" onClick={(event) => event.stopPropagation()}>
            <div className="templates-modal__header">
              <h3>Pick a starting point</h3>
              <button
                type="button"
                className="templates-modal__close"
                onClick={() => setTemplatesOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="templates-modal__grid">
              {LETTER_TEMPLATES.map((template) => (
                <button
                  type="button"
                  className="template-card"
                  key={template.title}
                  onClick={() => applyTemplate(template.text)}
                >
                  <span className="template-card__title">{template.title}</span>
                  <span className="template-card__preview">
                    {template.text(displayName(her))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <SongSection
        song={song}
        songFile={songFile}
        onSelectLibrary={selectLibrarySong}
        onUpload={uploadSong}
        onClearUpload={clearUploadSong}
      />

      <GiftSection gift={gift} onChange={setGift} />

      <ScheduleSection unlockAt={unlockAt} onChange={setUnlockAt} />

      {error && <p className="details__error">{error}</p>}

      <button type="button" className="details__submit" onClick={handleSubmit} disabled={saving}>
        {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save & continue'}
      </button>
    </main>
  )
}

export default Details
