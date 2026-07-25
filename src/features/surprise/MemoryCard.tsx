import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import './MemoryCard.css'

function MemoryCard({ text, photo }: { text: string; photo?: string }) {
  const hitRef = useRef<HTMLDivElement>(null)
  const [halfWidth, setHalfWidth] = useState(0)
  const [progress, setProgress] = useState(0)
  const [settling, setSettling] = useState(false)
  const drag = useRef<{ startX: number; startProgress: number; moved: boolean } | null>(null)

  useEffect(() => {
    const el = hitRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setHalfWidth(entry.contentRect.width / 2)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const settleTo = (target: number) => {
    setSettling(true)
    setProgress(target)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setSettling(false)
    drag.current = { startX: event.clientX, startProgress: progress, moved: false }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || halfWidth === 0) return
    const deltaX = event.clientX - drag.current.startX
    if (Math.abs(deltaX) > 4) drag.current.moved = true
    const deltaProgress = -deltaX / (halfWidth * 2)
    const next = Math.min(1, Math.max(0, drag.current.startProgress + deltaProgress))
    setProgress(next)
  }

  const endDrag = () => {
    if (!drag.current) return
    const { moved } = drag.current
    drag.current = null
    if (!moved) {
      settleTo(progress > 0.5 ? 0 : 1)
      return
    }
    settleTo(progress > 0.5 ? 1 : 0)
  }

  return (
    <section className="memory-card">
      {/* The hit area stays flat (no rotation) so its pointer bounding box never
          collapses edge-on -- only the scene inside it flips in 3D. Rotating the
          hit-testing element itself broke dragging back once it hit 90deg. */}
      <div
        className="memory-card__hit"
        ref={hitRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="memory-card__scene"
          style={{
            transform: `rotateY(${-progress * 90}deg)`,
            transition: settling ? 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
        >
          <div
            className="memory-card__face memory-card__face--front"
            style={{ transform: `translateZ(${halfWidth}px)` }}
          >
            <p className="memory-card__label">do you remember?</p>
            <p className="memory-card__text">{text}</p>
            <div className="memory-card__hint">
              <span className="memory-card__hint-arrow">←</span>
              swipe
            </div>
          </div>
          <div
            className="memory-card__face memory-card__face--back"
            style={{ transform: `rotateY(90deg) translateZ(${halfWidth}px)` }}
          >
            {photo && <img src={photo} alt="" draggable={false} />}
            <div className="memory-card__hint">
              swipe back
              <span className="memory-card__hint-arrow">→</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default MemoryCard
