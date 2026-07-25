import { useEffect, useRef } from 'react'
import './Confetti.css'

const COLORS = ['#ef2964', '#00c09d', '#2d87b0', '#48485e', '#f7b32b']
const SPEEDS = ['slow', 'medium', 'fast'] as const
const SPAWN_INTERVAL_MS = 25
const PIECE_LIFETIME_MS = 3000

function Confetti() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const interval = window.setInterval(() => {
      const piece = document.createElement('div')
      const size = Math.floor(Math.random() * 3) + 7
      const speed = SPEEDS[Math.floor(Math.random() * SPEEDS.length)]

      piece.className = `confetti-piece confetti-piece--${speed}`
      piece.style.left = `${Math.floor(Math.random() * container.offsetWidth)}px`
      piece.style.width = `${size}px`
      piece.style.height = `${size}px`
      piece.style.backgroundColor = COLORS[Math.floor(Math.random() * COLORS.length)]
      if (Math.random() > 0.5) piece.style.borderRadius = '50%'

      container.appendChild(piece)
      window.setTimeout(() => piece.remove(), PIECE_LIFETIME_MS)
    }, SPAWN_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [])

  return <div className="confetti" ref={containerRef} aria-hidden="true" />
}

export default Confetti
