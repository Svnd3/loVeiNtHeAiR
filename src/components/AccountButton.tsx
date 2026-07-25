import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import './AccountButton.css'

function AccountButton() {
  const { session } = useAuth()
  const location = useLocation()
  // The shared-surprise link is meant to work with zero access to the creator's
  // account — even if it's opened in a browser that happens to have his session,
  // it should never surface a path into editing.
  if (location.pathname.startsWith('/s/')) return null
  if (!session) return null

  const avatarUrl = session.user.user_metadata?.avatar_url as string | undefined
  const email = session.user.email ?? ''
  const initial = email.charAt(0).toUpperCase() || '?'

  return (
    <Link to="/account" className="account-button" aria-label="Your account">
      {avatarUrl ? (
        <img className="account-button__avatar" src={avatarUrl} alt="" />
      ) : (
        <span className="account-button__initial">{initial}</span>
      )}
    </Link>
  )
}

export default AccountButton
