import { useEffect, useRef, useState } from 'react'
import { KNOW_ME_COLORS, type KnowMeQuestion } from './knowMeQuiz'
import './KnowMeQuiz.css'

const TITLE_DELAY_MS = 1000
const TITLE_HOLD_MS = 1600
const TITLE_FADE_MS = 500
const COUNTDOWN_MS = 3000
const FEEDBACK_MS = 800
const COLOR_INTERVAL_MS = 1800

type Stage = 'title' | 'title-fade' | 'countdown' | 'question'

// Lets the lyrics ticker (see SharedSurprise.tsx / LyricsBackdrop) show
// faintly through the quiz's full-screen background, without touching
// KNOW_ME_COLORS itself -- that same palette also colors the solid answer
// buttons, which should stay fully opaque.
function toBackdropTint(hex: string) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, 0.9)`
}

function useColorCycle(active: boolean) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % KNOW_ME_COLORS.length)
    }, COLOR_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [active])
  return KNOW_ME_COLORS[index]
}

// Sits between LoveQuiz and ScrollStory for Super/Mixed/Premium (see
// SharedSurprise.tsx) -- a non-skippable 3-question "how well do you know
// me" mini-quiz: a title beat, then a 3-2-1 countdown before each question.
function KnowMeQuiz({
  herName,
  questions,
  onDone,
}: {
  herName?: string
  questions: KnowMeQuestion[]
  onDone: () => void
}) {
  const [stage, setStage] = useState<Stage>('title')
  const [round, setRound] = useState(0)
  const [countdownValue, setCountdownValue] = useState(3)
  const [pickedIndex, setPickedIndex] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const color = useColorCycle(stage === 'countdown' || stage === 'question')

  // Preloaded the moment the quiz mounts (during the title screen, well
  // before round 1's countdown even starts) and reused every round via
  // currentTime reset -- so every click plays instantly, not just the first.
  useEffect(() => {
    const audio = new Audio('/audio/know-me-click.mp3')
    audio.preload = 'auto'
    audio.load()
    audioRef.current = audio
  }, [])

  useEffect(() => {
    if (stage !== 'title') return
    const timer = setTimeout(() => setStage('title-fade'), TITLE_DELAY_MS + TITLE_HOLD_MS)
    return () => clearTimeout(timer)
  }, [stage])

  useEffect(() => {
    if (stage !== 'title-fade') return
    const timer = setTimeout(() => setStage('countdown'), TITLE_FADE_MS)
    return () => clearTimeout(timer)
  }, [stage])

  // A fresh 3-2-1 beat before every question, not just the first.
  useEffect(() => {
    if (stage !== 'countdown') return
    setCountdownValue(3)
    const tick2 = setTimeout(() => setCountdownValue(2), 1000)
    const tick1 = setTimeout(() => setCountdownValue(1), 2000)
    const advance = setTimeout(() => setStage('question'), COUNTDOWN_MS)
    return () => {
      clearTimeout(tick2)
      clearTimeout(tick1)
      clearTimeout(advance)
    }
  }, [stage, round])

  useEffect(() => {
    if (questions.length === 0) onDone()
  }, [questions.length, onDone])

  if (questions.length === 0) return null

  const currentQuestion = questions[round]

  const handlePick = (index: number) => {
    if (pickedIndex !== null) return
    setPickedIndex(index)
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {})
    }
    setTimeout(() => {
      setPickedIndex(null)
      if (round + 1 < questions.length) {
        setRound((r) => r + 1)
        setStage('countdown')
      } else {
        onDone()
      }
    }, FEEDBACK_MS)
  }

  if (stage === 'title' || stage === 'title-fade') {
    return (
      <div className="know-me-quiz know-me-quiz--title">
        <h1
          className={`know-me-quiz__headline ${stage === 'title-fade' ? 'know-me-quiz__headline--out' : ''}`}
        >
          How well do you know me?
        </h1>
      </div>
    )
  }

  if (stage === 'countdown') {
    return (
      <div className="know-me-quiz" style={{ background: toBackdropTint(color.bg), color: color.fg }}>
        {herName && round === 0 && <p className="know-me-quiz__greeting">Hey, {herName}</p>}
        <p className="know-me-quiz__countdown" key={countdownValue}>
          {countdownValue}
        </p>
      </div>
    )
  }

  return (
    <div className="know-me-quiz" style={{ background: toBackdropTint(color.bg), color: color.fg }}>
      <p className="know-me-quiz__progress">
        {round + 1} / {questions.length}
      </p>
      <h2 className="know-me-quiz__question">{currentQuestion.question}</h2>
      <div className="know-me-quiz__options">
        {currentQuestion.options.map((option, index) => {
          const isPicked = pickedIndex === index
          const swatch = KNOW_ME_COLORS[index % KNOW_ME_COLORS.length]
          return (
            <button
              type="button"
              key={option}
              // Deliberately doesn't reveal correctIndex here at all -- she
              // picks an answer and it just moves on, no right/wrong tell.
              className={['know-me-quiz__option', isPicked ? 'know-me-quiz__option--picked' : '']
                .filter(Boolean)
                .join(' ')}
              style={{ background: swatch.bg, color: swatch.fg }}
              onClick={() => handlePick(index)}
              disabled={pickedIndex !== null}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default KnowMeQuiz
