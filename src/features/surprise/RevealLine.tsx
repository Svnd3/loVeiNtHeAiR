import { useEffect, useRef, useState, type ReactNode } from 'react'
import './RevealLine.css'

function RevealLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`reveal-line ${visible ? 'reveal-line--visible' : ''} ${className}`}>
      {children}
    </div>
  )
}

export default RevealLine
