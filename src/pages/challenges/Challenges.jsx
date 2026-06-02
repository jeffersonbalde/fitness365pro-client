import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest, ensureAccessToken } from '../../utils/api'
import { notifyError } from '../../utils/notifications'
import { toEvent, deriveChallengeProgressCtas } from './eventCatalog'
import ChallengeProgressHistoryModal from '../../components/profile/ChallengeProgressHistoryModal.jsx'
import EventShareModal from '../../components/challenges/EventShareModal.jsx'
import { AppLoadingState } from '../../components/AppLoadingState.jsx'
import './Challenges.css'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const resolveMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

const Challenges = () => {
  const navigate = useNavigate()
  const fetchSeq = useRef(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [challenges, setChallenges] = useState([])
  const [historyModal, setHistoryModal] = useState(null)
  const [shareEvent, setShareEvent] = useState(null)

  const completedChallengeIdsFromEvents = useMemo(() => {
    const ids = new Set()
    for (const challenge of challenges) {
      const event = toEvent(challenge)
      if (!event.isRegistered) continue
      const ctas = deriveChallengeProgressCtas({
        challengeProgress: event.challengeProgress,
        endsAtIso: event.endsAtIso,
      })
      if (ctas.goalMet) {
        ids.add(String(event.id))
      }
    }
    return ids
  }, [challenges])

  const loadChallenges = useCallback(async (options = {}) => {
    const { silent } = options
    const seq = ++fetchSeq.current
    if (!silent) setLoading(true)
    setLoadError(null)

    try {
      await ensureAccessToken()
      const eventsRes = await apiRequest('/v1/cms/events', { method: 'GET' })
      if (seq !== fetchSeq.current) return

      if (eventsRes.data?.success) {
        setChallenges(eventsRes.data?.data?.events || [])
      } else {
        const msg = eventsRes.data?.message || 'Events could not be loaded.'
        if (!silent) {
          setChallenges([])
          setLoadError(msg)
          notifyError(msg)
        }
      }
    } catch (error) {
      if (seq !== fetchSeq.current) return
      console.error('Failed to load challenges:', error)
      const msg = error?.response?.data?.message || 'Unable to reach the server right now.'
      if (!silent) {
        setChallenges([])
        setLoadError(msg)
        notifyError(msg)
      }
    } finally {
      if (seq === fetchSeq.current && !silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadChallenges()
  }, [loadChallenges])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      loadChallenges({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadChallenges])

  return (
    <div className="d-flex flex-column challenges-page" style={{ minHeight: '100vh' }}>
      <main className="flex-grow-1">
          <div className="container py-4 px-3 px-md-4">
            <div className="challenges-head">
              <h1 className="challenges-title">Events</h1>
              <p className="challenges-subtitle">
                Browse upcoming events, check details, and register in one place.
              </p>
            </div>

            {loading ? (
              <AppLoadingState hint="Fetching events…" />
            ) : loadError ? (
              <div className="challenges-empty">
                <div className="mb-3">{loadError}</div>
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => loadChallenges()}>
                  Try again
                </button>
              </div>
            ) : challenges.length === 0 ? (
              <div className="challenges-empty">
                No events to show right now.
              </div>
            ) : (
              <div className="challenges-grid">
                {challenges.map((challenge) => {
                  const event = toEvent(challenge)
                  const baseCtas = event.isRegistered
                    ? deriveChallengeProgressCtas({
                        challengeProgress: event.challengeProgress,
                        endsAtIso: event.endsAtIso,
                      })
                    : null
                  const ctas =
                    baseCtas && completedChallengeIdsFromEvents.has(String(event.id))
                      ? {
                          ...baseCtas,
                          goalMet: true,
                          primary: { kind: 'history', label: 'View progress' },
                        }
                      : baseCtas

                  const runSingleCta = () => {
                    if (!ctas) return
                    if (ctas.primary.kind === 'log') {
                      navigate('/workout', {
                        state: {
                          adminEventId: event.id,
                          adminEventName: event.name,
                          adminEventGoalKm:
                            event.challengeProgress?.goalKm
                            ?? event.challengeProgress?.mileageChallengeKm
                            ?? null,
                          returnTo: '/challenges',
                        },
                      })
                    } else {
                      setHistoryModal({
                        eventId: String(event.id),
                        title: event.name,
                      })
                    }
                  }

                  const openShare = (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShareEvent(event)
                  }

                  return (
                    <div key={challenge.id} className="challenge-card">
                      <button
                        type="button"
                        className="challenge-card-link"
                        onClick={() => navigate(`/challenges/${event.id}`)}
                      >
                        <div className="challenge-cover-wrap">
                          {event.imageUrl ? (
                            <img
                              src={resolveMediaUrl(event.imageUrl)}
                              alt={event.name}
                              className="challenge-cover-image"
                            />
                          ) : (
                            <div className="challenge-cover-fallback" />
                          )}
                        </div>
                        <div className="challenge-card-body">
                          <div className="challenge-top">
                            <div className="challenge-name">{event.name}</div>
                            <button
                              type="button"
                              className="challenge-card-share-btn"
                              onClick={openShare}
                              aria-label={`Share ${event.name}`}
                            >
                              Share
                            </button>
                          </div>
                          <div className="challenge-description">
                            {event.description}
                          </div>
                          <div className="challenge-info-row">
                            <span className="challenge-info-label">Participants</span>
                            <span className="challenge-info-value">{event.joinersCount}</span>
                          </div>
                          <div className="challenge-info-row">
                            <span className="challenge-info-label">Registration ends</span>
                            <span className="challenge-info-value">{event.registrationDeadlineLabel}</span>
                          </div>
                          <div className="challenge-info-row">
                            <span className="challenge-info-label">Event period</span>
                            <span className="challenge-info-value">{event.timelineLabel}</span>
                          </div>
                          <div className="challenge-meta">{event.location}</div>
                        </div>
                      </button>
                      {event.isRegistered && ctas ? (
                        <div className="challenge-card-footer">
                          <button
                            type="button"
                            className={`event-modern-log-progress-btn ${
                              ctas.primary.kind === 'log' ? 'is-progress-log' : 'is-progress-history'
                            }`}
                            onClick={runSingleCta}
                          >
                            {ctas.primary.label}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
      </main>
      <ChallengeProgressHistoryModal
        open={Boolean(historyModal?.eventId)}
        eventId={historyModal?.eventId || ''}
        eventTitleFallback={historyModal?.title || ''}
        resolveMediaUrl={resolveMediaUrl}
        onClosed={() => setHistoryModal(null)}
      />
      <EventShareModal
        open={Boolean(shareEvent)}
        event={shareEvent}
        resolveMediaUrl={resolveMediaUrl}
        onRequestClose={() => setShareEvent(null)}
      />
    </div>
  )
}

export default Challenges
