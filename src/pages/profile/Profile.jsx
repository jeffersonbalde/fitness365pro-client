import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { apiRequest } from '../../utils/api'
import { setCachedProfilePictureUrl } from '../../utils/profileCache'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { notifyError, notifySuccess } from '../../utils/notifications'
import { trackEvent } from '../../utils/telemetry'
import { CountryDropdown, RegionDropdown } from 'react-country-region-selector'
import AppModalTransition from '../../components/AppModalTransition.jsx'
import { AppLoadingState } from '../../components/AppLoadingState.jsx'
import './Profile.css'
import ChallengeProgressHistoryModal from '../../components/profile/ChallengeProgressHistoryModal.jsx'
import ProfileEarnedEventBadges from '../../components/profile/ProfileEarnedEventBadges.jsx'
import ProfileEarnedEventTrophies from '../../components/profile/ProfileEarnedEventTrophies.jsx'
import { ProfileJoinedEventsSection } from '../../components/profile/JoinedChallengeEvents.jsx'
import { TimelineLinkedEventCallout } from '../../components/profile/TimelineLinkedEventCallout.jsx'
import { isJoinedChallengeGoalCompleted } from '../challenges/eventCatalog'
import {
  isAcceptableWorkoutImageFile,
  WORKOUT_IMAGE_ACCEPT,
  PROFILE_IMAGE_ACCEPT,
  MAX_PROFILE_IMAGE_BYTES,
  MAX_COVER_IMAGE_BYTES,
  validateProfileImageFile,
  getProfileUploadErrorMessage,
  resolveUploadFilename,
} from '../../utils/workoutImages'
import {
  cmToFeetInches,
  feetInchesToCm,
  formatHeightFtIn,
  validateHeightFeetInches,
} from '../../utils/height'
import WorkoutMetricsFields from '../../components/workout/WorkoutMetricsFields'
import {
  totalSecondsToDurationMinutes,
  totalSecondsToHms,
  validateWorkoutHms,
} from '../../utils/workoutDuration'

const formatLongDate = (value) => {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const normalizeDateInput = (value) => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()

  // yyyy-mm-dd (native date input format)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  // mm/dd/yyyy fallback
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (slashMatch) {
    const mm = slashMatch[1].padStart(2, '0')
    const dd = slashMatch[2].padStart(2, '0')
    return `${slashMatch[3]}-${mm}-${dd}`
  }

  return null
}

