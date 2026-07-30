import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { useSmartBack } from '../lib/useSmartBack'
import TierPaywall from '../components/TierPaywall'
import SurpriseCard, { type SurpriseCardData } from '../components/SurpriseCard'
import { SUPER_ADMIN_EMAIL } from '../lib/admin'
import './Account.css'

type SurpriseSummary = SurpriseCardData & {
  createdAt: string
  viewCount: number
  firstViewedAt: string | null
  unlockAt: string | null
}

function statusLabel(surprise: SurpriseSummary) {
  if (surprise.unlockAt && new Date(surprise.unlockAt).getTime() > Date.now()) {
    return { text: 'Locked until ' + new Date(surprise.unlockAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }), className: 'account-surprises__status--locked' }
  }
  if (surprise.firstViewedAt) {
    return { text: `Seen · ${surprise.viewCount} view${surprise.viewCount === 1 ? '' : 's'}`, className: 'account-surprises__status--seen' }
  }
  return { text: 'Not opened yet', className: 'account-surprises__status--pending' }
}

function Account() {
  const navigate = useNavigate()
  const goBack = useSmartBack('/')
  const { session } = useAuth()

  const [surprises, setSurprises] = useState<SurpriseSummary[]>([])
  const [loadingSurprises, setLoadingSurprises] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [listError, setListError] = useState('')
  const [payingSurpriseId, setPayingSurpriseId] = useState<string | null>(null)

  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    Promise.all([
      supabase
        .from('surprises')
        .select(
          'id, her_name, her_nickname, him_name, him_nickname, him_country, him_photos, created_at, view_count, first_viewed_at, unlock_at',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase.from('surprise_payments').select('surprise_id').eq('user_id', userId),
    ]).then(([surprisesResult, paymentsResult]) => {
      if (cancelled) return
      if (surprisesResult.error) {
        setListError(surprisesResult.error.message)
      } else {
        const paidIds = new Set((paymentsResult.data ?? []).map((row) => row.surprise_id as string))
        setSurprises(
          (surprisesResult.data ?? []).map((row) => ({
            id: row.id as string,
            herName: (row.her_name as string) || 'Untitled surprise',
            herNickname: (row.her_nickname as string) ?? '',
            himName: (row.him_name as string) ?? '',
            himNickname: (row.him_nickname as string) ?? '',
            himCountry: (row.him_country as string) ?? '',
            himPhotos: (row.him_photos as string[]) ?? [],
            createdAt: row.created_at as string,
            paid: paidIds.has(row.id as string),
            viewCount: (row.view_count as number) ?? 0,
            firstViewedAt: (row.first_viewed_at as string | null) ?? null,
            unlockAt: (row.unlock_at as string | null) ?? null,
          })),
        )
      }
      setLoadingSurprises(false)
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  if (!session) return null

  const { user } = session
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const fullName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined
  const email = user.email ?? ''
  const initial = email.charAt(0).toUpperCase() || '?'
  const provider = user.app_metadata?.provider === 'google' ? 'Google' : 'Email & password'
  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const handleSwitchAccount = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleDelete = async (id: string) => {
    if (!userId) return
    setDeletingId(id)
    setListError('')
    try {
      const { data: files } = await supabase.storage.from('surprise-photos').list(`${userId}/${id}`)
      if (files && files.length > 0) {
        await supabase.storage
          .from('surprise-photos')
          .remove(files.map((file) => `${userId}/${id}/${file.name}`))
      }
      const { error } = await supabase.from('surprises').delete().eq('id', id)
      if (error) throw error
      setSurprises((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Could not delete that surprise. Try again.')
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <main className="account-page">
      <button
        type="button"
        className="account-page__back"
        onClick={goBack}
        aria-label="Go back"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div className="account-page__stack">
        <div className="account-card">
          <div className="account-card__avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initial}</span>}
          </div>

          {fullName && <h1 className="account-card__name">{fullName}</h1>}
          <p className="account-card__email">{email}</p>

          <div className="account-card__details">
            <div className="account-card__row">
              <span>Signed in with</span>
              <span>{provider}</span>
            </div>
            {joined && (
              <div className="account-card__row">
                <span>Member since</span>
                <span>{joined}</span>
              </div>
            )}
          </div>

          <button type="button" className="account-card__edit" onClick={() => navigate('/details')}>
            Create a new surprise
          </button>
          {email === SUPER_ADMIN_EMAIL && (
            <button type="button" className="account-card__edit" onClick={() => navigate('/admin')}>
              Browse all surprises
            </button>
          )}
          <button type="button" className="account-card__switch" onClick={handleSwitchAccount}>
            Switch account
          </button>
          <button type="button" className="account-card__signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>

        <div className="account-card account-surprises">
          <h2 className="account-surprises__title">Your surprises</h2>
          <p className="account-card__email">
            Delete one you don't see fit anymore — this removes its link and photos for good.
          </p>

          {loadingSurprises && <p className="account-surprises__empty">Loading…</p>}

          {!loadingSurprises && surprises.length === 0 && (
            <p className="account-surprises__empty">You haven't created one yet.</p>
          )}

          {listError && <p className="account-surprises__error">{listError}</p>}

          <div className="account-surprises__grid">
            {surprises.map((surprise, index) =>
              confirmingId === surprise.id ? (
                <div key={surprise.id} className="account-surprises__confirm">
                  <span>Delete the surprise for {surprise.herName}?</span>
                  <button
                    type="button"
                    className="account-surprises__confirm-cancel"
                    onClick={() => setConfirmingId(null)}
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    className="account-surprises__confirm-delete"
                    onClick={() => handleDelete(surprise.id)}
                    disabled={deletingId === surprise.id}
                  >
                    {deletingId === surprise.id ? 'deleting…' : 'delete'}
                  </button>
                </div>
              ) : (
                <SurpriseCard
                  key={surprise.id}
                  surprise={surprise}
                  index={index}
                  variant="mine"
                  status={
                    surprise.paid ? (
                      <span className={`account-surprises__status ${statusLabel(surprise).className}`}>
                        {statusLabel(surprise).text}
                      </span>
                    ) : undefined
                  }
                  onPay={() => setPayingSurpriseId(surprise.id)}
                  onDelete={() => setConfirmingId(surprise.id)}
                />
              ),
            )}
          </div>
        </div>
      </div>

      {payingSurpriseId && session && (
        <TierPaywall
          surpriseId={payingSurpriseId}
          userEmail={session.user.email ?? ''}
          accessToken={session.access_token}
          onSuccess={() => {
            setSurprises((prev) =>
              prev.map((s) => (s.id === payingSurpriseId ? { ...s, paid: true } : s)),
            )
            setPayingSurpriseId(null)
          }}
          onClose={() => setPayingSurpriseId(null)}
        />
      )}
    </main>
  )
}

export default Account
