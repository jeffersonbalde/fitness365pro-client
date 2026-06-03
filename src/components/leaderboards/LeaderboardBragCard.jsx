import React, { useMemo } from 'react'
import './LeaderboardBragCard.css'

const rankMeta = (rank) => {
  const n = Number(rank)
  if (n === 1) return { label: '1st Place', tier: 'gold', medal: '🥇' }
  if (n === 2) return { label: '2nd Place', tier: 'silver', medal: '🥈' }
  if (n === 3) return { label: '3rd Place', tier: 'bronze', medal: '🥉' }
  return { label: `#${n} Place`, tier: 'default', medal: null }
}

const formatKm = (value) => {
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`
}

export default function LeaderboardBragCard({
  ownerName,
  eventTitle,
  rank,
  progress,
  categoryLabel,
  eventImageUrl,
  resolveMediaUrl,
}) {
  const meta = useMemo(() => rankMeta(rank), [rank])
  const coverSrc = useMemo(() => {
    const raw = eventImageUrl || ''
    return resolveMediaUrl ? resolveMediaUrl(raw) : raw
  }, [eventImageUrl, resolveMediaUrl])

  const loggedKm = progress?.logged_distance_km
  const progressPercent = progress?.progress_percent
  const goalCompleted = Boolean(progress?.goal_completed)

  return (
    <div className={`lb-brag-card lb-brag-card--${meta.tier}`}>
      <div className="lb-brag-card__banner">
        {coverSrc ? (
          <img
            className="lb-brag-card__banner-img"
            src={coverSrc}
            alt=""
            crossOrigin="anonymous"
          />
        ) : (
          <div className="lb-brag-card__banner-fallback" aria-hidden />
        )}
        <div className="lb-brag-card__banner-scrim" aria-hidden />
        <div className={`lb-brag-card__rank-pill lb-brag-card__rank-pill--${meta.tier}`}>
          {meta.medal ? <span className="lb-brag-card__rank-pill-medal" aria-hidden>{meta.medal}</span> : null}
          <span>{meta.label}</span>
        </div>
      </div>

      <div className="lb-brag-card__content">
        <div className="lb-brag-card__meta-row">
          <span className="lb-brag-card__brand">Fitness 365 Pro · Leaderboard</span>
        </div>

        <h3 className="lb-brag-card__name">{ownerName || 'Athlete'}</h3>
        <p className="lb-brag-card__event">{eventTitle || 'Fitness 365 Pro Event'}</p>

        <div className="lb-brag-card__stats">
          <div className="lb-brag-card__stat">
            <span className="lb-brag-card__stat-value">{formatKm(loggedKm)}</span>
            <span className="lb-brag-card__stat-label">Logged</span>
          </div>
          {goalCompleted ? (
            <div className="lb-brag-card__stat lb-brag-card__stat--done">
              <span className="lb-brag-card__stat-value">100%</span>
              <span className="lb-brag-card__stat-label">Goal done</span>
            </div>
          ) : progressPercent != null ? (
            <div className="lb-brag-card__stat">
              <span className="lb-brag-card__stat-value">
                {Number(progressPercent).toLocaleString(undefined, { maximumFractionDigits: 1 })}%
              </span>
              <span className="lb-brag-card__stat-label">Of goal</span>
            </div>
          ) : null}
          {categoryLabel && categoryLabel !== 'General' ? (
            <div className="lb-brag-card__stat lb-brag-card__stat--wide">
              <span className="lb-brag-card__stat-value lb-brag-card__stat-value--sm">{categoryLabel}</span>
              <span className="lb-brag-card__stat-label">Category</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
