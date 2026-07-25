import DodgeYesNo from './DodgeYesNo'

function LoveQuiz({ onBelieve }: { onBelieve: () => void }) {
  return (
    <DodgeYesNo title="Do you believe in love? 💗" hint="be honest..." onYes={onBelieve} />
  )
}

export default LoveQuiz