const formatExperienceLabel = (value) => {
  if (!value) return null
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const formatPaceMinPerKm = (value) => {
  if (value === null || value === undefined) return 'N/A'
  const num = Number(value)
  if (Number.isNaN(num)) return 'N/A'

  // Value is "minutes per km" (e.g. 5.75 => 5:45).
  const totalSeconds = Math.round(num * 60)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
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

const PRIMARY_NICHE_OPTIONS = [
  { value: 'running', label: 'Running' },
  { value: 'gym', label: 'Gym' },
  { value: 'biking', label: 'Biking' },
]

const DISCOVER_NICHE_OPTIONS = [
  { value: '', label: 'All niches' },
  { value: 'running', label: 'Running' },
  { value: 'gym', label: 'Gym' },
  { value: 'biking', label: 'Biking' },
  { value: 'hybrid', label: 'Hybrid' },
]

const Profile = () => {
  const { client } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [selectedGoalIds, setSelectedGoalIds] = useState([])
  const [profileGoals, setProfileGoals] = useState([])
  const [goalOptions, setGoalOptions] = useState([])
  const [socialStats, setSocialStats] = useState({
    following_count: 0,
    followers_count: 0,
    activities_count: 0,
  })
  const [myStats, setMyStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [secondaryLoading, setSecondaryLoading] = useState(true)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [, setUploadingCover] = useState(false) // setter used in cover upload flow; value not needed in UI
  const [mediaViewerTarget, setMediaViewerTarget] = useState(null)
  const [postImageViewerUrl, setPostImageViewerUrl] = useState('')
  const [removingMedia, setRemovingMedia] = useState(false)
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [mediaLibrary, setMediaLibrary] = useState([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [selectedLibraryImage, setSelectedLibraryImage] = useState('')
  const [socialModalType, setSocialModalType] = useState(null)
  const [socialModalLoading, setSocialModalLoading] = useState(false)
  const [socialUsers, setSocialUsers] = useState([])
  const [discoverQuery, setDiscoverQuery] = useState('')
  const [discoverNiche, setDiscoverNiche] = useState('')
  const [suggestedBuddies, setSuggestedBuddies] = useState([])
  const [suggestedBuddiesLoading, setSuggestedBuddiesLoading] = useState(false)
  const [suggestedFollowBusyById, setSuggestedFollowBusyById] = useState({})
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [savingProfileEdit, setSavingProfileEdit] = useState(false)
  const [profileEditErrors, setProfileEditErrors] = useState({})
  const [profileEditForm, setProfileEditForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    height_feet: '',
    height_inches: '',
    current_weight_kg: '',
    target_weight_kg: '',
    city: '',
    province: '',
    country: '',
    workout_days_per_week: '',
    workout_location: '',
    food_preference: '',
    experience_level: '',
    experience_running: '',
    experience_gym: '',
    experience_biking: '',
    experience_others_title: '',
    experience_others: '',
    primary_niche: 'gym',
  })
  const [editingWorkout, setEditingWorkout] = useState(null)
  const [linkedWorkoutChallengeId, setLinkedWorkoutChallengeId] = useState('')
  const [editForm, setEditForm] = useState({
    workout_type: '',
    workout_date: '',
    duration_hours: '',
    duration_minutes: '',
    duration_seconds: '',
    distance_km: '',
    notes: '',
  })
  const [savingWorkoutEdit, setSavingWorkoutEdit] = useState(false)
  const [deletingWorkoutId, setDeletingWorkoutId] = useState(null)
  const [timelineMenuOpenId, setTimelineMenuOpenId] = useState(null)
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
  const [deleteWorkoutTarget, setDeleteWorkoutTarget] = useState(null)
  const [editExistingImages, setEditExistingImages] = useState([])
  const [editNewImages, setEditNewImages] = useState([])
  const [editNewImagePreviews, setEditNewImagePreviews] = useState([])
  const [challengeJournalModal, setChallengeJournalModal] = useState(null)
  const lastGoalToastAtRef = useRef(0)
  const workoutEditImageInputRef = useRef(null)
  const profilePhotoInputRef = useRef(null)
  const coverPhotoInputRef = useRef(null)

  const workoutEditJoinedEvents = useMemo(() => {
    const base = Array.isArray(myStats?.joined_challenge_events)
      ? [...myStats.joined_challenge_events]
      : []
    const lid = editingWorkout?.linked_challenge?.id
    if (lid && !base.some((r) => String(r.event_id) === String(lid))) {
      base.push({
        event_id: String(lid),
        title: editingWorkout.linked_challenge.title || 'Linked challenge',
        progress_goal_km: null,
      })
    }
    return base
  }, [
    editingWorkout?.linked_challenge?.id,
    editingWorkout?.linked_challenge?.title,
    myStats?.joined_challenge_events,
  ])

  const workoutEditSelectableEvents = useMemo(() => {
    const lid = editingWorkout?.linked_challenge?.id ? String(editingWorkout.linked_challenge.id) : ''
    return workoutEditJoinedEvents.filter((ev) => {
      const id = String(ev.event_id)
      if (lid && id === lid) return true
      return !isJoinedChallengeGoalCompleted(ev)
    })
  }, [workoutEditJoinedEvents, editingWorkout?.linked_challenge?.id])

  const modalGoalOptions = PRIMARY_GOAL_GROUPS
    .map((group) => {
      const goal = goalOptions.find((item) => item.slug === group.slug)
      if (!goal) return null
      return { ...goal, uiLabel: group.label }
    })
    .filter(Boolean)

  const displayGoalText = profileGoals.length > 0
    ? profileGoals
        .map((goal) => PRIMARY_GOAL_GROUPS.find((item) => item.slug === goal.slug)?.label || goal.name)
        .join(', ')
    : 'Not set'

  const notifyGoalLimitOnce = (message) => {
    const now = Date.now()
    if (now - lastGoalToastAtRef.current < 1200) return
    lastGoalToastAtRef.current = now
    notifyError(message)
  }

  useEffect(() => {
    if (!client) return undefined

    let cancelled = false

    const fetchProfileData = async () => {
      setLoading(true)
      setSecondaryLoading(true)
      setSuggestedBuddiesLoading(true)
      try {
        const [
          profileResponse,
          workoutsResponse,
          socialStatsResponse,
          goalsResponse,
          suggestedResponse,
          statsResponse,
        ] = await Promise.all([
          apiRequest('/v1/profile', { method: 'GET' }),
          apiRequest('/v1/workouts?limit=20', { method: 'GET' }),
          apiRequest('/v1/social/stats', { method: 'GET' }),
          apiRequest('/v1/onboarding/goals', { method: 'GET' }),
          apiRequest('/v1/social/suggested-buddies?per_page=6', { method: 'GET' }),
          apiRequest('/v1/workouts/stats', { method: 'GET' }),
        ])

        if (cancelled) return

        if (profileResponse.data.success) {
          const profileData = profileResponse.data.data.profile
          setProfile(profileData)
          setCachedProfilePictureUrl(client.id, profileData?.profile_picture_url || '')
          const goals = profileResponse.data.data.goals || []
          setProfileGoals(goals)
          setSelectedGoalIds(goals.map((goal) => goal.id))
        }
        if (goalsResponse.data.success) {
          setGoalOptions(goalsResponse.data.data.goals || [])
        }
        if (workoutsResponse.data.success) {
          setTimeline(workoutsResponse.data.data.workouts || [])
        }
        if (socialStatsResponse.data.success) {
          setSocialStats(socialStatsResponse.data.data || socialStats)
        }
        if (suggestedResponse.data.success) {
          setSuggestedBuddies(suggestedResponse.data.data?.results || [])
        }
        if (statsResponse?.data?.success) {
          setMyStats(statsResponse.data.data || null)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch profile/timeline:', error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setSecondaryLoading(false)
          setSuggestedBuddiesLoading(false)
        }
      }
    }

    fetchProfileData()

    return () => {
      cancelled = true
    }
  }, [client])

  const refreshSuggestedBuddies = async () => {
    setSuggestedBuddiesLoading(true)
    try {
      const response = await apiRequest('/v1/social/suggested-buddies?per_page=6', { method: 'GET' })
      if (response.data.success) {
        setSuggestedBuddies(response.data.data?.results || [])
      }
    } catch (error) {
      console.error('Failed to refresh suggested buddies:', error)
    } finally {
      setSuggestedBuddiesLoading(false)
    }
  }

  useEffect(() => {
    if (!timelineMenuOpenId) return
    const handleClickOutside = (event) => {
      if (!event.target.closest('.timeline-post-menu')) {
        setTimelineMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [timelineMenuOpenId])

  useEffect(() => {
    const objectUrls = editNewImages.map((file) => URL.createObjectURL(file))
    setEditNewImagePreviews(objectUrls)

    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [editNewImages])

  const refreshProfile = async () => {
    try {
      const response = await apiRequest('/v1/profile', { method: 'GET' })
      if (response.data.success) {
        const profileData = response.data.data.profile
        setProfile(profileData)
        if (client?.id) {
          setCachedProfilePictureUrl(client.id, profileData?.profile_picture_url || '')
        }
        const goals = response.data.data.goals || []
        setProfileGoals(goals)
        setSelectedGoalIds(goals.map((goal) => goal.id))
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error)
    }
  }

  const refreshSocialStats = async () => {
    try {
      const response = await apiRequest('/v1/social/stats', { method: 'GET' })
      if (response.data.success) {
        setSocialStats(response.data.data || socialStats)
      }
    } catch (error) {
      console.error('Failed to refresh social stats:', error)
    }
  }

  const refreshMyStats = async () => {
    try {
      const response = await apiRequest('/v1/workouts/stats', { method: 'GET' })
      if (response.data?.success) {
        setMyStats(response.data.data || null)
      }
    } catch (error) {
      console.error('Failed to refresh my stats:', error)
    }
  }

  const openChallengeJournalFromProfile = (ev) => {
    const eventId = String(ev?.event_id ?? ev?.id ?? '').trim()
    if (!eventId) return
    setChallengeJournalModal({ eventId, title: ev?.title || '' })
  }

  const openProfileEditModal = () => {
    setProfileEditErrors({})
    const { feet, inches } = cmToFeetInches(profile?.height_cm)
    setProfileEditForm({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      date_of_birth: profile?.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '',
      gender: profile?.gender || '',
      height_feet: feet,
      height_inches: inches,
      current_weight_kg: profile?.current_weight_kg || '',
      target_weight_kg: profile?.target_weight_kg || '',
      city: profile?.city || '',
      province: profile?.province || '',
      country: profile?.country || '',
      workout_days_per_week: profile?.workout_preferences?.days_per_week || '',
      workout_location: profile?.workout_preferences?.location || '',
      food_preference: profile?.nutrition_preferences?.primary || '',
      experience_level: profile?.experience_level || '',
      experience_running: profile?.experience_running || '',
      experience_gym: profile?.experience_gym || '',
      experience_biking: profile?.workout_preferences?.experience_biking || '',
      experience_others_title: profile?.experience_others_title || '',
      experience_others: profile?.experience_others || '',
      primary_niche: PRIMARY_NICHE_OPTIONS.some((option) => option.value === profile?.primary_niche)
        ? profile.primary_niche
        : 'gym',
    })
    const allowedSlugs = PRIMARY_GOAL_GROUPS.map((item) => item.slug)
    const currentGoalIds = Array.isArray(profileGoals)
      ? profileGoals.filter((goal) => allowedSlugs.includes(goal.slug)).map((goal) => goal.id)
      : []
    setSelectedGoalIds(currentGoalIds)
    setProfileEditOpen(true)
  }

  const closeProfileEditModal = () => {
    if (savingProfileEdit) return
    setProfileEditOpen(false)
  }

  const handleProfileEditChange = (e) => {
    const { name, value } = e.target
    setProfileEditForm((prev) => ({ ...prev, [name]: value }))
    if (profileEditErrors[name]) {
      setProfileEditErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
    if ((name === 'height_feet' || name === 'height_inches') && profileEditErrors.height) {
      setProfileEditErrors((prev) => {
        const next = { ...prev }
        delete next.height
        return next
      })
    }
  }

  const handleProfileCountryChange = (value) => {
    setProfileEditForm((prev) => ({
      ...prev,
      country: value,
      province: '',
    }))
    setProfileEditErrors((prev) => {
      const next = { ...prev }
      delete next.country
      delete next.province
      return next
    })
  }

  const handleProfileProvinceChange = (value) => {
    setProfileEditForm((prev) => ({ ...prev, province: value }))
    if (profileEditErrors.province) {
      setProfileEditErrors((prev) => {
        const next = { ...prev }
        delete next.province
        return next
      })
    }
  }

  const handlePrimaryNicheSelect = (value) => {
    setProfileEditForm((prev) => ({ ...prev, primary_niche: value || 'gym' }))
    if (profileEditErrors.primary_niche) {
      setProfileEditErrors((prev) => {
        const next = { ...prev }
        delete next.primary_niche
        return next
      })
    }
  }

  const submitProfileEdit = async (e) => {
    e.preventDefault()
    setSavingProfileEdit(true)
    setProfileEditErrors({})

    try {
      if (!selectedGoalIds.length) {
        notifyError('Please select at least 1 fitness goal.')
        setSavingProfileEdit(false)
        return
      }
      if (selectedGoalIds.length > 3) {
        notifyGoalLimitOnce('You can select up to 3 fitness goals only.')
        setSavingProfileEdit(false)
        return
      }
      if (!profileEditForm.country) {
        setProfileEditErrors((prev) => ({ ...prev, country: 'Country is required.' }))
        notifyError('Country is required.')
        setSavingProfileEdit(false)
        return
      }
      if (!profileEditForm.province) {
        setProfileEditErrors((prev) => ({ ...prev, province: 'Region / State / Province is required.' }))
        notifyError('Region / State / Province is required.')
        setSavingProfileEdit(false)
        return
      }
      if (!profileEditForm.workout_days_per_week) {
        setProfileEditErrors((prev) => ({ ...prev, workout_days_per_week: 'Workout days per week is required.' }))
        notifyError('Workout days per week is required.')
        setSavingProfileEdit(false)
        return
      }
      if (!profileEditForm.workout_location) {
        setProfileEditErrors((prev) => ({ ...prev, workout_location: 'Workout location is required.' }))
        notifyError('Where do you usually work out is required.')
        setSavingProfileEdit(false)
        return
      }
      if (profileEditForm.primary_niche === 'running' && !profileEditForm.experience_running) {
        setProfileEditErrors((prev) => ({ ...prev, experience_running: 'Running experience is required.' }))
        notifyError('Running experience is required.')
        setSavingProfileEdit(false)
        return
      }
      if (profileEditForm.primary_niche === 'gym' && !profileEditForm.experience_gym) {
        setProfileEditErrors((prev) => ({ ...prev, experience_gym: 'PRT/Gym workout experience is required.' }))
        notifyError('PRT/Gym workout experience is required.')
        setSavingProfileEdit(false)
        return
      }
      if (profileEditForm.primary_niche === 'biking' && !profileEditForm.experience_biking) {
        setProfileEditErrors((prev) => ({ ...prev, experience_biking: 'Biking experience is required.' }))
        notifyError('Biking experience is required.')
        setSavingProfileEdit(false)
        return
      }
      const hasOthersTitle = profileEditForm.experience_others_title.trim().length > 0
      const hasOthersLevel = Boolean(profileEditForm.experience_others)
      if (hasOthersLevel && !hasOthersTitle) {
        setProfileEditErrors((prev) => ({ ...prev, experience_others_title: 'Please enter the activity title.' }))
        notifyError('Please enter the activity title.')
        setSavingProfileEdit(false)
        return
      }

      const hasHeight = profileEditForm.height_feet !== '' || profileEditForm.height_inches !== ''
      const heightError = validateHeightFeetInches(
        profileEditForm.height_feet,
        profileEditForm.height_inches,
        { required: false },
      )
      if (heightError) {
        setProfileEditErrors((prev) => ({ ...prev, height: heightError }))
        notifyError(heightError)
        setSavingProfileEdit(false)
        return
      }

      const payload = {
        ...profileEditForm,
        first_name: profileEditForm.first_name.trim(),
        last_name: profileEditForm.last_name.trim(),
        city: profileEditForm.city.trim(),
        province: profileEditForm.province.trim(),
        country: profileEditForm.country.trim(),
        date_of_birth: profileEditForm.date_of_birth || null,
        height_cm: hasHeight
          ? feetInchesToCm(profileEditForm.height_feet, profileEditForm.height_inches)
          : null,
        workout_preferences: {
          days_per_week: profileEditForm.workout_days_per_week,
          location: profileEditForm.workout_location,
          experience_biking: profileEditForm.experience_biking || null,
        },
        nutrition_preferences: {
          primary: profileEditForm.food_preference || null,
        },
        primary_niche: profileEditForm.primary_niche || 'gym',
        experience_running: profileEditForm.experience_running || null,
        experience_gym: profileEditForm.experience_gym || null,
        experience_others_title: profileEditForm.experience_others_title.trim() || null,
        experience_others: profileEditForm.experience_others || null,
      }

      delete payload.height_feet
      delete payload.height_inches

      if (payload.date_of_birth) {
        const normalizedDob = normalizeDateInput(payload.date_of_birth)
        if (!normalizedDob) {
          notifyError('Please provide a valid date of birth.')
          setSavingProfileEdit(false)
          return
        }
        const now = new Date()
        const todayLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
        if (normalizedDob >= todayLocal) {
          notifyError('Date of birth must be before today.')
          setSavingProfileEdit(false)
          return
        }
        payload.date_of_birth = normalizedDob
      }

      const response = await apiRequest('/v1/profile', {
        method: 'PUT',
        body: payload,
      })

      if (response.data.success) {
        const goalsResponse = await apiRequest('/v1/profile/goals', {
          method: 'PUT',
          body: { goals: selectedGoalIds },
        })
        if (goalsResponse.data.success) {
          setProfileGoals(goalsResponse.data.data.goals || [])
        }
        trackEvent('niche_selected', {
          primary_niche: payload.primary_niche || null,
          secondary_niches_count: 0,
        })
        notifySuccess('Profile updated successfully.', { icon: false })
        await refreshProfile()
        setProfileEditOpen(false)
      }
    } catch (error) {
      const apiErrors = error?.response?.data?.errors || {}
      const formattedErrors = {}
      Object.keys(apiErrors).forEach((key) => {
        const value = apiErrors[key]
        formattedErrors[key] = Array.isArray(value) ? value[0] : value
      })
      if (formattedErrors.height_cm) {
        formattedErrors.height = formattedErrors.height_cm
        delete formattedErrors.height_cm
      }
      setProfileEditErrors(formattedErrors)
      const firstError = Object.values(formattedErrors)[0]
      notifyError(firstError || error?.response?.data?.message || 'Failed to update profile.')
    } finally {
      setSavingProfileEdit(false)
    }
  }

  const refreshTimeline = async () => {
    try {
      const response = await apiRequest('/v1/workouts?limit=20', { method: 'GET' })
      if (response.data.success) {
        setTimeline(response.data.data.workouts || [])
      }
    } catch (error) {
      console.error('Failed to refresh timeline:', error)
    }
  }

  const updateTimelineEntry = (entryId, updater) => {
    setTimeline((prev) => prev.map((entry) => (entry.id === entryId ? updater(entry) : entry)))
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
      const endpoint = `/v1/workouts/${entry.id}/likes`
      const response = await apiRequest(endpoint, { method: wasLiked ? 'DELETE' : 'POST' })
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
    if (!workoutId) return
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
    if (authorId === client?.id) {
      navigate('/profile')
      return
    }
    navigate(`/profile/${authorId}`)
  }

  const submitComment = async (workoutId, parentCommentId = null) => {
    const draft = parentCommentId
      ? (replyDraftByComment[parentCommentId] || '')
      : (commentDraftByWorkout[workoutId] || '')
    const body = draft.trim()
    if (!body) return

    setSubmittingCommentByWorkout((prev) => ({ ...prev, [workoutId]: true }))
    try {
      const response = await apiRequest(`/v1/workouts/${workoutId}/comments`, {
        method: 'POST',
        body: {
          body,
          parent_comment_id: parentCommentId || undefined,
        },
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
              const replies = Array.isArray(comment.replies) ? comment.replies : []
              return { ...comment, replies: [...replies, newComment] }
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
          const replies = (comment.replies || []).map((reply) => (
            reply.id === commentId ? { ...reply, ...patch } : reply
          ))
          return { ...comment, replies }
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

  const handleProfilePhotoUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validationError = validateProfileImageFile(file, {
      maxBytes: MAX_PROFILE_IMAGE_BYTES,
      label: 'Profile photo',
    })
    if (validationError) {
      notifyError(validationError)
      return
    }

    const formData = new FormData()
    formData.append('profile_picture', file, resolveUploadFilename(file, 'profile-photo'))
    setUploadingAvatar(true)
    try {
      const response = await apiRequest('/v1/profile/picture', {
        method: 'POST',
        body: formData,
      })
      if (response.data.success) {
        notifySuccess('Profile photo updated.', { icon: false })
        await refreshProfile()
      }
    } catch (error) {
      notifyError(getProfileUploadErrorMessage(error, 'profile_picture', 'Failed to upload profile photo.'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleCoverPhotoUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validationError = validateProfileImageFile(file, {
      maxBytes: MAX_COVER_IMAGE_BYTES,
      label: 'Cover photo',
    })
    if (validationError) {
      notifyError(validationError)
      return
    }

    const formData = new FormData()
    formData.append('cover_photo', file, resolveUploadFilename(file, 'cover-photo'))
    setUploadingCover(true)
    try {
      const response = await apiRequest('/v1/profile/cover-photo', {
        method: 'POST',
        body: formData,
      })
      if (response.data.success) {
        notifySuccess('Cover photo updated.', { icon: false })
        await refreshProfile()
      }
    } catch (error) {
      notifyError(getProfileUploadErrorMessage(error, 'cover_photo', 'Failed to upload cover photo.'))
    } finally {
      setUploadingCover(false)
    }
  }

  const openMediaViewer = (target) => {
    const hasImage = target === 'cover' ? Boolean(profile?.cover_photo_url) : Boolean(profile?.profile_picture_url)
    if (!hasImage) {
      if (target === 'cover') {
        coverPhotoInputRef.current?.click()
      } else {
        profilePhotoInputRef.current?.click()
      }
      return
    }
    setLibraryOpen(false)
    setSelectedLibraryImage('')
    setMediaViewerTarget(target)
  }

  const closeMediaViewer = () => {
    if (removingMedia) return
    setLibraryOpen(false)
    setSelectedLibraryImage('')
    setMediaViewerTarget(null)
  }

  const openPostImageViewer = (imageUrl) => {
    if (!imageUrl) return
    setPostImageViewerUrl(imageUrl)
  }

  const closePostImageViewer = () => {
    setPostImageViewerUrl('')
  }

  const handleChangeMediaFromViewer = () => {
    if (mediaViewerTarget === 'cover') {
      coverPhotoInputRef.current?.click()
    } else if (mediaViewerTarget === 'avatar') {
      profilePhotoInputRef.current?.click()
    }
    setMediaViewerTarget(null)
  }

  const handleRemoveMediaFromViewer = async () => {
    if (!mediaViewerTarget) return
    setRemovingMedia(true)
    try {
      const endpoint = mediaViewerTarget === 'cover' ? '/v1/profile/cover-photo' : '/v1/profile/picture'
      const response = await apiRequest(endpoint, { method: 'DELETE' })
      if (response.data.success) {
        notifySuccess(
          mediaViewerTarget === 'cover' ? 'Cover photo removed.' : 'Profile photo removed.',
          { icon: false }
        )
        await refreshProfile()
      }
      setMediaViewerTarget(null)
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to remove photo.'
      notifyError(msg)
    } finally {
      setRemovingMedia(false)
    }
  }

  const loadMediaLibrary = async () => {
    setLoadingLibrary(true)
    try {
      const response = await apiRequest('/v1/profile/media-library', { method: 'GET' })
      if (response.data.success) {
        const images = response.data.data.images || []
        setMediaLibrary(images)
        if (images.length > 0) {
          setSelectedLibraryImage(images[0])
        } else {
          setSelectedLibraryImage('')
        }
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to load media library.'
      notifyError(msg)
    } finally {
      setLoadingLibrary(false)
    }
  }

  const openLibraryPicker = async () => {
    setLibraryOpen(true)
    if (mediaLibrary.length === 0) {
      await loadMediaLibrary()
    }
  }

  const closeLibraryPicker = () => {
    setLibraryOpen(false)
    setSelectedLibraryImage('')
  }

  const handleApplyLibraryImage = async () => {
    if (!selectedLibraryImage || !mediaViewerTarget) {
      notifyError('Please select an image first.')
      return
    }

    setLoadingLibrary(true)
    try {
      const endpoint =
        mediaViewerTarget === 'cover'
          ? '/v1/profile/cover-photo/from-library'
          : '/v1/profile/picture/from-library'

      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: { image_url: selectedLibraryImage },
      })

      if (response.data.success) {
        notifySuccess(
          mediaViewerTarget === 'cover' ? 'Cover photo updated from your photos.' : 'Profile photo updated from your photos.',
          { icon: false }
        )
        await refreshProfile()
        closeLibraryPicker()
        setMediaViewerTarget(null)
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to apply selected image.'
      notifyError(msg)
    } finally {
      setLoadingLibrary(false)
    }
  }

  const openSocialModal = async (type) => {
    setSocialModalType(type)
    setSocialModalLoading(true)
    setSocialUsers([])
    try {
      if (type === 'followers') {
        const response = await apiRequest('/v1/social/followers', { method: 'GET' })
        if (response.data.success) {
          setSocialUsers(response.data.data.followers || [])
        }
      } else if (type === 'following') {
        const response = await apiRequest('/v1/social/following', { method: 'GET' })
        if (response.data.success) {
          setSocialUsers(response.data.data.following || [])
        }
      } else if (type === 'discover') {
        const discoverParams = new URLSearchParams()
        const trimmedQuery = discoverQuery.trim()
        if (trimmedQuery) discoverParams.set('query', trimmedQuery)
        if (discoverNiche) discoverParams.set('niche', discoverNiche)
        const discoverUrl = discoverParams.toString()
          ? `/v1/social/discover?${discoverParams.toString()}`
          : '/v1/social/discover'
        const response = await apiRequest(discoverUrl, { method: 'GET' })
        if (response.data.success) {
          setSocialUsers(response.data.data.results || [])
        }
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to load social data.')
    } finally {
      setSocialModalLoading(false)
    }
  }

  const closeSocialModal = () => {
    setSocialModalType(null)
    setSocialUsers([])
    setDiscoverQuery('')
    setDiscoverNiche('')
  }

  const openPublicProfile = (targetClientId) => {
    if (!targetClientId) return
    const selectedUser = socialUsers.find((user) => user.id === targetClientId)
    trackEvent('niche_profile_viewed', {
      source: socialModalType || 'unknown',
      target_client_id: targetClientId,
      target_primary_niche: selectedUser?.primary_niche || null,
    })
    setSocialModalType(null)
    setSocialUsers([])
    setDiscoverQuery('')
    setDiscoverNiche('')
    navigate(`/profile/${targetClientId}`)
  }

  const handleDiscoverSearch = async () => {
    setSocialModalLoading(true)
    try {
      const discoverParams = new URLSearchParams()
      const trimmedQuery = discoverQuery.trim()
      if (trimmedQuery) discoverParams.set('query', trimmedQuery)
      if (discoverNiche) discoverParams.set('niche', discoverNiche)
      const discoverUrl = discoverParams.toString()
        ? `/v1/social/discover?${discoverParams.toString()}`
        : '/v1/social/discover'
      const response = await apiRequest(discoverUrl, {
        method: 'GET',
      })
      if (response.data.success) {
        trackEvent('discover_filter_used', {
          query: trimmedQuery || null,
          niche: discoverNiche || null,
        })
        setSocialUsers(response.data.data.results || [])
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to search users.')
    } finally {
      setSocialModalLoading(false)
    }
  }

  const toggleFollow = async (targetClientId, isFollowing) => {
    try {
      await apiRequest(isFollowing ? '/v1/social/unfollow' : '/v1/social/follow', {
        method: 'POST',
        body: { client_id: targetClientId },
      })

      if (socialModalType === 'discover') {
        setSocialUsers((prev) =>
          prev.map((user) =>
            user.id === targetClientId ? { ...user, is_following: !isFollowing } : user
          )
        )
      } else if (socialModalType === 'following' && isFollowing) {
        setSocialUsers((prev) => prev.filter((user) => user.id !== targetClientId))
      }

      setLikesUsers((prev) => prev.map((user) => (
        user.id === targetClientId ? { ...user, is_following: !isFollowing } : user
      )))

      await refreshSocialStats()
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to update follow status.')
    }
  }

  const handleSuggestedFollow = async (targetClientId, isFollowing) => {
    if (!targetClientId || suggestedFollowBusyById[targetClientId]) return
    setSuggestedFollowBusyById((prev) => ({ ...prev, [targetClientId]: true }))
    try {
      await toggleFollow(targetClientId, isFollowing)
      if (isFollowing) {
        setSuggestedBuddies((prev) => prev.map((item) => (
          item.id === targetClientId ? { ...item, is_following: false } : item
        )))
      } else {
        setSuggestedBuddies((prev) => prev.filter((item) => item.id !== targetClientId))
      }
    } finally {
      setSuggestedFollowBusyById((prev) => ({ ...prev, [targetClientId]: false }))
    }
  }

  const openEditWorkoutModal = (entry) => {
    setTimelineMenuOpenId(null)
    setEditingWorkout(entry)
    setLinkedWorkoutChallengeId(entry.linked_challenge?.id ? String(entry.linked_challenge.id) : '')
    const storedSeconds = Number(entry.duration_seconds)
    const fallbackSeconds = Number(entry.duration_minutes) * 60
    const totalSeconds = Number.isFinite(storedSeconds) && storedSeconds > 0
      ? storedSeconds
      : (Number.isFinite(fallbackSeconds) && fallbackSeconds > 0 ? fallbackSeconds : 0)
    const hms = totalSecondsToHms(totalSeconds)
    setEditForm({
      workout_type: entry.workout_type || '',
      workout_date: entry.workout_date ? String(entry.workout_date).slice(0, 10) : '',
      duration_hours: hms.hours,
      duration_minutes: hms.minutes,
      duration_seconds: hms.seconds,
      distance_km: entry.distance_km ?? '',
      notes: entry.notes || '',
    })
    setEditExistingImages(Array.isArray(entry.workout_images) ? [...entry.workout_images] : [])
    setEditNewImages([])
  }

  const closeEditWorkoutModal = () => {
    if (savingWorkoutEdit) return
    setEditingWorkout(null)
    setLinkedWorkoutChallengeId('')
    setEditExistingImages([])
    setEditNewImages([])
  }

  const handleEditFormChange = (e) => {
    const { name, value } = e.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditDurationPartChange = (name, value) => {
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const submitWorkoutEdit = async (e) => {
    e.preventDefault()
    if (!editingWorkout) return

    if (!editForm.workout_type.trim()) {
      notifyError('Workout type is required.')
      return
    }
    if (!editForm.workout_date) {
      notifyError('Workout date is required.')
      return
    }
    const normalizedWorkoutDate = normalizeDateInput(editForm.workout_date)
    if (!normalizedWorkoutDate) {
      notifyError('Please provide a valid workout date.')
      return
    }
    const now = new Date()
    const todayLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    if (normalizedWorkoutDate > todayLocal) {
      notifyError('Workout date cannot be in the future.')
      return
    }
    const durationCheck = validateWorkoutHms(
      editForm.duration_hours,
      editForm.duration_minutes,
      editForm.duration_seconds,
    )
    if (!durationCheck.valid) {
      notifyError(durationCheck.message)
      return
    }
    if (!editForm.distance_km || Number(editForm.distance_km) <= 0) {
      notifyError('Distance must be greater than 0.')
      return
    }

    setSavingWorkoutEdit(true)
    try {
      const payload = new FormData()
      payload.append('_method', 'PUT')
      payload.append('workout_type', editForm.workout_type.trim())
      payload.append('workout_date', normalizedWorkoutDate)
      payload.append('duration_minutes', String(totalSecondsToDurationMinutes(durationCheck.totalSeconds)))
      payload.append('duration_seconds', String(durationCheck.totalSeconds))
      payload.append('distance_km', String(parseFloat(editForm.distance_km)))
      if (editForm.notes?.trim()) {
        payload.append('notes', editForm.notes.trim())
      }
      if ((editingWorkout.entry_type || 'workout') === 'workout') {
        payload.append(
          'admin_event_id',
          linkedWorkoutChallengeId.trim() ? linkedWorkoutChallengeId.trim() : '',
        )
      }
      payload.append('replace_images', '1')
      editExistingImages.forEach((imageUrl) => {
        payload.append('keep_workout_images[]', imageUrl)
      })
      editNewImages.forEach((imageFile, index) => {
        payload.append(`workout_images[${index}]`, imageFile, imageFile.name || `photo-${index + 1}.jpg`)
      })

      await apiRequest(`/v1/workouts/${editingWorkout.id}`, {
        method: 'POST',
        body: payload,
      })

      notifySuccess('Workout updated successfully.', { icon: false })
      await refreshTimeline()
      await refreshSocialStats()
      await refreshMyStats()
      closeEditWorkoutModal()
    } catch (error) {
      const apiErrors = error?.response?.data?.errors || {}
      const firstFieldError = Object.values(apiErrors)[0]
      const normalizedFirstError = Array.isArray(firstFieldError) ? firstFieldError[0] : firstFieldError
      notifyError(normalizedFirstError || error?.response?.data?.message || 'Failed to update workout.')
    } finally {
      setSavingWorkoutEdit(false)
    }
  }

  const deleteWorkout = async (entryId) => {
    setTimelineMenuOpenId(null)
    setDeletingWorkoutId(entryId)
    try {
      await apiRequest(`/v1/workouts/${entryId}`, { method: 'DELETE' })
      notifySuccess('Workout deleted successfully.', { icon: false })
      await refreshTimeline()
      await refreshSocialStats()
      await refreshMyStats()
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to delete workout.')
    } finally {
      setDeletingWorkoutId(null)
    }
  }

  const requestDeleteWorkout = (entry) => {
    setTimelineMenuOpenId(null)
    setDeleteWorkoutTarget(entry)
  }

  const closeDeleteWorkoutModal = () => {
    if (deletingWorkoutId) return
    setDeleteWorkoutTarget(null)
  }

  const confirmDeleteWorkout = async () => {
    if (!deleteWorkoutTarget?.id) return
    await deleteWorkout(deleteWorkoutTarget.id)
    setDeleteWorkoutTarget(null)
  }

  const handleEditImageSelect = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    const accepted = files.filter((file) => isAcceptableWorkoutImageFile(file))
    if (accepted.length !== files.length) {
      notifyError('One or more files were skipped because they are not supported image formats.')
    }
    if (accepted.length > 0) {
      setEditNewImages((prev) => [...prev, ...accepted])
    }
  }

  const toggleProfileGoal = (goalId) => {
    setSelectedGoalIds((prev) => {
      if (prev.includes(goalId)) {
        return prev.filter((id) => id !== goalId)
      }
      if (prev.length >= 3) {
        notifyGoalLimitOnce('You can select up to 3 fitness goals only.')
        return prev
      }
      return [...prev, goalId]
    })
  }

  const removeExistingEditImage = (indexToRemove) => {
    setEditExistingImages((prev) => prev.filter((_, index) => index !== indexToRemove))
  }

  const removeNewEditImage = (indexToRemove) => {
    setEditNewImages((prev) => prev.filter((_, index) => index !== indexToRemove))
  }

  if (loading) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center profile-page px-3"
        style={{ minHeight: '100vh' }}
      >
        <AppLoadingState hint="Loading your profile…" />
      </div>
    )
  }

  const displayName = profile?.display_name || 
                      (profile?.first_name && profile?.last_name 
                        ? `${profile.first_name} ${profile.last_name}` 
                        : profile?.first_name || client?.email?.split('@')[0] || 'User')
  const locationSummary = [profile?.city, profile?.province, profile?.country].filter(Boolean).join(', ')
  const experienceSummary = [
    profile?.experience_running ? `Running: ${formatExperienceLabel(profile.experience_running)}` : null,
    profile?.experience_gym ? `PRT/Gym: ${formatExperienceLabel(profile.experience_gym)}` : null,
    profile?.workout_preferences?.experience_biking
      ? `Biking: ${formatExperienceLabel(profile.workout_preferences.experience_biking)}`
      : null,
    profile?.experience_others_title && profile?.experience_others
      ? `${profile.experience_others_title}: ${formatExperienceLabel(profile.experience_others)}`
      : null,
  ].filter(Boolean).join(' | ')
  const primaryNicheLabel = formatNicheLabel(profile?.primary_niche)
  const secondaryNicheLabels = Array.isArray(profile?.secondary_niches)
    ? profile.secondary_niches.map(formatNicheLabel).filter(Boolean)
    : []
  const nicheSummary = [primaryNicheLabel, ...secondaryNicheLabels].filter(Boolean).join(', ')

  return (
    <>
      <div className="d-flex flex-column profile-page" style={{ minHeight: '100vh' }}>
        <main className="flex-grow-1">
          <div className="container px-3 px-md-4 py-3 py-md-4">
            <div className="profile-hero">
              <div className="profile-cover-stack">
                <div className="profile-cover profile-cover-clickable" onClick={() => openMediaViewer('cover')} role="button" tabIndex={0}>
                  {profile?.cover_photo_url && (
                    <img src={resolveMediaUrl(profile.cover_photo_url)} alt="Cover" className="profile-cover-image" />
                  )}
                  <div className="profile-media-hint">Edit cover photo</div>
                  <input
                    ref={coverPhotoInputRef}
                    type="file"
                    accept={PROFILE_IMAGE_ACCEPT}
                    onChange={handleCoverPhotoUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
              <input
                ref={profilePhotoInputRef}
                type="file"
                accept={PROFILE_IMAGE_ACCEPT}
                onChange={handleProfilePhotoUpload}
                style={{ display: 'none' }}
                aria-hidden="true"
              />

            <div className="profile-header-card">
              <div className="profile-header-layout d-flex flex-column flex-md-row align-items-md-end justify-content-between gap-3">
                <div className="profile-header-main d-flex flex-column flex-md-row align-items-md-end gap-3">
                  <div
                    className="profile-avatar-wrap profile-avatar-clickable d-none d-lg-block"
                    onClick={() => openMediaViewer('avatar')}
                    role="button"
                    tabIndex={0}
                  >
                    {profile?.profile_picture_url ? (
                      <img src={resolveMediaUrl(profile.profile_picture_url)} alt="Profile" />
                    ) : (
                      <div className="profile-avatar-fallback">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div
                      className="profile-avatar-btn"
                      aria-hidden="true"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!uploadingAvatar) profilePhotoInputRef.current?.click()
                      }}
                    >
                      {uploadingAvatar ? (
                        '...'
                      ) : (
                        <svg
                          className="profile-avatar-btn-icon"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M8 7.5H6.5C5.67157 7.5 5 8.17157 5 9V16.5C5 17.3284 5.67157 18 6.5 18H17.5C18.3284 18 19 17.3284 19 16.5V9C19 8.17157 18.3284 7.5 17.5 7.5H16L15 6H9L8 7.5Z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="12.2" r="2.5" stroke="currentColor" strokeWidth="1.7" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <div className="profile-identity">
                    <h1 className="profile-name">{displayName}</h1>
                    <div className="profile-meta">
                      {profile?.city && profile?.province
                        ? `${profile.city}, ${profile.province}`
                        : 'Location not set'}
                    </div>
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
                  <button type="button" className="profile-action-btn" onClick={openProfileEditModal}>
                    Edit profile
                  </button>
                </div>
              </div>
            </div>
            <div className="profile-cover-avatar profile-avatar-on-cover" onClick={(e) => e.stopPropagation()} role="presentation">
              <div
                className="profile-avatar-wrap profile-avatar-clickable"
                onClick={() => openMediaViewer('avatar')}
                role="button"
                tabIndex={0}
              >
                {profile?.profile_picture_url ? (
                  <img src={resolveMediaUrl(profile.profile_picture_url)} alt="Profile" />
                ) : (
                  <div className="profile-avatar-fallback">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  className="profile-avatar-btn"
                  aria-hidden="true"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!uploadingAvatar) profilePhotoInputRef.current?.click()
                  }}
                >
                  {uploadingAvatar ? (
                    '...'
                  ) : (
                    <svg
                      className="profile-avatar-btn-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 7.5H6.5C5.67157 7.5 5 8.17157 5 9V16.5C5 17.3284 5.67157 18 6.5 18H17.5C18.3284 18 19 17.3284 19 16.5V9C19 8.17157 18.3284 7.5 17.5 7.5H16L15 6H9L8 7.5Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12.2" r="2.5" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
            </div>

            <div className="row g-3 mt-1">
              <div className="col-12 col-lg-4 profile-left-column">
                <div className="profile-section-card profile-side-card">
                  <div className="profile-left-connections-panels">
                    <div className="profile-side-head">
                      <h2 className="profile-section-title mb-0">Connections</h2>
                    </div>
                    <div className="profile-social-grid profile-social-grid-modern">
                      <button type="button" className="profile-social-item" onClick={() => openSocialModal('following')}>
                        <div className="profile-social-count">{socialStats.following_count}</div>
                        <div className="profile-social-label">Following</div>
                      </button>
                      <button type="button" className="profile-social-item" onClick={() => openSocialModal('followers')}>
                        <div className="profile-social-count">{socialStats.followers_count}</div>
                        <div className="profile-social-label">Followers</div>
                      </button>
                      <div className="profile-social-item profile-social-item--static" aria-label={`${socialStats.activities_count} activities`}>
                        <div className="profile-social-count">{socialStats.activities_count}</div>
                        <div className="profile-social-label">Activities</div>
                      </div>
                    </div>
                  </div>
                </div>

                {(secondaryLoading || myStats) && (
                  <>
                    <div className="profile-section-card profile-side-card">
                      <div className="profile-side-head profile-side-head--stacked">
                        <h2 className="profile-section-title mb-0">My Progress</h2>
                        <div className="profile-section-subtitle">Distance, performance, sessions</div>
                      </div>

                      <div className="profile-my-stats-grid">
                        <div className="profile-my-stat-card">
                          <div className="profile-my-stat-label">Distance Covered</div>
                          <div className="profile-my-stat-value">
                            {secondaryLoading && !myStats ? '…' : `${myStats?.total_distance_km ?? 0} km`}
                          </div>
                        </div>
                        <div className="profile-my-stat-card">
                          <div className="profile-my-stat-label">Avg Performance</div>
                          <div className="profile-my-stat-value">
                            {secondaryLoading && !myStats
                              ? '…'
                              : formatPaceMinPerKm(myStats?.avg_pace_min_per_km)}
                          </div>
                        </div>
                        <div className="profile-my-stat-card">
                          <div className="profile-my-stat-label">Total Sessions</div>
                          <div className="profile-my-stat-value">
                            {secondaryLoading && !myStats ? '…' : (myStats?.total_runs ?? 0)}
                          </div>
                        </div>
                        <div className="profile-my-stat-card">
                          <div className="profile-my-stat-label">Active Streak</div>
                          <div className="profile-my-stat-value">
                            {secondaryLoading && !myStats ? '…' : `${myStats?.current_streak ?? 0} days`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="profile-section-card profile-side-card profile-side-card--compact">
                      <ProfileEarnedEventBadges
                        items={myStats?.event_badges || []}
                        resolveMediaUrl={resolveMediaUrl}
                        ownerName={displayName}
                        clientId={client?.id || ''}
                      />
                    </div>

                    <div className="profile-section-card profile-side-card profile-side-card--compact">
                      <ProfileEarnedEventTrophies
                        items={myStats?.event_trophies || []}
                        resolveMediaUrl={resolveMediaUrl}
                        ownerName={displayName}
                        clientId={client?.id || ''}
                      />
                    </div>

                    <div className="profile-section-card profile-side-card profile-side-card--compact">
                      <ProfileJoinedEventsSection
                        variant="sidebar"
                        items={myStats?.joined_challenge_events || []}
                        resolveMediaUrl={resolveMediaUrl}
                        emptyHint="Join a challenge under Events — distance progress appears here."
                        onOpenChallengeJournal={openChallengeJournalFromProfile}
                      />
                    </div>
                  </>
                )}

                <div className="profile-section-card profile-side-card">
                  <div className="profile-side-head profile-side-head--stacked">
                    <h2 className="profile-section-title mb-0">About</h2>
                    <div className="profile-section-subtitle">Profile overview</div>
                  </div>
                  <div className="profile-about-list">
                    <div className="profile-about-row">
                      <span className="profile-about-label">Email</span>
                      <span className="profile-about-value">{client?.email || 'Not set'}</span>
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
                        {profile?.workout_preferences?.days_per_week
                          ? `${profile.workout_preferences.days_per_week} days`
                          : 'Not set'}
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
                      <span className="profile-about-value">{formatHeightFtIn(profile?.height_cm) || 'Not set'}</span>
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
                    <div className="profile-timeline-empty">
                      No workouts logged yet. Your workout feed will appear here.
                    </div>
                  )}
                  <div className="d-grid gap-3">
                    {timeline.map((entry) => (
                      <div className="timeline-card" key={entry.id}>
                        <div className="timeline-top-row">
                          <div>
                            <div className="timeline-title">{entry.workout_type}</div>
                            <div className="timeline-meta">
                              {entry.workout_date ? formatLongDate(entry.workout_date) : 'Unknown date'}
                            </div>
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
                          <div className="timeline-top-actions">
                            <div className="timeline-post-menu">
                              <button
                                type="button"
                                className="timeline-menu-trigger"
                                onClick={() =>
                                  setTimelineMenuOpenId((prev) => (prev === entry.id ? null : entry.id))
                                }
                                aria-label="Post options"
                              >
                                <span />
                                <span />
                                <span />
                              </button>
                              {timelineMenuOpenId === entry.id && (
                                <div className="timeline-menu-dropdown">
                                  <button type="button" onClick={() => openEditWorkoutModal(entry)}>
                                    Edit post
                                  </button>
                                  <button type="button" className="is-danger" onClick={() => requestDeleteWorkout(entry)}>
                                    Delete post
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {(entry.duration_minutes || entry.distance_km || entry.pace_min_per_km) && (
                        <div className="timeline-stat-row">
                          {entry.duration_minutes && (
                            <div className="timeline-stat">{entry.duration_minutes} min</div>
                          )}
                          {entry.distance_km && (
                            <div className="timeline-stat">{entry.distance_km} km</div>
                          )}
                          {entry.pace_min_per_km && (
                            <div className="timeline-stat">{entry.pace_min_per_km} min/km</div>
                          )}
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
                      navigate(item.id === client?.id ? '/profile' : `/profile/${item.id}`)
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
                      navigate(item.id === client?.id ? '/profile' : `/profile/${item.id}`)
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
        open={profileEditOpen}
        onRequestClose={closeProfileEditModal}
        backdropClassName="profile-social-modal-backdrop"
        panelClassName="profile-social-modal profile-edit-modal"
      >
        {(dismiss) =>
          profileEditOpen ? (
            <>
              <div className="profile-social-modal-head">
                <div className="profile-social-modal-title">Edit profile</div>
                <button type="button" className="profile-social-modal-close" onClick={dismiss}>
                  ×
                </button>
              </div>
              <form onSubmit={submitProfileEdit} className="profile-workout-edit-form">
              {Object.keys(profileEditErrors).length > 0 && (
                <div className="profile-form-error-banner">
                  Please review the highlighted fields and try again.
                </div>
              )}
              <div className="profile-workout-edit-grid">
                <div className="profile-workout-edit-notes profile-edit-section-title">Basic Information</div>
                <div className="profile-workout-edit-notes profile-edit-section-note">Identity, location, and goals used across your profile.</div>
                <div>
                  <label className="form-label">First Name</label>
                  <input className={`form-control ${profileEditErrors.first_name ? 'is-invalid' : ''}`} name="first_name" value={profileEditForm.first_name} onChange={handleProfileEditChange} />
                </div>
                <div>
                  <label className="form-label">Last Name</label>
                  <input className={`form-control ${profileEditErrors.last_name ? 'is-invalid' : ''}`} name="last_name" value={profileEditForm.last_name} onChange={handleProfileEditChange} />
                </div>
                <div>
                  <label className="form-label">Date of Birth</label>
                  <input type="date" className={`form-control ${profileEditErrors.date_of_birth ? 'is-invalid' : ''}`} name="date_of_birth" value={profileEditForm.date_of_birth} onChange={handleProfileEditChange} />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select className={`form-select ${profileEditErrors.gender ? 'is-invalid' : ''}`} name="gender" value={profileEditForm.gender} onChange={handleProfileEditChange}>
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Country *</label>
                  <div className="profile-location-select">
                    <CountryDropdown
                      value={profileEditForm.country}
                      onChange={handleProfileCountryChange}
                      classes={`form-control ${profileEditErrors.country ? 'is-invalid' : ''}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Region / State / Province *</label>
                  <div className="profile-location-select">
                    <RegionDropdown
                      country={profileEditForm.country}
                      value={profileEditForm.province}
                      onChange={handleProfileProvinceChange}
                      classes={`form-control ${profileEditErrors.province ? 'is-invalid' : ''}`}
                      blankOptionLabel="Select region"
                      defaultOptionLabel="Select region"
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input className={`form-control ${profileEditErrors.city ? 'is-invalid' : ''}`} name="city" value={profileEditForm.city} onChange={handleProfileEditChange} />
                </div>
                <div className="profile-workout-edit-notes">
                  <label className="form-label">Fitness Goals (1-3)</label>
                  <div className="profile-goals-grid">
                    {modalGoalOptions.map((goal) => {
                      const active = selectedGoalIds.includes(goal.id)
                      return (
                        <button
                          type="button"
                          key={goal.id}
                          className={`profile-goal-chip ${active ? 'is-active' : ''}`}
                          onClick={() => toggleProfileGoal(goal.id)}
                        >
                          <span>{goal.uiLabel}</span>
                          {active && (
                            <span className="profile-goal-chip-check" aria-hidden="true">
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                                <path
                                  d="M12.5 4.5L7 11L3.5 8"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="profile-workout-edit-notes">
                  <label className="form-label">Training Focus</label>
                  <div className="profile-preferences-grid profile-preferences-grid-two">
                    {PRIMARY_NICHE_OPTIONS.map((option) => {
                      const active = profileEditForm.primary_niche === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`profile-pref-chip ${active ? 'is-active' : ''}`}
                          onClick={() => handlePrimaryNicheSelect(option.value)}
                        >
                          <span><strong>{option.label}</strong></span>
                          {active && (
                            <span className="profile-goal-chip-check" aria-hidden="true">
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                                <path
                                  d="M12.5 4.5L7 11L3.5 8"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="profile-workout-edit-notes profile-edit-section-title">Body Metrics</div>
                <div>
                  <label className="form-label">Height</label>
                  <div className={`profile-height-inputs ${profileEditErrors.height ? 'is-invalid' : ''}`}>
                    <div className="profile-height-field">
                      <input
                        type="number"
                        min="1"
                        max="9"
                        placeholder="5"
                        inputMode="numeric"
                        aria-label="Height in feet"
                        className={`form-control ${profileEditErrors.height ? 'is-invalid' : ''}`}
                        name="height_feet"
                        value={profileEditForm.height_feet}
                        onChange={handleProfileEditChange}
                      />
                      <span className="profile-height-unit">ft</span>
                    </div>
                    <div className="profile-height-field">
                      <input
                        type="number"
                        min="0"
                        max="11"
                        placeholder="10"
                        inputMode="numeric"
                        aria-label="Height in inches"
                        className={`form-control ${profileEditErrors.height ? 'is-invalid' : ''}`}
                        name="height_inches"
                        value={profileEditForm.height_inches}
                        onChange={handleProfileEditChange}
                      />
                      <span className="profile-height-unit">in</span>
                    </div>
                  </div>
                  {profileEditErrors.height && (
                    <div className="invalid-feedback d-block">{profileEditErrors.height}</div>
                  )}
                </div>
                <div>
                  <label className="form-label">Current Weight (kg)</label>
                  <input type="number" min="20" max="500" step="0.1" className={`form-control ${profileEditErrors.current_weight_kg ? 'is-invalid' : ''}`} name="current_weight_kg" value={profileEditForm.current_weight_kg} onChange={handleProfileEditChange} />
                </div>
                <div>
                  <label className="form-label">Target Weight (kg)</label>
                  <input type="number" min="20" max="500" step="0.1" className={`form-control ${profileEditErrors.target_weight_kg ? 'is-invalid' : ''}`} name="target_weight_kg" value={profileEditForm.target_weight_kg} onChange={handleProfileEditChange} />
                </div>

                <div className="profile-workout-edit-notes profile-edit-section-title">Training Preferences</div>
                <div className="profile-workout-edit-notes">
                  <label className="form-label">Workout days per week *</label>
                  <div className="profile-preferences-grid">
                    {[
                      { value: '3-4', label: '3-4 days', sub: 'Light' },
                      { value: '4-5', label: '4-5 days', sub: 'Moderate' },
                      { value: '5-6', label: '5-6 days', sub: 'Intense' },
                    ].map((option) => {
                      const active = profileEditForm.workout_days_per_week === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`profile-pref-chip ${active ? 'is-active' : ''}`}
                          onClick={() =>
                            setProfileEditForm((prev) => ({ ...prev, workout_days_per_week: option.value }))
                          }
                        >
                          <span>
                            <strong>{option.label}</strong>
                            <small>{option.sub}</small>
                          </span>
                          {active && (
                            <span className="profile-goal-chip-check" aria-hidden="true">
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                                <path
                                  d="M12.5 4.5L7 11L3.5 8"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="profile-workout-edit-notes">
                  <label className="form-label">Where do you usually work out? *</label>
                  <div className="profile-preferences-grid profile-preferences-grid-two">
                    {[
                      { value: 'home', label: 'At home' },
                      { value: 'gym', label: 'At the gym' },
                      { value: 'outdoor', label: 'Outdoor' },
                    ].map((option) => {
                      const active = profileEditForm.workout_location === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`profile-pref-chip ${active ? 'is-active' : ''}`}
                          onClick={() =>
                            setProfileEditForm((prev) => ({ ...prev, workout_location: option.value }))
                          }
                        >
                          <span>
                            <strong>{option.label}</strong>
                          </span>
                          {active && (
                            <span className="profile-goal-chip-check" aria-hidden="true">
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                                <path
                                  d="M12.5 4.5L7 11L3.5 8"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="profile-workout-edit-notes">
                  <label className="form-label">Food preference (optional)</label>
                  <select
                    className="form-select"
                    name="food_preference"
                    value={profileEditForm.food_preference}
                    onChange={handleProfileEditChange}
                  >
                    <option value="">No specific preference</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="low_carb">Low-carb</option>
                    <option value="high_protein">High-protein</option>
                  </select>
                </div>

                <div className="profile-workout-edit-notes profile-edit-section-title">Experience Level</div>
                <div>
                  <label className="form-label">Running {profileEditForm.primary_niche === 'running' ? '*' : ''}</label>
                  <select
                    className={`form-select ${profileEditErrors.experience_running ? 'is-invalid' : ''}`}
                    name="experience_running"
                    value={profileEditForm.experience_running}
                    onChange={handleProfileEditChange}
                    style={{ borderRadius: '8px', padding: '10px 14px' }}
                  >
                    <option value="">Select experience level...</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">PRT/Gym Workout {profileEditForm.primary_niche === 'gym' ? '*' : ''}</label>
                  <select
                    className={`form-select ${profileEditErrors.experience_gym ? 'is-invalid' : ''}`}
                    name="experience_gym"
                    value={profileEditForm.experience_gym}
                    onChange={handleProfileEditChange}
                    style={{ borderRadius: '8px', padding: '10px 14px' }}
                  >
                    <option value="">Select experience level...</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Biking {profileEditForm.primary_niche === 'biking' ? '*' : ''}</label>
                  <select
                    className={`form-select ${profileEditErrors.experience_biking ? 'is-invalid' : ''}`}
                    name="experience_biking"
                    value={profileEditForm.experience_biking}
                    onChange={handleProfileEditChange}
                    style={{ borderRadius: '8px', padding: '10px 14px' }}
                  >
                    <option value="">Select experience level...</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div className="profile-workout-edit-notes">
                  <label className="form-label">Other Activity / Hobby (optional)</label>
                  <input
                    className={`form-control ${profileEditErrors.experience_others_title ? 'is-invalid' : ''}`}
                    name="experience_others_title"
                    value={profileEditForm.experience_others_title}
                    onChange={handleProfileEditChange}
                    placeholder="e.g., Yoga, Swimming, Cycling, Martial Arts"
                  />
                </div>
                <div>
                  <label className="form-label">Experience Level (optional)</label>
                  <select
                    className={`form-select ${profileEditErrors.experience_others ? 'is-invalid' : ''}`}
                    name="experience_others"
                    value={profileEditForm.experience_others}
                    onChange={handleProfileEditChange}
                    style={{ borderRadius: '8px', padding: '10px 14px' }}
                  >
                    <option value="">Select experience level...</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              </div>
              <div className="profile-workout-edit-actions">
                <button type="button" className="profile-library-btn is-secondary" onClick={closeProfileEditModal}>
                  Cancel
                </button>
                <button type="submit" className="profile-library-btn" disabled={savingProfileEdit}>
                  {savingProfileEdit ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
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
            <div className="profile-media-viewer-actions" role="tablist" aria-label="Photo actions">
              <button type="button" className="profile-media-tab-btn" onClick={handleChangeMediaFromViewer}>
                {mediaViewerTarget === 'cover' ? 'Change cover photo' : 'Change profile photo'}
              </button>
              <button
                type="button"
                className="profile-media-tab-btn"
                onClick={openLibraryPicker}
              >
                Choose from your photos
              </button>
              <button
                type="button"
                className="profile-media-tab-btn is-danger"
                onClick={handleRemoveMediaFromViewer}
                disabled={removingMedia}
              >
                {removingMedia ? 'Removing...' : mediaViewerTarget === 'cover' ? 'Remove cover photo' : 'Remove profile photo'}
              </button>
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
      <AppModalTransition
        open={libraryOpen}
        onRequestClose={closeLibraryPicker}
        backdropClassName="profile-library-modal-backdrop"
        panelClassName="profile-library-modal"
      >
        {(dismiss) =>
          libraryOpen ? (
            <>
            <div className="profile-library-modal-head">
              <div className="profile-library-modal-title">Choose from your photos</div>
              <button
                type="button"
                className="profile-library-modal-close"
                onClick={dismiss}
                aria-label="Close library"
              >
                ×
              </button>
            </div>
            <div className="profile-library-modal-body">
              {loadingLibrary && <div className="profile-library-muted">Loading photos...</div>}
              {!loadingLibrary && mediaLibrary.length === 0 && (
                <div className="profile-library-muted">No images found in your workout uploads yet.</div>
              )}
              {!loadingLibrary && mediaLibrary.length > 0 && (
                <>
                  {selectedLibraryImage && (
                    <div className="profile-library-selected-preview">
                      <img src={resolveMediaUrl(selectedLibraryImage)} alt="Selected preview" />
                    </div>
                  )}
                  <div className="profile-library-grid">
                    {mediaLibrary.map((imageUrl, idx) => {
                      const resolvedUrl = resolveMediaUrl(imageUrl)
                      const active = selectedLibraryImage === imageUrl
                      return (
                        <button
                          type="button"
                          key={`${imageUrl}-${idx}`}
                          className={`profile-library-thumb ${active ? 'is-active' : ''}`}
                          onClick={() => setSelectedLibraryImage(imageUrl)}
                        >
                          <img src={resolvedUrl} alt="Library selection" />
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="profile-library-modal-foot">
              <button
                type="button"
                className="profile-library-btn"
                onClick={handleApplyLibraryImage}
                disabled={loadingLibrary || !selectedLibraryImage}
              >
                Use selected image
              </button>
              <button type="button" className="profile-library-btn is-secondary" onClick={dismiss}>
                Cancel
              </button>
            </div>
            </>
          ) : null
        }
      </AppModalTransition>
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
              <div className="profile-social-modal-title">
                {socialModalType === 'followers'
                  ? 'Followers'
                  : socialModalType === 'following'
                  ? 'Following'
                  : 'Find People'}
              </div>
              <button type="button" className="profile-social-modal-close" onClick={dismiss}>
                ×
              </button>
            </div>

            {socialModalType === 'discover' && (
              <div className="profile-social-search-row">
                <input
                  type="text"
                  className="form-control"
                  value={discoverQuery}
                  onChange={(e) => setDiscoverQuery(e.target.value)}
                  placeholder="Search by name or email"
                />
                <select
                  className="form-select profile-discover-niche-select"
                  value={discoverNiche}
                  onChange={(e) => setDiscoverNiche(e.target.value)}
                >
                  {DISCOVER_NICHE_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button type="button" className="profile-social-search-btn" onClick={handleDiscoverSearch}>
                  Search
                </button>
              </div>
            )}

            <div className="profile-social-modal-body">
              {socialModalLoading && <div className="profile-library-muted">Loading...</div>}
              {!socialModalLoading && socialUsers.length === 0 && (
                <div className="profile-library-muted">No users found.</div>
              )}
              {!socialModalLoading &&
                socialUsers.map((user) => (
                  <div className="profile-social-user-row" key={user.id}>
                    <div className="profile-social-user-main">
                      <button
                        type="button"
                        className="profile-social-user-link"
                        onClick={() => openPublicProfile(user.id)}
                      >
                        <div className="profile-social-user-avatar">
                          {user.profile_picture_url ? (
                            <img src={resolveMediaUrl(user.profile_picture_url)} alt={user.display_name} />
                          ) : (
                            <span>{(user.display_name || 'U').charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        className="profile-social-user-link profile-social-user-text-link"
                        onClick={() => openPublicProfile(user.id)}
                      >
                        <div className="profile-social-user-name">{user.display_name}</div>
                        <div className="profile-social-user-sub">
                          {[user.city, user.province].filter(Boolean).join(', ') || 'Fitness 365 Pro Member'}
                        </div>
                      </button>
                    </div>
                    {(socialModalType === 'discover' || socialModalType === 'following') && (
                      <button
                        type="button"
                        className={`profile-social-follow-btn ${user.is_following ? 'is-secondary' : ''}`}
                        onClick={() => toggleFollow(user.id, Boolean(user.is_following))}
                      >
                        {user.is_following ? 'Unfollow' : 'Follow'}
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
        open={Boolean(editingWorkout)}
        onRequestClose={closeEditWorkoutModal}
        backdropClassName="profile-social-modal-backdrop"
        panelClassName="profile-social-modal profile-workout-edit-modal profile-edit-modal"
      >
        {(dismiss) =>
          editingWorkout ? (
            <>
            <div className="profile-social-modal-head">
              <div className="profile-social-modal-title">Edit post</div>
              <button type="button" className="profile-social-modal-close" onClick={dismiss}>
                ×
              </button>
            </div>
            <form onSubmit={submitWorkoutEdit} className="profile-workout-edit-form">
              <div className="profile-workout-edit-grid">
                <div>
                  <label className="form-label">Workout Type</label>
                  <input
                    className="form-control"
                    name="workout_type"
                    value={editForm.workout_type}
                    onChange={handleEditFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-control"
                    name="workout_date"
                    value={editForm.workout_date}
                    onChange={handleEditFormChange}
                    required
                  />
                </div>
                <div className="profile-workout-edit-metrics">
                  <WorkoutMetricsFields
                    distanceKm={editForm.distance_km}
                    durationHours={editForm.duration_hours}
                    durationMinutes={editForm.duration_minutes}
                    durationSeconds={editForm.duration_seconds}
                    onDistanceChange={handleEditFormChange}
                    onDurationPartChange={handleEditDurationPartChange}
                    inputClassName="form-control"
                    labelClassName="form-label"
                    sectionClassName=""
                  />
                </div>
                {(editingWorkout.entry_type || 'workout') === 'workout'
                  && (workoutEditSelectableEvents.length > 0 || linkedWorkoutChallengeId) && (
                  <div className="profile-workout-edit-challenge profile-workout-edit-notes">
                    <label className="form-label" htmlFor="edit_linked_challenge_event">
                      Count toward challenge
                    </label>
                    <select
                      id="edit_linked_challenge_event"
                      className="form-select"
                      value={linkedWorkoutChallengeId}
                      onChange={(e) => setLinkedWorkoutChallengeId(e.target.value)}
                      aria-describedby="edit_linked_challenge_help"
                    >
                      <option value="">Do not attach to an event</option>
                      {workoutEditSelectableEvents.map((ev) => (
                        <option key={ev.event_id} value={ev.event_id}>
                          {ev.title || 'Challenge'}
                          {typeof ev.progress_goal_km === 'number' && ev.progress_goal_km > 0
                            ? ` · goal ${ev.progress_goal_km} km`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <div id="edit_linked_challenge_help" className="profile-workout-edit-challenge-help">
                      Finished events are omitted unless this post is already linked to one.
                    </div>
                  </div>
                )}
                <div className="profile-workout-edit-notes">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    name="notes"
                    rows="3"
                    value={editForm.notes}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="profile-workout-images-editor">
                  <div className="profile-workout-images-head">
                    <label className="form-label mb-0">Workout Images</label>
                    <button
                      type="button"
                      className="profile-library-btn"
                      onClick={() => workoutEditImageInputRef.current?.click()}
                    >
                      Add photos
                    </button>
                    <input
                      ref={workoutEditImageInputRef}
                      type="file"
                      accept={WORKOUT_IMAGE_ACCEPT}
                      multiple
                      onChange={handleEditImageSelect}
                      style={{ display: 'none' }}
                    />
                  </div>
                  {(editExistingImages.length > 0 || editNewImagePreviews.length > 0) ? (
                    <div className="profile-workout-image-grid">
                      {editExistingImages.map((imageUrl, idx) => (
                        <div className="profile-workout-image-card" key={`existing-${imageUrl}-${idx}`}>
                          <img src={resolveMediaUrl(imageUrl)} alt="Existing workout" />
                          <button
                            type="button"
                            className="profile-workout-image-remove"
                            onClick={() => removeExistingEditImage(idx)}
                            aria-label="Remove existing image"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {editNewImagePreviews.map((previewUrl, idx) => (
                        <div className="profile-workout-image-card" key={`new-${previewUrl}-${idx}`}>
                          <img src={previewUrl} alt="New upload preview" />
                          <button
                            type="button"
                            className="profile-workout-image-remove"
                            onClick={() => removeNewEditImage(idx)}
                            aria-label="Remove new image"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="profile-workout-image-empty">No images yet. Add photos for this workout post.</div>
                  )}
                </div>
              </div>
              <div className="profile-workout-edit-actions">
                <button type="button" className="profile-library-btn is-secondary" onClick={dismiss}>
                  Cancel
                </button>
                <button type="submit" className="profile-library-btn" disabled={savingWorkoutEdit}>
                  {savingWorkoutEdit ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
            </>
          ) : null
        }
      </AppModalTransition>
      <AppModalTransition
        open={Boolean(deleteWorkoutTarget)}
        onRequestClose={closeDeleteWorkoutModal}
        backdropClassName="profile-social-modal-backdrop"
        panelClassName="profile-social-modal profile-delete-modal"
      >
        {(dismiss) =>
          deleteWorkoutTarget ? (
            <>
            <div className="profile-social-modal-head">
              <div className="profile-social-modal-title">Delete post</div>
              <button type="button" className="profile-social-modal-close" onClick={dismiss}>
                ×
              </button>
            </div>
            <div className="profile-delete-modal-body">
              <p>Delete this post permanently?</p>
              <p className="profile-delete-modal-sub">This action cannot be undone.</p>
            </div>
            <div className="profile-workout-edit-actions">
              <button type="button" className="profile-library-btn is-secondary" onClick={dismiss}>
                Cancel
              </button>
              <button
                type="button"
                className="profile-library-btn is-danger"
                onClick={confirmDeleteWorkout}
                disabled={deletingWorkoutId === deleteWorkoutTarget.id}
              >
                {deletingWorkoutId === deleteWorkoutTarget.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
            </>
          ) : null
        }
      </AppModalTransition>
      <ChallengeProgressHistoryModal
        open={Boolean(challengeJournalModal?.eventId)}
        eventId={challengeJournalModal?.eventId || ''}
        eventTitleFallback={challengeJournalModal?.title || ''}
        memberDisplayName={displayName}
        resolveMediaUrl={resolveMediaUrl}
        onClosed={() => setChallengeJournalModal(null)}
      />
    </>
  )
}

export default Profile

