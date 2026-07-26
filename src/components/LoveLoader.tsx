import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import './LoveLoader.css'

function LoveLoader({ label }: { label?: string }) {
  return (
    <div className="love-loader">
      <DotLottieReact src="/love-loader.lottie" loop autoplay className="love-loader__animation" />
      {label && <p className="love-loader__label">{label}</p>}
    </div>
  )
}

export default LoveLoader
