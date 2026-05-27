const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

export const resolveMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

export const resolveNotificationLink = (notification) => {
  if (!notification) return null

  const type = notification.type
  const meta = notification.meta || {}

  if (type === 'login' || type === 'logout') {
    return null
  }

  if (type === 'new_follower') {
    const actorId = notification.actor?.id || meta.actor_client_id
    return actorId ? `/profile/${actorId}` : null
  }

  if (type === 'progress_approved' || type === 'progress_rejected') {
    const eventId = meta.admin_event_id
    return eventId ? `/challenges/${eventId}` : null
  }

  if (
    type === 'workout_liked' ||
    type === 'workout_commented' ||
    type === 'comment_replied' ||
    type === 'comment_liked'
  ) {
    return '/profile'
  }

  const rawLink = notification.link
  if (rawLink && rawLink !== '/settings' && rawLink !== '/login') {
    return rawLink
  }

  return null
}

export const formatNotificationTime = (iso) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const timePart = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return `Today at ${timePart}`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${timePart}`
  }

  const datePart = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })

  return `${datePart} at ${timePart}`
}

export const isNotificationInteractive = (notification) => Boolean(resolveNotificationLink(notification))
