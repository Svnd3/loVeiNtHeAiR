import { useState } from 'react'
import LoveQuiz from './LoveQuiz'
import AudioPlayer from './AudioPlayer'
import LyricsBackdrop from './LyricsBackdrop'
import ScrollStory from './ScrollStory'
import { useProfile } from './useProfile'
import './Surprise.css'

function Surprise() {
  const [believed, setBelieved] = useState(false)
  const [audioTime, setAudioTime] = useState({ currentTime: 0, duration: 0 })
  const profile = useProfile()

  return (
    <div className="surprise">
      {!believed && <LoveQuiz onBelieve={() => setBelieved(true)} />}
      {believed && (
        <>
          <LyricsBackdrop
            song={profile.song}
            currentTime={audioTime.currentTime}
            duration={audioTime.duration}
          />
          <AudioPlayer
            song={profile.song}
            onTimeUpdate={(currentTime, duration) => setAudioTime({ currentTime, duration })}
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
        </>
      )}
    </div>
  )
}

export default Surprise
