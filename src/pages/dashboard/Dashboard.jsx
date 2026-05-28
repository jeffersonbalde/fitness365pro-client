import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { apiRequest } from '../../utils/api'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { notifyError } from '../../utils/notifications'
import AppModalTransition from '../../components/AppModalTransition.jsx'
import { AppLoadingState } from '../../components/AppLoadingState.jsx'
import ChallengeProgressHistoryModal from '../../components/profile/ChallengeProgressHistoryModal.jsx'
import { TimelineLinkedEventCallout } from '../../components/profile/TimelineLinkedEventCallout.jsx'
import './Dashboard.css'
import '../profile/Profile.css'

const formatFeedDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatLongDate = (value) => {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

const Dashboard = () => {
  const { client } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [feedItems, setFeedItems] = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedError, setFeedError] = useState('')
  const [postLikeBusyByWorkout, setPostLikeBusyByWorkout] = useState({})
  const [activeCommentsWorkoutId, setActiveCommentsWorkoutId] = useState(null)
  const [commentsLoadingByWorkout, setCommentsLoadingByWorkout] = useState({})
  const [commentsByWorkout, setCommentsByWorkout] = useState({})
  const [commentDraftByWorkout, setCommentDraftByWorkout] = useState({})
  const [replyDraftByComment, setReplyDraftByComment] = useState({})
  const [replyTargetByWorkout, setReplyTargetByWorkout] = useState({})
  const [submittingCommentByWorkout, setSubmittingCommentByWorkout] = useState({})
  const [activeLikesWorkoutId, setActiveLikesWorkoutId] = useState(null)
  const [likesModalLoading, setLikesModalLoading] = useState(false)
  const [likesUsers, setLikesUsers] = useState([])
  const [postImageViewerUrl, setPostImageViewerUrl] = useState('')
  const [togglingFollow, setTogglingFollow] = useState(false)
  const [challengeJournalModal, setChallengeJournalModal] = useState(null)

  const feedItemSortTime = (entry) => {
    const raw = entry?.workout_date || entry?.published_at
    if (!raw) return 0
    const time = new Date(raw).getTime()
    return Number.isFinite(time) ? time : 0
  }

  const mapCmsPostToFeedItem = (post) => ({
    id: post.id,
    entry_type: 'admin_post',
    workout_date: post.published_at || new Date().toISOString(),
    workout_type: post.title || 'Admin Update',
    caption: post.body || '',
    notes: '',
    location: '',
    workout_images: post.image_url ? [post.image_url] : [],
    likes_count: 0,
    comments_count: 0,
    is_liked_by_me: false,
    client_id: post.author?.email || 'admin',
    client: {
      email: post.author?.email || 'admin@fitness365pro.local',
      profile: {
        display_name: post.author?.name || 'Administrator',
        first_name: 'Administrator',
        last_name: '',
        profile_picture_url: null,
      },
    },
  })

  useEffect(() => {
    const fetchData = async () => {
      setFeedLoading(true)
      setFeedError('')
      try {
        const feedParams = new URLSearchParams({
          limit: '25',
          sort: 'chronological',
          scope: 'all',
        })
        const [workoutsResult, cmsResult] = await Promise.allSettled([
          apiRequest(`/v1/workouts/feed?${feedParams.toString()}`, { method: 'GET' }),
          apiRequest('/v1/cms/feed', { method: 'GET' }),
        ])

        const workoutsFeedRes = workoutsResult.status === 'fulfilled' ? workoutsResult.value : null
        const cmsFeedRes = cmsResult.status === 'fulfilled' ? cmsResult.value : null

        const workoutItems = workoutsFeedRes?.data?.success
          ? (workoutsFeedRes.data?.data?.workouts || [])
          : []
        const cmsItems = cmsFeedRes?.data?.success
          ? (cmsFeedRes.data?.data?.posts || []).map(mapCmsPostToFeedItem)
          : []

        const feedErrors = []
        if (workoutsResult.status === 'rejected') {
          feedErrors.push(workoutsResult.reason?.response?.data?.message || 'Workout feed failed.')
        } else if (!workoutsFeedRes?.data?.success) {
          feedErrors.push(workoutsFeedRes?.data?.message || 'Workout feed failed.')
        }
        if (cmsResult.status === 'rejected') {
          feedErrors.push(cmsResult.reason?.response?.data?.message || 'Admin posts failed.')
        } else if (!cmsFeedRes?.data?.success) {
          feedErrors.push(cmsFeedRes?.data?.message || 'Admin posts failed.')
        }

        const mergedItems = [...workoutItems, ...cmsItems].sort((a, b) => feedItemSortTime(b) - feedItemSortTime(a))
        setFeedItems(mergedItems)

        if (mergedItems.length === 0 && feedErrors.length > 0) {
          setFeedError(feedErrors[0])
        }
      } catch (error) {
        console.error('Failed to fetch feed:', error)
        setFeedError(error?.response?.data?.message || 'Could not load feed. Please refresh.')
        setFeedItems([])
      } finally {
        setFeedLoading(false)
      }
    }

    if (client) {
      fetchData()
    } else {
      setFeedLoading(false)
    }
  }, [client])

  const toggleFollow = async (targetClientId, isFollowing) => {
    setTogglingFollow(true)
    try {
      await apiRequest(isFollowing ? '/v1/social/unfollow' : '/v1/social/follow', {
        method: 'POST',
        body: { client_id: targetClientId },
      })

      setLikesUsers((prev) => prev.map((user) => (
        user.id === targetClientId ? { ...user, is_following: !isFollowing } : user
      )))
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to update follow status.')
    } finally {
      setTogglingFollow(false)
    }
  }

  const updateFeedEntry = (entryId, updater) => {
    setFeedItems((prev) => prev.map((entry) => (entry.id === entryId ? updater(entry) : entry)))
  }

  const togglePostLike = async (entry) => {
    if (entry?.entry_type === 'admin_post') return
    if (!entry?.id || postLikeBusyByWorkout[entry.id]) return

    const wasLiked = Boolean(entry.is_liked_by_me)
    const previousCount = Number(entry.likes_count || 0)
    setPostLikeBusyByWorkout((prev) => ({ ...prev, [entry.id]: true }))
    updateFeedEntry(entry.id, (prev) => ({
      ...prev,
      is_liked_by_me: !wasLiked,
      likes_count: Math.max(0, previousCount + (wasLiked ? -1 : 1)),
    }))

    try {
      const response = await apiRequest(`/v1/workouts/${entry.id}/likes`, {
        method: wasLiked ? 'DELETE' : 'POST',
      })
      if (response.data?.success) {
        const data = response.data.data || {}
        updateFeedEntry(entry.id, (prev) => ({
          ...prev,
          is_liked_by_me: Boolean(data.is_liked_by_me),
          likes_count: Number(data.likes_count || 0),
        }))
      }
    } catch (error) {
      updateFeedEntry(entry.id, (prev) => ({
        ...prev,
        is_liked_by_me: wasLiked,
        likes_count: previousCount,
      }))
      notifyError(error?.response?.data?.message || 'Failed to update like.')
    } finally {
      setPostLikeBusyByWorkout((prev) => ({ ...prev, [entry.id]: false }))
    }
  }

  const loadComments = async (workoutId) => {
    setCommentsLoadingByWorkout((prev) => ({ ...prev, [workoutId]: true }))
    try {
      const response = await apiRequest(`/v1/workouts/${workoutId}/comments`, { method: 'GET' })
      if (response.data?.success) {
        const comments = response.data?.data?.comments || []
        const commentsCount = Number(response.data?.data?.comments_count || comments.length || 0)
        setCommentsByWorkout((prev) => ({ ...prev, [workoutId]: comments }))
        updateFeedEntry(workoutId, (entry) => ({ ...entry, comments_count: commentsCount }))
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to load comments.')
    } finally {
      setCommentsLoadingByWorkout((prev) => ({ ...prev, [workoutId]: false }))
    }
  }

  const openCommentsModal = async (workoutId) => {
    const target = feedItems.find((entry) => entry.id === workoutId)
    if (target?.entry_type === 'admin_post') return
    setActiveCommentsWorkoutId(workoutId)
    if (!commentsByWorkout[workoutId]) {
      await loadComments(workoutId)
    }
  }

  const closeCommentsModal = () => {
    setActiveCommentsWorkoutId(null)
  }

  const submitComment = async (workoutId, parentCommentId = null) => {
    const draft = parentCommentId ? (replyDraftByComment[parentCommentId] || '') : (commentDraftByWorkout[workoutId] || '')
    const body = draft.trim()
    if (!body) return
    setSubmittingCommentByWorkout((prev) => ({ ...prev, [workoutId]: true }))
    try {
      const response = await apiRequest(`/v1/workouts/${workoutId}/comments`, {
        method: 'POST',
        body: { body, parent_comment_id: parentCommentId || undefined },
      })
      if (response.data?.success) {
        const newComment = response.data?.data?.comment
        const commentsCount = Number(response.data?.data?.comments_count || 0)
        updateFeedEntry(workoutId, (entry) => ({ ...entry, comments_count: commentsCount }))

        if (newComment) {
          setCommentsByWorkout((prev) => {
            const existing = prev[workoutId] || []
            if (!parentCommentId) {
              return { ...prev, [workoutId]: [...existing, { ...newComment, replies: [] }] }
            }
            const updated = existing.map((comment) => {
              if (comment.id !== parentCommentId) return comment
              return { ...comment, replies: [...(comment.replies || []), newComment] }
            })
            return { ...prev, [workoutId]: updated }
          })
        } else {
          await loadComments(workoutId)
        }

        if (parentCommentId) {
          setReplyDraftByComment((prev) => ({ ...prev, [parentCommentId]: '' }))
          setReplyTargetByWorkout((prev) => ({ ...prev, [workoutId]: null }))
        } else {
          setCommentDraftByWorkout((prev) => ({ ...prev, [workoutId]: '' }))
        }
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to post comment.')
    } finally {
      setSubmittingCommentByWorkout((prev) => ({ ...prev, [workoutId]: false }))
    }
  }

  const openLikesModal = async (workoutId) => {
    const target = feedItems.find((entry) => entry.id === workoutId)
    if (target?.entry_type === 'admin_post') return
    setActiveLikesWorkoutId(workoutId)
    setLikesModalLoading(true)
    setLikesUsers([])
    try {
      const response = await apiRequest(`/v1/workouts/${workoutId}/likes`, { method: 'GET' })
      if (response.data?.success) {
        setLikesUsers(response.data?.data?.likes || [])
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to load likes.')
    } finally {
      setLikesModalLoading(false)
    }
  }

  const closeLikesModal = () => {
    setActiveLikesWorkoutId(null)
    setLikesUsers([])
  }

  const openPostImageViewer = (imageUrl) => {
    if (!imageUrl) return
    setPostImageViewerUrl(imageUrl)
  }

  const closePostImageViewer = () => {
    setPostImageViewerUrl('')
  }

  return (
    <div className={`dashboard-page ${isDark ? 'is-dark' : ''}`}>
      <main className="dashboard-social-main">
        <div className="dashboard-social-feed">
          {feedLoading ? (
            <AppLoadingState compact hint="Loading feed…" className="dashboard-social-feed-loading" />
          ) : feedError ? (
            <div className="dashboard-feed-empty">
              <p>Could not load feed.</p>
              <p className="dashboard-feed-empty-sub">{feedError}</p>
            </div>
          ) : feedItems.length === 0 ? (
            <div className="dashboard-feed-empty">
              <p>No posts yet.</p>
              <p className="dashboard-feed-empty-sub">Workout logs from the community will show up here.</p>
            </div>
          ) : (
            feedItems.map((entry) => {
              const authorName =
                entry?.client?.profile?.display_name ||
                [entry?.client?.profile?.first_name, entry?.client?.profile?.last_name].filter(Boolean).join(' ') ||
                entry?.client?.email ||
                'User'
              const workoutLabel = entry.entry_type === 'post' ? 'Workout Post' : entry.workout_type
              const workoutImages = Array.isArray(entry.workout_images) ? entry.workout_images : []
              const isAdminPost = entry.entry_type === 'admin_post'
              const profileId = isAdminPost ? null : entry.client_id
              const captionText = [entry.caption, entry.notes].filter(Boolean).join(' ').trim()
              const hasStats = !isAdminPost && entry.entry_type !== 'post' &&
                (entry.duration_minutes || entry.distance_km || entry.pace_min_per_km)
              const showLinkedEvent =
                (entry.entry_type || 'workout') === 'workout' &&
                entry.linked_challenge?.title &&
                entry.linked_challenge?.id

              return (
                <article className="dashboard-feed-card" key={entry.id}>
                  <header className="dashboard-feed-card__head">
                    <button
                      type="button"
                      className="dashboard-feed-card__author"
                      onClick={() => profileId && navigate(`/profile/${profileId}`)}
                      disabled={!profileId}
                    >
                      <div className="dashboard-feed-card__avatar">
                        {entry?.client?.profile?.profile_picture_url ? (
                          <img src={resolveMediaUrl(entry.client.profile.profile_picture_url)} alt={authorName} />
                        ) : (
                          <span>{(authorName.charAt(0) || 'U').toUpperCase()}</span>
                        )}
                      </div>
                      <div className="dashboard-feed-card__author-text">
                        <span className="dashboard-feed-card__name">{authorName}</span>
                        <span className="dashboard-feed-card__meta">{workoutLabel}</span>
                      </div>
                    </button>
                    <time className="dashboard-feed-card__time" dateTime={entry.workout_date}>
                      {formatFeedDate(entry.workout_date)}
                    </time>
                  </header>

                  {showLinkedEvent && (
                    <div className="dashboard-feed-card__event">
                      <TimelineLinkedEventCallout
                        title={entry.linked_challenge.title}
                        pendingReview={entry.linked_challenge.review_status === 'pending_review'}
                        onOpen={() =>
                          setChallengeJournalModal({
                            eventId: String(entry.linked_challenge.id),
                            title: entry.linked_challenge.title || '',
                            memberClientId: profileId ? String(profileId) : '',
                            memberDisplayName: authorName,
                          })
                        }
                      />
                    </div>
                  )}

                  {workoutImages.length > 0 && (
                    <div
                      className={`dashboard-feed-card__media ${
                        workoutImages.length === 1 ? 'is-single' : 'is-grid'
                      }`}
                    >
                      {workoutImages.slice(0, 4).map((imageUrl, idx) => (
                        <button
                          key={`${entry.id}-${idx}`}
                          type="button"
                          className="dashboard-feed-card__media-btn"
                          onClick={() => openPostImageViewer(imageUrl)}
                          aria-label="View photo"
                        >
                          <img src={resolveMediaUrl(imageUrl)} alt="" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="dashboard-feed-card__body">
                    {hasStats && (
                      <div className="dashboard-feed-card__stats">
                        {entry.duration_minutes ? <span>{entry.duration_minutes} min</span> : null}
                        {entry.distance_km ? <span>{entry.distance_km} km</span> : null}
                        {entry.pace_min_per_km ? <span>{entry.pace_min_per_km} min/km</span> : null}
                      </div>
                    )}

                    {entry.location && (
                      <p className="dashboard-feed-card__location">{entry.location}</p>
                    )}

                    {captionText && (
                      <p className="dashboard-feed-card__caption">
                        <strong>{authorName}</strong> {captionText}
                      </p>
                    )}

                    {isAdminPost && (
                      <p className="dashboard-feed-card__badge">Official update</p>
                    )}

                    {!isAdminPost && (
                      <footer className="dashboard-feed-card__actions">
                        <button
                          type="button"
                          className={`dashboard-feed-card__action ${entry.is_liked_by_me ? 'is-liked' : ''}`}
                          disabled={Boolean(postLikeBusyByWorkout[entry.id])}
                          onClick={() => togglePostLike(entry)}
                          aria-label={entry.is_liked_by_me ? 'Unlike' : 'Like'}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12.1 21.35 10.55 19.9C5.4 15.14 2 12.01 2 8.2 2 5.07 4.42 2.7 7.4 2.7c1.68 0 3.3.79 4.35 2.04A5.78 5.78 0 0 1 16.1 2.7c2.98 0 5.4 2.37 5.4 5.5 0 3.8-3.4 6.94-8.55 11.72l-1.55 1.43Z" />
                          </svg>
                        </button>
                        {Number(entry.likes_count || 0) > 0 && (
                          <button
                            type="button"
                            className="dashboard-feed-card__count"
                            onClick={() => openLikesModal(entry.id)}
                          >
                            {Number(entry.likes_count)} {Number(entry.likes_count) === 1 ? 'like' : 'likes'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="dashboard-feed-card__action"
                          onClick={() => openCommentsModal(entry.id)}
                          aria-label="Comment"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                          </svg>
                        </button>
                        {Number(entry.comments_count || 0) > 0 && (
                          <button
                            type="button"
                            className="dashboard-feed-card__count is-muted"
                            onClick={() => openCommentsModal(entry.id)}
                          >
                            {Number(entry.comments_count)} {Number(entry.comments_count) === 1 ? 'comment' : 'comments'}
                          </button>
                        )}
                      </footer>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </main>

      <AppModalTransition
        open={Boolean(activeCommentsWorkoutId)}
        onRequestClose={closeCommentsModal}
        backdropClassName="profile-social-modal-backdrop"
        panelClassName="profile-social-modal post-details-modal"
      >
        {(dismiss) =>
          activeCommentsWorkoutId ? (
            <>
              <div className="profile-social-modal-head">
                <div className="profile-social-modal-title">Comments</div>
                <button type="button" className="profile-social-modal-close" onClick={dismiss}>
                  ×
                </button>
              </div>
              <div className="profile-social-modal-body">
              {(() => {
                const activeEntry = feedItems.find((entry) => entry.id === activeCommentsWorkoutId)
                if (!activeEntry) return <div className="timeline-comment-muted">Post not found.</div>
                const activeImages = Array.isArray(activeEntry.workout_images) ? activeEntry.workout_images : []
                return (
                  <div className="post-details-content">
                    <div className="post-details-head">
                      <div>
                        <div className="timeline-title">
                          {activeEntry.entry_type === 'post' ? 'Workout Post' : activeEntry.workout_type}
                        </div>
                        <div className="timeline-meta">{formatLongDate(activeEntry.workout_date)}</div>
                        {(activeEntry.entry_type || 'workout') === 'workout' &&
                          activeEntry.linked_challenge?.title &&
                          activeEntry.linked_challenge?.id && (
                            <TimelineLinkedEventCallout
                              title={activeEntry.linked_challenge.title}
                              pendingReview={activeEntry.linked_challenge.review_status === 'pending_review'}
                              onOpen={() =>
                                setChallengeJournalModal({
                                  eventId: String(activeEntry.linked_challenge.id),
                                  title: activeEntry.linked_challenge.title || '',
                                  memberClientId: activeEntry.client_id ? String(activeEntry.client_id) : '',
                                  memberDisplayName:
                                    activeEntry?.client?.profile?.display_name ||
                                    activeEntry?.client?.email ||
                                    'User',
                                })
                              }
                            />
                          )}
                      </div>
                    </div>
                    {(activeEntry.duration_minutes || activeEntry.distance_km || activeEntry.pace_min_per_km) && (
                      <div className="post-details-metrics">
                        {activeEntry.duration_minutes && <div className="post-details-metric">{activeEntry.duration_minutes} min</div>}
                        {activeEntry.distance_km && <div className="post-details-metric">{activeEntry.distance_km} km</div>}
                        {activeEntry.pace_min_per_km && <div className="post-details-metric">{activeEntry.pace_min_per_km} min/km</div>}
                      </div>
                    )}
                    {activeEntry.location && <div className="timeline-notes">Location: {activeEntry.location}</div>}
                    {activeEntry.caption && <div className="timeline-notes">{activeEntry.caption}</div>}
                    {activeEntry.notes && <div className="timeline-notes">{activeEntry.notes}</div>}
                    {activeImages.length > 0 && (
                      <div className="timeline-images post-details-images">
                        {activeImages.map((imageUrl, index) => (
                          <img
                            key={`${activeEntry.id}-modal-img-${index}`}
                            src={resolveMediaUrl(imageUrl)}
                            alt="Workout log"
                            className="timeline-image-clickable"
                            onClick={() => openPostImageViewer(imageUrl)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openPostImageViewer(imageUrl)
                              }
                            }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="timeline-comment-input-row">
                      <input
                        className="timeline-comment-input"
                        placeholder="Add a comment..."
                        value={commentDraftByWorkout[activeCommentsWorkoutId] || ''}
                        onChange={(event) => {
                          const value = event.target.value
                          setCommentDraftByWorkout((prev) => ({ ...prev, [activeCommentsWorkoutId]: value }))
                        }}
                      />
                      <button
                        type="button"
                        className="timeline-comment-send"
                        disabled={Boolean(submittingCommentByWorkout[activeCommentsWorkoutId])}
                        onClick={() => submitComment(activeCommentsWorkoutId)}
                      >
                        Post
                      </button>
                    </div>
                    {commentsLoadingByWorkout[activeCommentsWorkoutId] ? (
                      <div className="timeline-comment-muted">Loading comments...</div>
                    ) : (
                      <>
                        {(commentsByWorkout[activeCommentsWorkoutId] || []).length === 0 && (
                          <div className="timeline-comment-muted">No comments yet.</div>
                        )}
                        {(commentsByWorkout[activeCommentsWorkoutId] || []).map((comment) => (
                          <div className="timeline-comment-item" key={comment.id}>
                            <button
                              type="button"
                              className="timeline-comment-head timeline-comment-author-link"
                              onClick={() => navigate(`/profile/${comment.author?.id}`)}
                            >
                              <div className="timeline-comment-avatar">
                                {comment.author?.profile_picture_url ? (
                                  <img src={resolveMediaUrl(comment.author.profile_picture_url)} alt={comment.author?.display_name || 'User'} />
                                ) : (
                                  <span>{(comment.author?.display_name || 'U').charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div>
                                <div className="timeline-comment-author">{comment.author?.display_name || 'User'}</div>
                                <div className="timeline-comment-body">{comment.body}</div>
                              </div>
                            </button>
                            <div className="timeline-comment-actions">
                              <button
                                type="button"
                                className="timeline-comment-action"
                                onClick={() => setReplyTargetByWorkout((prev) => ({
                                  ...prev,
                                  [activeCommentsWorkoutId]: prev[activeCommentsWorkoutId] === comment.id ? null : comment.id,
                                }))}
                              >
                                Reply
                              </button>
                            </div>
                            {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                              <div className="dashboard-reply-list">
                                {comment.replies.map((reply) => (
                                  <div className="dashboard-reply-item" key={reply.id}>
                                    <button
                                      type="button"
                                      className="timeline-comment-head timeline-comment-author-link"
                                      onClick={() => navigate(`/profile/${reply.author?.id}`)}
                                    >
                                      <div className="timeline-comment-avatar is-reply">
                                        {reply.author?.profile_picture_url ? (
                                          <img src={resolveMediaUrl(reply.author.profile_picture_url)} alt={reply.author?.display_name || 'User'} />
                                        ) : (
                                          <span>{(reply.author?.display_name || 'U').charAt(0).toUpperCase()}</span>
                                        )}
                                      </div>
                                      <div>
                                        <div className="timeline-comment-author">{reply.author?.display_name || 'User'}</div>
                                        <div className="timeline-comment-body">{reply.body}</div>
                                      </div>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {replyTargetByWorkout[activeCommentsWorkoutId] === comment.id && (
                              <div className="timeline-comment-input-row dashboard-reply-input-row">
                                <input
                                  className="timeline-comment-input"
                                  placeholder={`Reply to ${comment.author?.display_name || 'user'}…`}
                                  value={replyDraftByComment[comment.id] || ''}
                                  onChange={(event) => {
                                    const value = event.target.value
                                    setReplyDraftByComment((prev) => ({ ...prev, [comment.id]: value }))
                                  }}
                                />
                                <button
                                  type="button"
                                  className="timeline-comment-send"
                                  disabled={Boolean(submittingCommentByWorkout[activeCommentsWorkoutId])}
                                  onClick={() => submitComment(activeCommentsWorkoutId, comment.id)}
                                >
                                  Reply
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )
              })()}
            </div>
            </>
          ) : null
        }
      </AppModalTransition>
      <AppModalTransition
        open={Boolean(activeLikesWorkoutId)}
        onRequestClose={closeLikesModal}
        backdropClassName="profile-social-modal-backdrop"
        panelClassName="profile-social-modal"
      >
        {(dismiss) =>
          activeLikesWorkoutId ? (
            <>
              <div className="profile-social-modal-head">
                <div className="profile-social-modal-title">Likes</div>
                <button type="button" className="profile-social-modal-close" onClick={dismiss}>
                  ×
                </button>
              </div>
              <div className="profile-social-modal-body">
              {likesModalLoading && <div className="profile-library-muted">Loading...</div>}
              {!likesModalLoading && likesUsers.length === 0 && <div className="profile-library-muted">No likes yet.</div>}
              {!likesModalLoading && likesUsers.map((item) => (
                <div className="profile-social-user-row likes-user-row" key={item.id}>
                  <button
                    type="button"
                    className="profile-social-user-main profile-social-user-link"
                    onClick={() => {
                      dismiss()
                      navigate(`/profile/${item.id}`)
                    }}
                  >
                    <div className="profile-social-user-avatar">
                      {item.profile_picture_url ? (
                        <img src={resolveMediaUrl(item.profile_picture_url)} alt={item.display_name} />
                      ) : (
                        <span>{(item.display_name || 'U').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className="profile-social-user-name">{item.display_name}</div>
                      <div className="profile-social-user-sub">
                        {[item.city, item.province].filter(Boolean).join(', ') || 'Fitness 365 Pro Member'}
                      </div>
                    </div>
                  </button>
                  {item.is_self ? (
                    <span className="profile-follow-indicator">You</span>
                  ) : (
                    <button
                      type="button"
                      className={`profile-social-follow-btn ${item.is_following ? 'is-secondary' : ''}`}
                      disabled={togglingFollow}
                      onClick={() => toggleFollow(item.id, Boolean(item.is_following))}
                    >
                      {item.is_following ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            </>
          ) : null
        }
      </AppModalTransition>
      <AppModalTransition
        open={Boolean(postImageViewerUrl)}
        onRequestClose={closePostImageViewer}
        backdropClassName="profile-media-viewer-backdrop profile-post-image-backdrop"
        panelClassName="profile-media-viewer profile-post-image-viewer"
      >
        {(dismiss) =>
          postImageViewerUrl ? (
            <>
              <button type="button" className="profile-media-viewer-close" onClick={dismiss}>
                ×
              </button>
              <div className="profile-media-viewer-image-wrap profile-post-image-wrap">
                <img
                  src={resolveMediaUrl(postImageViewerUrl)}
                  alt="Workout attachment preview"
                  className="profile-media-viewer-image is-post"
                />
              </div>
            </>
          ) : null
        }
      </AppModalTransition>
      <ChallengeProgressHistoryModal
        open={Boolean(challengeJournalModal?.eventId)}
        eventId={challengeJournalModal?.eventId || ''}
        eventTitleFallback={challengeJournalModal?.title || ''}
        memberClientId={challengeJournalModal?.memberClientId || ''}
        memberDisplayName={challengeJournalModal?.memberDisplayName || ''}
        resolveMediaUrl={resolveMediaUrl}
        onClosed={() => setChallengeJournalModal(null)}
      />
    </div>
  )
}

export default Dashboard
