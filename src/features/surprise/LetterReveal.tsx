import RevealLine from './RevealLine'
import './LetterReveal.css'

function LetterReveal({
  herName,
  himName,
  letter,
}: {
  herName: string
  himName: string
  letter: string
}) {
  return (
    <section className="letter-reveal">
      <RevealLine className="letter-reveal__intro">
        <p>one more thing was waiting for you down here…</p>
      </RevealLine>

      <RevealLine className="letter-reveal__card-wrap">
        <div className="letter-reveal__card">
          <p className="letter-reveal__salutation">Dear {herName},</p>
          <p className="letter-reveal__body">{letter}</p>
          <p className="letter-reveal__signature">— {himName}</p>
        </div>
      </RevealLine>
    </section>
  )
}

export default LetterReveal
