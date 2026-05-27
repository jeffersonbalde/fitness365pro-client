import React, { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../utils/api'
import { notifyError, notifySuccess } from '../../utils/notifications'
import './Communities.css'

const NICHE_OPTIONS = [
  { value: '', label: 'All niches' },
  { value: 'running', label: 'Running' },
  { value: 'gym', label: 'Gym' },
  { value: 'biking', label: 'Biking' },
  { value: 'hybrid', label: 'Hybrid' },
]

const Communities = () => {
  const [loading, setLoading] = useState(true)
  const [savingCommunity, setSavingCommunity] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [posting, setPosting] = useState(false)
  const [workingMembership, setWorkingMembership] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState(null)
  const [loadingChat, setLoadingChat] = useState(false)
  const [chatBusy, setChatBusy] = useState(false)
  const [deletingChatMessageId, setDeletingChatMessageId] = useState(null)

  const [nicheFilter, setNicheFilter] = useState('')
  const [communities, setCommunities] = useState([])
  const [selectedCommunityId, setSelectedCommunityId] = useState(null)
  const [selectedCommunity, setSelectedCommunity] = useState(null)
  const [posts, setPosts] = useState([])
  const [chatChannel, setChatChannel] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatMessageBody, setChatMessageBody] = useState('')

  const [newCommunityForm, setNewCommunityForm] = useState({
    name: '',
    description: '',
    primary_niche: 'running',
    visibility: 'public',
    city: '',
    province: '',
    country: '',
  })
  const [newPostBody, setNewPostBody] = useState('')

  const selectedCommunityFromList = useMemo(
    () => communities.find((community) => community.id === selectedCommunityId) || null,
    [communities, selectedCommunityId]
  )

  const loadCommunities = async (focusId = null) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (nicheFilter) params.set('niche', nicheFilter)
      params.set('limit', '50')
      const endpoint = params.toString() ? `/v1/communities?${params.toString()}` : '/v1/communities'
      const response = await apiRequest(endpoint, { method: 'GET' })
      if (response.data?.success) {
        const list = response.data?.data?.communities || []
        setCommunities(list)
        const pickId = focusId || selectedCommunityId || list[0]?.id || null
        setSelectedCommunityId(pickId)
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to load communities.')
    } finally {
      setLoading(false)
    }
  }

  const loadCommunityDetails = async (communityId) => {
    if (!communityId) {
      setSelectedCommunity(null)
      setPosts([])
      return
    }
    try {
      const [communityRes, postsRes] = await Promise.all([
        apiRequest(`/v1/communities/${communityId}`, { method: 'GET' }),
        apiRequest(`/v1/communities/${communityId}/posts?per_page=20&page=1`, { method: 'GET' }),
      ])

      if (communityRes.data?.success) {
        setSelectedCommunity(communityRes.data?.data?.community || null)
      }
      if (postsRes.data?.success) {
        setPosts(postsRes.data?.data?.posts || [])
      }
    } catch (error) {
      setSelectedCommunity(null)
      setPosts([])
      setChatChannel(null)
      setChatMessages([])
      notifyError(error?.response?.data?.message || 'Failed to load community details.')
    }
  }

  const loadCommunityChat = async (communityId, { silent = false } = {}) => {
    if (!communityId) {
      setChatChannel(null)
      setChatMessages([])
      return
    }
    if (!silent) setLoadingChat(true)
    try {
      const [channelRes, messagesRes] = await Promise.all([
        apiRequest(`/v1/communities/${communityId}/chat/channel`, { method: 'GET' }),
        apiRequest(`/v1/communities/${communityId}/chat/messages?per_page=40`, { method: 'GET' }),
      ])
      if (channelRes.data?.success) {
        setChatChannel(channelRes.data?.data?.channel || null)
      }
      if (messagesRes.data?.success) {
        setChatMessages(messagesRes.data?.data?.messages || [])
      }
    } catch (error) {
      if (!silent) {
        notifyError(error?.response?.data?.message || 'Failed to load community chat.')
      }
      setChatChannel(null)
      setChatMessages([])
    } finally {
      if (!silent) setLoadingChat(false)
    }
  }

  useEffect(() => {
    loadCommunities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicheFilter])

  useEffect(() => {
    if (!selectedCommunityId) {
      setSelectedCommunity(null)
      setPosts([])
      setChatChannel(null)
      setChatMessages([])
      return
    }
    setLoadingPosts(true)
    loadCommunityDetails(selectedCommunityId).finally(() => setLoadingPosts(false))
    loadCommunityChat(selectedCommunityId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommunityId])

  useEffect(() => {
    if (!selectedCommunityId) return undefined
    const timer = setInterval(() => {
      loadCommunityChat(selectedCommunityId, { silent: true })
    }, 4000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommunityId])

  const handleCreateCommunity = async (e) => {
    e.preventDefault()
    setSavingCommunity(true)
    try {
      const response = await apiRequest('/v1/communities', {
        method: 'POST',
        body: {
          ...newCommunityForm,
          name: newCommunityForm.name.trim(),
          description: newCommunityForm.description.trim() || null,
          city: newCommunityForm.city.trim() || null,
          province: newCommunityForm.province.trim() || null,
          country: newCommunityForm.country.trim() || null,
        },
      })
      if (response.data?.success) {
        const created = response.data?.data?.community
        notifySuccess('Community created.', { icon: false })
        setNewCommunityForm({
          name: '',
          description: '',
          primary_niche: 'running',
          visibility: 'public',
          city: '',
          province: '',
          country: '',
        })
        await loadCommunities(created?.id || null)
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to create community.')
    } finally {
      setSavingCommunity(false)
    }
  }

  const handleJoinOrLeave = async () => {
    if (!selectedCommunity) return
    setWorkingMembership(true)
    try {
      const isActiveMember = selectedCommunity?.viewer_membership?.status === 'active'
      const endpoint = isActiveMember
        ? `/v1/communities/${selectedCommunity.id}/leave`
        : `/v1/communities/${selectedCommunity.id}/join`

      const response = await apiRequest(endpoint, { method: 'POST' })
      if (response.data?.success) {
        notifySuccess(response.data?.message || (isActiveMember ? 'Left community.' : 'Joined community.'), { icon: false })
        await loadCommunities(selectedCommunity.id)
        await loadCommunityChat(selectedCommunity.id)
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to update membership.')
    } finally {
      setWorkingMembership(false)
    }
  }

  const handleCreatePost = async (e) => {
    e.preventDefault()
    if (!selectedCommunity || !newPostBody.trim()) return
    setPosting(true)
    try {
      const response = await apiRequest(`/v1/communities/${selectedCommunity.id}/posts`, {
        method: 'POST',
        body: { body: newPostBody.trim() },
      })
      if (response.data?.success) {
        setNewPostBody('')
        setPosts((prev) => [response.data.data.post, ...prev])
        notifySuccess('Post published.', { icon: false })
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to publish post.')
    } finally {
      setPosting(false)
    }
  }

  const handleDeletePost = async (postId) => {
    if (!selectedCommunity || !postId) return
    setDeletingPostId(postId)
    try {
      const response = await apiRequest(`/v1/communities/${selectedCommunity.id}/posts/${postId}`, {
        method: 'DELETE',
      })
      if (response.data?.success) {
        setPosts((prev) => prev.filter((post) => post.id !== postId))
        notifySuccess('Post deleted.', { icon: false })
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to delete post.')
    } finally {
      setDeletingPostId(null)
    }
  }

  const handleSendChatMessage = async (e) => {
    e.preventDefault()
    if (!selectedCommunity || !chatMessageBody.trim()) return
    setChatBusy(true)
    try {
      const response = await apiRequest(`/v1/communities/${selectedCommunity.id}/chat/messages`, {
        method: 'POST',
        body: { body: chatMessageBody.trim() },
      })
      if (response.data?.success) {
        setChatMessageBody('')
        setChatMessages((prev) => [...prev, response.data.data.message])
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to send message.')
    } finally {
      setChatBusy(false)
    }
  }

  const handleDeleteChatMessage = async (messageId) => {
    if (!selectedCommunity || !messageId) return
    setDeletingChatMessageId(messageId)
    try {
      const response = await apiRequest(`/v1/communities/${selectedCommunity.id}/chat/messages/${messageId}`, {
        method: 'DELETE',
      })
      if (response.data?.success) {
        setChatMessages((prev) => prev.filter((message) => message.id !== messageId))
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to delete message.')
    } finally {
      setDeletingChatMessageId(null)
    }
  }

  const canPost = selectedCommunity?.viewer_membership?.status === 'active'
  const canJoinOrLeave = Boolean(selectedCommunity)

  return (
    <div className="d-flex flex-column communities-page" style={{ minHeight: '100vh' }}>
      <main className="flex-grow-1">
          <div className="container py-4 px-3 px-md-4">
            <div className="row g-3">
              <div className="col-12 col-lg-4">
                <div className="communities-card">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h2 className="communities-title mb-0">Communities</h2>
                    <select
                      className="form-select"
                      style={{ width: 170 }}
                      value={nicheFilter}
                      onChange={(e) => setNicheFilter(e.target.value)}
                    >
                      {NICHE_OPTIONS.map((option) => (
                        <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  {loading && <div className="communities-muted">Loading communities...</div>}
                  {!loading && communities.length === 0 && (
                    <div className="communities-muted">No communities yet.</div>
                  )}
                  <div className="d-grid gap-2">
                    {communities.map((community) => (
                      <button
                        type="button"
                        key={community.id}
                        className={`communities-chip ${selectedCommunityId === community.id ? 'is-active' : ''}`}
                        onClick={() => setSelectedCommunityId(community.id)}
                        style={{ textAlign: 'left' }}
                      >
                        <span>
                          <strong>{community.name}</strong>
                          <small>{community.members_count || 0} members • {community.primary_niche}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="communities-card mt-3">
                  <h2 className="communities-title mb-2">Create community</h2>
                  <form className="d-grid gap-2" onSubmit={handleCreateCommunity}>
                    <input
                      className="form-control"
                      placeholder="Community name"
                      value={newCommunityForm.name}
                      onChange={(e) => setNewCommunityForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Description"
                      value={newCommunityForm.description}
                      onChange={(e) => setNewCommunityForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                    <select
                      className="form-select"
                      value={newCommunityForm.primary_niche}
                      onChange={(e) => setNewCommunityForm((prev) => ({ ...prev, primary_niche: e.target.value }))}
                    >
                      {NICHE_OPTIONS.filter((opt) => opt.value).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <select
                      className="form-select"
                      value={newCommunityForm.visibility}
                      onChange={(e) => setNewCommunityForm((prev) => ({ ...prev, visibility: e.target.value }))}
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                    <button type="submit" className="communities-btn" disabled={savingCommunity}>
                      {savingCommunity ? 'Creating...' : 'Create'}
                    </button>
                  </form>
                </div>
              </div>

              <div className="col-12 col-lg-8">
                <div className="communities-card">
                  {!selectedCommunityFromList && !selectedCommunity && (
                    <div className="communities-muted">Select a community to see details and posts.</div>
                  )}

                  {(selectedCommunity || selectedCommunityFromList) && (
                    <>
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                        <div>
                          <h2 className="profile-section-title mb-0">
                            {selectedCommunity?.name || selectedCommunityFromList?.name || 'Community'}
                          </h2>
                          <div className="communities-subtitle mt-1">
                            {(selectedCommunity?.members_count ?? selectedCommunityFromList?.members_count ?? 0)} members
                            {' • '}
                            {selectedCommunity?.primary_niche || selectedCommunityFromList?.primary_niche}
                            {selectedCommunity?.city || selectedCommunity?.province
                              ? ` • ${[selectedCommunity.city, selectedCommunity.province].filter(Boolean).join(', ')}`
                              : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`communities-btn ${(selectedCommunity?.viewer_membership?.status === 'active') ? 'is-secondary' : ''}`}
                          onClick={handleJoinOrLeave}
                          disabled={!canJoinOrLeave || workingMembership}
                        >
                          {workingMembership
                            ? 'Please wait...'
                            : selectedCommunity?.viewer_membership?.status === 'active'
                            ? 'Leave'
                            : selectedCommunity?.viewer_membership?.status === 'requested'
                            ? 'Requested'
                            : 'Join'}
                        </button>
                      </div>

                      {loadingPosts && <div className="communities-muted mb-3">Loading posts...</div>}

                      <form className="d-grid gap-2 mb-3" onSubmit={handleCreatePost}>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={newPostBody}
                          onChange={(e) => setNewPostBody(e.target.value)}
                          placeholder={canPost ? 'Share something with the community...' : 'Join this community to post'}
                          disabled={!canPost}
                        />
                        <button type="submit" className="communities-btn" disabled={!canPost || posting || !newPostBody.trim()}>
                          {posting ? 'Posting...' : 'Post'}
                        </button>
                      </form>

                      <div className="d-grid gap-3">
                        {posts.length === 0 && (
                          <div className="communities-muted">No posts yet.</div>
                        )}
                        {posts.map((post) => (
                          <div key={post.id} className="community-post-card">
                            <div className="d-flex align-items-start justify-content-between gap-2">
                              <div>
                                <div className="community-post-title">{post.author?.display_name || 'Member'}</div>
                                <div className="community-post-meta">{new Date(post.created_at).toLocaleString()}</div>
                              </div>
                              {(post.is_mine || selectedCommunity?.viewer_membership?.role === 'owner' || selectedCommunity?.viewer_membership?.role === 'admin') && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  disabled={deletingPostId === post.id}
                                  onClick={() => handleDeletePost(post.id)}
                                >
                                  {deletingPostId === post.id ? 'Deleting...' : 'Delete'}
                                </button>
                              )}
                            </div>
                            <div className="community-post-body mt-2">{post.body}</div>
                            {Array.isArray(post.media_urls) && post.media_urls.length > 0 && (
                              <div className="community-post-images mt-2">
                                {post.media_urls.map((url, idx) => (
                                  <img key={`${post.id}-media-${idx}`} src={url} alt="Community post media" />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="community-chat-wrap mt-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h3 className="communities-title mb-0">#{chatChannel?.channel_name || 'general'} Chat</h3>
                          {loadingChat && <span className="communities-muted">Syncing...</span>}
                        </div>
                        <div className="community-chat-list mb-3">
                          {chatMessages.length === 0 && (
                            <div className="communities-muted">No messages yet.</div>
                          )}
                          {chatMessages.map((message) => {
                            const canDeleteMessage = message.is_mine
                              || selectedCommunity?.viewer_membership?.role === 'owner'
                              || selectedCommunity?.viewer_membership?.role === 'admin'
                            return (
                              <div key={message.id} className="community-chat-item">
                                <div className="d-flex align-items-center justify-content-between gap-2">
                                  <div className="community-post-title">{message.sender?.display_name || 'Member'}</div>
                                  {canDeleteMessage && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => handleDeleteChatMessage(message.id)}
                                      disabled={deletingChatMessageId === message.id}
                                    >
                                      {deletingChatMessageId === message.id ? 'Deleting...' : 'Delete'}
                                    </button>
                                  )}
                                </div>
                                <div className="community-post-meta">
                                  {new Date(message.created_at).toLocaleString()} • {message.delivery_status}
                                </div>
                                <div className="community-post-body mt-1">{message.body}</div>
                              </div>
                            )
                          })}
                        </div>
                        <form className="d-grid gap-2" onSubmit={handleSendChatMessage}>
                          <textarea
                            className="form-control"
                            rows={2}
                            value={chatMessageBody}
                            onChange={(e) => setChatMessageBody(e.target.value)}
                            placeholder={canPost ? 'Message #general' : 'Join this community to chat'}
                            disabled={!canPost}
                          />
                          <button type="submit" className="communities-btn" disabled={!canPost || chatBusy || !chatMessageBody.trim()}>
                            {chatBusy ? 'Sending...' : 'Send message'}
                          </button>
                        </form>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
      </main>
    </div>
  )
}

export default Communities

