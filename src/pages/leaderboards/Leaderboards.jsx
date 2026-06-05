import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../utils/api'
import { getPageSnapshot, setPageSnapshot } from '../../utils/pageSnapshots'
import { notifyError } from '../../utils/notifications'
import { toEvent } from '../challenges/eventCatalog'
import { AppLoadingState } from '../../components/AppLoadingState.jsx'
import '../challenges/Challenges.css'
import './Leaderboards.css'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const resolveMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

const Leaderboards = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(() => !getPageSnapshot('cms-events'))
  const [loadError, setLoadError] = useState(null)
  const [events, setEvents] = useState(() => getPageSnapshot('cms-events') || [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const response = await apiRequest('/v1/cms/events', { method: 'GET' })
      if (response.data?.success) {
        const nextEvents = response.data?.data?.events || []
        setEvents(nextEvents)
        setPageSnapshot('cms-events', nextEvents)
      } else {
        const msg = response.data?.message || 'Events could not be loaded.'
        setEvents([])
        setLoadError(msg)
        notifyError(msg)
      }
    } catch (error) {
      console.error('Failed to load leaderboard events:', error)
      const msg = error?.response?.data?.message || 'Unable to reach the server right now.'
      setEvents([])
      setLoadError(msg)
      notifyError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  return (
    <div className="d-flex flex-column leaderboard-page" style={{ minHeight: '100vh' }}>
      <main className="flex-grow-1">
        <div className="container py-4 px-3 px-md-4">
          <div className="leaderboard-head">
            <div>
              <h1 className="leaderboard-title">Leaderboards</h1>
              <p className="leaderboard-subtitle">
                Pick an event to see live participant rankings by progress.
              </p>
            </div>
          </div>

          {loading ? (
            <AppLoadingState hint="Loading events…" className="leaderboard-loading" />
          ) : loadError ? (
            <div className="leaderboard-empty">
              <div className="mb-3">{loadError}</div>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={loadEvents}>
                Try again
              </button>
            </div>
          ) : events.length === 0 ? (
            <div className="leaderboard-empty">No events with leaderboards yet. Check back when events are published.</div>
          ) : (
            <div className="challenges-grid leaderboard-events-grid">
              {events.map((rawEvent) => {
                const event = toEvent(rawEvent)
                return (
                  <div key={event.id} className="challenge-card leaderboard-event-card">
                    <button
                      type="button"
                      className="challenge-card-link"
                      onClick={() => navigate(`/leaderboards/${event.id}`)}
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
                        </div>
                        <div className="challenge-description">{event.description}</div>
                        <div className="challenge-info-row">
                          <span className="challenge-info-label">Participants</span>
                          <span className="challenge-info-value">{event.joinersCount}</span>
                        </div>
                        <div className="challenge-info-row">
                          <span className="challenge-info-label">Event period</span>
                          <span className="challenge-info-value">{event.timelineLabel}</span>
                        </div>
                        <div className="challenge-meta">{event.location}</div>
                      </div>
                    </button>
                    <div className="challenge-card-footer">
                      <button
                        type="button"
                        className="event-modern-log-progress-btn is-progress-log"
                        onClick={() => navigate(`/leaderboards/${event.id}`)}
                      >
                        View rankings
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default Leaderboards
