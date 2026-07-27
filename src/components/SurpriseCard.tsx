import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import './SurpriseCard.css'

// White/yellow/pink/blue/green/orange/red, cycled by list position so the
// grid stays colorful without anything re-shuffling on re-fetch/poll.
const CARD_COLORS = ['#ffffff', '#fff3b0', '#fbd1e8', '#a0c4ff', '#caffbf', '#ffd6a5', '#ffadad']

export type SurpriseCardData = {
  id: string
  himName: string
  himNickname: string
  himCountry: string
  himPhotos: string[]
  herName: string
  herNickname: string
  paid: boolean
  ownerJoinedAt?: string
  isPreviewTemplate?: boolean
}

// Two faces of the same card: `mine` is what a regular creator sees for
// their own surprises on Account.tsx (view/edit right on the card, no
// expand); `admin` is hezronsande2@gmail.com's cross-user browser
// (Admin.tsx) -- the card itself has no buttons, tapping it opens a larger
// detail view instead (full info + a "Canon it" button to pick it as the
// public /surprise preview's live content).
function SurpriseCard({
  surprise,
  index,
  variant,
  status,
  onEdit,
  onDelete,
  onPay,
  onSetPreviewTemplate,
}: {
  surprise: SurpriseCardData
  index: number
  variant: 'mine' | 'admin'
  // Extra bit of text under the "for {her}" line -- e.g. Account.tsx's
  // "Seen · 3 views" / "Locked until ..." status. Only ever used by `mine`.
  status?: ReactNode
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onPay?: (id: string) => void
  onSetPreviewTemplate?: (id: string) => void
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const color = CARD_COLORS[index % CARD_COLORS.length]
  const name = surprise.himNickname || surprise.himName
  const herDisplayName = surprise.herNickname || surprise.herName
  const pfp = surprise.himPhotos[0]
  const viewHref = `/s/${surprise.id}`

  if (variant === 'mine') {
    return (
      <div className="surprise-card" style={{ background: color }}>
        {onDelete && (
          <button
            type="button"
            className="surprise-card__delete"
            onClick={() => onDelete(surprise.id)}
            aria-label={`Delete surprise for ${herDisplayName}`}
          >
            ×
          </button>
        )}
        <div className="surprise-card__head">
          {pfp && <img className="surprise-card__pfp" src={pfp} alt="" />}
          <span className="surprise-card__name">{name}</span>
        </div>
        <p className="surprise-card__meta">for {herDisplayName}</p>
        {status && <div className="surprise-card__status">{status}</div>}
        <div className="surprise-card__actions">
          {surprise.paid ? (
            <a className="surprise-card__btn" href={viewHref} target="_blank" rel="noopener noreferrer">
              View surprise
            </a>
          ) : (
            <button type="button" className="surprise-card__btn" onClick={() => onPay?.(surprise.id)}>
              Complete payment
            </button>
          )}
          <button
            type="button"
            className="surprise-card__btn surprise-card__btn--ghost"
            onClick={() => (onEdit ? onEdit(surprise.id) : navigate(`/details/${surprise.id}`))}
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        className="surprise-card surprise-card--admin"
        style={{ background: color }}
        onClick={() => setExpanded(true)}
      >
        {pfp && <img className="surprise-card__pfp" src={pfp} alt="" />}
        <span className="surprise-card__name">{name}</span>
      </button>

      {expanded && (
        <div className="surprise-card-overlay" onClick={() => setExpanded(false)}>
          <div className="surprise-card-expanded" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="surprise-card-expanded__edit"
              onClick={() => navigate(`/details/${surprise.id}`)}
              aria-label="Edit"
            >
              ✎
            </button>
            <button
              type="button"
              className="surprise-card-expanded__close"
              onClick={() => setExpanded(false)}
              aria-label="Close"
            >
              ×
            </button>

            {pfp && <img className="surprise-card-expanded__pfp" src={pfp} alt="" />}
            <h2 className="surprise-card-expanded__name">{name}</h2>
            {surprise.himCountry && <p className="surprise-card-expanded__row">{surprise.himCountry}</p>}
            {surprise.ownerJoinedAt && (
              <p className="surprise-card-expanded__row">
                Joined{' '}
                {new Date(surprise.ownerJoinedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            )}
            <p className="surprise-card-expanded__row">Surprise for {herDisplayName}</p>

            <a
              className="surprise-card-expanded__view"
              href={viewHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              View surprise
            </a>

            {onSetPreviewTemplate && (
              <button
                type="button"
                className="surprise-card-expanded__canon"
                onClick={() => onSetPreviewTemplate(surprise.id)}
                disabled={surprise.isPreviewTemplate}
              >
                {surprise.isPreviewTemplate ? "It's canon ✓" : 'Canon it'}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default SurpriseCard
