import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import './MemoryCard.css'

// Built from whichever fields he actually filled in -- the prompt always
// shows first, then the photo slide (if he added one), then the caption
// slide (if he wrote one). A memory with just a prompt renders as a single,
// non-swipeable slide.
type Face = 'prompt' | 'photo' | 'caption'

function MemoryCard({
  prompt,
  photo,
  caption,
}: {
  prompt: string
  photo?: string
  caption?: string
}) {
  const faces: Face[] = ['prompt', ...(photo ? (['photo'] as const) : []), ...(caption ? (['caption'] as const) : [])]
  const lastIndex = faces.length - 1

  const hitRef = useRef<HTMLDivElement>(null)
  const [cardWidth, setCardWidth] = useState(0)
  const [progress, setProgress] = useState(0)
  const [settling, setSettling] = useState(false)
  const drag = useRef<{ startX: number; startProgress: number; moved: boolean } | null>(null)

  useEffect(() => {
    const el = hitRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setCardWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const settleTo = (target: number) => {
    setSettling(true)
    setProgress(Math.min(lastIndex, Math.max(0, target)))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (lastIndex === 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setSettling(false)
    drag.current = { startX: event.clientX, startProgress: progress, moved: false }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || cardWidth === 0) return
    const deltaX = event.clientX - drag.current.startX
    if (Math.abs(deltaX) > 4) drag.current.moved = true
    const deltaProgress = -deltaX / cardWidth
    const next = Math.min(lastIndex, Math.max(0, drag.current.startProgress + deltaProgress))
    setProgress(next)
  }

  const endDrag = () => {
    if (!drag.current) return
    const { moved, startProgress } = drag.current
    drag.current = null
    if (!moved) {
      settleTo(startProgress >= lastIndex ? 0 : startProgress + 1)
      return
    }
    settleTo(Math.round(progress))
  }

  const step = Math.round(progress)

  return (
    <section className="memory-card">
      <div
        className="memory-card__hit"
        ref={hitRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="memory-card__track"
          style={{
            width: `${faces.length * 100}%`,
            transform: `translateX(-${(progress * 100) / faces.length}%)`,
            transition: settling ? 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
        >
          {faces.map((face) => (
            <div
              className={`memory-card__face memory-card__face--${face}`}
              style={{ width: `${100 / faces.length}%` }}
              key={face}
            >
              {face === 'prompt' && (
                <>
                  <p className="memory-card__label">do you remember</p>
                  <p className="memory-card__text">{prompt}</p>
                </>
              )}
              {face === 'photo' && photo && <img src={photo} alt="" draggable={false} />}
              {face === 'caption' && (
                <>
                  <p className="memory-card__label">and then...</p>
                  <p className="memory-card__text">{caption}</p>
                </>
              )}
            </div>
          ))}
        </div>

        {lastIndex > 0 && step < lastIndex && (
          <div className="memory-card__hint">
            swipe
            <span className="memory-card__hint-arrow">←</span>
          </div>
        )}
        {lastIndex > 0 && step === lastIndex && (
          <div className="memory-card__hint">
            swipe back
            <span className="memory-card__hint-arrow">→</span>
          </div>
        )}
      </div>
    </section>
  )
}

export default MemoryCard
