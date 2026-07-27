import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { SUPER_ADMIN_EMAIL } from '../lib/admin'
import { useSmartBack } from '../lib/useSmartBack'
import SurpriseCard, { type SurpriseCardData } from '../components/SurpriseCard'
import LoveLoader from '../components/LoveLoader'
import './Admin.css'

function Admin() {
  const { session } = useAuth()
  const goBack = useSmartBack('/account')
  const [surprises, setSurprises] = useState<SurpriseCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isAdmin = session?.user.email === SUPER_ADMIN_EMAIL

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false

    supabase
      .rpc('admin_list_surprises')
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setSurprises(
            ((data ?? []) as Record<string, unknown>[]).map((row) => ({
              id: row.id as string,
              himName: (row.him_name as string) ?? '',
              himNickname: (row.him_nickname as string) ?? '',
              himCountry: (row.him_country as string) ?? '',
              himPhotos: (row.him_photos as string[]) ?? [],
              herName: (row.her_name as string) ?? '',
              herNickname: (row.her_nickname as string) ?? '',
              paid: Boolean(row.paid),
              ownerJoinedAt: (row.owner_joined_at as string) ?? undefined,
              isPreviewTemplate: Boolean(row.is_preview_template),
            })),
          )
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const handleSetPreviewTemplate = (id: string) => {
    supabase.rpc('set_preview_template', { p_surprise_id: id }).then(({ error: rpcError }) => {
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      setSurprises((prev) => prev.map((s) => ({ ...s, isPreviewTemplate: s.id === id })))
    })
  }

  if (!session) return null
  if (!isAdmin) return <Navigate to="/account" replace />

  return (
    <main className="admin-page">
      <button type="button" className="admin-page__back" onClick={goBack} aria-label="Go back">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <h1 className="admin-page__title">Every surprise</h1>
      <p className="admin-page__subtitle">
        {loading ? 'Loading…' : `${surprises.length} made so far`}
      </p>

      {error && <p className="admin-page__error">{error}</p>}

      {loading && <LoveLoader label="loading…" />}

      {!loading && surprises.length === 0 && !error && (
        <p className="admin-page__empty">Nobody's made one yet.</p>
      )}

      <div className="admin-page__grid">
        {surprises.map((surprise, index) => (
          <SurpriseCard
            key={surprise.id}
            surprise={surprise}
            index={index}
            variant="admin"
            onSetPreviewTemplate={handleSetPreviewTemplate}
          />
        ))}
      </div>
    </main>
  )
}

export default Admin
