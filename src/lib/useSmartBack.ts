import { useNavigate, useLocation } from 'react-router-dom'

/**
 * A "back" button that's safe even when this page was the first thing loaded
 * in the tab (direct link, refresh, opened in a new tab) — react-router gives
 * the very first history entry the key "default", where navigate(-1) would
 * otherwise be a no-op or leave the app entirely.
 */
export function useSmartBack(fallback = '/') {
  const navigate = useNavigate()
  const location = useLocation()

  return () => {
    if (location.key === 'default') {
      navigate(fallback, { replace: true })
    } else {
      navigate(-1)
    }
  }
}
