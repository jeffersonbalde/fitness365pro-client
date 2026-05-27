import React from 'react'
import { Link } from 'react-router-dom'
import {
  formatNotificationTime,
  isNotificationInteractive,
  resolveNotificationLink,
  resolveMediaUrl,
} from '../utils/notificationUtils'

export { formatNotificationTime, resolveMediaUrl } from '../utils/notificationUtils'

const iconForType = (type) => {
  switch (type) {
    case 'workout_liked':
    case 'comment_liked':
      return (
        <span className="notifications-item__icon notifications-item__icon--like" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </span>
      )
    case 'workout_commented':
    case 'comment_replied':
      return (
        <span className="notifications-item__icon notifications-item__icon--comment" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
      )
    case 'new_follower':
      return (
        <span className="notifications-item__icon notifications-item__icon--follow" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </span>
      )
    case 'progress_approved':
      return (
        <span className="notifications-item__icon notifications-item__icon--approved" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </span>
      )
    case 'progress_rejected':
      return (
        <span className="notifications-item__icon notifications-item__icon--rejected" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </span>
      )
    case 'login':
    case 'logout':
    default:
      return (
        <span className="notifications-item__icon notifications-item__icon--system" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </span>
      )
  }
}

const NotificationAvatar = ({ notification }) => {
  const actor = notification.actor
  const avatarUrl = resolveMediaUrl(actor?.profile_picture_url)
  const initial = (actor?.display_name || notification.title || 'N').charAt(0).toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="notifications-item__avatar"
      />
    )
  }

  return (
    <div className="notifications-item__avatar notifications-item__avatar--fallback" aria-hidden="true">
      {initial}
    </div>
  )
}

export const NotificationRow = ({ notification, onOpen, onRemove, compact = false }) => {
  const link = resolveNotificationLink(notification)
  const interactive = isNotificationInteractive(notification)
  const timeLabel = formatNotificationTime(notification.created_at)

  const handleClick = () => {
    onOpen?.(notification)
  }

  const handleRemove = (event) => {
    event.preventDefault()
    event.stopPropagation()
    onRemove?.(notification.id)
  }

  const content = (
    <>
      <div className="notifications-item__leading">
        <NotificationAvatar notification={notification} />
        {iconForType(notification.type)}
      </div>
      <div className="notifications-item__body">
        <p className="notifications-item__message">
          {!notification.actor && notification.title ? (
            <>
              <strong>{notification.title}</strong>
              {' — '}
              {notification.message}
            </>
          ) : (
            notification.message
          )}
        </p>
        {timeLabel ? (
          <time className="notifications-item__time" dateTime={notification.created_at}>
            {timeLabel}
          </time>
        ) : null}
      </div>
      {!compact && (
        <button
          type="button"
          className="notifications-item__dismiss"
          aria-label="Remove notification"
          onClick={handleRemove}
        >
          ×
        </button>
      )}
    </>
  )

  const className = [
    'notifications-item',
    notification.is_read ? '' : 'notifications-item--unread',
    interactive ? '' : 'notifications-item--static',
  ]
    .filter(Boolean)
    .join(' ')

  if (link) {
    return (
      <Link to={link} className={className} onClick={handleClick}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={`${className} notifications-item--button`} onClick={handleClick}>
      {content}
    </button>
  )
}

export default NotificationRow
