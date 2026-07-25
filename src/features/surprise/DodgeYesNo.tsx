import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import './DodgeYesNo.css'

const DODGE_LIMIT = 19
const DODGE_RADIUS = 90
const DODGE_COOLDOWN_MS = 120

const COLORS = [
  '#fbd1e8', '#c7e3e1', '#ffd6a5', '#caffbf', '#a0c4ff',
  '#bdb2ff', '#ffadad', '#fdffb6', '#9bf6ff', '#ffc6ff',
]

const EMOJIS = [
  '😢', '🥺', '😭', '🙈', '👉👈', '🥹', '😳', '💔', '🫣',
  '😅', '😩', '🤏', '🫠', '🙃', '😖', '🫥', '😬', '😵‍💫',
]

type Point = { x: number; y: number }
type Popper = { id: number; emoji: string; left: number; top: number }

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function positionStyle(pos: Point | null, zIndex: number): CSSProperties {
  if (!pos) return {}
  return { position: 'absolute', left: pos.x, top: pos.y, zIndex }
}

function DodgeYesNo({
  title,
  hint,
  onYes,
}: {
  title: ReactNode
  hint?: ReactNode
  onYes: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const yesRef = useRef<HTMLButtonElement>(null)
  const noRef = useRef<HTMLButtonElement>(null)

  const [attempts, setAttempts] = useState(0)
  const [yesPos, setYesPos] = useState<Point | null>(null)
  const [noPos, setNoPos] = useState<Point | null>(null)
  const [poppers, setPoppers] = useState<Popper[]>([])

  const popId = useRef(0)
  const lastDodgeAt = useRef(0)
  const behindYes = attempts >= DODGE_LIMIT

  // Measure the buttons' natural flex position once, then pin both absolutely
  // at those coordinates so future dodges don't disturb the layout.
  useLayoutEffect(() => {
    const container = containerRef.current
    const yesBtn = yesRef.current
    const noBtn = noRef.current
    if (!container || !yesBtn || !noBtn) return
    const containerRect = container.getBoundingClientRect()
    const yesRect = yesBtn.getBoundingClientRect()
    const noRect = noBtn.getBoundingClientRect()
    setYesPos({ x: yesRect.left - containerRect.left, y: yesRect.top - containerRect.top })
    setNoPos({ x: noRect.left - containerRect.left, y: noRect.top - containerRect.top })
  }, [])

  // Once the dodge limit is hit, park No exactly behind Yes.
  useEffect(() => {
    if (behindYes && yesPos) setNoPos(yesPos)
  }, [behindYes, yesPos])

  const dodge = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current
      const noBtn = noRef.current
      if (!container || !noBtn || behindYes) return

      const now = performance.now()
      if (now - lastDodgeAt.current < DODGE_COOLDOWN_MS) return
      lastDodgeAt.current = now

      const containerRect = container.getBoundingClientRect()
      const noRect = noBtn.getBoundingClientRect()
      const pointer = { x: clientX - containerRect.left, y: clientY - containerRect.top }

      const id = popId.current++
      setPoppers((prev) => [
        ...prev,
        {
          id,
          emoji: randomChoice(EMOJIS),
          left: noRect.left - containerRect.left + noRect.width / 2,
          top: noRect.top - containerRect.top,
        },
      ])
      setTimeout(() => setPoppers((prev) => prev.filter((p) => p.id !== id)), 900)

      const angle = Math.random() * Math.PI * 2
      const radius = DODGE_RADIUS + Math.random() * 80
      const maxLeft = Math.max(containerRect.width - noRect.width - 8, 8)
      const maxTop = Math.max(containerRect.height - noRect.height - 8, 8)
      const left = Math.min(Math.max(pointer.x + Math.cos(angle) * radius - noRect.width / 2, 8), maxLeft)
      const top = Math.min(Math.max(pointer.y + Math.sin(angle) * radius - noRect.height / 2, 8), maxTop)

      setNoPos({ x: left, y: top })
      setAttempts((prev) => Math.min(prev + 1, DODGE_LIMIT))
    },
    [behindYes],
  )

  const handleContainerPointerMove = (event: ReactPointerEvent) => {
    if (behindYes || !noRef.current) return
    const rect = noRef.current.getBoundingClientRect()
    const dist = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2))
    if (dist < DODGE_RADIUS) dodge(event.clientX, event.clientY)
  }

  const handleNoPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (behindYes) return
    event.preventDefault()
    dodge(event.clientX, event.clientY)
  }

  const noColor = COLORS[attempts % COLORS.length]
  const yesColor = COLORS[(attempts + 3) % COLORS.length]

  return (
    <section className="dodge-quiz" ref={containerRef} onPointerMove={handleContainerPointerMove}>
      <h1 className="dodge-quiz__title">{title}</h1>
      {hint && <p className="dodge-quiz__hint">{hint}</p>}

      <div className="dodge-quiz__buttons">
        <button
          type="button"
          ref={yesRef}
          className="dodge-quiz__btn dodge-quiz__btn--yes"
          style={{ ...positionStyle(yesPos, 2), background: yesColor }}
          onClick={onYes}
        >
          Yes
        </button>
        <button
          type="button"
          ref={noRef}
          className="dodge-quiz__btn dodge-quiz__btn--no"
          style={{ ...positionStyle(noPos, behindYes ? 1 : 3), background: noColor }}
          onPointerDown={handleNoPointerDown}
          onClick={(event) => event.preventDefault()}
          tabIndex={behindYes ? -1 : 0}
          aria-hidden={behindYes}
          disabled={behindYes}
        >
          No
        </button>
      </div>

      {poppers.map((p) => (
        <span
          key={p.id}
          className="dodge-quiz__popper"
          style={{ left: p.left, top: p.top }}
          aria-hidden="true"
        >
          {p.emoji}
        </span>
      ))}
    </section>
  )
}

export default DodgeYesNo
