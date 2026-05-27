import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../../utils/api'
import { notifyError } from '../../utils/notifications'
import { AppLoadingState } from '../AppLoadingState.jsx'

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

const formatFinishTime = (minutes) => {
  const num = Number(minutes)
  if (Number.isNaN(num) || num <= 0) return '—'
  const totalSecs = Math.round(num * 60)
  const hrs = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

const formatEventDate = (iso) => {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatCategoryLabel = (value) => {
  if (!value) return 'General'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const ProfileRaceResultsTab = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const eventFromQuery = searchParams.get('event')
  const [eventsLoading, setEventsLoading] = useState(true)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [eventMeta, setEventMeta] = useState(null)
  const [categories, setCategories] = useState([])
  const [results, setResults] = useState([])
  const [totalResults, setTotalResults] = useState(0)
  const [viewerResult, setViewerResult] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loadError, setLoadError] = useState(null)

  const selectedEvent = useMemo(
    () => events.find((event) => String(event.id) === String(selectedEventId)) || null,
    [events, selectedEventId],
  )

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true)
    setLoadError(null)
    try {
      const response = await apiRequest('/v1/profile/race-results/events', { method: 'GET' })
      if (response.data?.success) {
        const list = response.data?.data?.events || []
        setEvents(list)
        if (list.length > 0) {
          const preferredId = eventFromQuery
            ? list.find((item) => String(item.id) === String(eventFromQuery))?.id
            : null
          setSelectedEventId((prev) => preferredId || prev || list[0].id)
        } else {
          setSelectedEventId(null)
        }
      } else {
        setEvents([])
        setLoadError(response.data?.message || 'Could not load completed events.')
      }
    } catch (error) {
      setEvents([])
      setLoadError(error?.response?.data?.message || 'Failed to load completed events.')
      notifyError(error?.response?.data?.message || 'Failed to load completed events.')
    } finally {
      setEventsLoading(false)
    }
  }, [eventFromQuery])

  const fetchResults = useCallback(async (eventId, searchOverride, categoryOverride) => {
    if (!eventId) return
    setResultsLoading(true)
    setLoadError(null)

    const search = typeof searchOverride === 'string' ? searchOverride : activeSearch
    const category = typeof categoryOverride === 'string' ? categoryOverride : categoryFilter

    try {
      const params = new URLSearchParams({ limit: '200' })
      if (search.trim()) params.set('search', search.trim())
      if (category && category !== 'all') params.set('category', category)

      const response = await apiRequest(
        `/v1/profile/race-results/events/${eventId}?${params.toString()}`,
        { method: 'GET' },
      )

      if (response.data?.success) {
        const payload = response.data?.data || {}
        setEventMeta(payload.event || null)
        setCategories(payload.categories || [])
        setResults(payload.results || [])
        setTotalResults(Number(payload.total || 0))
        setViewerResult(payload.viewer_result || null)
      } else {
        setEventMeta(null)
        setCategories([])
        setResults([])
        setTotalResults(0)
        setViewerResult(null)
        setLoadError(response.data?.message || 'Could not load race results.')
      }
    } catch (error) {
      setEventMeta(null)
      setCategories([])
      setResults([])
      setTotalResults(0)
      setViewerResult(null)
      setLoadError(error?.response?.data?.message || 'Failed to load race results.')
    } finally {
      setResultsLoading(false)
    }
  }, [activeSearch, categoryFilter])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    if (!selectedEventId) return
    fetchResults(selectedEventId)
  }, [selectedEventId, fetchResults])

  const handleEventSelect = (eventId) => {
    setSelectedEventId(eventId)
    setSearchInput('')
    setActiveSearch('')
    setCategoryFilter('all')
  }

  const handleSearchSubmit = async (event) => {
    event.preventDefault()
    const nextSearch = searchInput.trim()
    setActiveSearch(nextSearch)
    await fetchResults(selectedEventId, nextSearch, categoryFilter)
  }

  const clearSearch = async () => {
    setSearchInput('')
    setActiveSearch('')
    await fetchResults(selectedEventId, '', categoryFilter)
  }

  const handleCategoryChange = async (nextCategory) => {
    setCategoryFilter(nextCategory)
    await fetchResults(selectedEventId, activeSearch, nextCategory)
  }

  const categoryOptions = useMemo(() => {
    const base = [{ key: 'all', label: 'All categories' }]
    const fromApi = (categories || []).map((cat) => ({
      key: cat.key,
      label: cat.label || formatCategoryLabel(cat.key),
    }))
    return [...base, ...fromApi]
  }, [categories])

  return (
    <div className="profile-tab-panel profile-race-results-panel">
      <div className="profile-tab-panel-head">
        <h2 className="profile-section-title mb-1">Race Results</h2>
        <p className="profile-tab-panel-subtitle mb-0">
          Browse finished events, filter by category, and search athletes by name
        </p>
      </div>

      {eventsLoading ? (
        <AppLoadingState compact hint="Loading completed events…" />
      ) : events.length === 0 ? (
        <div className="profile-tab-empty">
          No completed events yet. Results will appear here after events end.
        </div>
      ) : (
        <div className="profile-race-results-layout">
          <aside className="profile-race-results-events">
            <div className="profile-race-results-events__title">Completed events</div>
            <div className="profile-race-results-events__list">
              {events.map((event) => {
                const isActive = String(event.id) === String(selectedEventId)
                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`profile-race-results-event-card${isActive ? ' is-active' : ''}`}
                    onClick={() => handleEventSelect(event.id)}
                  >
                    {event.image_url ? (
                      <img
                        src={resolveMediaUrl(event.image_url)}
                        alt=""
                        className="profile-race-results-event-card__thumb"
                      />
                    ) : (
                      <div className="profile-race-results-event-card__thumb profile-race-results-event-card__thumb--fallback" />
                    )}
                    <div className="profile-race-results-event-card__body">
                      <div className="profile-race-results-event-card__name">{event.title}</div>
                      <div className="profile-race-results-event-card__meta">
                        {formatCategoryLabel(event.category)} · Ended {formatEventDate(event.ends_at)}
                      </div>
                      <div className="profile-race-results-event-card__count">
                        {event.participants_count ?? 0} athletes
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="profile-race-results-main">
            {selectedEvent && (
              <>
                <div className="profile-race-results-main__head">
                  <h3 className="profile-race-results-main__title">
                    {eventMeta?.title || selectedEvent.title}
                  </h3>
                  <p className="profile-race-results-main__subtitle">
                    {formatCategoryLabel(eventMeta?.category || selectedEvent.category)}
                    {' · '}
                    {eventMeta?.location || selectedEvent.location || 'Location TBA'}
                    {' · '}
                    Ended {formatEventDate(eventMeta?.ends_at || selectedEvent.ends_at)}
                  </p>
                </div>

                <div className="profile-race-results-filters">
                  <form className="profile-members-search profile-race-results-search" onSubmit={handleSearchSubmit}>
                    <div className="profile-members-search__field">
                      <svg className="profile-members-search__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
                        <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      <input
                        type="search"
                        className="profile-members-search__input"
                        placeholder="Search athletes"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        aria-label="Search athletes"
                      />
                      {searchInput && (
                        <button type="button" className="profile-members-search__clear" onClick={clearSearch}>
                          Clear
                        </button>
                      )}
                    </div>
                    <button type="submit" className="profile-members-search__submit">
                      Search
                    </button>
                  </form>

                  <div className="profile-race-results-category">
                    <label htmlFor="race-results-category" className="profile-race-results-category__label">
                      Category
                    </label>
                    <select
                      id="race-results-category"
                      className="profile-race-results-category__select"
                      value={categoryFilter}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                    >
                      {categoryOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {viewerResult && (
                  <div className="profile-race-results-viewer">
                    <span className="profile-race-results-viewer__rank">Your rank: #{viewerResult.rank}</span>
                    <span className="profile-race-results-viewer__meta">
                      {formatFinishTime(viewerResult.finish_time_minutes)} · {formatPace(viewerResult.progress?.pace_min_per_km)} · {viewerResult.category_label}
                    </span>
                  </div>
                )}

                <div className="profile-race-results-summary">
                  {totalResults} athlete{totalResults === 1 ? '' : 's'}
                  {activeSearch ? ` matching "${activeSearch}"` : ''}
                </div>

                {resultsLoading ? (
                  <AppLoadingState compact hint="Loading results…" />
                ) : loadError ? (
                  <div className="profile-tab-empty profile-tab-empty--error">{loadError}</div>
                ) : results.length === 0 ? (
                  <div className="profile-tab-empty">
                    No athletes found for this event with the current filters.
                  </div>
                ) : (
                  <div className="profile-race-results-table-wrap">
                    <table className="profile-race-results-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Athlete</th>
                          <th>Category</th>
                          <th>Time</th>
                          <th>Pace</th>
                          <th>Distance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((row) => (
                          <tr key={`${row.user?.id}-${row.rank}`}>
                            <td>
                              <span className="profile-race-results-rank">#{row.rank}</span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="profile-race-results-athlete"
                                onClick={() => navigate(`/profile/${row.user.id}`)}
                              >
                                <span className="profile-race-results-athlete__avatar">
                                  {row.user?.profile_picture_url ? (
                                    <img src={resolveMediaUrl(row.user.profile_picture_url)} alt="" />
                                  ) : (
                                    (row.user?.display_name?.charAt(0) || 'U').toUpperCase()
                                  )}
                                </span>
                                <span className="profile-race-results-athlete__name">
                                  {row.user?.display_name || 'Athlete'}
                                </span>
                              </button>
                            </td>
                            <td>{row.category_label || '—'}</td>
                            <td>{formatFinishTime(row.finish_time_minutes)}</td>
                            <td>{formatPace(row.progress?.pace_min_per_km)}</td>
                            <td>{formatKm(row.progress?.logged_distance_km)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default ProfileRaceResultsTab
