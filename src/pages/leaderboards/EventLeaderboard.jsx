import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../../utils/api'
import { AppLoadingState } from '../../components/AppLoadingState.jsx'
import LeaderboardShareModal from '../../components/leaderboards/LeaderboardShareModal.jsx'
import './Leaderboards.css'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const resolveMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

const formatKm = (value) => {
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`
}

const formatPace = (value) => {
  const num = Number(value)
  if (Number.isNaN(num) || num <= 0) return '—'
  const mins = Math.floor(num)
  const secs = Math.round((num - mins) * 60)
  return `${mins}:${String(secs).padStart(2, '0')} /km`
}

const formatPercent = (value) => {
  if (value === null || value === undefined) return '—'
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

const formatCategoryLabel = (value) => {
  if (!value) return 'General'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const rankAccent = (rank) => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

const EventLeaderboard = () => {
  const navigate = useNavigate()
  const { eventId } = useParams()
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const requestIdRef = useRef(0)
  const [eventMeta, setEventMeta] = useState(null)
  const [categories, setCategories] = useState([])
  const [rows, setRows] = useState([])
  const [totalResults, setTotalResults] = useState(0)
  const [viewerRank, setViewerRank] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [shareOpen, setShareOpen] = useState(false)

  const loadLeaderboard = useCallback(async (category = 'all', { background = false } = {}) => {
    const requestId = ++requestIdRef.current

    if (!background) {
      setInitialLoading(true)
      setLoadError(null)
    }

    try {
      const params = new URLSearchParams({ limit: '50', include_viewer_rank: '0' })
      if (category && category !== 'all') {
        params.set('category', category)
      }

      const response = await apiRequest(`/v1/cms/events/${eventId}/leaderboard?${params.toString()}`, {
        method: 'GET',
        timeoutMs: 45000,
      })

      if (requestId !== requestIdRef.current) return

      if (!response.data?.success) {
        if (!background) {
          setEventMeta(null)
          setCategories([])
          setRows([])
          setTotalResults(0)
          setViewerRank(null)
          setLoadError(response.data?.message || 'Leaderboard could not be loaded.')
        }
        return
      }

      const payload = response.data?.data || {}
      setEventMeta(payload.event || null)
      setCategories(payload.categories || [])
      setRows(payload.leaderboard || [])
      setTotalResults(Number(payload.total || 0))
      setViewerRank(null)
      setLoadError(null)

      const viewerParams = new URLSearchParams(params)
      viewerParams.set('include_viewer_rank', '1')
      void apiRequest(`/v1/cms/events/${eventId}/leaderboard?${viewerParams.toString()}`, {
        method: 'GET',
        timeoutMs: 45000,
      })
        .then((viewerResponse) => {
          if (requestId !== requestIdRef.current) return
          const viewerPayload = viewerResponse.data?.data || {}
          if (viewerPayload.viewer_rank) {
            setViewerRank(viewerPayload.viewer_rank)
          }
        })
        .catch(() => {
          // Rankings already visible; viewer card is optional.
        })
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      if (error?.response?.data?.event_status === 'completed') {
        navigate(`/profile/race-results?event=${encodeURIComponent(eventId)}`, { replace: true })
        return
      }
      console.error('Failed to load event leaderboard:', error)
      if (!background) {
        setEventMeta(null)
        setCategories([])
        setRows([])
        setTotalResults(0)
        setViewerRank(null)
        setLoadError(error?.response?.data?.message || 'Unable to reach the server right now.')
      }
    } finally {
      if (requestId === requestIdRef.current && !background) {
        setInitialLoading(false)
      }
    }
  }, [eventId, navigate])

  useEffect(() => {
    setCategoryFilter('all')
    loadLeaderboard('all', { background: false })
  }, [eventId, loadLeaderboard])

  const handleCategoryChange = (nextCategory) => {
    if (nextCategory === categoryFilter) return
    setCategoryFilter(nextCategory)
    loadLeaderboard(nextCategory, { background: true })
  }

  const showCategoryFilter = useMemo(() => {
    if (!categories.length) return false
    if (categories.length === 1 && categories[0]?.key === '_general') return false
    return true
  }, [categories])

  const showCategoryColumn = showCategoryFilter

  const categoryOptions = useMemo(() => {
    const base = [{ key: 'all', label: 'All categories' }]
    const fromApi = (categories || []).map((cat) => ({
      key: cat.key,
      label: cat.label || formatCategoryLabel(cat.key),
    }))
    return [...base, ...fromApi]
  }, [categories])

  const topThree = useMemo(() => rows.slice(0, 3), [rows])

  const listHeadClass = showCategoryColumn
    ? 'leaderboard-list-head leaderboard-event-list-head has-category'
    : 'leaderboard-list-head leaderboard-event-list-head'

  const rowClass = showCategoryColumn
    ? 'leaderboard-row leaderboard-event-row leaderboard-event-row--with-category leaderboard-clickable'
    : 'leaderboard-row leaderboard-event-row leaderboard-clickable'

  return (
    <div className="d-flex flex-column leaderboard-page" style={{ minHeight: '100vh' }}>
      <main className="flex-grow-1">
        <div className="container py-4 px-3 px-md-4">
          <div className="leaderboard-head leaderboard-event-head">
            <div>
              <button type="button" className="leaderboard-back-btn" onClick={() => navigate('/leaderboards')}>
                ← All events
              </button>
              <h1 className="leaderboard-title">{eventMeta?.title || 'Event Leaderboard'}</h1>
              <p className="leaderboard-subtitle">
                {eventMeta
                  ? `${eventMeta.participants_count ?? 0} participants ranked by finish order, then progress`
                  : 'Rankings update when admin approves progress. Finishers rank by who completed the goal first.'}
              </p>
            </div>
            {viewerRank && (
              <button
                type="button"
                className="leaderboard-share-btn"
                onClick={() => setShareOpen(true)}
                aria-label="Share your leaderboard standing"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Share
              </button>
            )}
          </div>

          {showCategoryFilter && !initialLoading && !loadError && (
            <div className="leaderboard-control-shell">
              <div className="leaderboard-category-label">Filter by distance</div>
              <div className="leaderboard-chip-row">
                {categoryOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`leaderboard-chip-btn${categoryFilter === option.key ? ' is-active' : ''}`}
                    onClick={() => handleCategoryChange(option.key)}
                    aria-pressed={categoryFilter === option.key}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {initialLoading ? (
            <AppLoadingState compact hint="Loading rankings…" className="leaderboard-loading" />
          ) : loadError ? (
            <div className="leaderboard-empty">
              <div className="mb-3">{loadError}</div>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => navigate('/leaderboards')}>
                Back to events
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="leaderboard-empty">
              {showCategoryFilter && categoryFilter !== 'all'
                ? 'No participants found for this category yet.'
                : 'No confirmed participants yet. Rankings will appear once athletes join and log progress.'}
            </div>
          ) : (
            <>
                  {totalResults > 0 && showCategoryFilter && categoryFilter !== 'all' && (
                    <div className="leaderboard-results-summary">
                      {totalResults} athlete{totalResults === 1 ? '' : 's'} in{' '}
                      {categoryOptions.find((option) => option.key === categoryFilter)?.label || 'this category'}
                    </div>
                  )}

                  {viewerRank && (
                    <div className="leaderboard-viewer-card">
                      <div className="leaderboard-viewer-card-top">
                        <div className="leaderboard-viewer-rank">Your rank: #{viewerRank.rank}</div>
                        <button
                          type="button"
                          className="leaderboard-share-btn leaderboard-share-btn--compact"
                          onClick={() => setShareOpen(true)}
                          aria-label="Share your leaderboard standing"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Share
                        </button>
                      </div>
                      <div className="leaderboard-viewer-meta">
                        {formatKm(viewerRank.progress?.logged_distance_km)} logged
                        {viewerRank.progress?.goal_distance_km != null
                          ? ` • ${formatPercent(viewerRank.progress?.progress_percent)} of goal`
                          : ''}
                        {viewerRank.progress?.goal_completed ? ' • Goal completed' : ''}
                        {viewerRank.category_label ? ` • ${viewerRank.category_label}` : ''}
                      </div>
                    </div>
                  )}

                  <div className="leaderboard-top3 leaderboard-top3-main">
                    {topThree.map((entry) => (
                      <button
                        key={entry.user.id}
                        type="button"
                        className="leaderboard-podium-card leaderboard-clickable"
                        onClick={() => navigate(`/profile/${entry.user.id}`)}
                      >
                        <div className="leaderboard-podium-rank">{rankAccent(entry.rank)}</div>
                        <div className="leaderboard-podium-avatar">
                          {entry.user.profile_picture_url ? (
                            <img src={resolveMediaUrl(entry.user.profile_picture_url)} alt={entry.user.display_name || 'User'} />
                          ) : (
                            <span>{(entry.user.display_name?.charAt(0) || 'U').toUpperCase()}</span>
                          )}
                        </div>
                        <div className="leaderboard-podium-name">{entry.user.display_name || 'User'}</div>
                        {showCategoryColumn && entry.category_label && (
                          <div className="leaderboard-podium-category">{entry.category_label}</div>
                        )}
                        <div className="leaderboard-podium-meta">
                          {formatKm(entry.progress?.logged_distance_km)}
                          {entry.progress?.goal_completed ? ' • Finished' : ''}
                        </div>
                        <div className="leaderboard-podium-score">{formatPercent(entry.progress?.progress_percent)}</div>
                      </button>
                    ))}
                  </div>

                  <div className="leaderboard-event-list-scroll">
                    <div className="leaderboard-list leaderboard-main-list leaderboard-event-list">
                      <div className={listHeadClass}>
                        <span>Rank</span>
                        <span>Athlete</span>
                        {showCategoryColumn && <span>Category</span>}
                        <span>Progress</span>
                        <span>Goal</span>
                        <span>Pace</span>
                        <span>Complete</span>
                      </div>
                      <div className="card-body p-0">
                        {rows.map((entry) => (
                          <button
                            key={`${entry.user.id}-${entry.rank}`}
                            type="button"
                            className={rowClass}
                            onClick={() => navigate(`/profile/${entry.user.id}`)}
                          >
                            <div className="leaderboard-event-row-leading">
                              <div className="leaderboard-rank">#{entry.rank}</div>
                              <div className="leaderboard-user">
                                <div className="leaderboard-avatar">
                                  {entry.user.profile_picture_url ? (
                                    <img src={resolveMediaUrl(entry.user.profile_picture_url)} alt={entry.user.display_name || 'User'} />
                                  ) : (
                                    <span>{(entry.user.display_name?.charAt(0) || 'U').toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="leaderboard-user-copy">
                                  <div className="leaderboard-name">{entry.user.display_name || 'User'}</div>
                                  <div className="leaderboard-sub">
                                    {[entry.user.city, entry.user.province].filter(Boolean).join(', ') || 'Fitness 365 Pro member'}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="leaderboard-event-metrics">
                              {showCategoryColumn && (
                                <div className="leaderboard-metric leaderboard-stat leaderboard-category-cell" data-label="Category">
                                  {entry.category_label || '—'}
                                </div>
                              )}
                              <div className="leaderboard-metric leaderboard-stat" data-label="Progress">
                                {formatKm(entry.progress?.logged_distance_km)}
                              </div>
                              <div className="leaderboard-metric leaderboard-stat" data-label="Goal">
                                {entry.progress?.goal_distance_km != null ? formatKm(entry.progress.goal_distance_km) : '—'}
                              </div>
                              <div className="leaderboard-metric leaderboard-stat" data-label="Pace">
                                {formatPace(entry.progress?.pace_min_per_km)}
                              </div>
                              <div className="leaderboard-score leaderboard-stat" data-label="Complete">
                                {entry.progress?.goal_completed ? (
                                  <span className="leaderboard-complete-badge">Done</span>
                                ) : (
                                  formatPercent(entry.progress?.progress_percent)
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
          )}
        </div>
      </main>

      <LeaderboardShareModal
        open={shareOpen}
        onRequestClose={() => setShareOpen(false)}
        eventTitle={eventMeta?.title}
        eventId={eventId}
        clientId={viewerRank?.user?.id}
        ownerName={viewerRank?.user?.display_name}
        rank={viewerRank?.rank}
        progress={viewerRank?.progress}
        categoryLabel={viewerRank?.category_label}
        categoryFilter={categoryFilter}
        eventImageUrl={eventMeta?.image_url}
        resolveMediaUrl={resolveMediaUrl}
      />
    </div>
  )
}

export default EventLeaderboard
