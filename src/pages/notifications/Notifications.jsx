import React, { useEffect, useState } from 'react'
import { useNotifications } from '../../contexts/NotificationsContext'
import { useTheme } from '../../contexts/ThemeContext'
import NotificationRow from '../../components/NotificationRow'
import { AppLoadingState } from '../../components/AppLoadingState'
import './Notifications.css'

const NotificationsPage = () => {
  const { isDark } = useTheme()
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
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      await fetchNotifications({ force: true })
      if (active) setPageLoading(false)
    })()
    return () => {
      active = false
    }
  }, [fetchNotifications])

  const handleOpen = async (notification) => {
    if (!notification.is_read) {
      await markRead(notification.id)
    }
  }

  return (
    <div className={`notifications-page ${isDark ? 'is-dark' : ''}`}>
      <div className="container py-4 py-md-5">
        <div className="notifications-page__card">
          <div className="notifications-page__header">
            <div>
              <h1 className="notifications-page__title">Notifications</h1>
              <p className="notifications-page__subtitle">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button type="button" className="btn btn-outline-brand notifications-page__mark-all" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notifications-page__body">
            {(pageLoading || (loading && !loaded)) ? (
              <AppLoadingState hint="Loading notifications..." />
            ) : error ? (
              <div className="notifications-page__empty">
                <p>{error}</p>
                <button type="button" className="btn btn-primary-brand" onClick={() => fetchNotifications({ force: true })}>
                  Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="notifications-page__empty">
                <p className="notifications-page__empty-title">All caught up</p>
                <p>Recent activity will appear here.</p>
              </div>
            ) : (
              <ul className="notifications-page__list list-unstyled mb-0">
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
        </div>
      </div>
    </div>
  )
}

export default NotificationsPage
