import { useEffect, useState } from 'react'
import { KNOW_ME_COLORS } from './knowMeQuiz'
import { useColorCycle, toBackdropTint } from './KnowMeQuiz'
import './KnowMeQuiz.css'
import './GuessGiftQuiz.css'

const TITLE_DELAY_MS = 500
const TITLE_HOLD_MS = 900
const TITLE_FADE_MS = 400
// A 3-2-1 beat like KnowMeQuiz's, just tuned faster (700ms/tick instead of 1s).
const TICK_MS = 700
const COUNTDOWN_MS = TICK_MS * 3
const FEEDBACK_MS = 700
const MAX_ATTEMPTS = 2

type Stage = 'title' | 'title-fade' | 'countdown' | 'question' | 'reveal'

// The very last beat, only for Premium surprises with an attached ticket/
// reservation/document AND a guess question authored in Details.tsx (see
// GiftSection) -- she gets up to 2 guesses at what the gift actually is,
// unlike KnowMeQuiz this reveals right/wrong per pick, then always shows the
// real attachment photo once she's used her guesses. Mounted by
// ScratchReveal.tsx as a full-screen overlay once she chooses to play.
function GuessGiftQuiz({
  question,
  options,
  correctIndex,
  attachmentPhoto,
  onDone,
}: {
  question: string
  options: string[]
  correctIndex: number
  attachmentPhoto: string
  onDone: () => void
}) {
  const [stage, setStage] = useState<Stage>('title')
  const [countdownValue, setCountdownValue] = useState(3)
  const [attempt, setAttempt] = useState(1)
  const [pickedIndex, setPickedIndex] = useState<number | null>(null)
  const [wrongIndices, setWrongIndices] = useState<number[]>([])

  const color = useColorCycle(stage === 'countdown' || stage === 'question' || stage === 'reveal')

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

  useEffect(() => {
    if (stage !== 'countdown') return
    setCountdownValue(3)
    const tick2 = setTimeout(() => setCountdownValue(2), TICK_MS)
    const tick1 = setTimeout(() => setCountdownValue(1), TICK_MS * 2)
    const advance = setTimeout(() => setStage('question'), COUNTDOWN_MS)
    return () => {
      clearTimeout(tick2)
      clearTimeout(tick1)
      clearTimeout(advance)
    }
  }, [stage])

  const handlePick = (index: number) => {
    if (pickedIndex !== null) return
    setPickedIndex(index)
    const correct = index === correctIndex
    setTimeout(() => {
      if (correct || attempt >= MAX_ATTEMPTS) {
        setStage('reveal')
        return
      }
      setWrongIndices((prev) => [...prev, index])
      setPickedIndex(null)
      setAttempt((a) => a + 1)
    }, FEEDBACK_MS)
  }

  if (stage === 'title' || stage === 'title-fade') {
    return (
      <div className="know-me-quiz know-me-quiz--title guess-gift-quiz">
        <h1
          className={`know-me-quiz__headline ${stage === 'title-fade' ? 'know-me-quiz__headline--out' : ''}`}
        >
          Guess the gift!
        </h1>
      </div>
    )
  }

  if (stage === 'countdown') {
    return (
      <div
        className="know-me-quiz guess-gift-quiz"
        style={{ background: toBackdropTint(color.bg), color: color.fg }}
      >
        <p className="know-me-quiz__countdown" key={countdownValue}>
          {countdownValue}
        </p>
      </div>
    )
  }

  if (stage === 'reveal') {
    return (
      <div
        className="know-me-quiz guess-gift-quiz guess-gift-quiz--reveal"
        style={{ background: toBackdropTint(color.bg), color: color.fg }}
      >
        <p className="know-me-quiz__progress">here's what it really is</p>
        <img className="guess-gift-quiz__photo" src={attachmentPhoto} alt="" />
        <button type="button" className="guess-gift-quiz__done" onClick={onDone}>
          continue →
        </button>
      </div>
    )
  }

  return (
    <div
      className="know-me-quiz guess-gift-quiz"
      style={{ background: toBackdropTint(color.bg), color: color.fg }}
    >
      <p className="know-me-quiz__progress">
        guess {attempt} of {MAX_ATTEMPTS}
      </p>
      <h2 className="know-me-quiz__question">{question}</h2>
      <div className="know-me-quiz__options">
        {options.map((option, index) => {
          const isPicked = pickedIndex === index
          const isWrongPick = isPicked && index !== correctIndex
          const isRightPick = isPicked && index === correctIndex
          const swatch = KNOW_ME_COLORS[index % KNOW_ME_COLORS.length]
          return (
            <button
              type="button"
              key={option}
              className={[
                'know-me-quiz__option',
                isPicked ? 'know-me-quiz__option--picked' : '',
                isRightPick ? 'guess-gift-quiz__option--right' : '',
                isWrongPick ? 'guess-gift-quiz__option--wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ background: swatch.bg, color: swatch.fg }}
              onClick={() => handlePick(index)}
              disabled={pickedIndex !== null || wrongIndices.includes(index)}
            >
              {option}
            </button>
          )
        })}
      </div>
      {pickedIndex !== null && (
        <p className="guess-gift-quiz__feedback">
          {pickedIndex === correctIndex ? 'you got it! 🎉' : 'not quite...'}
        </p>
      )}
    </div>
  )
}

export default GuessGiftQuiz
