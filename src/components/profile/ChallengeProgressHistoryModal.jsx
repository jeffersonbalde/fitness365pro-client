import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppModalTransition from '../AppModalTransition.jsx'
import { apiRequest, ensureAccessToken } from '../../utils/api'
import { resolveEarnedRewardThumbnailUrl } from '../../utils/mediaUrl'
import './ChallengeProgressHistoryModal.css'

/** Unmount timeouts — slightly longer than challenge-history-detail-leave / lb-leave in CSS */
const DETAIL_LEAVE_MS = 310
const LIGHTBOX_LEAVE_MS = 290

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

const formatWhen = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatDateShort = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatKmShort = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`
}

const formatPace = (v) => {
  const num = Number(v)
  if (Number.isNaN(num)) return '—'
  const totalSeconds = Math.round(num * 60)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

const normalizeChallengeProgress = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  return {
    loggedKm: Number(raw.logged_distance_km ?? 0),
    goalKm: raw.goal_distance_km != null ? Number(raw.goal_distance_km) : null,
    percent: raw.progress_percent != null ? Number(raw.progress_percent) : null,
    targetLabel: raw.target_label ? String(raw.target_label) : null,
    paceMinPerKm: raw.pace_min_per_km != null ? Number(raw.pace_min_per_km) : null,
    submissionStatus: raw.submission_status ? String(raw.submission_status) : 'none',
    pendingQueueKm: raw.pending_queue_km != null ? Number(raw.pending_queue_km) : 0,
    pendingSubmissionsCount:
      raw.pending_submissions_count != null ? Number(raw.pending_submissions_count) : 0,
  }
}

const statusBadgeClass = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'pending') return 'challenge-history-badge is-pending'
  if (s === 'approved') return 'challenge-history-badge is-approved'
  if (s === 'rejected') return 'challenge-history-badge is-rejected'
  return 'challenge-history-badge is-pending'
}

const statusLabel = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'pending') return 'Pending review'
  if (s === 'approved') return 'Approved'
  if (s === 'rejected') return 'Rejected'
  return s || 'Update'
}

const sourceLabel = (source) => {
  const s = String(source || '').toLowerCase()
  if (s === 'workout') return 'Workout'
  if (s === 'manual') return 'Manual entry'
  return s || 'Entry'
}

const daysLeftLabel = (endsAtIso, nowMs = Date.now()) => {
  if (!endsAtIso) return { text: '—', done: false }
  const end = new Date(endsAtIso).getTime()
  if (Number.isNaN(end)) return { text: '—', done: false }
  if (nowMs >= end) return { text: 'Event ended', done: true }
  const days = Math.ceil((end - nowMs) / 86400000)
  if (days <= 0) return { text: 'Last day', done: false }
  return { text: `${days} day${days === 1 ? '' : 's'} left`, done: false }
}

const normalizeBadges = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw
    .map((b, idx) => {
      if (typeof b === 'string') {
        const t = b.trim()
        return t ? { key: `slug-${idx}`, title: t, imageUrl: '' } : null
      }
      if (!b || typeof b !== 'object') return null
      const title = String(b.title || b.label || b.slug || `Badge ${idx + 1}`).trim()
      const imageUrl = String(b.image_url || b.imageUrl || '').trim()
      return { key: String(b.slug || b.id || idx), title: title || `Badge ${idx + 1}`, imageUrl }
    })
    .filter(Boolean)
}

function ChallengeHistoryStatIconDistance() {
  return (
    <svg
      className="challenge-history-stat-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 17.5 8.5 8l4.5 8L21 6" />
      <circle cx="3" cy="17.5" r="2" fill="currentColor" stroke="none" />
      <circle cx="21" cy="6" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ChallengeHistoryStatIconRuns() {
  return (
    <svg
      className="challenge-history-stat-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 21v-6M12 21V11M18 21V5" />
    </svg>
  )
}

function ChallengeHistoryStatIconCalendar() {
  return (
    <svg
      className="challenge-history-stat-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="5.5" width="17" height="16" rx="2" ry="2" />
      <path d="M8 4v4M16 4v4M3 11h18" />
    </svg>
  )
}
/**
 * Modal: badges, stats, progress, and submission logs with detail + image viewing.
 */
export default function ChallengeProgressHistoryModal({
  open,
  eventId,
  eventTitleFallback,
  memberClientId = null,
  memberDisplayName = '',
  resolveMediaUrl,
  onClosed = () => {},
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [payload, setPayload] = useState(null)
  const [selectedLog, setSelectedLog] = useState(null)
  const [detailLeaving, setDetailLeaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [lightboxLeaving, setLightboxLeaving] = useState(false)

  const resolveImg = useCallback(
    (u) => {
      if (!u) return ''
      const s = String(u)
      return resolveMediaUrl ? resolveMediaUrl(s) : s
    },
    [resolveMediaUrl],
  )

  const resolveRewardImg = useCallback(
    (row) => {
      if (!row || typeof row !== 'object') return resolveImg(row?.image_url || row?.imageUrl)
      return resolveEarnedRewardThumbnailUrl(
        {
          image_url: row.image_url || row.imageUrl,
          base_image_url: row.base_image_url || row.image_url || row.imageUrl,
        },
        resolveMediaUrl,
      )
    },
    [resolveImg, resolveMediaUrl],
  )

  useEffect(() => {
    if (!open || !eventId) {
      setPayload(null)
      setError(null)
      setLoading(false)
      setSelectedLog(null)
      setDetailLeaving(false)
      setLightbox(null)
      setLightboxLeaving(false)
      return undefined
    }

    const historyPath = memberClientId
      ? `/v1/social/profile/${encodeURIComponent(memberClientId)}/events/${encodeURIComponent(eventId)}/challenge-history`
      : `/v1/cms/events/${encodeURIComponent(eventId)}/my-challenge-history`

    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      setPayload(null)
      setSelectedLog(null)
      setDetailLeaving(false)
      setLightbox(null)
      setLightboxLeaving(false)
      try {
        await ensureAccessToken()
        const res = await apiRequest(historyPath, {
          method: 'GET',
          timeoutMs: 45000,
        })
        if (cancelled) return
        if (res.data?.success && res.data?.data) {
          setPayload(res.data.data)
        } else {
          setError(res.data?.message || 'Could not load progress.')
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e)
          const msg =
            e?.response?.status === 403
              ? 'Confirm your registration to view progress.'
              : e?.response?.status === 404
                ? memberClientId
                  ? 'This member has no progress for this challenge.'
                  : 'Progress not found.'
                : e?.response?.data?.message || 'Unable to load progress.'
          setError(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [open, eventId, memberClientId])

  useEffect(() => {
    if (!open) {
      setSelectedLog(null)
      setDetailLeaving(false)
      setLightbox(null)
      setLightboxLeaving(false)
    }
  }, [open])

  const badges = useMemo(() => normalizeBadges(payload?.event?.badges), [payload?.event?.badges])

  const pctDisplay = useMemo(() => {
    const rawCp = normalizeChallengeProgress(payload?.challenge_progress)
    if (rawCp?.percent != null && Number.isFinite(rawCp.percent)) {
      return Math.min(100, Math.round(rawCp.percent * 10) / 10)
    }
    const goal = rawCp?.goalKm
    const logged = rawCp?.loggedKm
    if (goal != null && goal > 0 && logged != null && Number.isFinite(logged)) {
      return Math.min(100, Math.round((logged / goal) * 1000) / 10)
    }
    return null
  }, [payload?.challenge_progress])

  const daysInfo = useMemo(
    () => daysLeftLabel(payload?.event?.ends_at != null ? String(payload.event.ends_at) : ''),
    [payload?.event?.ends_at],
  )

  const lightboxLeavingRef = useRef(false)
  useEffect(() => {
    lightboxLeavingRef.current = lightboxLeaving
  }, [lightboxLeaving])

  const requestCloseDetail = useCallback(() => {
    if (!selectedLog) return
    if (detailLeaving) {
      setSelectedLog(null)
      setDetailLeaving(false)
      return
    }
    if (prefersReducedMotion()) {
      setSelectedLog(null)
      setDetailLeaving(false)
      return
    }
    setDetailLeaving(true)
  }, [selectedLog, detailLeaving])

  /** After slide-out finishes, unmount the detail pane. Kept short of prefers-reduced-motion (instant dismiss). */
  useEffect(() => {
    if (!detailLeaving) return undefined
    if (prefersReducedMotion()) return undefined
    const id = window.setTimeout(() => {
      setSelectedLog(null)
      setDetailLeaving(false)
    }, DETAIL_LEAVE_MS)
    return () => window.clearTimeout(id)
  }, [detailLeaving])

  const requestCloseLightbox = useCallback(() => {
    if (lightbox == null) return
    if (lightboxLeaving) {
      setLightbox(null)
      setLightboxLeaving(false)
      return
    }
    if (prefersReducedMotion()) {
      setLightbox(null)
      setLightboxLeaving(false)
      return
    }
    setLightboxLeaving(true)
  }, [lightbox, lightboxLeaving])

  useEffect(() => {
    if (!lightboxLeaving) return undefined
    if (prefersReducedMotion()) return undefined
    const id = window.setTimeout(() => {
      setLightbox(null)
      setLightboxLeaving(false)
    }, LIGHTBOX_LEAVE_MS)
    return () => window.clearTimeout(id)
  }, [lightboxLeaving])

  const openLightbox = useCallback((urls, index) => {
    const list = (urls || []).filter(Boolean)
    if (list.length === 0) return
    setLightboxLeaving(false)
    setLightbox({ urls: list, index: Math.max(0, Math.min(index, list.length - 1)) })
  }, [])

  const shiftLightbox = useCallback((delta) => {
    setLightbox((prev) => {
      if (!prev || prev.urls.length === 0 || lightboxLeavingRef.current) return prev
      const n = prev.urls.length
      const idx = (prev.index + delta + n) % n
      return { ...prev, index: idx }
    })
  }, [])

  /** Escape closes lightbox first, then log detail, without dismissing the whole modal (capture phase). */
  useEffect(() => {
    if (!open || (!selectedLog && lightbox == null)) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      if (lightbox != null) requestCloseLightbox()
      else requestCloseDetail()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, selectedLog, lightbox, requestCloseDetail, requestCloseLightbox])

  const workoutImagesResolved = useCallback(
    (w) => {
      if (!w || !Array.isArray(w.workout_images)) return []
      return w.workout_images.map((u) => resolveImg(u)).filter(Boolean)
    },
    [resolveImg],
  )

  const eventTitle = payload?.event?.title || eventTitleFallback || 'Challenge'
  const memberName =
    payload?.member?.display_name || memberDisplayName || ''
  const isMemberView = Boolean(memberClientId || payload?.is_member_view)
  const cp = normalizeChallengeProgress(payload?.challenge_progress)
  const submissions = Array.isArray(payload?.submissions) ? payload.submissions : []
  const workouts = Array.isArray(payload?.linked_workouts) ? payload.linked_workouts : []
  const runsCount = Number(payload?.runs_count ?? workouts.length ?? 0)

  return (
    <AppModalTransition
      open={open}
      onRequestClose={onClosed}
      backdropClassName="profile-social-modal-backdrop"
      panelClassName="profile-social-modal challenge-history-modal"
    >
      {(dismiss) => (
        <div className="challenge-history-modal-inner">
          <div className="profile-social-modal-head">
            <div className="profile-social-modal-title-wrap">
              <div className="profile-social-modal-title">{eventTitle}</div>
              {isMemberView && memberName ? (
                <div className="profile-social-modal-subtitle">{memberName}&apos;s progress</div>
              ) : null}
            </div>
            <button type="button" className="profile-social-modal-close" onClick={dismiss} aria-label="Close">
              ×
            </button>
          </div>

          <div className="challenge-history-scroll">
            {loading && <div className="profile-library-muted">Loading…</div>}
            {error && !loading && <div className="challenge-history-error">{error}</div>}

            {!loading && !error && payload && (
              <>
                {badges.length > 0 ? (
                  <section className="challenge-history-badges-block" aria-label="Event badges">
                    <div className="challenge-history-block-label">Badges</div>
                    <div className="challenge-history-badges-strip">
                      {badges.map((b) => (
                        <div key={b.key} className="challenge-history-badge-chip">
                          {b.imageUrl ? (
                            <img
                              className="challenge-history-badge-chip-img"
                              src={resolveRewardImg(b)}
                              alt=""
                            />
                          ) : (
                            <div className="challenge-history-badge-chip-fallback" aria-hidden />
                          )}
                          <span className="challenge-history-badge-chip-title">{b.title}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="challenge-history-stats-row" aria-label="Totals">
                  <div className="challenge-history-stat">
                    <span className="challenge-history-stat-icon" aria-hidden>
                      <ChallengeHistoryStatIconDistance />
                    </span>
                    <div className="challenge-history-stat-body">
                      <span className="challenge-history-stat-label">Total distance</span>
                      <span className="challenge-history-stat-value">{formatKmShort(cp?.loggedKm)}</span>
                    </div>
                  </div>
                  <div className="challenge-history-stat">
                    <span className="challenge-history-stat-icon" aria-hidden>
                      <ChallengeHistoryStatIconRuns />
                    </span>
                    <div className="challenge-history-stat-body">
                      <span className="challenge-history-stat-label">Runs logged</span>
                      <span className="challenge-history-stat-value">{runsCount}</span>
                    </div>
                  </div>
                  <div className="challenge-history-stat">
                    <span className="challenge-history-stat-icon" aria-hidden>
                      <ChallengeHistoryStatIconCalendar />
                    </span>
                    <div className="challenge-history-stat-body">
                      <span className="challenge-history-stat-label">Days left</span>
                      <span className="challenge-history-stat-value challenge-history-stat-value--compact">
                        {daysInfo.text}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="challenge-history-progress-block" aria-label="Goal progress">
                  <div className="challenge-history-progress-head">
                    <span className="challenge-history-block-label">Progress</span>
                    {pctDisplay != null ? (
                      <span className="challenge-history-progress-pct">{pctDisplay}%</span>
                    ) : null}
                  </div>
                  <div
                    className="challenge-history-progress-track"
                    role="progressbar"
                    aria-valuenow={pctDisplay != null ? Math.round(pctDisplay) : 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="challenge-history-progress-fill"
                      style={{ width: `${pctDisplay != null ? Math.min(100, pctDisplay) : 0}%` }}
                    />
                  </div>
                  <div className="challenge-history-progress-foot">
                    {cp?.goalKm != null && cp.goalKm > 0 ? (
                      <span className="challenge-history-progress-meta">
                        Goal {formatKmShort(cp.goalKm)}
                      </span>
                    ) : (
                      <span className="challenge-history-progress-meta">No distance goal set</span>
                    )}
                    {cp?.targetLabel ? (
                      <span className="challenge-history-progress-meta">{cp.targetLabel}</span>
                    ) : null}
                  </div>
                  {(Number(cp?.pendingQueueKm ?? 0) > 0.0001 ||
                    Number(cp?.pendingSubmissionsCount ?? 0) > 0) && (
                    <div className="challenge-history-pending-pill">
                      {Number(cp.pendingSubmissionsCount ?? 0) > 0
                        ? `${cp.pendingSubmissionsCount} update(s) pending review`
                        : `${formatKmShort(cp.pendingQueueKm)} pending review`}
                    </div>
                  )}
                </section>

                <div className="challenge-history-section-head">
                  <h3 className="challenge-history-section-title">Logs</h3>
                  <span className="challenge-history-section-muted">{submissions.length}</span>
                </div>
                {submissions.length === 0 ? (
                  <div className="challenge-history-empty">No activity logged yet.</div>
                ) : (
                  <div className="challenge-history-log-list">
                    {submissions.map((row) => {
                      const thumb =
                        row.workout &&
                        Array.isArray(row.workout.workout_images) &&
                        row.workout.workout_images[0]
                          ? resolveImg(row.workout.workout_images[0])
                          : ''
                      return (
                        <button
                          key={row.id}
                          type="button"
                          className="challenge-history-log-row"
                          onClick={() => {
                            setDetailLeaving(false)
                            setSelectedLog(row)
                          }}
                        >
                          {thumb ? (
                            <img className="challenge-history-log-thumb" src={thumb} alt="" />
                          ) : (
                            <div className="challenge-history-log-thumb is-placeholder" aria-hidden />
                          )}
                          <div className="challenge-history-log-main">
                            <div className="challenge-history-log-top">
                              <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>
                              <span className="challenge-history-log-date">{formatWhen(row.created_at)}</span>
                            </div>
                            <div className="challenge-history-log-summary">
                              <strong>{sourceLabel(row.source)}</strong>
                              {row.distance_delta_km != null ? <> · {formatKmShort(row.distance_delta_km)}</> : null}
                              {row.workout?.workout_type ? <> · {row.workout.workout_type}</> : null}
                            </div>
                          </div>
                          <span className="challenge-history-log-chevron" aria-hidden>
                            ›
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {selectedLog ? (
            <div
              className={`challenge-history-detail-layer${detailLeaving ? ' is-leaving' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="challenge-history-detail-heading"
            >
              <div className="challenge-history-detail-toolbar">
                <button
                  type="button"
                  className="challenge-history-detail-back"
                  onClick={requestCloseDetail}
                >
                  ← Back
                </button>
              </div>
              <div className="challenge-history-detail-scroll">
                <h3 id="challenge-history-detail-heading" className="challenge-history-detail-title">
                  Log details
                </h3>

                <div className="challenge-history-detail-grid">
                  <div>
                    <span className="challenge-history-detail-label">Status</span>
                    <div>
                      <span className={statusBadgeClass(selectedLog.status)}>
                        {statusLabel(selectedLog.status)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="challenge-history-detail-label">Submitted</span>
                    <div className="challenge-history-detail-value">{formatWhen(selectedLog.created_at)}</div>
                  </div>
                  {selectedLog.reviewed_at ? (
                    <div>
                      <span className="challenge-history-detail-label">Reviewed</span>
                      <div className="challenge-history-detail-value">{formatWhen(selectedLog.reviewed_at)}</div>
                    </div>
                  ) : null}
                  <div>
                    <span className="challenge-history-detail-label">Source</span>
                    <div className="challenge-history-detail-value">{sourceLabel(selectedLog.source)}</div>
                  </div>
                  {selectedLog.distance_delta_km != null ? (
                    <div>
                      <span className="challenge-history-detail-label">Distance</span>
                      <div className="challenge-history-detail-value">
                        {formatKmShort(selectedLog.distance_delta_km)}
                      </div>
                    </div>
                  ) : null}
                  {selectedLog.pace_min_per_km != null ? (
                    <div>
                      <span className="challenge-history-detail-label">Pace</span>
                      <div className="challenge-history-detail-value">{formatPace(selectedLog.pace_min_per_km)}</div>
                    </div>
                  ) : null}
                </div>

                {selectedLog.review_note ? (
                  <div className="challenge-history-note">{selectedLog.review_note}</div>
                ) : null}

                {selectedLog.workout ? (
                  <section className="challenge-history-detail-workout" aria-label="Linked workout">
                    <div className="challenge-history-block-label">Workout</div>
                    <div className="challenge-history-detail-value challenge-history-detail-workout-title">
                      {selectedLog.workout.workout_type || 'Workout'}
                    </div>
                    <div className="challenge-history-detail-meta">
                      {selectedLog.workout.workout_date
                        ? formatDateShort(selectedLog.workout.workout_date)
                        : ''}
                      {selectedLog.workout.distance_km != null
                        ? ` · ${formatKmShort(selectedLog.workout.distance_km)}`
                        : ''}
                      {selectedLog.workout.caption ? ` · ${selectedLog.workout.caption}` : ''}
                    </div>
                    {selectedLog.workout.linked_challenge?.review_status ? (
                      <div className="challenge-history-detail-meta">
                        Link status:{' '}
                        {String(selectedLog.workout.linked_challenge.review_status).replace(/_/g, ' ')}
                      </div>
                    ) : null}

                    {(() => {
                      const imgs = workoutImagesResolved(selectedLog.workout)
                      if (imgs.length === 0) return null
                      return (
                        <div className="challenge-history-detail-images">
                          {imgs.map((url, idx) => (
                            <button
                              key={url}
                              type="button"
                              className="challenge-history-detail-image-hit"
                              onClick={() => openLightbox(imgs, idx)}
                            >
                              <img src={url} alt={`Workout photo ${idx + 1}`} />
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                  </section>
                ) : null}
              </div>
            </div>
          ) : null}

          {lightbox != null && lightbox.urls.length > 0 ? (
            <div
              className={`challenge-history-lightbox${lightboxLeaving ? ' is-leaving' : ''}`}
              role="dialog"
              aria-label="Photo viewer"
              aria-modal="true"
            >
              <button
                type="button"
                className="challenge-history-lightbox-backdrop"
                aria-label="Close viewer"
                onClick={requestCloseLightbox}
              />
              <button
                type="button"
                className="challenge-history-lightbox-close"
                aria-label="Close"
                onClick={requestCloseLightbox}
              >
                ×
              </button>
              {lightbox.urls.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="challenge-history-lightbox-nav challenge-history-lightbox-prev"
                    aria-label="Previous photo"
                    onClick={(e) => {
                      e.stopPropagation()
                      shiftLightbox(-1)
                    }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="challenge-history-lightbox-nav challenge-history-lightbox-next"
                    aria-label="Next photo"
                    onClick={(e) => {
                      e.stopPropagation()
                      shiftLightbox(1)
                    }}
                  >
                    ›
                  </button>
                </>
              ) : null}
              <div className="challenge-history-lightbox-stage">
                <img
                  key={`${lightbox.index}-${lightbox.urls[lightbox.index]}`}
                  className="challenge-history-lightbox-img"
                  src={lightbox.urls[lightbox.index]}
                  alt=""
                />
              </div>
              {lightbox.urls.length > 1 ? (
                <div className="challenge-history-lightbox-counter">
                  {lightbox.index + 1} / {lightbox.urls.length}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </AppModalTransition>
  )
}
