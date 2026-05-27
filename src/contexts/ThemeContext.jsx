import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiRequest } from '../utils/api'
import { useAuth } from './AuthContext'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'ui_theme_mode'

const isValidTheme = (value) => value === 'light' || value === 'dark'

const resolveInitialTheme = () => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (isValidTheme(stored)) return stored
  // Product default: dark-first UI across the app (login, onboarding, dashboard, etc.)
  return 'dark'
}

export const ThemeProvider = ({ children }) => {
  const location = useLocation()
  const { client, isAuthenticated } = useAuth()
  const [theme, setThemeState] = useState(resolveInitialTheme)
  const loadedServerThemeForClientRef = useRef(null)

  /** Admin CMS routes stay light; admin login is always dark. */
  const pathname = typeof location.pathname === 'string' ? location.pathname : ''
  const isAdminLoginPage = pathname === '/admin/login'
  const isAdminForcedLight = pathname.startsWith('/admin') && !isAdminLoginPage
  const isAdminForcedDark = isAdminLoginPage
  const effectiveTheme = isAdminForcedLight ? 'light' : isAdminForcedDark ? 'dark' : theme

  const applyTheme = useCallback((value) => {
    document.documentElement.setAttribute('data-theme', value)
    document.body.setAttribute('data-theme', value)
  }, [])

  const setTheme = useCallback(async (nextTheme, { persistRemote = true } = {}) => {
    if (!isValidTheme(nextTheme)) return

    setThemeState(nextTheme)
    localStorage.setItem(STORAGE_KEY, nextTheme)

    if (persistRemote && isAuthenticated) {
      try {
        await apiRequest('/v1/profile', {
          method: 'PUT',
          body: { theme_mode: nextTheme },
        })
      } catch {
        // Silent fail: local mode still applies.
      }
    }
  }, [isAuthenticated])

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    await setTheme(next)
  }, [theme, setTheme])

  useEffect(() => {
    applyTheme(effectiveTheme)
  }, [applyTheme, effectiveTheme])

  useEffect(() => {
    if (!isAuthenticated || !client?.id) return
    if (loadedServerThemeForClientRef.current === client.id) return

    let mounted = true
    const loadServerTheme = async () => {
      try {
        const response = await apiRequest('/v1/profile', { method: 'GET' })
        const serverTheme = response?.data?.data?.profile?.theme_mode
        if (mounted && isValidTheme(serverTheme)) {
          setThemeState(serverTheme)
          localStorage.setItem(STORAGE_KEY, serverTheme)
        }
      } catch {
        // Ignore fetch errors and keep local theme.
      } finally {
        loadedServerThemeForClientRef.current = client.id
      }
    }

    loadServerTheme()
    return () => {
      mounted = false
    }
  }, [client?.id, isAuthenticated])

  const value = useMemo(() => ({
    theme,
    effectiveTheme,
    isAdminForcedLight,
    isAdminForcedDark,
    /** Use for UI palettes (inherits admin light chrome). */
    isDark: effectiveTheme === 'dark',
    setTheme,
    toggleTheme,
  }), [effectiveTheme, isAdminForcedLight, isAdminForcedDark, theme, setTheme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

