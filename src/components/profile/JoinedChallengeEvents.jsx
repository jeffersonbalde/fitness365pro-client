import React, { useId, useState } from 'react'
import './JoinedChallengeEvents.css'

const formatLongDateJoined = (value) => {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatKm = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} km`
}

/** First paint shows up to this many enrolled events; “View all” reveals the rest. */
const JOINED_EVENTS_INITIAL_COUNT = 2

/** Donut progress (pie-style ring) — works in light/dark via currentColor + CSS vars. */
function ChallengeProgressRing({ percent, size = 68, labelId }) {
  const p = Math.min(100, Math.max(0, typeof percent === 'number' ? percent : 0))
  const stroke = size <= 44 ? 4 : 5
  const pad = stroke / 2 + 1
  const r = size / 2 - pad
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - p / 100)
  const uid = useId()
  const gid = `jc-ring-grad-${uid.replace(/:/g, '')}`

  return (
    <svg
      className="profile-joined-challenge-ring-svg"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-labelledby={labelId}
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="profile-joined-challenge-stop-a" />
          <stop offset="100%" className="profile-joined-challenge-stop-b" />
        </linearGradient>
      </defs>
      <circle
        className="profile-joined-challenge-ring-track"
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth={stroke}
      />
      <circle
        className="profile-joined-challenge-ring-arc"
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        stroke={`url(#${gid})`}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy}
        className="profile-joined-challenge-ring-label"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size <= 44 ? 10 : size >= 76 ? 13 : 11}
      >
        {Math.round(p)}
        <tspan className="profile-joined-challenge-ring-pct-symbol">%</tspan>
      </text>
    </svg>
  )
}

/** Tap opens progress modal (optional). */
export function ProfileJoinedChallengeCard({ ev, resolveMediaUrl, layout = 'stack', onOpenChallengeJournal }) {
  const pct = typeof ev.progress_percent === 'number' ? ev.progress_percent : null
  const hasGoal = ev.progress_goal_km != null && Number(ev.progress_goal_km) > 0
  const ringPct = pct != null ? Math.min(100, Math.max(0, pct)) : hasGoal ? 0 : 0
  const status = typeof ev.submission_status === 'string' ? ev.submission_status : 'none'
  const pendingReview = status === 'pending_review'
  const ringSize = layout === 'hero' ? 44 : 40
  const ringLabelId = `jc-ring-lbl-${ev.event_id}`

  const metaItems = []
  if (ev.target_label) {
    metaItems.push(
      <span key="target" className="profile-joined-challenge-meta-item profile-joined-challenge-inline-muted">
        {ev.target_label}
      </span>
    )
  }
  if (hasGoal) {
    metaItems.push(
      <span key="goal" className="profile-joined-challenge-meta-item profile-joined-challenge-inline-distance">
        {formatKm(ev.progress_logged_km)} of {formatKm(ev.progress_goal_km)}
      </span>
    )
  } else {
    metaItems.push(
      <span
        key="enrolled"
        className="profile-joined-challenge-meta-item profile-joined-challenge-enrolled-pill profile-joined-challenge-enrolled-pill--micro"
      >
        Enrolled
      </span>
    )
  }
  metaItems.push(
    <span key="joined" className="profile-joined-challenge-meta-item profile-joined-challenge-inline-muted">
      {formatLongDateJoined(ev.joined_at)}
    </span>
  )
  metaItems.push(
    <span key="cat" className="profile-joined-challenge-meta-item profile-joined-challenge-chip-inline cat">
      {ev.category || 'event'}
    </span>
  )
  if (pendingReview) {
    metaItems.push(
      <span key="pending" className="profile-joined-challenge-meta-item profile-joined-challenge-chip-inline pending">
        Review
      </span>
    )
  }

  const resolveEventId = (row) =>
    row?.event_id != null && String(row.event_id) !== ''
      ? String(row.event_id)
      : row?.id != null && String(row.id) !== ''
        ? String(row.id)
        : ''

  const openJournal = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onOpenChallengeJournal) return
    const eventId = resolveEventId(ev)
    if (!eventId) return
    onOpenChallengeJournal({ ...ev, event_id: eventId })
  }

  const cardModifierClass = `profile-joined-challenge-card profile-joined-challenge-card--${layout}${
    onOpenChallengeJournal ? ' profile-joined-challenge-card--interactive' : ''
  }`

  const cardBody = (
    <div
      className={`profile-joined-challenge-row profile-joined-challenge-row--one-line${
        hasGoal ? '' : ' profile-joined-challenge-row--no-ring'
      }`}
    >
      <div className="profile-joined-challenge-left">
        <div className="profile-joined-challenge-avatar-only">
          <div className="profile-joined-challenge-cover-frame">
            {ev.image_url ? (
              <img
                className="profile-joined-challenge-cover"
                src={resolveMediaUrl(ev.image_url)}
                alt=""
              />
            ) : (
              <div className={`profile-joined-challenge-cover is-placeholder cat-${ev.category || 'default'}`} aria-hidden />
            )}
          </div>
        </div>

        <div className="profile-joined-challenge-inline-cluster" aria-label={ev.title || 'Challenge'}>
          <span className="profile-joined-challenge-inline-title">{ev.title || 'Challenge'}</span>
          <div className="profile-joined-challenge-inline-meta">{metaItems}</div>
        </div>
      </div>

      {hasGoal ? (
        <div className="profile-joined-challenge-ring-shell profile-joined-challenge-ring-shell--one-line">
          <span id={ringLabelId} className="visually-hidden">
            Challenge progress {pct != null ? `${Math.round(pct)} percent` : 'zero percent'}
          </span>
          <ChallengeProgressRing percent={ringPct} size={ringSize} labelId={ringLabelId} />
        </div>
      ) : null}
    </div>
  )

  if (onOpenChallengeJournal) {
    return (
      <button
        type="button"
        className={cardModifierClass}
        onClick={openJournal}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        aria-label={`Open progress for ${ev.title || 'challenge'}`}
      >
        {cardBody}
      </button>
    )
  }

  return <div className={cardModifierClass}>{cardBody}</div>
}

