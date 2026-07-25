import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import Confetti from './Confetti'
import type { SurpriseGift } from './useProfile'
import './ScratchReveal.css'

const SCRATCH_RADIUS = 30
const REVEAL_THRESHOLD = 0.45
const SAMPLE_STRIDE = 4 * 8
const CHECK_EVERY_N_MOVES = 8

const KICKERS: Record<SurpriseGift['type'], string> = {
  date: 'a date, just for you',
  ticket: "tickets — you're going",
  other: 'a little something',
}

function paintFoil(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#fbd1e8')
  gradient.addColorStop(1, '#c7e3e1')
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '600 16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('scratch here to reveal your surprise', width / 2, height / 2)
}

function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

function ScratchReveal({ himName, gift }: { himName: string; gift: SurpriseGift }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scratchingRef = useRef(false)
  const moveCountRef = useRef(0)
  const previousOverflowRef = useRef('')
  const [revealed, setRevealed] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const hasAttachment = Boolean(gift.attachment)

  const lockScroll = () => {
    previousOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  const unlockScroll = () => {
    document.body.style.overflow = previousOverflowRef.current
  }

  useEffect(() => unlockScroll, [])

  // The canvas unmounts the instant `revealed` flips true (below), which can
  // happen mid-gesture (inside onPointerMove) — so the pointer's onPointerUp
  // never fires on an element that no longer exists, and the scroll lock from
  // onPointerDown would otherwise stick forever. Unlock as soon as it's revealed.
  useEffect(() => {
    if (revealed) unlockScroll()
  }, [revealed])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      paintFoil(ctx, rect.width, rect.height)
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const scratchAt = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, SCRATCH_RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }

  const checkProgress = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx || !canvas.width || !canvas.height) return
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let cleared = 0
    let total = 0
    for (let i = 3; i < data.length; i += SAMPLE_STRIDE) {
      total++
      if (data[i] < 40) cleared++
    }
    if (total > 0 && cleared / total > REVEAL_THRESHOLD) setRevealed(true)
  }

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (revealed) return
    event.currentTarget.setPointerCapture(event.pointerId)
    scratchingRef.current = true
    lockScroll()
    const { x, y } = pointFromEvent(event)
    scratchAt(x, y)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!scratchingRef.current || revealed) return
    event.preventDefault()
    const { x, y } = pointFromEvent(event)
    scratchAt(x, y)
    moveCountRef.current += 1
    if (moveCountRef.current % CHECK_EVERY_N_MOVES === 0) checkProgress()
  }

  const onPointerUp = () => {
    if (!scratchingRef.current) return
    scratchingRef.current = false
    unlockScroll()
    checkProgress()
  }

  return (
    <section className="scratch-reveal">
      {revealed && <Confetti />}
      <h1 className="scratch-reveal__title">One more surprise</h1>

      <div className={`scratch-card ${revealed ? 'scratch-card--revealed' : ''}`} ref={wrapRef}>
        <div className={`scratch-card__flip ${flipped ? 'scratch-card__flip--flipped' : ''}`}>
          <div className="scratch-card__content scratch-card__content--front">
            <img className="scratch-card__photo" src={gift.photo} alt={himName} />
            <p className="scratch-card__kicker">{KICKERS[gift.type]}</p>
            <h2 className="scratch-card__title">{gift.title}</h2>
            {gift.location && <p className="scratch-card__detail">Where: {gift.location}</p>}
            {gift.when && <p className="scratch-card__detail">When: {gift.when}</p>}
            <p className="scratch-card__message">{gift.message}</p>
          </div>

          {hasAttachment && (
            <div className="scratch-card__content scratch-card__content--back">
              <img className="scratch-card__attachment" src={gift.attachment} alt="Attachment" />
            </div>
          )}
        </div>

        {!revealed && (
          <canvas
            ref={canvasRef}
            className="scratch-card__canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        )}
      </div>

      {!revealed && (
        <button type="button" className="scratch-reveal__skip" onClick={() => setRevealed(true)}>
          just show me
        </button>
      )}

      {revealed && hasAttachment && (
        <button
          type="button"
          className="scratch-card__flip-btn"
          onClick={() => setFlipped((prev) => !prev)}
        >
          <FlipIcon />
          {flipped ? 'back to the surprise' : 'see the attachment'}
        </button>
      )}
    </section>
  )
}

export default ScratchReveal
