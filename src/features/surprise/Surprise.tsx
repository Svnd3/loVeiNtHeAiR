import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoveQuiz from './LoveQuiz'
import KnowMeQuiz from './KnowMeQuiz'
import AudioPlayer from './AudioPlayer'
import ScrollStory from './ScrollStory'
import { useProfile } from './useProfile'
import { generateAutoQuestions } from './knowMeQuiz'
import { useAuth } from '../../lib/AuthContext'
import './Surprise.css'

// A couple of examples of the "ask her your own question" gate (Super+) so
// the demo shows it off instead of just the default "Do you believe in love?".
const DEMO_GATE_QUESTIONS = ['Do you believe in love?', 'Will you sing along?']

function Surprise() {
  const [believed, setBelieved] = useState(false)
  const [knowMeDone, setKnowMeDone] = useState(false)
  const profile = useProfile()
  const navigate = useNavigate()
  const { session } = useAuth()

  const goBuildOne = () => navigate(session ? '/details' : '/login')

  // This preview is a showcase of the full Premium experience -- reuses the
  // same auto-generator real Super/Mixed/Premium surprises use (see
  // SharedSurprise.tsx), fed from the demo's own gift/song, so it's exactly
  // what a buyer would actually get, not a hand-written stand-in.
  const knowMeQuestions = useMemo(
    () =>
      generateAutoQuestions({
        her_nickname: '',
        him_nickname: '',
        him_country: '',
        gift: profile.gift,
        song: profile.song ?? null,
      }),
    [profile],
  )

  return (
    <div className="surprise">
      {/* Mounted immediately (not gated on `believed`) so the song is already
          buffering in the background by the time she reaches the reveal --
          `active` is what actually controls whether it plays/shows its widget. */}
      <AudioPlayer song={profile.song} active={believed} />

      {!believed && (
        <LoveQuiz
          herName={profile.herName}
          questions={DEMO_GATE_QUESTIONS}
          onBelieve={() => setBelieved(true)}
        />
      )}
      {believed && !knowMeDone && (
        <KnowMeQuiz
          herName={profile.herName}
          questions={knowMeQuestions}
          onDone={() => setKnowMeDone(true)}
        />
      )}
      {believed && knowMeDone && (
        <>
          {/* Lyrics backdrop disabled for this preview for now. */}
          <ScrollStory
            herName={profile.herName}
            himName={profile.himName}
            photos={profile.photos}
            letter={profile.letter}
            gift={profile.gift}
            memories={profile.memories}
            placesPhotos={profile.placesPhotos}
            premium
          />

          <div className="shared-surprise-cta">
            <p>Liked what you see?</p>
            <button type="button" className="shared-surprise-cta__btn" onClick={goBuildOne}>
              Get one for your girlfriend too →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default Surprise
