import { useState } from 'react'
import './SenderChip.css'

function LegoFace() {
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="10" fill="#ffd23f" />
      <rect x="10" y="16" width="5" height="7" rx="2" fill="#243946" />
      <rect x="25" y="16" width="5" height="7" rx="2" fill="#243946" />
      <path d="M12 27c3 4 13 4 16 0" stroke="#243946" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function SenderChip({ name }: { name: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="sender-chip">
      <button
        type="button"
        className="sender-chip__button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close sender info' : 'Who sent this?'}
      >
        <LegoFace />
      </button>

      {open && (
        <div className="sender-chip__popover" role="dialog" aria-label="Sender">
          <div className="sender-chip__popover-avatar">
            <LegoFace />
          </div>
          <p className="sender-chip__popover-name">{name}</p>
        </div>
      )}
    </div>
  )
}

export default SenderChip
