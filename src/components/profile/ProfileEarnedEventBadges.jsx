import React, { useCallback, useMemo, useState } from 'react'
import BadgeShareModal from './BadgeShareModal.jsx'
import EarnedRewardThumbnail from './EarnedRewardThumbnail.jsx'
import './BadgeShareModal.css'

/**
 * CMS event badges (image_url from admin_events.badges), populated when enrolled challenge reaches 100% progress.
 */
export default function ProfileEarnedEventBadges({
  items = [],
  resolveMediaUrl,
  ownerName = '',
  clientId = '',
}) {
  const list = useMemo(() => (Array.isArray(items) ? items : []).filter(Boolean), [items])
  const [activeBadge, setActiveBadge] = useState(null)

  const openBadge = useCallback((badge) => {
    setActiveBadge(badge)
  }, [])

  const closeBadge = useCallback(() => {
    setActiveBadge(null)
  }, [])

  return (
    <>
      <section className="profile-earned-event-badges-block" aria-labelledby="profile-earned-event-badges-title">
        <div className="profile-side-head profile-joined-events-section-head">
          <h2 id="profile-earned-event-badges-title" className="profile-section-title mb-0">
            Badges
          </h2>
        </div>
        {list.length === 0 ? (
          <div className="profile-library-muted">No event badges yet — finish a challenge distance goal first.</div>
        ) : (
          <ul className="profile-earned-event-rewards-grid" role="list">
            {list.map((b) => {
              const label = b.event_title ? `${b.event_title}${b.title ? ` · ${b.title}` : ''}` : b.title || 'Badge'
              return (
                <li key={b.id} className="profile-earned-event-reward-li">
                  <button
                    type="button"
                    className="profile-earned-event-badge-btn"
                    onClick={() => openBadge(b)}
                    aria-label={`View and share badge: ${label}`}
                  >
                    <div className="profile-earned-event-reward-frame" title={label}>
                      <EarnedRewardThumbnail
                        item={b}
                        resolveMediaUrl={resolveMediaUrl}
                        ownerName={ownerName}
                        alt={b.title || 'Event badge'}
                      />
                    </div>
                    {(b.title || b.event_title) && (
                      <span className="profile-earned-event-reward-caption">{b.title || b.event_title}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <BadgeShareModal
        open={Boolean(activeBadge)}
        onRequestClose={closeBadge}
        badge={activeBadge}
        ownerName={ownerName}
        clientId={clientId}
        resolveMediaUrl={resolveMediaUrl}
      />
    </>
  )
}
