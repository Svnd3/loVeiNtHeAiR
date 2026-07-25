import { useEffect, useState } from 'react'
import './CookieBanner.css'

const COOKIE_KEY = 'gfbf_cookie_consent'

function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(localStorage.getItem(COOKIE_KEY) !== 'accepted')
  }, [])

  if (!visible) return null

  return (
    <div className="cookie-banner" role="status">
      <p>
        This site uses cookies to remember you. We only use them to keep you signed in.
      </p>
      <button
        type="button"
        className="cookie-banner__accept"
        onClick={() => {
          localStorage.setItem(COOKIE_KEY, 'accepted')
          setVisible(false)
        }}
      >
        Got it
      </button>
    </div>
  )
}

export default CookieBanner
