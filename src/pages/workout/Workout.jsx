import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiRequest } from '../../utils/api'
import { notifySuccess, notifyError } from '../../utils/notifications'
import {
  isAcceptableWorkoutImageFile,
  normalizeApiFieldErrors,
  WORKOUT_IMAGE_ACCEPT,
} from '../../utils/workoutImages'
import { isJoinedChallengeGoalCompleted } from '../challenges/eventCatalog'
import WorkoutMetricsFields from '../../components/workout/WorkoutMetricsFields'
import {
  totalSecondsToDurationMinutes,
  totalSecondsToHms,
  validateWorkoutHms,
} from '../../utils/workoutDuration'
import './Workout.css'

const QUICK_WORKOUT_TYPES = [
  'Strength Training',
  'Easy Run',
  'Tempo Run',
  'HIIT',
  'Cycling',
  'Yoga / Mobility',
]

const Workout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [workoutData, setWorkoutData] = useState({
    entry_type: location.state?.entryType === 'post' ? 'post' : 'workout',
    workout_type: '',
    workout_date: new Date().toISOString().split('T')[0],
    duration_hours: '',
    duration_minutes: '',
    distance_km: '',
    duration_seconds: '',
    caption: '',
    location: '',
    notes: '',
    status: 'completed',
  })
  const [selectedImages, setSelectedImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [joinedChallenges, setJoinedChallenges] = useState([])
  const [joinedChallengesLoading, setJoinedChallengesLoading] = useState(true)
  const [linkedEventId, setLinkedEventId] = useState(() =>
    location.state?.adminEventId ? String(location.state.adminEventId) : '',
  )

  const prefilledEvent = useMemo(() => {
    const id = location.state?.adminEventId
    if (!id) return null
    return {
      id: String(id),
      name: location.state?.adminEventName || 'Selected event',
      goalKm:
        location.state?.adminEventGoalKm != null
          ? Number(location.state.adminEventGoalKm)
          : null,
    }
  }, [
    location.state?.adminEventId,
    location.state?.adminEventName,
    location.state?.adminEventGoalKm,
  ])

  useEffect(() => {
    if (location.state?.adminEventId) {
      setLinkedEventId(String(location.state.adminEventId))
    }
  }, [location.state?.adminEventId])

  useEffect(() => {
    let cancelled = false
    const loadChallenges = async () => {
      setJoinedChallengesLoading(true)
      try {
        const res = await apiRequest('/v1/workouts/stats', { method: 'GET' })
        if (!cancelled && res.data?.success && Array.isArray(res.data?.data?.joined_challenge_events)) {
          setJoinedChallenges(res.data.data.joined_challenge_events)
        }
      } catch {
        /* optional picker */
      } finally {
        if (!cancelled) setJoinedChallengesLoading(false)
      }
    }
    loadChallenges()

    return () => {
      cancelled = true
    }
  }, [])

  const activeJoinedChallenges = useMemo(
    () => joinedChallenges.filter((ev) => !isJoinedChallengeGoalCompleted(ev)),
    [joinedChallenges],
  )

  useEffect(() => {
    if (joinedChallengesLoading) return
    if (!linkedEventId) return
    if (joinedChallenges.length === 0) {
      if (prefilledEvent && linkedEventId === prefilledEvent.id) return
      return
    }
    const allowed = joinedChallenges.some(
      (ev) => String(ev.event_id) === linkedEventId && !isJoinedChallengeGoalCompleted(ev),
    )
    if (!allowed && !(prefilledEvent && linkedEventId === prefilledEvent.id)) {
      setLinkedEventId('')
    }
  }, [joinedChallenges, joinedChallengesLoading, linkedEventId, prefilledEvent])

  const showEventLinker = workoutData.entry_type === 'workout'
    && (Boolean(prefilledEvent) || joinedChallengesLoading || activeJoinedChallenges.length > 0)

  const selectedEventLabel = useMemo(() => {
    if (!linkedEventId) return null
    const fromList = activeJoinedChallenges.find(
      (ev) => String(ev.event_id) === linkedEventId,
    )
    if (fromList) return fromList.title || 'Challenge'
    if (prefilledEvent && prefilledEvent.id === linkedEventId) return prefilledEvent.name
    return null
  }, [activeJoinedChallenges, linkedEventId, prefilledEvent])

  const selectedEventGoalLabel = useMemo(() => {
    if (!linkedEventId) return null
    const fromList = activeJoinedChallenges.find(
      (ev) => String(ev.event_id) === linkedEventId,
    )
    const goalKm = fromList?.progress_goal_km ?? prefilledEvent?.goalKm
    if (typeof goalKm === 'number' && goalKm > 0) {
      return `Goal ${goalKm} km`
    }
    return null
  }, [activeJoinedChallenges, linkedEventId, prefilledEvent])

  const clearDurationErrors = () => {
    setErrors((prev) => {
      const next = { ...prev }
      delete next.duration
      delete next.duration_hours
      delete next.duration_minutes
      delete next.duration_seconds
      return next
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setWorkoutData(prev => ({
      ...prev,
      [name]: value,
    }))
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleDurationPartChange = (name, value) => {
    setWorkoutData((prev) => ({ ...prev, [name]: value }))
    clearDurationErrors()
  }

  useEffect(() => {
    const prefilledMinutes = location.state?.duration
    if (prefilledMinutes == null || prefilledMinutes === '') return
    const totalSeconds = Number(prefilledMinutes) * 60
    if (!Number.isFinite(totalSeconds) || totalSeconds < 1) return
    const hms = totalSecondsToHms(totalSeconds)
    setWorkoutData((prev) => ({
      ...prev,
      duration_hours: hms.hours,
      duration_minutes: hms.minutes,
      duration_seconds: hms.seconds,
    }))
  }, [location.state?.duration])

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const accepted = []
    const rejected = []

    files.forEach((file) => {
      if (isAcceptableWorkoutImageFile(file)) {
        accepted.push(file)
      } else {
        rejected.push(file.name || 'Unknown file')
      }
    })

    if (rejected.length > 0) {
      notifyError(`Unsupported file type: ${rejected.join(', ')}`)
    }

    if (accepted.length > 0) {
      setSelectedImages((prev) => [...prev, ...accepted])
      if (errors.workout_images) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next.workout_images
          return next
        })
      }
    }

    e.target.value = ''
  }

  const removeImageAtIndex = (idxToRemove) => {
    setSelectedImages(prev => prev.filter((_, idx) => idx !== idxToRemove))
  }

  useEffect(() => {
    const previews = selectedImages.map(file => URL.createObjectURL(file))
    setImagePreviews(previews)

    return () => {
      previews.forEach(url => URL.revokeObjectURL(url))
    }
  }, [selectedImages])

  useEffect(() => {
    if (!location.state?.entryType) return
    setWorkoutData(prev => ({
      ...prev,
      entry_type: location.state.entryType === 'post' ? 'post' : 'workout',
    }))
  }, [location.state?.entryType])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = {}
    const isPostEntry = workoutData.entry_type === 'post'
    const workoutType = workoutData.workout_type.trim()
    if (!isPostEntry && !workoutType) {
      nextErrors.workout_type = 'Workout type is required.'
    }

    if (!workoutData.workout_date) {
      nextErrors.workout_date = 'Workout date is required.'
    }

    const selectedDate = new Date(workoutData.workout_date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (selectedDate > today) {
      nextErrors.workout_date = 'Workout date cannot be in the future.'
    }

    const distanceValue = workoutData.distance_km ? parseFloat(workoutData.distance_km) : null
    let totalDurationSeconds = null
    let durationMinutesValue = null

    if (!isPostEntry) {
      const durationCheck = validateWorkoutHms(
        workoutData.duration_hours,
        workoutData.duration_minutes,
        workoutData.duration_seconds,
      )
      if (!durationCheck.valid) {
        nextErrors[durationCheck.field] = durationCheck.message
      } else {
        totalDurationSeconds = durationCheck.totalSeconds
        durationMinutesValue = totalSecondsToDurationMinutes(totalDurationSeconds)
      }
    }

    if (!isPostEntry && (distanceValue === null || Number.isNaN(distanceValue) || distanceValue <= 0)) {
      nextErrors.distance_km = 'Distance is required and must be greater than 0.'
    }

    const captionValue = workoutData.caption.trim()
    if (isPostEntry && captionValue.length === 0) {
      nextErrors.caption = 'Caption is required.'
    }

    const locationValue = workoutData.location.trim()
    if (!locationValue) {
      nextErrors.location = 'Location is required.'
    }

    const notesValue = workoutData.notes.trim()
    if (!isPostEntry && notesValue.length === 0) {
      nextErrors.notes = 'Caption is required.'
    }

    if (selectedImages.length === 0) {
      nextErrors.workout_images = 'At least one image is required.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      notifyError(Object.values(nextErrors)[0])
      return
    }

    setLoading(true)

    try {
      const planDay = location.state?.planDay || null
      const formPayload = new FormData()
      formPayload.append('entry_type', workoutData.entry_type)
      formPayload.append('workout_date', workoutData.workout_date)
      formPayload.append('status', workoutData.status || 'completed')
      formPayload.append('location', locationValue)
      if (captionValue) formPayload.append('caption', captionValue)

      if (!isPostEntry) formPayload.append('workout_type', workoutType)
      if (!isPostEntry && durationMinutesValue !== null) {
        formPayload.append('duration_minutes', String(durationMinutesValue))
      }
      if (!isPostEntry && distanceValue !== null && !Number.isNaN(distanceValue)) {
        formPayload.append('distance_km', String(distanceValue))
      }
      if (!isPostEntry && totalDurationSeconds !== null) {
        formPayload.append('duration_seconds', String(totalDurationSeconds))
      }
      formPayload.append('notes', notesValue)
      if (!isPostEntry && planDay) formPayload.append('plan_day', String(planDay))
      if (!isPostEntry) {
        formPayload.append('admin_event_id', linkedEventId ? String(linkedEventId).trim() : '')
      }

      selectedImages.forEach((file, index) => {
        formPayload.append(`workout_images[${index}]`, file, file.name || `photo-${index + 1}.jpg`)
      })

      const res = await apiRequest('/v1/workouts', {
        method: 'POST',
        body: formPayload,
      })

      if (res.data.success) {
        notifySuccess(isPostEntry ? 'Post shared successfully.' : 'Workout logged successfully.', { icon: false })
        const returnTo = typeof location.state?.returnTo === 'string' ? location.state.returnTo : ''
        navigate(returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard', { replace: true })
      }
    } catch (error) {
      console.error('Failed to log workout', error)
      const apiErrors = normalizeApiFieldErrors(error?.response?.data?.errors || {})
      if (Object.keys(apiErrors).length > 0) {
        setErrors(apiErrors)
      }
      const firstFieldError = Object.values(apiErrors)[0]
      const errorMsg =
        firstFieldError ||
        error?.response?.data?.message ||
        'Failed to log workout. Please try again.'
      notifyError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="d-flex flex-column workout-shell" style={{ minHeight: '100vh' }}>
      <main className="flex-grow-1">
          <div className="container workout-page py-4 py-md-5 px-3 px-md-4">
            <div className="workout-editor">
              <div className="workout-header">
                <h2 className="workout-title">Workout Entry</h2>
                <p className="workout-subtitle">Add a workout record or share a quick update.</p>
              </div>

              <form onSubmit={handleSubmit} className="workout-form">
                <section className="workout-block">
                  <div className="mb-3 workout-section">
                        <label htmlFor="entry_type" className="form-label workout-label">
                          Entry type *
                        </label>
                        <select
                          id="entry_type"
                          name="entry_type"
                          className="form-select workout-input"
                          value={workoutData.entry_type}
                          onChange={handleChange}
                        >
                          <option value="workout">Workout</option>
                          <option value="post">Post update</option>
                        </select>
                  </div>
                </section>

                {workoutData.entry_type === 'workout' ? (
                  <section className="workout-block">
                    {showEventLinker && (
                      <div className="mb-4 workout-section workout-linked-event-section">
                        <label htmlFor="linked_challenge_event" className="form-label workout-label">
                          Event for this workout
                        </label>
                        {prefilledEvent && linkedEventId === prefilledEvent.id && (
                          <div className="workout-linked-event-card" role="status">
                            <div className="workout-linked-event-card__badge">Linked event</div>
                            <div className="workout-linked-event-card__title">
                              {selectedEventLabel || prefilledEvent.name}
                            </div>
                            {selectedEventGoalLabel && (
                              <div className="workout-linked-event-card__meta">{selectedEventGoalLabel}</div>
                            )}
                            <p className="workout-linked-event-card__hint mb-0">
                              This workout will count toward the event you opened from. You can change it below if needed.
                            </p>
                          </div>
                        )}
                        {joinedChallengesLoading ? (
                          <div className="workout-linked-event-loading" aria-live="polite">
                            Loading your joined events…
                          </div>
                        ) : activeJoinedChallenges.length > 0 ? (
                          <>
                            <select
                              id="linked_challenge_event"
                              className="form-select workout-input"
                              value={linkedEventId}
                              onChange={(e) => setLinkedEventId(e.target.value)}
                              aria-describedby="linked_challenge_help"
                            >
                              <option value="">Do not attach to an event</option>
                              {activeJoinedChallenges.map((ev) => (
                                <option key={ev.event_id} value={ev.event_id}>
                                  {ev.title || 'Challenge'}
                                  {typeof ev.progress_goal_km === 'number' && ev.progress_goal_km > 0
                                    ? ` · goal ${ev.progress_goal_km} km`
                                    : ''}
                                </option>
                              ))}
                            </select>
                            <div id="linked_challenge_help" className="small mt-1 workout-help-muted">
                              Distance is sent for review before it counts toward the event.
                            </div>
                          </>
                        ) : prefilledEvent && linkedEventId === prefilledEvent.id ? (
                          <div id="linked_challenge_help" className="small mt-1 workout-help-muted">
                            Your event is pre-selected from the Events page.
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="mb-3 workout-section">
                        <label htmlFor="workout_type" className="form-label workout-label">
                          Activity type *
                        </label>
                        <input
                          type="text"
                          className="form-control workout-input"
                          id="workout_type"
                          name="workout_type"
                          value={workoutData.workout_type}
                          onChange={handleChange}
                          required
                          placeholder="Activity type"
                        />
                        {errors.workout_type && (
                          <small className="text-danger d-block mt-1">{errors.workout_type}</small>
                        )}
                        <div className="workout-type-grid">
                          {QUICK_WORKOUT_TYPES.map(type => (
                            <button
                              key={type}
                              type="button"
                              className={`workout-type-chip ${workoutData.workout_type === type ? 'is-active' : ''}`}
                              onClick={() => setWorkoutData(prev => ({ ...prev, workout_type: type }))}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                    </div>

                    <div className="mb-3 workout-section">
                        <label htmlFor="workout_date" className="form-label workout-label">
                          Date *
                        </label>
                        <input
                          type="date"
                          className="form-control workout-input"
                          id="workout_date"
                          name="workout_date"
                          value={workoutData.workout_date}
                          onChange={handleChange}
                          required
                          max={new Date().toISOString().split('T')[0]}
                        />
                        {errors.workout_date && (
                          <small className="text-danger d-block mt-1">{errors.workout_date}</small>
                        )}
                    </div>

                    <WorkoutMetricsFields
                      distanceKm={workoutData.distance_km}
                      durationHours={workoutData.duration_hours}
                      durationMinutes={workoutData.duration_minutes}
                      durationSeconds={workoutData.duration_seconds}
                      onDistanceChange={handleChange}
                      onDurationPartChange={handleDurationPartChange}
                      errors={errors}
                    />
                  </section>
                ) : (
                  <section className="workout-block">
                    <div className="mb-3 workout-section">
                            <label htmlFor="workout_date" className="form-label workout-label">
                              Date *
                            </label>
                            <input
                              type="date"
                              className="form-control workout-input"
                              id="workout_date"
                              name="workout_date"
                              value={workoutData.workout_date}
                              onChange={handleChange}
                              required
                              max={new Date().toISOString().split('T')[0]}
                            />
                            {errors.workout_date && (
                              <small className="text-danger d-block mt-1">{errors.workout_date}</small>
                            )}
                    </div>

                    <div className="mb-3 workout-section">
                            <label htmlFor="caption" className="form-label workout-label">
                              Caption *
                            </label>
                            <textarea
                              className="form-control workout-textarea"
                              id="caption"
                              name="caption"
                              rows="4"
                              value={workoutData.caption}
                              onChange={handleChange}
                              placeholder="Write a caption"
                              maxLength={2200}
                              required
                            />
                            {errors.caption && (
                              <small className="text-danger d-block mt-1">{errors.caption}</small>
                            )}
                    </div>

                    <div className="mb-3 workout-section">
                            <label htmlFor="location" className="form-label workout-label">
                              Location *
                            </label>
                            <input
                              type="text"
                              className="form-control workout-input"
                              id="location"
                              name="location"
                              value={workoutData.location}
                              onChange={handleChange}
                              placeholder="Location"
                              maxLength={255}
                              required
                            />
                            {errors.location && (
                              <small className="text-danger d-block mt-1">{errors.location}</small>
                            )}
                    </div>
                  </section>
                )}

                <section className="workout-block">
                  {workoutData.entry_type === 'workout' && (
                    <div className="mb-3 workout-section">
                      <label htmlFor="notes" className="form-label workout-label">
                        Caption *
                      </label>
                      <textarea
                        className="form-control workout-textarea"
                        id="notes"
                        name="notes"
                        rows="3"
                        value={workoutData.notes}
                        onChange={handleChange}
                        placeholder="Write a caption"
                        maxLength={1000}
                        required
                      />
                      {errors.notes && (
                        <small className="text-danger d-block mt-1">{errors.notes}</small>
                      )}
                    </div>
                  )}

                  {workoutData.entry_type === 'workout' && (
                    <div className="mb-3 workout-section">
                      <label htmlFor="location" className="form-label workout-label">
                        Location *
                      </label>
                      <input
                        type="text"
                        className="form-control workout-input"
                        id="location"
                        name="location"
                        value={workoutData.location}
                        onChange={handleChange}
                        placeholder="Location"
                        maxLength={255}
                        required
                      />
                      {errors.location && (
                        <small className="text-danger d-block mt-1">{errors.location}</small>
                      )}
                    </div>
                  )}

                  <div className="mb-4 workout-section">
                        <label htmlFor="workout_images" className="form-label workout-label">
                          Upload Images *
                        </label>
                        <div className="image-upload-dropzone">
                          <input
                            id="workout_images"
                            type="file"
                            accept={WORKOUT_IMAGE_ACCEPT}
                            multiple
                            className="form-control image-upload-input"
                            onChange={handleImageSelect}
                          />
                          <div className="image-upload-hint">
                            Add at least one photo for this entry.
                          </div>
                          {errors.workout_images && (
                            <small className="text-danger d-block mt-2">{errors.workout_images}</small>
                          )}
                          {imagePreviews.length > 0 && (
                            <div className="image-preview-grid">
                              {imagePreviews.map((previewUrl, idx) => (
                                <div className="image-preview-card" key={`${previewUrl}-${idx}`}>
                                  <img src={previewUrl} alt={`Workout preview ${idx + 1}`} />
                                  <button
                                    type="button"
                                    className="image-preview-remove"
                                    onClick={() => removeImageAtIndex(idx)}
                                    aria-label="Remove image"
                                  >
                                    x
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                  </div>
                </section>

                <div className="d-flex gap-2 workout-actions">
                  <button
                    type="button"
                    className="btn workout-btn workout-btn-cancel"
                    onClick={() => navigate('/dashboard')}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn workout-btn workout-btn-save"
                    disabled={loading}
                  >
                    {loading
                      ? (workoutData.entry_type === 'post' ? 'Sharing Post...' : 'Saving Workout...')
                      : (workoutData.entry_type === 'post' ? 'Post Update' : 'Save Entry')}
                  </button>
                </div>
              </form>
            </div>
          </div>
      </main>
    </div>
  )
}

export default Workout

