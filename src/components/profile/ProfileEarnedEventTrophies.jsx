import React, { useCallback, useMemo, useState } from 'react'
import BadgeShareModal from './BadgeShareModal.jsx'
import EarnedRewardThumbnail from './EarnedRewardThumbnail.jsx'
import './BadgeShareModal.css'

/**
 * CMS event trophies (image_url from admin_events.trophies), shown when enrolled challenge reaches 100% progress.
 */
export default function ProfileEarnedEventTrophies({
  items = [],
  resolveMediaUrl,
  ownerName = '',
  clientId = '',
}) {
  const list = useMemo(() => (Array.isArray(items) ? items : []).filter(Boolean), [items])
  const [activeTrophy, setActiveTrophy] = useState(null)

  const openTrophy = useCallback((trophy) => {
    setActiveTrophy(trophy)
  }, [])

  const closeTrophy = useCallback(() => {
    setActiveTrophy(null)
  }, [])

  return (
    <>
      <section className="profile-earned-event-trophies-block" aria-labelledby="profile-earned-event-trophies-title">
        <div className="profile-side-head profile-joined-events-section-head">
          <h2 id="profile-earned-event-trophies-title" className="profile-section-title mb-0">
            Trophies
          </h2>
        </div>
        {list.length === 0 ? (
          <div className="profile-library-muted">No trophies yet.</div>
        ) : (
          <ul className="profile-earned-event-rewards-grid" role="list">
            {list.map((t) => {
              const label = t.event_title
                ? `${t.event_title}${t.title ? ` · ${t.title}` : ''}`
                : t.title || 'Trophy'
              return (
                <li key={t.id} className="profile-earned-event-reward-li">
                  <button
                    type="button"
                    className="profile-earned-event-badge-btn"
                    onClick={() => openTrophy(t)}
                    aria-label={`View and share trophy: ${label}`}
                  >
                    <div className="profile-earned-event-reward-frame" title={label}>
                      <EarnedRewardThumbnail
                        item={t}
                        resolveMediaUrl={resolveMediaUrl}
                        alt={t.title || 'Event trophy'}
                      />
                    </div>
                    {(t.title || t.event_title) && (
                      <span className="profile-earned-event-reward-caption">{t.title || t.event_title}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <BadgeShareModal
        open={Boolean(activeTrophy)}
        onRequestClose={closeTrophy}
        badge={activeTrophy}
        ownerName={ownerName}
        clientId={clientId}
        resolveMediaUrl={resolveMediaUrl}
        kind="trophy"
      />
    </>
  )
}
