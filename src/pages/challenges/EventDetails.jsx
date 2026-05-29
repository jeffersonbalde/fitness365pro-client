import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../../utils/api'
import {
  deriveRegistrationPhase,
  deriveChallengeProgressCtas,
  formatCountdownTo,
  toEvent,
} from './eventCatalog'
import ChallengeProgressHistoryModal from '../../components/profile/ChallengeProgressHistoryModal.jsx'
import './Challenges.css'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const resolveMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

const formatParticipantJoined = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const EventDetails = () => {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [eventData, setEventData] = useState(null)
  const [nowMs, setNowMs] = useState(Date.now())
  const [challengeHistoryModal, setChallengeHistoryModal] = useState(null)
  const loadEventPayload = useCallback(async (options = {}) => {
    const silent = options.silent === true
    if (!eventId) return
    if (!silent) setLoading(true)
    try {
      const response = await apiRequest(`/v1/cms/events/${eventId}`, { method: 'GET' })

      if (response.data?.success && response.data?.data?.event) {
        setEventData(response.data.data.event)
      } else {
        setEventData(null)
      }
    } catch (error) {
      if (error?.response?.data?.event_status === 'completed') {
        navigate(`/profile/race-results?event=${encodeURIComponent(eventId)}`, { replace: true })
        return
      }
      console.error('Failed to load event details:', error)
      if (!silent) {
        setEventData(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [eventId, navigate])

  useEffect(() => {
    loadEventPayload()
  }, [eventId, location.key, loadEventPayload])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') loadEventPayload({ silent: true })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadEventPayload])

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const event = useMemo(() => (eventData ? toEvent(eventData) : null), [eventData])
  const progressCtas = useMemo(() => {
    if (!event?.isRegistered) return null
    return deriveChallengeProgressCtas({
      challengeProgress: event.challengeProgress,
      endsAtIso: event.endsAtIso,
      nowMs,
    })
  }, [event, nowMs])

  const runChallengeCta = useCallback(
    (kind) => {
      if (!eventId || !kind) return
      if (kind === 'log') {
        navigate('/workout', {
          state: {
            adminEventId: eventId,
            returnTo: `/challenges/${eventId}`,
          },
        })
        return
      }
      setChallengeHistoryModal({
        eventId: String(eventId),
        title: event?.name || '',
      })
    },
    [event?.name, eventId, navigate],
  )
  const runningChoices = event?.runningChoices ?? null
  const gymChoices = event?.gymChoices ?? null

  const registrationUi = useMemo(
    () =>
      event
        ? deriveRegistrationPhase(
            event.registrationOpensIso,
            event.registrationClosesIso,
            nowMs,
          )
        : null,
    [event, nowMs],
  )

  const heroCountdownText = useMemo(() => {
    if (!registrationUi) return '—'
    if (registrationUi.phase === 'closed') return '—'
    if (registrationUi.countdownTargetIso) {
      return formatCountdownTo(registrationUi.countdownTargetIso, nowMs)
    }
    return 'Open — no closing date'
  }, [registrationUi, nowMs])

  const goToRegistration = () => {
    if (!eventId || event?.isRegistered) return
    const canContinuePending = Boolean(event.registrationPendingPayment)
    if (!registrationUi?.canRegister && !canContinuePending) return
    navigate(`/challenges/${eventId}/register`)
  }

  let registerBtnLabel = 'Registration coming soon'
  let registerDisabled = true
  if (event) {
    if (event.isRegistered) {
      registerBtnLabel = "You're registered"
      registerDisabled = true
    } else if (event.registrationPendingPayment) {
      registerBtnLabel = registrationUi?.canRegister
        ? 'Continue registration · finish payment'
        : 'Continue registration (payment pending)'
      registerDisabled = false
    } else if (!registrationUi) {
      registerBtnLabel = 'Registration coming soon'
      registerDisabled = true
    } else if (registrationUi.phase === 'closed') {
      registerBtnLabel = 'Registration closed'
      registerDisabled = true
    } else if (!registrationUi.canRegister) {
      registerBtnLabel = 'Registration opens soon'
      registerDisabled = true
    } else {
      registerBtnLabel = 'Register for this event'
      registerDisabled = false
    }
  }

  return (
    <div className="d-flex flex-column challenges-page" style={{ minHeight: '100vh' }}>
      <main className="event-modern-main">
        {loading ? (
          <div className="event-details-loading" role="status" aria-live="polite" aria-busy="true">
            <span className="visually-hidden">Loading event details.</span>
            <div className="container px-4 px-md-5">
              <div className="event-details-loading-inner">
                <div className="event-details-skeleton-hero-wrap">
                  <div className="event-details-skeleton-hero event-skeleton-block" aria-hidden />
                </div>
                <div className="event-details-skeleton-participants" aria-hidden>
                  {[0, 1, 2, 3, 4, 5].map((slot) => (
                    <div key={slot} className="event-details-skeleton-person event-skeleton-block" />
                  ))}
                </div>
                <div className="event-details-skeleton-lines" aria-hidden>
                  <div className="event-details-skeleton-line event-details-skeleton-line--xl event-skeleton-block" />
                  <div className="event-details-skeleton-line event-details-skeleton-line--lg event-skeleton-block" />
                  <div className="event-details-skeleton-line event-skeleton-block" />
                  <div className="event-details-skeleton-line event-skeleton-block" />
                  <div className="event-details-skeleton-line event-details-skeleton-line--sm event-skeleton-block" />
                </div>
                <div className="event-details-skeleton-meta-grid" aria-hidden>
                  {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className="event-details-skeleton-meta-row">
                      <div className="event-details-skeleton-line event-details-skeleton-line--meta-label event-skeleton-block" />
                      <div className="event-details-skeleton-line event-details-skeleton-line--meta-value event-skeleton-block" />
                    </div>
                  ))}
                </div>
                <div className="event-details-skeleton-pill-grid" aria-hidden>
                  {[0, 1, 2, 3].map((pill) => (
                    <div key={pill} className="event-details-skeleton-badge event-skeleton-block" />
                  ))}
                </div>
                <div className="event-details-skeleton-lines" aria-hidden>
                  <div className="event-details-skeleton-line event-skeleton-block" />
                  <div className="event-details-skeleton-line event-skeleton-block" />
                  <div className="event-details-skeleton-line event-details-skeleton-line--half event-skeleton-block" />
                </div>
                <div className="event-details-skeleton-cta event-skeleton-block" aria-hidden />
              </div>
            </div>
          </div>
        ) : !event ? (
          <div className="container py-4 px-4 px-md-5">
            <div className="challenges-empty">
              Event not found.{' '}
              <Link to="/challenges">Return to events</Link>
              {' or '}
              <Link to="/profile/race-results">view race results</Link>.
            </div>
          </div>
        ) : (
          <article className="event-modern">
            <div className="container px-4 px-md-5">
              <header className="event-modern-hero">
                {event.imageUrl ? (
                  <img src={resolveMediaUrl(event.imageUrl)} alt={event.name} className="event-modern-hero-image" />
                ) : (
                  <div className="challenge-cover-fallback" />
                )}
                <div className="event-modern-hero-overlay" />
                <div className="event-modern-hero-top">
                  <button type="button" className="event-modern-back" onClick={() => navigate('/challenges')}>
                    Back to events
                  </button>
                </div>
                <div className="event-modern-hero-bottom">
                  <div className="event-modern-countdown-label">
                    {registrationUi?.heroLabel || 'Registration'}
                  </div>
                  <div className="event-modern-countdown-value">
                    {heroCountdownText}
                  </div>
                </div>
              </header>
            </div>
            <section className="event-modern-content container px-4 px-md-5">
              <div className="event-modern-participants-head">
                <h2 className="event-modern-section-title">
                  Participants ({event.joinersCount})
                </h2>
              </div>
              <div className="event-modern-participants-list">
                {event.participantPreviewItems.length === 0 ? (
                  <div className="challenges-empty event-modern-participants-empty">
                    {event.joinersCount === 0
                      ? 'No confirmed participants yet. Register to appear in this list.'
                      : 'Participant list will load in a moment. Pull to refresh or reopen this tab if it stays blank.'}
                  </div>
                ) : (
                  event.participantPreviewItems.map((p) => (
                    <Link
                      key={p.clientId}
                      className="event-modern-person"
                      to={`/profile/${encodeURIComponent(p.clientId)}`}
                      aria-label={`View profile: ${p.displayName}`}
                    >
                      <span className="event-modern-person-avatar" aria-hidden>
                        {p.pictureUrl ? (
                          <img src={resolveMediaUrl(p.pictureUrl)} alt="" />
                        ) : (
                          p.initials || '?'
                        )}
                      </span>
                      <span className="event-modern-person-text">
                        <span className="event-modern-person-name">{p.displayName}</span>
                        {p.registeredAtIso ? (
                          <span className="event-modern-person-meta">
                            Joined {formatParticipantJoined(p.registeredAtIso)}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  ))
                )}
              </div>
              {event.participantsTruncated && event.participantPreviewItems.length > 0 ? (
                <p className="event-modern-participants-truncation small mb-4">
                  Showing {event.participantPreviewItems.length} of {event.joinersCount} participants.
                  {' '}Open profiles from the grid above.
                </p>
              ) : null}

              <h1 className="event-modern-title">{event.name}</h1>
              <p className="event-modern-description">{event.description}</p>

              <div className="event-modern-info">
                <div className="event-modern-row"><span>Where</span><strong>{event.location}</strong></div>
                <div className="event-modern-row">
                  <span>Registration opens</span>
                  <strong>{event.registrationStartsLabel}</strong>
                </div>
                <div className="event-modern-row">
                  <span>Registration deadline</span>
                  <strong>{event.registrationDeadlineLabel}</strong>
                </div>
                <div className="event-modern-row"><span>Event period</span><strong>{event.timelineLabel}</strong></div>
                <div className="event-modern-row"><span>Category</span><strong>{event.categoryLabel}</strong></div>
                <div className="event-modern-row"><span>Registration fee</span><strong>{event.feeLabel}</strong></div>
                {runningChoices && (
                  <>
                    <div className="event-modern-row">
                      <span>Distances offered</span>
                      <strong>{runningChoices.distancesOffered.map((d) => d.label).join(' · ')}</strong>
                    </div>
                    <div className="event-modern-row">
                      <span>Packages offered</span>
                      <strong>{runningChoices.packagesOffered.map((p) => p.label).join(' · ')}</strong>
                    </div>
                    {runningChoices.needsShirtSize && (
                      <div className="event-modern-row">
                        <span>Shirt sizes offered</span>
                        <strong>{runningChoices.shirtSizesOffered.join(', ')}</strong>
                      </div>
                    )}
                  </>
                )}
                {gymChoices && (
                  <>
                    <div className="event-modern-row">
                      <span>Programs offered</span>
                      <strong>{gymChoices.programsOffered.map((d) => d.label).join(' · ')}</strong>
                    </div>
                    <div className="event-modern-row">
                      <span>Packages offered</span>
                      <strong>{gymChoices.packagesOffered.map((p) => p.label).join(' · ')}</strong>
                    </div>
                    {gymChoices.needsShirtSize && (
                      <div className="event-modern-row">
                        <span>Apparel sizes offered</span>
                        <strong>{gymChoices.shirtSizesOffered.join(', ')}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>

              <section className="event-modern-section">
                <h2 className="event-modern-section-title">Badges</h2>
                <div className="event-badge-gallery">
                  {event.badgeItems.length === 0 ? (
                    <div className="text-muted small">No badge artwork has been published for this event yet.</div>
                  ) : (
                    event.badgeItems.map((badge, idx) => (
                      <div
                        key={`${badge.title}-${idx}`}
                        className="event-badge-card"
                        title={`Badge reward: ${badge.title}`}
                      >
                        <img
                          src={resolveMediaUrl(badge.imageUrl)}
                          alt={badge.title}
                          className="event-badge-image"
                        />
                        <div className="event-badge-title">{badge.title}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="event-modern-section">
                <h2 className="event-modern-section-title">How this event works</h2>
                <ul className="event-detail-list">
                  {(event.howItWorksLines || []).map((line, idx) => (
                    <li key={`how-${idx}`}>{line}</li>
                  ))}
                </ul>
              </section>

              <section className="event-modern-section">
                <h2 className="event-modern-section-title">Rules</h2>
                <ul className="event-detail-list">
                  {(event.participantRulesLines || []).map((line, idx) => (
                    <li key={`rule-${idx}`}>{line}</li>
                  ))}
                </ul>
              </section>

              <div className="event-modern-register">
                {event.isRegistered && progressCtas ? (
                  <button
                    type="button"
                    className={`event-modern-log-progress-btn ${
                      progressCtas.primary.kind === 'log' ? 'is-progress-log' : 'is-progress-history'
                    }`}
                    onClick={() => runChallengeCta(progressCtas.primary.kind)}
                  >
                    {progressCtas.primary.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`challenge-btn ${registerDisabled ? 'is-secondary' : ''}`}
                  disabled={registerDisabled}
                  onClick={() => goToRegistration()}
                >
                  {registerBtnLabel}
                </button>
              </div>
            </section>
          </article>
        )}
      </main>
      <ChallengeProgressHistoryModal
        open={Boolean(challengeHistoryModal?.eventId)}
        eventId={challengeHistoryModal?.eventId || ''}
        eventTitleFallback={challengeHistoryModal?.title || ''}
        resolveMediaUrl={resolveMediaUrl}
        onClosed={() => setChallengeHistoryModal(null)}
      />
    </div>
  )
}

export default EventDetails
