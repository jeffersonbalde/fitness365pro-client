import React, { useMemo } from 'react'
import EarnedRewardThumbnail from './EarnedRewardThumbnail.jsx'

/**
 * CMS event trophies (image_url from admin_events.trophies), shown when enrolled challenge reaches 100% progress.
 */
export default function ProfileEarnedEventTrophies({
  items = [],
  resolveMediaUrl,
}) {
  const list = useMemo(() => (Array.isArray(items) ? items : []).filter(Boolean), [items])

  return (
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
                <div className="profile-earned-event-reward-card" title={label}>
                  <div className="profile-earned-event-reward-frame">
                    <EarnedRewardThumbnail
                      item={t}
                      resolveMediaUrl={resolveMediaUrl}
                      alt={t.title || 'Event trophy'}
                    />
                  </div>
                  {(t.title || t.event_title) && (
                    <span className="profile-earned-event-reward-caption">{t.title || t.event_title}</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
