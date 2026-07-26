import DodgeYesNo from './DodgeYesNo'

function LoveQuiz({
  herName,
  question,
  onBelieve,
}: {
  herName?: string
  question?: string
  onBelieve: () => void
}) {
  return (
    <DodgeYesNo
      greeting={herName ? `Hey, ${herName}` : undefined}
      title={question || 'Do you believe in love?'}
      hint="be honest..."
      onYes={onBelieve}
    />
  )
}

export default LoveQuiz
