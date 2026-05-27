import React from 'react'

/**
 * Timeline row: workout linked to a CMS event — opens progress modal only (no routing).
 */
export function TimelineLinkedEventCallout({
  title,
  pendingReview = false,
  onOpen,
}) {
  const safeTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Event'

  return (
    <button
      type="button"
      className="timeline-feed-event-meta"
      onClick={onOpen}
      aria-label={`Open challenge progress for ${safeTitle}`}
    >
      <span className="timeline-feed-event-meta__row">
        <span className="timeline-feed-event-meta__lbl">Event</span>
        <span className="timeline-feed-event-meta__sep" aria-hidden>
          ·
        </span>
        <span className="timeline-feed-event-meta__name">{safeTitle}</span>
        {pendingReview ? (
          <>
            <span className="timeline-feed-event-meta__sep" aria-hidden>
              ·
            </span>
            <span className="timeline-feed-event-meta__status">Pending review</span>
          </>
        ) : null}
      </span>
    </button>
  )
}
