import { useEffect, useState, type CSSProperties } from 'react'
import DodgeYesNo from './DodgeYesNo'
import './RememberQuiz.css'

const SCROLL_LOCK_KEYS = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End']

function RememberQuiz({
  photos,
  onOpenPhoto,
}: {
  photos: string[]
  onOpenPhoto: (src: string) => void
}) {
  const [revealed, setRevealed] = useState(false)

  // Keep her from scrolling past this section until she presses Yes.
  useEffect(() => {
    if (revealed) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const preventWheel = (event: WheelEvent) => event.preventDefault()
    const preventTouchMove = (event: TouchEvent) => event.preventDefault()
    const preventScrollKeys = (event: KeyboardEvent) => {
      if (SCROLL_LOCK_KEYS.includes(event.key)) event.preventDefault()
    }

    window.addEventListener('wheel', preventWheel, { passive: false })
    window.addEventListener('touchmove', preventTouchMove, { passive: false })
    window.addEventListener('keydown', preventScrollKeys)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('wheel', preventWheel)
      window.removeEventListener('touchmove', preventTouchMove)
      window.removeEventListener('keydown', preventScrollKeys)
    }
  }, [revealed])

  if (!revealed) {
    return (
      <DodgeYesNo
        title="Do you remember the first time we met? 💭"
        hint="think back..."
        onYes={() => setRevealed(true)}
      />
    )
  }

  return (
    <section className="dodge-quiz remember-reveal">
      <p className="remember-reveal__label">
        {photos.length > 0 ? 'remember this? 🤍' : 'you always do 🤍'}
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
