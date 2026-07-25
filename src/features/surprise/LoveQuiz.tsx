import DodgeYesNo from './DodgeYesNo'

function LoveQuiz({ herName, onBelieve }: { herName?: string; onBelieve: () => void }) {
  return (
    <DodgeYesNo
      greeting={herName ? `Hey, ${herName}` : undefined}
      title="Do you believe in love? 💗"
      hint="be honest..."
      onYes={onBelieve}
    />
  )
}

export default LoveQuiz
