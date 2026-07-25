import { useState, type CSSProperties } from 'react'
import DodgeYesNo from './DodgeYesNo'
import './RememberQuiz.css'

function RememberQuiz({
  photos,
  onOpenPhoto,
}: {
  photos: string[]
  onOpenPhoto: (src: string) => void
}) {
  const [revealed, setRevealed] = useState(false)

  if (!revealed) {
    return (
      <DodgeYesNo
        title="Do you remember the first time we met?"
        hint="think back..."
        onYes={() => setRevealed(true)}
      />
    )
  }

  return (
    <section className="dodge-quiz remember-reveal">
      <p className="remember-reveal__label">
        {photos.length > 0 ? 'remember this?' : 'you always do'}
      </p>
      {photos.length > 0 && (
        <div className="remember-reveal__photos">
          {photos.map((src, index) => (
            <button
              type="button"
              key={src}
              className="remember-reveal__photo-btn"
              style={{ '--i': index } as CSSProperties}
              onClick={() => onOpenPhoto(src)}
              aria-label="Open photo"
            >
              <img src={src} alt="" className="remember-reveal__photo" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export default RememberQuiz
