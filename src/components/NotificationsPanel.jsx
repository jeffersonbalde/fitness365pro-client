import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../contexts/NotificationsContext'
import NotificationRow from './NotificationRow'
import { AppLoadingState } from './AppLoadingState'

const NotificationsPanel = ({ open, onClose, palette }) => {
  const {
    items,
    unreadCount,
    loading,
    loaded,
    error,
    fetchNotifications,
    markRead,
    markAllRead,
    removeNotification,
  } = useNotifications()

  useEffect(() => {
    if (open) {
      fetchNotifications({ force: true })
    }
  }, [open, fetchNotifications])

  const handleOpen = async (notification) => {
    if (!notification.is_read) {
      await markRead(notification.id)
    }
    onClose?.()
  }

  return (
    <div
      className={`auth-navbar-notifications-panel ${open ? 'show' : ''}`}
      style={{
        background: palette.dropdownBg,
        borderColor: palette.dropdownBorder,
      }}
      role="dialog"
      aria-label="Notifications"
      aria-hidden={!open}
    >
      <div className="notifications-panel__header">
        <h2 className="notifications-panel__title">Notifications</h2>
        {unreadCount > 0 && (
          <button type="button" className="notifications-panel__mark-all" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      <div className={`notifications-panel__body ${!loading && items.length === 0 ? 'notifications-panel__body--empty' : ''}`}>
        {loading && !loaded ? (
          <div className="notifications-panel__state">
            <AppLoadingState hint="Loading notifications..." compact />
          </div>
        ) : error ? (
          <div className="notifications-panel__state">
            <p className="notifications-panel__empty">{error}</p>
            <button type="button" className="notifications-panel__retry" onClick={() => fetchNotifications({ force: true })}>
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="notifications-panel__state">
            <div className="notifications-panel__empty-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3C9.79086 3 8 4.79086 8 7V8.05172C8 8.74227 7.78047 9.4152 7.37227 9.97236L6.21922 11.5459C5.4452 12.6076 6.20409 14.125 7.52288 14.125H16.4771C17.7959 14.125 18.5548 12.6076 17.7808 11.5459L16.6277 9.97237C16.2195 9.4152 16 8.74227 16 8.05172V7C16 4.79086 14.2091 3 12 3Z" />
                <path d="M10 15.5C10 16.6046 10.8954 17.5 12 17.5C13.1046 17.5 14 16.6046 14 15.5" />
              </svg>
            </div>
            <p className="notifications-panel__empty-title">All caught up</p>
            <p className="notifications-panel__empty">Recent activity will appear here.</p>
          </div>
        ) : (
          <ul className="notifications-panel__list list-unstyled mb-0">
            {items.map((notification) => (
              <li key={notification.id}>
                <NotificationRow
                  notification={notification}
                  onOpen={handleOpen}
                  onRemove={removeNotification}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <div className="notifications-panel__footer">
          <Link to="/notifications" className="notifications-panel__see-all" onClick={onClose}>
            See all notifications
          </Link>
        </div>
      )}
    </div>
  )
}

export default NotificationsPanel
