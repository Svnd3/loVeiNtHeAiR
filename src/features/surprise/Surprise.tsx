import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoveQuiz from './LoveQuiz'
import AudioPlayer from './AudioPlayer'
import LyricsBackdrop from './LyricsBackdrop'
import ScrollStory from './ScrollStory'
import { useProfile } from './useProfile'
import { useAuth } from '../../lib/AuthContext'
import './Surprise.css'

function Surprise() {
  const [believed, setBelieved] = useState(false)
  const [audioTime, setAudioTime] = useState({ currentTime: 0, duration: 0 })
  const profile = useProfile()
  const navigate = useNavigate()
  const { session } = useAuth()

  const goBuildOne = () => navigate(session ? '/details' : '/login')

  return (
    <div className="surprise">
      {/* Mounted immediately (not gated on `believed`) so the song is already
          buffering in the background by the time she reaches the reveal --
          `active` is what actually controls whether it plays/shows its widget. */}
      <AudioPlayer
        song={profile.song}
        active={believed}
        onTimeUpdate={(currentTime, duration) => setAudioTime({ currentTime, duration })}
      />

      {!believed && <LoveQuiz herName={profile.herName} onBelieve={() => setBelieved(true)} />}
      {believed && (
        <>
          <LyricsBackdrop
            song={profile.song}
            currentTime={audioTime.currentTime}
            duration={audioTime.duration}
          />
          <ScrollStory
            herName={profile.herName}
            himName={profile.himName}
            photos={profile.photos}
            himPhotos={profile.himPhotos}
            letter={profile.letter}
            gift={profile.gift}
            memories={profile.memories}
            placesPhotos={profile.placesPhotos}
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
