import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../../utils/api'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { notifyError } from '../../utils/notifications'
import AppModalTransition from '../../components/AppModalTransition.jsx'
import { AppLoadingState } from '../../components/AppLoadingState.jsx'
import ChallengeProgressHistoryModal from '../../components/profile/ChallengeProgressHistoryModal.jsx'
import ProfileEarnedEventBadges from '../../components/profile/ProfileEarnedEventBadges.jsx'
import ProfileEarnedEventTrophies from '../../components/profile/ProfileEarnedEventTrophies.jsx'
import './Profile.css'
import { ProfileJoinedEventsSection } from '../../components/profile/JoinedChallengeEvents.jsx'
import { TimelineLinkedEventCallout } from '../../components/profile/TimelineLinkedEventCallout.jsx'

const formatLongDate = (value) => {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

const formatPaceMinPerKm = (value) => {
  if (value === null || value === undefined) return 'N/A'
  const num = Number(value)
  if (Number.isNaN(num)) return 'N/A'
  const totalSeconds = Math.round(num * 60)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

const formatExperienceLabel = (value) => {
  if (!value) return null
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const formatNicheLabel = (value) => {
  if (!value || typeof value !== 'string') return null
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const PRIMARY_GOAL_GROUPS = [
  { label: 'Lose Weight', slug: 'lose-weight' },
  { label: 'Gain Muscle', slug: 'build-muscle' },
  { label: 'Running / Cardio', slug: 'improve-cardio' },
  { label: 'General Fitness', slug: 'stay-active' },
]

const UserProfile = () => {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)
  const [workoutStats, setWorkoutStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [socialModalType, setSocialModalType] = useState(null)
  const [socialModalLoading, setSocialModalLoading] = useState(false)
  const [socialUsers, setSocialUsers] = useState([])
  const [togglingFollow, setTogglingFollow] = useState(false)
  const [mediaViewerTarget, setMediaViewerTarget] = useState(null)
  const [postImageViewerUrl, setPostImageViewerUrl] = useState('')
  const [activeCommentsWorkoutId, setActiveCommentsWorkoutId] = useState(null)
  const [commentsLoadingByWorkout, setCommentsLoadingByWorkout] = useState({})
  const [commentsByWorkout, setCommentsByWorkout] = useState({})
  const [commentDraftByWorkout, setCommentDraftByWorkout] = useState({})
  const [replyDraftByComment, setReplyDraftByComment] = useState({})
  const [replyTargetByWorkout, setReplyTargetByWorkout] = useState({})
  const [submittingCommentByWorkout, setSubmittingCommentByWorkout] = useState({})
  const [postLikeBusyByWorkout, setPostLikeBusyByWorkout] = useState({})
  const [commentLikeBusyByComment, setCommentLikeBusyByComment] = useState({})
  const [activeLikesWorkoutId, setActiveLikesWorkoutId] = useState(null)
  const [likesModalLoading, setLikesModalLoading] = useState(false)
  const [likesUsers, setLikesUsers] = useState([])
  const [activeCommentLikesId, setActiveCommentLikesId] = useState(null)
  const [commentLikesLoading, setCommentLikesLoading] = useState(false)
  const [commentLikesUsers, setCommentLikesUsers] = useState([])
  const [challengeJournalModal, setChallengeJournalModal] = useState(null)

  const openChallengeJournalFromUserProfile = (ev) => {
    const eventId = String(ev?.event_id ?? ev?.id ?? '').trim()
    if (!eventId) return
    setChallengeJournalModal({ eventId, title: ev?.title || '' })
  }

  const loadProfile = async () => {
    setLoading(true)
    setLoadError(null)
    setWorkoutStats(null)
    setStatsLoading(false)
    try {
      const response = await apiRequest(`/v1/social/profile/${clientId}`, {
        method: 'GET',
        timeoutMs: 45000,
      })
      if (response.data.success) {
        const payload = response.data.data
        if (payload?.social?.is_self) {
          navigate('/profile', { replace: true })
          return
        }
        setProfileData(payload)
        setLoading(false)

        setStatsLoading(true)
        void apiRequest(`/v1/social/profile/${clientId}/workout-stats`, {
          method: 'GET',
          timeoutMs: 90000,
        })
          .then((statsResponse) => {
            if (statsResponse.data?.success) {
              setWorkoutStats(statsResponse.data.data || null)
            }
          })
          .catch(() => {
            // Progress sidebar is optional; core profile already visible.
          })
          .finally(() => {
            setStatsLoading(false)
          })
        return
      }
    } catch (error) {
      setProfileData(null)
      const message = error?.response?.data?.message || 'Failed to load profile.'
      setLoadError(message)
      notifyError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (clientId) loadProfile()
  }, [clientId])

  const openSocialModal = async (type) => {
    setSocialModalType(type)
    setSocialModalLoading(true)
    setSocialUsers([])
    try {
      const endpoint = type === 'followers'
        ? `/v1/social/profile/${clientId}/followers`
        : `/v1/social/profile/${clientId}/following`
      const response = await apiRequest(endpoint, { method: 'GET' })
      if (response.data.success) {
        setSocialUsers(response.data.data[type] || [])
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to load users.')
    } finally {
      setSocialModalLoading(false)
    }
  }

  const toggleFollow = async (targetClientId, isFollowing) => {
    setTogglingFollow(true)
    try {
      await apiRequest(isFollowing ? '/v1/social/unfollow' : '/v1/social/follow', {
        method: 'POST',
        body: { client_id: targetClientId },
      })

      setSocialUsers((prev) => prev.map((user) => (
        user.id === targetClientId ? { ...user, is_following: !isFollowing } : user
      )))
      setLikesUsers((prev) => prev.map((user) => (
        user.id === targetClientId ? { ...user, is_following: !isFollowing } : user
      )))

      if (profileData?.user?.id === targetClientId) {
        setProfileData((prev) => ({
          ...prev,
          user: { ...prev.user, is_following: !isFollowing },
          social: {
            ...prev.social,
            is_following: !isFollowing,
            followers_count: Math.max(0, (prev.social?.followers_count || 0) + (isFollowing ? -1 : 1)),
          },
        }))
      } else {
        loadProfile()
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to update follow status.')
    } finally {
      setTogglingFollow(false)
    }
  }

  const closeSocialModal = () => {
    setSocialModalType(null)
    setSocialUsers([])
  }

  const openMediaViewer = (target) => {
    const hasImage = target === 'cover' ? Boolean(profileData?.profile?.cover_photo_url) : Boolean(profileData?.profile?.profile_picture_url)
    if (!hasImage) return
    setMediaViewerTarget(target)
  }

  const closeMediaViewer = () => {
    setMediaViewerTarget(null)
  }

  const openPostImageViewer = (imageUrl) => {
    if (!imageUrl) return
    setPostImageViewerUrl(imageUrl)
  }

  const closePostImageViewer = () => {
    setPostImageViewerUrl('')
  }

  const updateTimelineEntry = (entryId, updater) => {
    setProfileData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        timeline: (prev.timeline || []).map((entry) => (entry.id === entryId ? updater(entry) : entry)),
      }
    })
  }

  const togglePostLike = async (entry) => {
    if (!entry?.id || postLikeBusyByWorkout[entry.id]) return

    const wasLiked = Boolean(entry.is_liked_by_me)
    const previousCount = Number(entry.likes_count || 0)
    setPostLikeBusyByWorkout((prev) => ({ ...prev, [entry.id]: true }))
    updateTimelineEntry(entry.id, (prev) => ({
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
        updateTimelineEntry(entry.id, (prev) => ({
          ...prev,
          is_liked_by_me: Boolean(data.is_liked_by_me),
          likes_count: Number(data.likes_count || 0),
        }))
      }
    } catch (error) {
      updateTimelineEntry(entry.id, (prev) => ({
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
        updateTimelineEntry(workoutId, (entry) => ({ ...entry, comments_count: commentsCount }))
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to load comments.')
    } finally {
      setCommentsLoadingByWorkout((prev) => ({ ...prev, [workoutId]: false }))
    }
  }

  const openCommentsModal = async (workoutId) => {
    setActiveCommentsWorkoutId(workoutId)
    if (!commentsByWorkout[workoutId]) {
      await loadComments(workoutId)
    }
  }

  const closeCommentsModal = () => {
    setActiveCommentsWorkoutId(null)
  }

  const openLikesModal = async (workoutId) => {
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

  const openCommentLikesModal = async (commentId) => {
    setActiveCommentLikesId(commentId)
    setCommentLikesLoading(true)
    setCommentLikesUsers([])
    try {
      const response = await apiRequest(`/v1/workout-comments/${commentId}/likes`, { method: 'GET' })
      if (response.data?.success) {
        setCommentLikesUsers(response.data?.data?.likes || [])
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to load comment likes.')
    } finally {
      setCommentLikesLoading(false)
    }
  }

  const closeCommentLikesModal = () => {
    setActiveCommentLikesId(null)
    setCommentLikesUsers([])
  }

  const openCommentAuthorProfile = (authorId) => {
    if (!authorId) return
    navigate(`/profile/${authorId}`)
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
        updateTimelineEntry(workoutId, (entry) => ({ ...entry, comments_count: commentsCount }))

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

  const updateCommentLikeInState = (workoutId, commentId, isReply, parentCommentId, patch) => {
    setCommentsByWorkout((prev) => {
      const comments = prev[workoutId] || []
      const updated = comments.map((comment) => {
        if (!isReply && comment.id === commentId) return { ...comment, ...patch }
        if (isReply && comment.id === parentCommentId) {
          return {
            ...comment,
            replies: (comment.replies || []).map((reply) => (reply.id === commentId ? { ...reply, ...patch } : reply)),
          }
        }
        return comment
      })
      return { ...prev, [workoutId]: updated }
    })
  }

  const toggleCommentLike = async (workoutId, commentId, isLiked, isReply = false, parentCommentId = null) => {
    if (!commentId || commentLikeBusyByComment[commentId]) return
    setCommentLikeBusyByComment((prev) => ({ ...prev, [commentId]: true }))
    try {
      const response = await apiRequest(`/v1/workout-comments/${commentId}/likes`, {
        method: isLiked ? 'DELETE' : 'POST',
      })
      if (response.data?.success) {
        const data = response.data?.data || {}
        updateCommentLikeInState(workoutId, commentId, isReply, parentCommentId, {
          is_liked_by_me: Boolean(data.is_liked_by_me),
          likes_count: Number(data.likes_count || 0),
        })
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to update comment like.')
    } finally {
      setCommentLikeBusyByComment((prev) => ({ ...prev, [commentId]: false }))
    }
  }

  const experienceSummary = useMemo(() => {
    const profile = profileData?.profile
    const chunks = [
      profile?.experience_running ? `Running: ${formatExperienceLabel(profile.experience_running)}` : null,
      profile?.experience_gym ? `PRT/Gym: ${formatExperienceLabel(profile.experience_gym)}` : null,
      profile?.workout_preferences?.experience_biking
        ? `Biking: ${formatExperienceLabel(profile.workout_preferences.experience_biking)}`
        : null,
      profile?.experience_others_title && profile?.experience_others
        ? `${profile.experience_others_title}: ${formatExperienceLabel(profile.experience_others)}`
        : null,
    ].filter(Boolean)
    return chunks.join(' | ')
  }, [profileData])

  if (loading) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center profile-page px-3"
        style={{ minHeight: '100vh' }}
      >
        <AppLoadingState hint="Loading profile…" />
      </div>
    )
  }

  if (!profileData) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center profile-page px-3"
        style={{ minHeight: '100vh' }}
      >
        <div className="text-center" style={{ maxWidth: 420 }}>
          <p className="mb-3">{loadError || 'This profile could not be loaded right now.'}</p>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={loadProfile}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  const profile = profileData?.profile || {}
  const user = profileData?.user || {}
  const social = profileData?.social || {}
  const timeline = profileData?.timeline || []
  const goals = profileData?.goals || []
  const displayName = user.display_name || 'User'
  const locationSummary = [profile?.city, profile?.province, profile?.country].filter(Boolean).join(', ')
  const primaryNicheLabel = formatNicheLabel(profile?.primary_niche)
  const secondaryNicheLabels = Array.isArray(profile?.secondary_niches)
    ? profile.secondary_niches.map(formatNicheLabel).filter(Boolean)
    : []
  const nicheSummary = [primaryNicheLabel, ...secondaryNicheLabels].filter(Boolean).join(', ')
  const displayGoalText = goals.length
    ? goals
        .map((goal) => PRIMARY_GOAL_GROUPS.find((item) => item.slug === goal.slug)?.label || goal.name)
        .join(', ')
    : 'Not set'
  return (
    <>
      <div className="d-flex flex-column profile-page" style={{ minHeight: '100vh' }}>
        <main className="flex-grow-1">
          <div className="container px-3 px-md-4 py-3 py-md-4">
            <div className="profile-hero">
              <div className="profile-cover-stack">
                <div
                  className="profile-cover profile-cover-clickable"
                  onClick={() => openMediaViewer('cover')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openMediaViewer('cover')
                    }
                  }}
                  role="button"
                  tabIndex={profile?.cover_photo_url ? 0 : -1}
                  aria-label="View cover photo"
                >
                  {profile?.cover_photo_url && (
                    <img src={resolveMediaUrl(profile.cover_photo_url)} alt="Cover" className="profile-cover-image" />
                  )}
                </div>
              </div>

            <div className="profile-header-card">
              <div className="profile-header-layout d-flex flex-column flex-md-row align-items-md-end justify-content-between gap-3">
                <div className="profile-header-main d-flex flex-column flex-md-row align-items-md-end gap-3">
                  <div
                    className="profile-avatar-wrap profile-avatar-clickable d-none d-lg-block"
                    onClick={() => openMediaViewer('avatar')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openMediaViewer('avatar')
                      }
                    }}
                    role="button"
                    tabIndex={profile?.profile_picture_url ? 0 : -1}
                    aria-label="View profile photo"
                  >
                    {profile?.profile_picture_url ? (
                      <img src={resolveMediaUrl(profile.profile_picture_url)} alt={displayName} />
                    ) : (
                      <div className="profile-avatar-fallback">{displayName.charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                  <div className="profile-identity">
                    <h1 className="profile-name">{displayName}</h1>
                    <div className="profile-meta">{[profile?.city, profile?.province].filter(Boolean).join(', ') || 'Location not set'}</div>
                    {profile?.bio && <div className="profile-meta mt-1">{profile.bio}</div>}
                    {(primaryNicheLabel || secondaryNicheLabels.length > 0) && (
                      <div className="profile-niche-badges mt-2">
                        {primaryNicheLabel && (
                          <span className="profile-niche-badge">{primaryNicheLabel}</span>
                        )}
                        {secondaryNicheLabels.map((label) => (
                          <span key={label} className="profile-niche-badge is-secondary">{label}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="profile-header-actions">
                  <button
                    type="button"
                    className="profile-action-btn"
                    disabled={togglingFollow}
                    onClick={() => toggleFollow(user.id, Boolean(social.is_following))}
                  >
                    {social.is_following ? 'Unfollow' : 'Follow'}
                  </button>
                </div>
              </div>
            </div>
            <div className="profile-cover-avatar profile-avatar-on-cover" onClick={(e) => e.stopPropagation()} role="presentation">
              <div
                className="profile-avatar-wrap profile-avatar-clickable"
                onClick={() => openMediaViewer('avatar')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openMediaViewer('avatar')
                  }
                }}
                role="button"
                tabIndex={profile?.profile_picture_url ? 0 : -1}
                aria-label="View profile photo"
              >
                {profile?.profile_picture_url ? (
                  <img src={resolveMediaUrl(profile.profile_picture_url)} alt={displayName} />
                ) : (
                  <div className="profile-avatar-fallback">{displayName.charAt(0).toUpperCase()}</div>
                )}
              </div>
            </div>
            </div>

            <div className="row g-3 mt-1">
              <div className="col-12 col-lg-4 profile-left-column">
                <div className="profile-section-card profile-side-card">
                  <div className="profile-side-head">
                    <h2 className="profile-section-title mb-0">Connections</h2>
                  </div>
                  <div className="profile-social-grid profile-social-grid-modern">
                    <button type="button" className="profile-social-item" onClick={() => openSocialModal('following')}>
                      <div className="profile-social-count">{social.following_count || 0}</div>
                      <div className="profile-social-label">Following</div>
                    </button>
                    <button type="button" className="profile-social-item" onClick={() => openSocialModal('followers')}>
                      <div className="profile-social-count">{social.followers_count || 0}</div>
                      <div className="profile-social-label">Followers</div>
                    </button>
                    <div className="profile-social-item profile-social-item--static" aria-label={`${social.activities_count || 0} activities`}>
                      <div className="profile-social-count">{social.activities_count || 0}</div>
                      <div className="profile-social-label">Activities</div>
                    </div>
                  </div>
                  <div className="profile-side-divider" />
                  {statsLoading && (
                    <AppLoadingState compact hint="Loading progress…" className="profile-stats-loading" />
                  )}
                  {workoutStats && (
                    <>
                      <div className="profile-side-head">
                        <h2 className="profile-section-title mb-0">Progress</h2>
                        <div className="profile-section-subtitle">Distance, performance, sessions</div>
                      </div>

                      <div className="profile-my-stats-grid">
                        <div className="profile-my-stat-card">
                          <div className="profile-my-stat-label">Distance Covered</div>
                          <div className="profile-my-stat-value">{workoutStats.total_distance_km ?? 0} km</div>
                        </div>
                        <div className="profile-my-stat-card">
                          <div className="profile-my-stat-label">Avg Performance</div>
                          <div className="profile-my-stat-value">
                            {formatPaceMinPerKm(workoutStats.avg_pace_min_per_km)}
                          </div>
                        </div>
                        <div className="profile-my-stat-card">
                          <div className="profile-my-stat-label">Total Sessions</div>
                          <div className="profile-my-stat-value">{workoutStats.total_runs ?? 0}</div>
                        </div>
                        <div className="profile-my-stat-card">
                          <div className="profile-my-stat-label">Active Streak</div>
                          <div className="profile-my-stat-value">{workoutStats.current_streak ?? 0} days</div>
                        </div>
                      </div>

                      <div className="profile-side-divider" />

                      <ProfileEarnedEventBadges
                        items={workoutStats.event_badges}
                        resolveMediaUrl={resolveMediaUrl}
                        ownerName={displayName}
                        clientId={clientId || ''}
                      />

                      <div className="profile-side-divider" />

                      <ProfileEarnedEventTrophies
                        items={workoutStats.event_trophies}
                        resolveMediaUrl={resolveMediaUrl}
                        ownerName={displayName}
                        clientId={clientId || ''}
                      />

                      <div className="profile-side-divider" />

                      <ProfileJoinedEventsSection
                        variant="sidebar"
                        items={workoutStats.joined_challenge_events}
                        resolveMediaUrl={resolveMediaUrl}
                        emptyHint="This member has no enrolled CMS challenges yet."
                        onOpenChallengeJournal={openChallengeJournalFromUserProfile}
                      />

                      <div className="profile-side-divider" />
                    </>
                  )}
                  <div className="profile-side-head">
                    <h2 className="profile-section-title mb-0">About</h2>
                    <div className="profile-section-subtitle">Profile overview</div>
                  </div>
                  <div className="profile-about-list">
                    <div className="profile-about-row">
                      <span className="profile-about-label">Email</span>
                      <span className="profile-about-value">{user?.email || 'Not set'}</span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Location</span>
                      <span className="profile-about-value">{locationSummary || 'Not set'}</span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Fitness Goals</span>
                      <span className="profile-about-value">{displayGoalText}</span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Training Focus</span>
                      <span className="profile-about-value">{nicheSummary || 'Not set'}</span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Experience</span>
                      <span className="profile-about-value">{experienceSummary || profile?.experience_level || 'Not set'}</span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Workout Days / Week</span>
                      <span className="profile-about-value">
                        {profile?.workout_preferences?.days_per_week ? `${profile.workout_preferences.days_per_week} days` : 'Not set'}
                      </span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Workout Location</span>
                      <span className="profile-about-value">
                        {profile?.workout_preferences?.location
                          ? profile.workout_preferences.location === 'home'
                            ? 'At home'
                            : profile.workout_preferences.location === 'outdoor'
                              ? 'Outdoor'
                              : 'At the gym'
                          : 'Not set'}
                      </span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Food Preference</span>
                      <span className="profile-about-value">
                        {profile?.nutrition_preferences?.primary
                          ? profile.nutrition_preferences.primary.replaceAll('_', ' ')
                          : 'No specific preference'}
                      </span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Date of Birth</span>
                      <span className="profile-about-value">{formatLongDate(profile?.date_of_birth)}</span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Gender</span>
                      <span className="profile-about-value">
                        {profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Not set'}
                      </span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Height</span>
                      <span className="profile-about-value">{profile?.height_cm ? `${profile.height_cm} cm` : 'Not set'}</span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Current Weight</span>
                      <span className="profile-about-value">{profile?.current_weight_kg ? `${profile.current_weight_kg} kg` : 'Not set'}</span>
                    </div>
                    <div className="profile-about-row">
                      <span className="profile-about-label">Target Weight</span>
                      <span className="profile-about-value">{profile?.target_weight_kg ? `${profile.target_weight_kg} kg` : 'Not set'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-8">
                <div className="profile-section-card profile-timeline-panel">
                  <div className="profile-timeline-head">
                    <div className="profile-section-title mb-0">Timeline</div>
                    <div className="profile-timeline-subtitle">Recent workout posts</div>
                  </div>
                  {timeline.length === 0 && (
                    <div className="profile-timeline-empty">No workouts shared yet.</div>
                  )}
                  <div className="d-grid gap-3">
                    {timeline.map((entry) => (
                      <div className="timeline-card" key={entry.id}>
                        <div className="timeline-top-row">
                          <div>
                            <div className="timeline-title">{entry.workout_type}</div>
                            <div className="timeline-meta">{formatLongDate(entry.workout_date)}</div>
                            {(entry.entry_type || 'workout') === 'workout' &&
                              entry.linked_challenge?.title &&
                              entry.linked_challenge?.id && (
                                <TimelineLinkedEventCallout
                                  title={entry.linked_challenge.title}
                                  pendingReview={entry.linked_challenge.review_status === 'pending_review'}
                                  onOpen={() =>
                                    setChallengeJournalModal({
                                      eventId: String(entry.linked_challenge.id),
                                      title: entry.linked_challenge.title || '',
                                    })
                                  }
                                />
                              )}
                          </div>
                        </div>
                        {(entry.duration_minutes || entry.distance_km || entry.pace_min_per_km) && (
                        <div className="timeline-stat-row">
                          {entry.duration_minutes && <div className="timeline-stat">{entry.duration_minutes} min</div>}
                          {entry.distance_km && <div className="timeline-stat">{entry.distance_km} km</div>}
                          {entry.pace_min_per_km && <div className="timeline-stat">{entry.pace_min_per_km} min/km</div>}
                        </div>
                        )}
                        {entry.caption && <div className="timeline-notes">{entry.caption}</div>}
                        {entry.notes && <div className="timeline-notes">{entry.notes}</div>}
                        {Array.isArray(entry.workout_images) && entry.workout_images.length > 0 && (
                          <div className="timeline-images">
                            {entry.workout_images.map((imageUrl, index) => (
                              <img
                                key={`${entry.id}-img-${index}`}
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
                        <div className="timeline-icon-actions">
                          <button
                            type="button"
                            className={`timeline-icon-btn timeline-like-btn ${entry.is_liked_by_me ? 'is-active' : ''}`}
                            disabled={Boolean(postLikeBusyByWorkout[entry.id])}
                            onClick={() => togglePostLike(entry)}
                            aria-label="Like post"
                            title="Like"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12.1 21.35 10.55 19.9C5.4 15.14 2 12.01 2 8.2 2 5.07 4.42 2.7 7.4 2.7c1.68 0 3.3.79 4.35 2.04A5.78 5.78 0 0 1 16.1 2.7c2.98 0 5.4 2.37 5.4 5.5 0 3.8-3.4 6.94-8.55 11.72l-1.55 1.43Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="timeline-icon-stat-btn"
                            onClick={() => openLikesModal(entry.id)}
                          >
                            {entry.likes_count || 0}
                          </button>
                          <button
                            type="button"
                            className={`timeline-icon-btn timeline-comment-open-btn ${activeCommentsWorkoutId === entry.id ? 'is-active' : ''}`}
                            onClick={() => openCommentsModal(entry.id)}
                            aria-label="Open comments"
                            title="Comment"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                            </svg>
                          </button>
                          <div className="timeline-icon-stat">{entry.comments_count || 0}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <AppModalTransition
        open={Boolean(socialModalType)}
        onRequestClose={closeSocialModal}
        backdropClassName="profile-social-modal-backdrop"
        panelClassName="profile-social-modal"
      >
        {(dismiss) =>
          socialModalType ? (
            <>
              <div className="profile-social-modal-head">
                <div className="profile-social-modal-title">{socialModalType === 'followers' ? 'Followers' : 'Following'}</div>
                <button type="button" className="profile-social-modal-close" onClick={dismiss}>
                  ×
                </button>
              </div>
              <div className="profile-social-modal-body">
              {socialModalLoading && <div className="profile-library-muted">Loading...</div>}
              {!socialModalLoading && socialUsers.length === 0 && <div className="profile-library-muted">No users found.</div>}
              {!socialModalLoading && socialUsers.map((item) => (
                <div className="profile-social-user-row" key={item.id}>
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
                  <button
                    type="button"
                    className={`profile-social-follow-btn ${item.is_following ? 'is-secondary' : ''}`}
                    disabled={togglingFollow}
                    onClick={() => toggleFollow(item.id, Boolean(item.is_following))}
                  >
                    {item.is_following ? 'Unfollow' : 'Follow'}
                  </button>
                </div>
              ))}
            </div>
            </>
          ) : null
        }
      </AppModalTransition>
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
                <div className="profile-social-modal-title">Post details</div>
                <button type="button" className="profile-social-modal-close" onClick={dismiss}>
                  ×
                </button>
              </div>
              <div className="profile-social-modal-body">
              {(() => {
                const activeEntry = timeline.find((entry) => entry.id === activeCommentsWorkoutId)
                if (!activeEntry) return <div className="timeline-comment-muted">Post not found.</div>
                return (
                  <div className="post-details-content">
                    <div className="post-details-head">
                      <div>
                        <div className="timeline-title">{activeEntry.workout_type}</div>
                        <div className="timeline-meta">{activeEntry.workout_date ? formatLongDate(activeEntry.workout_date) : 'Unknown date'}</div>
                      </div>
                    </div>
                    {(activeEntry.duration_minutes || activeEntry.distance_km || activeEntry.pace_min_per_km) && (
                      <div className="post-details-metrics">
                        {activeEntry.duration_minutes && <div className="post-details-metric">{activeEntry.duration_minutes} min</div>}
                        {activeEntry.distance_km && <div className="post-details-metric">{activeEntry.distance_km} km</div>}
                        {activeEntry.pace_min_per_km && <div className="post-details-metric">{activeEntry.pace_min_per_km} min/km</div>}
                      </div>
                    )}
                    {activeEntry.notes && <div className="timeline-notes">{activeEntry.notes}</div>}
                    {Array.isArray(activeEntry.workout_images) && activeEntry.workout_images.length > 0 && (
                      <div className="timeline-images post-details-images">
                        {activeEntry.workout_images.map((imageUrl, index) => (
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
                        value={commentDraftByWorkout[activeEntry.id] || ''}
                        onChange={(event) => {
                          const value = event.target.value
                          setCommentDraftByWorkout((prev) => ({ ...prev, [activeEntry.id]: value }))
                        }}
                      />
                      <button
                        type="button"
                        className="timeline-comment-send"
                        disabled={Boolean(submittingCommentByWorkout[activeEntry.id])}
                        onClick={() => submitComment(activeEntry.id)}
                      >
                        Post
                      </button>
                    </div>
                    {commentsLoadingByWorkout[activeEntry.id] ? (
                      <div className="timeline-comment-muted">Loading comments...</div>
                    ) : (
                      <>
                        {(commentsByWorkout[activeEntry.id] || []).length === 0 && (
                          <div className="timeline-comment-muted">No comments yet.</div>
                        )}
                        {(commentsByWorkout[activeEntry.id] || []).map((comment) => (
                          <div className="timeline-comment-item" key={comment.id}>
                            <button
                              type="button"
                              className="timeline-comment-head timeline-comment-author-link"
                              onClick={() => openCommentAuthorProfile(comment.author?.id)}
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
                                className={`timeline-comment-like-btn ${comment.is_liked_by_me ? 'is-active' : ''}`}
                                disabled={Boolean(commentLikeBusyByComment[comment.id])}
                                onClick={() => toggleCommentLike(activeEntry.id, comment.id, Boolean(comment.is_liked_by_me))}
                                aria-label="Like comment"
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.1 21.35 10.55 19.9C5.4 15.14 2 12.01 2 8.2 2 5.07 4.42 2.7 7.4 2.7c1.68 0 3.3.79 4.35 2.04A5.78 5.78 0 0 1 16.1 2.7c2.98 0 5.4 2.37 5.4 5.5 0 3.8-3.4 6.94-8.55 11.72l-1.55 1.43Z" /></svg>
                              </button>
                              {Boolean(comment.likes_count) && (
                                <button
                                  type="button"
                                  className="timeline-comment-like-count-btn"
                                  onClick={() => openCommentLikesModal(comment.id)}
                                >
                                  {comment.likes_count}
                                </button>
                              )}
                              <button
                                type="button"
                                className="timeline-comment-action"
                                onClick={() => setReplyTargetByWorkout((prev) => ({
                                  ...prev,
                                  [activeEntry.id]: prev[activeEntry.id] === comment.id ? null : comment.id,
                                }))}
                              >
                                Reply
                              </button>
                            </div>
                            {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                              <div className="timeline-reply-list">
                                {comment.replies.map((reply) => (
                                  <div className="timeline-reply-item" key={reply.id}>
                                    <button
                                      type="button"
                                      className="timeline-comment-head timeline-comment-author-link"
                                      onClick={() => openCommentAuthorProfile(reply.author?.id)}
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
                                    <div className="timeline-comment-actions">
                                      <button
                                        type="button"
                                        className={`timeline-comment-like-btn ${reply.is_liked_by_me ? 'is-active' : ''}`}
                                        disabled={Boolean(commentLikeBusyByComment[reply.id])}
                                        onClick={() => toggleCommentLike(activeEntry.id, reply.id, Boolean(reply.is_liked_by_me), true, comment.id)}
                                        aria-label="Like reply"
                                      >
                                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.1 21.35 10.55 19.9C5.4 15.14 2 12.01 2 8.2 2 5.07 4.42 2.7 7.4 2.7c1.68 0 3.3.79 4.35 2.04A5.78 5.78 0 0 1 16.1 2.7c2.98 0 5.4 2.37 5.4 5.5 0 3.8-3.4 6.94-8.55 11.72l-1.55 1.43Z" /></svg>
                                      </button>
                                      {Boolean(reply.likes_count) && (
                                        <button
                                          type="button"
                                          className="timeline-comment-like-count-btn"
                                          onClick={() => openCommentLikesModal(reply.id)}
                                        >
                                          {reply.likes_count}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {replyTargetByWorkout[activeEntry.id] === comment.id && (
                              <div className="timeline-comment-input-row timeline-reply-input-row">
                                <input
                                  className="timeline-comment-input"
                                  placeholder={`Add a reply to ${comment.author?.display_name || 'user'}...`}
                                  value={replyDraftByComment[comment.id] || ''}
                                  onChange={(event) => {
                                    const value = event.target.value
                                    setReplyDraftByComment((prev) => ({ ...prev, [comment.id]: value }))
                                  }}
                                />
                                <button
                                  type="button"
                                  className="timeline-comment-send"
                                  disabled={Boolean(submittingCommentByWorkout[activeEntry.id])}
                                  onClick={() => submitComment(activeEntry.id, comment.id)}
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
                <div className="profile-social-modal-title">People who liked this post</div>
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
        open={Boolean(activeCommentLikesId)}
        onRequestClose={closeCommentLikesModal}
        backdropClassName="profile-social-modal-backdrop"
        panelClassName="profile-social-modal"
      >
        {(dismiss) =>
          activeCommentLikesId ? (
            <>
              <div className="profile-social-modal-head">
                <div className="profile-social-modal-title">People who liked this comment</div>
                <button type="button" className="profile-social-modal-close" onClick={dismiss}>
                  ×
                </button>
              </div>
              <div className="profile-social-modal-body">
              {commentLikesLoading && <div className="profile-library-muted">Loading...</div>}
              {!commentLikesLoading && commentLikesUsers.length === 0 && <div className="profile-library-muted">No likes yet.</div>}
              {!commentLikesLoading && commentLikesUsers.map((item) => (
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
                      onClick={() => {
                        toggleFollow(item.id, !!item.is_following)
                        setCommentLikesUsers((prev) => prev.map((user) => (
                          user.id === item.id ? { ...user, is_following: !item.is_following } : user
                        )))
                      }}
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
        open={Boolean(mediaViewerTarget)}
        onRequestClose={closeMediaViewer}
        backdropClassName="profile-media-viewer-backdrop"
        panelClassName="profile-media-viewer"
      >
        {(dismiss) =>
          mediaViewerTarget ? (
            <>
              <button
                type="button"
                className="profile-media-viewer-close"
                onClick={dismiss}
                aria-label="Close preview"
              >
                ×
              </button>
              <div className="profile-media-viewer-image-wrap">
                <img
                  src={resolveMediaUrl(
                    mediaViewerTarget === 'cover' ? profile?.cover_photo_url : profile?.profile_picture_url
                  )}
                  alt={mediaViewerTarget === 'cover' ? 'Cover preview' : 'Profile preview'}
                  className="profile-media-viewer-image is-cover"
                />
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
              <button
                type="button"
                className="profile-media-viewer-close"
                onClick={dismiss}
                aria-label="Close image preview"
              >
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
        memberClientId={clientId}
        memberDisplayName={profileData?.user?.display_name || ''}
        resolveMediaUrl={resolveMediaUrl}
        onClosed={() => setChallengeJournalModal(null)}
      />
    </>
  )
}

export default UserProfile