/** Chevron synced with expanded state via parent modifier class. */
function JoinedEventsToggleChevron() {
  return (
    <svg
      className="profile-joined-events-view-all-chevron"
      width="14"
      height="14"
      viewBox="0 0 20 20"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M5.75 8.22a1 1 0 0 1 1.41-.06l3.06 2.76 3.06-2.76a1 1 0 1 1 1.34 1.48l-3.75 3.38a1 1 0 0 1-1.34 0l-3.75-3.38a1 1 0 0 1-.06-1.41Z"
      />
    </svg>
  )
}

/**
 * Sidebar or main-panel block: section title, optional “View all”, then compact single-column cards.
 * @param {'sidebar' | 'hero'} variant
 */
export function ProfileJoinedEventsSection({
  variant = 'sidebar',
  items,
  resolveMediaUrl,
  emptyHint,
  onOpenChallengeJournal,
}) {
  const revealIdRaw = useId()
  const revealId = `profile-joined-events-reveal-${revealIdRaw.replace(/:/g, '')}`
  const [expanded, setExpanded] = useState(false)
  const list = Array.isArray(items) ? items : []
  const showToggle = list.length > JOINED_EVENTS_INITIAL_COUNT
  const initialSlice = list.slice(0, JOINED_EVENTS_INITIAL_COUNT)
  const remainder = showToggle ? list.slice(JOINED_EVENTS_INITIAL_COUNT) : []

  const toggleBtn = showToggle ? (
    <button
      type="button"
      className={`profile-joined-events-view-all${expanded ? ' profile-joined-events-view-all--expanded' : ''}`}
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      aria-controls={revealId}
    >
      <span className="profile-joined-events-view-all-label">{expanded ? 'Show less' : 'View all'}</span>
      <JoinedEventsToggleChevron />
    </button>
  ) : null

  const cardProps = { resolveMediaUrl, onOpenChallengeJournal }

  const remainderBlock =
    remainder.length === 0 ? null : (
      <div
        id={revealId}
        className={`profile-joined-events-reveal profile-joined-events-reveal--${variant} ${
          expanded ? 'profile-joined-events-reveal--open' : ''
        }`}
        aria-hidden={!expanded}
      >
        <div className="profile-joined-events-reveal-inner">
          <div className="profile-joined-events-reveal-motion">
            {remainder.map((ev) => (
              <ProfileJoinedChallengeCard
                key={ev.event_id}
                ev={ev}
                layout={variant === 'hero' ? 'hero' : 'stack'}
                {...cardProps}
              />
            ))}
          </div>
        </div>
      </div>
    )

  if (variant === 'sidebar') {
    return (
      <>
        <div className="profile-side-head profile-joined-events-section-head">
          <h2 className="profile-section-title mb-0">Joined Events</h2>
          {toggleBtn}
        </div>
        {!list.length ? (
          <div className="profile-library-muted">{emptyHint}</div>
        ) : (
          <div className="profile-joined-challenge-stack">
            {initialSlice.map((ev) => (
              <ProfileJoinedChallengeCard key={ev.event_id} ev={ev} layout="stack" {...cardProps} />
            ))}
            {remainderBlock}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="profile-hero-joined-events-head">
        <div className="profile-hero-joined-events-title">Joined Events</div>
        {toggleBtn}
      </div>
      {!list.length ? (
        <div className="profile-hero-muted">{emptyHint}</div>
      ) : (
        <div className="profile-joined-challenge-hero-grid">
          {initialSlice.map((ev) => (
            <ProfileJoinedChallengeCard key={ev.event_id} ev={ev} layout="hero" {...cardProps} />
          ))}
          {remainderBlock}
        </div>
      )}
    </>
  )
}
