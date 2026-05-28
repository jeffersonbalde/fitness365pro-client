export { resolveMediaUrl } from './mediaUrl'

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
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
