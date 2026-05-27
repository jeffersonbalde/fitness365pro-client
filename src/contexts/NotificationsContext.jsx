import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { apiRequest } from '../utils/api'

const NotificationsContext = createContext(null)

const POLL_MS = 45000

export const NotificationsProvider = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef(null)
  const fetchInFlightRef = useRef(false)

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0)
      return
    }

    try {
      const response = await apiRequest('/v1/notifications/unread-count', { method: 'GET' })
      if (response?.data?.success) {
        setUnreadCount(Number(response.data.data?.unread_count ?? 0))
      }
    } catch {
      // Silent — badge is non-critical.
    }
  }, [isAuthenticated])

  const fetchNotifications = useCallback(async ({ force = false } = {}) => {
    if (!isAuthenticated) {
      setItems([])
      setUnreadCount(0)
      setLoaded(false)
      return
    }

    if (fetchInFlightRef.current && !force) return

    fetchInFlightRef.current = true
    setLoading(true)
    setError('')

    try {
      const response = await apiRequest('/v1/notifications?per_page=30', { method: 'GET' })
      if (response?.data?.success) {
        setItems(response.data.data?.items ?? [])
        setLoaded(true)
      } else {
        setError('Could not load notifications.')
      }
      await fetchUnreadCount()
    } catch {
      setError('Could not load notifications.')
    } finally {
      fetchInFlightRef.current = false
      setLoading(false)
    }
  }, [fetchUnreadCount, isAuthenticated])

  const markRead = useCallback(async (id) => {
    try {
      const response = await apiRequest(`/v1/notifications/${id}/read`, { method: 'POST' })
      if (response?.data?.success) {
        const nextUnread = Number(response.data.data?.unread_count ?? 0)
        setUnreadCount(nextUnread)
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  is_read: true,
                  read_at: response.data.data?.notification?.read_at ?? new Date().toISOString(),
                }
              : item,
          ),
        )
      }
    } catch {
      // Ignore — row still navigates.
    }
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      const response = await apiRequest('/v1/notifications/read-all', { method: 'POST' })
      if (response?.data?.success) {
        setUnreadCount(0)
        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            is_read: true,
            read_at: item.read_at ?? new Date().toISOString(),
          })),
        )
      }
    } catch {
      // Ignore.
    }
  }, [])

  const removeNotification = useCallback(async (id) => {
    try {
      const response = await apiRequest(`/v1/notifications/${id}`, { method: 'DELETE' })
      if (response?.data?.success) {
        setUnreadCount(Number(response.data.data?.unread_count ?? 0))
        setItems((prev) => prev.filter((item) => item.id !== id))
      }
    } catch {
      // Ignore.
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([])
      setUnreadCount(0)
      setLoaded(false)
      return undefined
    }

    fetchUnreadCount()
    pollRef.current = setInterval(fetchUnreadCount, POLL_MS)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchUnreadCount, isAuthenticated])

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      loaded,
      error,
      fetchNotifications,
      fetchUnreadCount,
      markRead,
      markAllRead,
      removeNotification,
    }),
    [
      items,
      unreadCount,
      loading,
      loaded,
      error,
      fetchNotifications,
      fetchUnreadCount,
      markRead,
      markAllRead,
      removeNotification,
    ],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export const useNotifications = () => {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}
