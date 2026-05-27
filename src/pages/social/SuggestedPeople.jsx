import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../utils/api'
import './SuggestedPeople.css'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const resolveMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

const SuggestedPeople = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [totalMembers, setTotalMembers] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [followBusyById, setFollowBusyById] = useState({})
  const [searchInput, setSearchInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')

  const fetchMembers = async (targetPage = 1, append = false, queryOverride) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const query = typeof queryOverride === 'string' ? queryOverride : activeQuery
      const params = new URLSearchParams({
        page: String(targetPage),
        per_page: '18',
      })
      if (query.trim()) {
        params.set('query', query.trim())
      }

      const response = await apiRequest(
        `/v1/social/discover?${params.toString()}`,
        { method: 'GET' }
      )

      if (response.data?.success) {
        const results = response.data?.data?.results || []
        const pagination = response.data?.data?.pagination || {}
        setPeople((prev) => (append ? [...prev, ...results] : results))
        setPage(Number(pagination.page || targetPage))
        setLastPage(Number(pagination.last_page || 1))
        setTotalMembers(Number(pagination.total || results.length || 0))
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
      if (!append) setPeople([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchMembers(1, false, '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleFollow = async (targetClientId, isFollowing) => {
    if (!targetClientId || followBusyById[targetClientId]) return
    setFollowBusyById((prev) => ({ ...prev, [targetClientId]: true }))
    try {
      await apiRequest(isFollowing ? '/v1/social/unfollow' : '/v1/social/follow', {
        method: 'POST',
        body: { client_id: targetClientId },
      })

      setPeople((prev) => prev.map((person) => (
        person.id === targetClientId ? { ...person, is_following: !isFollowing } : person
      )))
    } catch (error) {
      console.error('Failed to toggle follow:', error)
    } finally {
      setFollowBusyById((prev) => ({ ...prev, [targetClientId]: false }))
    }
  }

  const handleSearchSubmit = async (event) => {
    event.preventDefault()
    const nextQuery = searchInput.trim()
    setActiveQuery(nextQuery)
    await fetchMembers(1, false, nextQuery)
  }

  const clearSearch = async () => {
    setSearchInput('')
    setActiveQuery('')
    await fetchMembers(1, false, '')
  }

  return (
    <div className="d-flex flex-column suggested-page" style={{ minHeight: '100vh' }}>
      <main className="flex-grow-1">
          <div className="container py-4 px-3 px-md-4">
            <div className="suggested-wrap">
              <div className="suggested-head">
                <h1 className="suggested-title">Suggested for you</h1>
                <p className="suggested-subtitle">Browse and follow members in the community</p>
                <form className="suggested-search" onSubmit={handleSearchSubmit}>
                  <div className="suggested-search-input-wrap">
                    <input
                      type="text"
                      className="suggested-search-input"
                      placeholder="Search members by name or email"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      aria-label="Search members"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        className="suggested-clear-btn"
                        onClick={clearSearch}
                        aria-label="Clear search"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <button type="submit" className="suggested-search-btn" disabled={loading}>
                    Search
                  </button>
                </form>
                <div className="suggested-count">
                  {activeQuery
                    ? `${totalMembers} result${totalMembers === 1 ? '' : 's'} for "${activeQuery}"`
                    : `${totalMembers} member${totalMembers === 1 ? '' : 's'} available`}
                </div>
              </div>

              {loading ? (
                <div className="suggested-empty">Loading members...</div>
              ) : people.length === 0 ? (
                <div className="suggested-empty">
                  {activeQuery
                    ? 'No members matched your search. Try another keyword.'
                    : 'No members available right now.'}
                </div>
              ) : (
                <>
                  <div className="suggested-list">
                    {people.map((person) => (
                      <div key={person.id} className="suggested-item">
                        <button
                          type="button"
                          className="suggested-main"
                          onClick={() => navigate(`/profile/${person.id}`)}
                        >
                          <div className="suggested-avatar">
                            {person.profile_picture_url ? (
                              <img src={resolveMediaUrl(person.profile_picture_url)} alt={person.display_name || 'User'} />
                            ) : (
                              <span>{(person.display_name?.charAt(0) || 'U').toUpperCase()}</span>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="suggested-name">{person.display_name || 'User'}</div>
                            <div className="suggested-meta">
                              {[person.city, person.province].filter(Boolean).join(', ') || 'Fitness 365 Pro member'}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          className={`suggested-follow ${person.is_following ? 'is-secondary' : ''}`}
                          disabled={Boolean(followBusyById[person.id])}
                          onClick={() => handleToggleFollow(person.id, Boolean(person.is_following))}
                        >
                          {followBusyById[person.id] ? '...' : person.is_following ? 'Following' : 'Follow'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {page < lastPage && (
                    <div className="suggested-more-wrap">
                      <button
                        type="button"
                        className="suggested-more-btn"
                        disabled={loadingMore}
                        onClick={() => fetchMembers(page + 1, true)}
                      >
                        {loadingMore ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
      </main>
    </div>
  )
}

export default SuggestedPeople
