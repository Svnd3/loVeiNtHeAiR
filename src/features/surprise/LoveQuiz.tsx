import { useState } from 'react'
import DodgeYesNo from './DodgeYesNo'

const DEFAULT_QUESTIONS = ['Do you believe in love?']

// `questions` walks her through however many he wrote (Super caps this at
// one before it ever gets here — see SharedSurprise.tsx — Premium can be
// any length) one dodge-the-No screen at a time, then calls onBelieve.
function LoveQuiz({
  herName,
  questions,
  onBelieve,
}: {
  herName?: string
  questions?: string[]
  onBelieve: () => void
}) {
  const list = questions && questions.length > 0 ? questions : DEFAULT_QUESTIONS
  const [index, setIndex] = useState(0)

  const advance = () => {
    if (index === list.length - 1) onBelieve()
    else setIndex((prev) => prev + 1)
  }

  return (
    // key={index} remounts DodgeYesNo per question so each one gets its own
    // fresh dodge attempts/button positions instead of inheriting whatever
    // state (e.g. "No" already cornered) the previous question ended in.
    <DodgeYesNo
      key={index}
      greeting={index === 0 && herName ? `Hey, ${herName}` : undefined}
      title={list[index]}
      hint={index === 0 ? 'be honest...' : undefined}
      onYes={advance}
    />
  )
}

export default LoveQuiz
