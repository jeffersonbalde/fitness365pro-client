import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

const ProfileMembersTab = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [members, setMembers] = useState([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [totalMembers, setTotalMembers] = useState(0)
  const [followBusyById, setFollowBusyById] = useState({})
  const [searchInput, setSearchInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')

  const fetchMembers = useCallback(async (targetPage = 1, append = false, queryOverride) => {
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

      const response = await apiRequest(`/v1/social/discover?${params.toString()}`, { method: 'GET' })

      if (response.data?.success) {
        const results = response.data?.data?.results || []
        const pagination = response.data?.data?.pagination || {}
        setMembers((prev) => (append ? [...prev, ...results] : results))
        setPage(Number(pagination.page || targetPage))
        setLastPage(Number(pagination.last_page || 1))
        setTotalMembers(Number(pagination.total || results.length || 0))
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to load members.')
      if (!append) setMembers([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeQuery])

  useEffect(() => {
    fetchMembers(1, false, '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleToggleFollow = async (targetClientId, isFollowing) => {
    if (!targetClientId || followBusyById[targetClientId]) return
    setFollowBusyById((prev) => ({ ...prev, [targetClientId]: true }))
    try {
      await apiRequest(isFollowing ? '/v1/social/unfollow' : '/v1/social/follow', {
        method: 'POST',
        body: { client_id: targetClientId },
      })

      setMembers((prev) => prev.map((person) => (
        person.id === targetClientId ? { ...person, is_following: !isFollowing } : person
      )))
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to update follow status.')
    } finally {
      setFollowBusyById((prev) => ({ ...prev, [targetClientId]: false }))
    }
  }

  return (
    <div className="profile-tab-panel">
      <div className="profile-tab-panel-head">
        <h2 className="profile-section-title mb-1">Members</h2>
        <p className="profile-tab-panel-subtitle mb-0">
          Search and browse everyone in Fitness 365 Pro
        </p>
      </div>

      <form className="profile-members-search" onSubmit={handleSearchSubmit}>
        <div className="profile-members-search__field">
          <svg className="profile-members-search__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
            <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="profile-members-search__input"
            placeholder="Search members"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search members"
          />
          {searchInput && (
            <button
              type="button"
              className="profile-members-search__clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
        <button type="submit" className="profile-members-search__submit" disabled={loading}>
          Search
        </button>
      </form>

      <div className="profile-members-count">
        {activeQuery
          ? `${totalMembers} result${totalMembers === 1 ? '' : 's'} for "${activeQuery}"`
          : `${totalMembers} member${totalMembers === 1 ? '' : 's'} available`}
      </div>

      {loading ? (
        <AppLoadingState compact hint="Loading members…" />
      ) : members.length === 0 ? (
        <div className="profile-tab-empty">
          {activeQuery
            ? 'No members matched your search. Try another keyword.'
            : 'No members available right now.'}
        </div>
      ) : (
        <>
          <div className="profile-members-list">
            {members.map((person) => (
              <div className="profile-members-item" key={person.id}>
                <button
                  type="button"
                  className="profile-members-item__main"
                  onClick={() => navigate(`/profile/${person.id}`)}
                >
                  <div className="profile-members-item__avatar">
                    {person.profile_picture_url ? (
                      <img src={resolveMediaUrl(person.profile_picture_url)} alt={person.display_name || 'User'} />
                    ) : (
                      <span>{(person.display_name?.charAt(0) || 'U').toUpperCase()}</span>
                    )}
                  </div>
                  <div className="profile-members-item__text">
                    <div className="profile-members-item__name">{person.display_name || 'User'}</div>
                    <div className="profile-members-item__meta">
                      {[person.city, person.province].filter(Boolean).join(', ') || 'Fitness 365 Pro member'}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className={`profile-members-item__follow ${person.is_following ? 'is-secondary' : ''}`}
                  disabled={Boolean(followBusyById[person.id])}
                  onClick={() => handleToggleFollow(person.id, Boolean(person.is_following))}
                >
                  {followBusyById[person.id] ? '…' : person.is_following ? 'Following' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
          {page < lastPage && (
            <div className="profile-tab-load-more-wrap">
              <button
                type="button"
                className="profile-tab-load-more"
                disabled={loadingMore}
                onClick={() => fetchMembers(page + 1, true)}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ProfileMembersTab
