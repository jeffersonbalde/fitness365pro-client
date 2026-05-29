import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationsContext'
import { useTheme } from '../contexts/ThemeContext'
import { apiRequest } from '../utils/api'
import { getCachedProfilePictureUrl, setCachedProfilePictureUrl } from '../utils/profileCache'
import NotificationsPanel from './NotificationsPanel'
import logoFinal from '../assets/images/logo_final.png'
import './AuthNavbar.css'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const resolveMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

const mobileNavIconClass = 'auth-navbar-mobile-link__icon d-flex flex-shrink-0 align-items-center justify-content-center'

const AuthNavbar = () => {
  const { client, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showWorkoutMenu, setShowWorkoutMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [peopleResults, setPeopleResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchBoxRef = useRef(null)
  const desktopSearchInputRef = useRef(null)
  const mobileSearchRootRef = useRef(null)
  const mobileSearchInputRef = useRef(null)
  const workoutMenuRef = useRef(null)
  const userMenuRef = useRef(null)
  const notificationsRef = useRef(null)
  const routeLoadingTimeoutRef = useRef(null)

  const closeNavbarMenus = useCallback(() => {
    setShowUserMenu(false)
    setShowWorkoutMenu(false)
    setShowNotifications(false)
  }, [])

  const navigateWithLoading = (to) => {
    if (location.pathname === to) return
    setRouteLoading(true)
    navigate(to)
  }

  const closeAllSearch = useCallback(() => {
    setSearchOpen(false)
    setMobileSearchOpen(false)
  }, [])

  const clearSearchQuery = useCallback(() => {
    setSearchQuery('')
    setSearchOpen(true)
    window.setTimeout(() => {
      if (mobileSearchOpen) {
        mobileSearchInputRef.current?.focus()
      } else {
        desktopSearchInputRef.current?.focus()
      }
    }, 0)
  }, [mobileSearchOpen])

  const palette = isDark
    ? {
        navBg: '#0a0b0f',
        navBorder: '#2a3042',
        navPrimary: '#f8fafc',
        navMuted: '#cbd5e1',
        avatarBg: '#1a1d28',
        avatarText: '#f1f5f9',
        dropdownBg: '#12141c',
        dropdownBorder: '#2a3042',
        dropdownHeader: '#9ca3af',
      }
    : {
        navBg: '#ffffff',
        navBorder: '#d6dee8',
        navPrimary: '#111827',
        navMuted: '#374151',
        avatarBg: '#eef2f7',
        avatarText: '#1f2937',
        dropdownBg: '#ffffff',
        dropdownBorder: '#d6dee8',
        dropdownHeader: '#6b7280',
      }

  const pathname = location.pathname
  const isFeedActive = pathname === '/dashboard'
  const isTrainingActive = pathname.startsWith('/workout')
  const isLeaderboardsActive = pathname.startsWith('/leaderboards')
  const isEventsActive = pathname.startsWith('/challenges')

  const navLinkProps = (active) => ({
    className: `nav-link auth-navbar-mobile-link${active ? ' auth-navbar-mobile-link--active' : ''}`,
    style: {
      fontSize: '0.9rem',
      fontWeight: active ? 600 : 500,
      color: active ? palette.navPrimary : palette.navMuted,
    },
  })

  const handleLogout = async () => {
    if (isLoggingOut) return

    const result = await Swal.fire({
      title: 'Log out now?',
      text: 'You will need to sign in again to continue.',
      icon: 'warning',
      showClass: {
        backdrop: 'swal2-backdrop-show app-modal-swal-backdrop-in',
        popup: 'app-modal-swal-popup-in',
      },
      hideClass: {
        backdrop: 'swal2-backdrop-hide app-modal-swal-backdrop-out',
        popup: 'app-modal-swal-popup-out',
      },
      showCancelButton: true,
      confirmButtonText: 'Yes, log out',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      allowOutsideClick: () => !Swal.isLoading(),
      allowEscapeKey: () => !Swal.isLoading(),
      width: 430,
      heightAuto: false,
      scrollbarPadding: false,
      customClass: {
        popup: 'system-swal-popup',
        title: 'system-swal-title',
        htmlContainer: 'system-swal-text',
        confirmButton: 'system-swal-confirm',
        cancelButton: 'system-swal-cancel',
      },
      buttonsStyling: false,
      preConfirm: async () => {
        const confirmButton = Swal.getConfirmButton()
        const cancelButton = Swal.getCancelButton()
        if (confirmButton) {
          confirmButton.disabled = true
          confirmButton.textContent = 'Logging out...'
        }
        if (cancelButton) cancelButton.disabled = true

        try {
          setIsLoggingOut(true)
          await logout()
          return true
        } catch (error) {
          const message = error?.response?.data?.message || 'Logout failed. Please try again.'
          Swal.showValidationMessage(message)
          if (confirmButton) {
            confirmButton.disabled = false
            confirmButton.textContent = 'Yes, log out'
          }
          if (cancelButton) cancelButton.disabled = false
          return false
        } finally {
          setIsLoggingOut(false)
        }
      },
    })

    if (result.isConfirmed) {
      setShowMenu(false)
      setShowUserMenu(false)
      navigate('/login')
    }
  }

  useEffect(() => {
    const handleMouseDown = (event) => {
      const inDesktop = searchBoxRef.current?.contains(event.target)
      const inMobile = mobileSearchRootRef.current?.contains(event.target)
      if (!inDesktop && !inMobile) {
        setSearchOpen(false)
        setMobileSearchOpen(false)
      }

      if (!workoutMenuRef.current?.contains(event.target)) {
        setShowWorkoutMenu(false)
      }
      if (!userMenuRef.current?.contains(event.target)) {
        setShowUserMenu(false)
      }
      if (!notificationsRef.current?.contains(event.target)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  useEffect(() => {
    if (!showUserMenu && !showWorkoutMenu && !showNotifications) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') closeNavbarMenus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showUserMenu, showWorkoutMenu, showNotifications, closeNavbarMenus])

  useEffect(() => {
    closeNavbarMenus()
  }, [location.pathname, closeNavbarMenus])

  useEffect(() => {
    if (!routeLoading) return

    if (routeLoadingTimeoutRef.current) {
      clearTimeout(routeLoadingTimeoutRef.current)
    }

    routeLoadingTimeoutRef.current = setTimeout(() => {
      setRouteLoading(false)
      routeLoadingTimeoutRef.current = null
    }, 500)

    return () => {
      if (routeLoadingTimeoutRef.current) {
        clearTimeout(routeLoadingTimeoutRef.current)
        routeLoadingTimeoutRef.current = null
      }
    }
  }, [location.pathname, routeLoading])

  useEffect(() => {
    closeAllSearch()
  }, [location.pathname, closeAllSearch])

  useEffect(() => {
    if (!showMenu) setShowWorkoutMenu(false)
  }, [showMenu])

  useEffect(() => {
    const loadNavbarProfile = async () => {
      if (!client) {
        setAvatarUrl('')
        return
      }

      const cachedUrl = getCachedProfilePictureUrl(client.id)
      if (cachedUrl) {
        setAvatarUrl(cachedUrl)
        return
      }

      try {
        const profileRes = await apiRequest('/v1/profile', { method: 'GET' })
        if (profileRes?.data?.success) {
          const profilePictureUrl = profileRes?.data?.data?.profile?.profile_picture_url || ''
          setCachedProfilePictureUrl(client.id, profilePictureUrl)
          setAvatarUrl(profilePictureUrl)
        }
      } catch {
        setAvatarUrl('')
      }
    }

    loadNavbarProfile()
  }, [client])

  useEffect(() => {
    const query = searchQuery.trim()
    if (query.length < 2) {
      setPeopleResults([])
      setSearchError('')
      return
    }

    let isActive = true
    const timeoutId = setTimeout(async () => {
      setSearchLoading(true)
      setSearchError('')
      try {
        const peopleResponse = await apiRequest(
          `/v1/social/discover?${new URLSearchParams({ query, limit: '8' })}`,
          { method: 'GET' }
        )

        if (!isActive) return

        setPeopleResults(peopleResponse?.data?.success ? (peopleResponse.data?.data?.results || []) : [])
      } catch {
        if (!isActive) return
        setPeopleResults([])
        setSearchError('Search failed. Please try again.')
      } finally {
        if (isActive) setSearchLoading(false)
      }
    }, 260)

    return () => {
      isActive = false
      clearTimeout(timeoutId)
    }
  }, [searchQuery])

  useEffect(() => {
    if (!mobileSearchOpen) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      mobileSearchInputRef.current?.focus()
    }, 60)
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeAllSearch()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileSearchOpen, closeAllSearch])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 992px)')
    const onChange = () => {
      if (mq.matches) setMobileSearchOpen(false)
    }
    mq.addEventListener('change', onChange)
    onChange()
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const renderPeopleSearchResults = () => {
    if (searchQuery.trim().length < 2) {
      return <div className="nav-search-hint">Type at least 2 characters to search.</div>
    }
    return (
      <>
        {searchLoading && <div className="nav-search-hint">Searching...</div>}
        {searchError && <div className="nav-search-error">{searchError}</div>}
        {!searchLoading && !searchError && (
          <div className="nav-search-section">
            <div className="nav-search-section-title">People</div>
            {peopleResults.length === 0 ? (
              <div className="nav-search-empty">No people found.</div>
            ) : (
              peopleResults.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="nav-search-item"
                  onClick={() => {
                    navigateWithLoading(`/profile/${person.id}`)
                    closeAllSearch()
                    setShowMenu(false)
                  }}
                >
                  <div className="nav-search-avatar">
                    {person.profile_picture_url ? (
                      <img
                        src={resolveMediaUrl(person.profile_picture_url)}
                        alt={person.display_name || 'User'}
                      />
                    ) : (
                      <span>{(person.display_name?.charAt(0) || 'U').toUpperCase()}</span>
                    )}
                  </div>
                  <div className="nav-search-item-content">
                    <div className="nav-search-item-title">{person.display_name || 'User'}</div>
                    <div className="nav-search-item-sub">
                      {[person.city, person.province].filter(Boolean).join(', ') || 'Fitness 365 Pro Member'}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <>
    <nav
      className="navbar navbar-expand-lg fixed-top auth-navbar py-0"
      style={{
        backgroundColor: palette.navBg,
        borderBottom: `1px solid ${palette.navBorder}`,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1030,
        boxShadow: isDark ? 'none' : '0 1px 4px rgba(15, 23, 42, 0.06)',
      }}
    >
      {routeLoading && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '2px',
            background: 'linear-gradient(90deg, #1D79BC 0%, #5FD100 100%)',
          }}
        />
      )}
      <div className="container px-4 px-md-5 auth-navbar-inner">
        <div className="auth-navbar-toolbar min-w-0">
          <Link
            className="navbar-brand d-flex align-items-center me-1 me-lg-3 flex-shrink-0"
            to="/dashboard"
            style={{ textDecoration: 'none' }}
          >
            <img src={logoFinal} alt="Fitness 365 Pro" className="auth-navbar-logo-img" />
          </Link>

          <div
            ref={searchBoxRef}
            className={`nav-global-search d-none d-lg-flex align-items-center min-w-0 ${isDark ? 'is-dark' : ''}`}
          >
            <div className={`nav-global-search-input-wrap${searchQuery ? ' has-clear' : ''}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-global-search-icon">
                <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm9.7 16.3-3.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                ref={desktopSearchInputRef}
                type="text"
                className="nav-global-search-input"
                placeholder="Search people"
                value={searchQuery}
                onFocus={() => {
                  closeNavbarMenus()
                  setSearchOpen(true)
                }}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  closeNavbarMenus()
                  setSearchOpen(true)
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="nav-global-search-clear"
                  onClick={clearSearchQuery}
                  aria-label="Clear search"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {searchOpen && (
              <div className="nav-global-search-dropdown">
                {renderPeopleSearchResults()}
              </div>
            )}
          </div>

        <ul
          id="auth-navbar-mobile-drawer"
          className={`navbar-nav align-items-lg-center gap-lg-3 pt-1 pt-lg-0 mt-0 mt-lg-0 auth-navbar-menu-links auth-navbar-mobile-drawer collapse navbar-collapse auth-navbar-collapse ${showMenu ? 'show' : ''}`}
        >
            <li className="nav-item d-none d-lg-block">
              <Link
                {...navLinkProps(isFeedActive)}
                to="/dashboard"
                onClick={() => setShowMenu(false)}
              >
                <span className={mobileNavIconClass} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1v-9.5Z"
                      stroke="currentColor"
                      strokeWidth="1.65"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="auth-navbar-mobile-link__label">Feed</span>
              </Link>
            </li>
            <li className="nav-item auth-navbar-mobile-training d-none d-lg-block">
              <div className="dropdown w-100 w-lg-auto" ref={workoutMenuRef}>
                <button
                  type="button"
                  className={`nav-link auth-navbar-mobile-link auth-navbar-mobile-link--trigger btn border-0 bg-transparent w-100 text-start d-inline-flex align-items-center gap-2${isTrainingActive ? ' auth-navbar-mobile-link--active' : ''}`}
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: isTrainingActive ? 600 : 500,
                    color: isTrainingActive ? palette.navPrimary : palette.navMuted,
                  }}
                  aria-expanded={showWorkoutMenu}
                  onClick={() => {
                    setShowUserMenu(false)
                    setShowWorkoutMenu((prev) => !prev)
                  }}
                >
                  <span className={mobileNavIconClass} aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 16l4-6 4 3 4-7 4 10"
                        stroke="currentColor"
                        strokeWidth="1.65"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="auth-navbar-mobile-link__label flex-grow-1">Training</span>
                  <span className={`auth-navbar-mobile-link__chev${showWorkoutMenu ? ' is-open' : ''}`} aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                <ul
                  className={`dropdown-menu auth-navbar-mobile-submenu ${showWorkoutMenu ? 'show' : ''}`}
                  style={{
                    minWidth: '230px',
                    background: palette.dropdownBg,
                    borderColor: palette.dropdownBorder,
                  }}
                >
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/workout"
                      state={{ entryType: 'workout' }}
                      onClick={() => {
                        setShowWorkoutMenu(false)
                        setShowMenu(false)
                      }}
                    >
                      Workout Entry
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/workout"
                      state={{ entryType: 'post' }}
                      onClick={() => {
                        setShowWorkoutMenu(false)
                        setShowMenu(false)
                      }}
                    >
                      Share Update
                    </Link>
                  </li>
                </ul>
              </div>
            </li>
            <li className="nav-item d-none d-lg-block">
              <Link
                {...navLinkProps(isLeaderboardsActive)}
                to="/leaderboards"
                onClick={() => setShowMenu(false)}
              >
                <span className={mobileNavIconClass} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M8 21h8M12 17V3M7 8l5-3 5 3v6H7V8Z"
                      stroke="currentColor"
                      strokeWidth="1.65"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="auth-navbar-mobile-link__label">Leaderboards</span>
              </Link>
            </li>
            <li className="nav-item d-none d-lg-block">
              <Link
                {...navLinkProps(isEventsActive)}
                to="/challenges"
                onClick={() => setShowMenu(false)}
              >
                <span className={mobileNavIconClass} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M8 2v4M16 2v4M4 9h16M6 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                      stroke="currentColor"
                      strokeWidth="1.65"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="auth-navbar-mobile-link__label">Events</span>
              </Link>
            </li>
            <li className="nav-item d-lg-none auth-navbar-mobile-profile-head">
              <div className="auth-navbar-mobile-profile-head__email" style={{ color: palette.dropdownHeader }}>
                {client?.email}
              </div>
            </li>
            <li className="nav-item d-lg-none">
              <Link
                className={`nav-link auth-navbar-mobile-link${location.pathname === '/profile' ? ' auth-navbar-mobile-link--active' : ''}`}
                to="/profile"
                style={{ fontSize: '0.9rem', fontWeight: 500, color: palette.navMuted }}
                onClick={() => setShowMenu(false)}
              >
                <span className={mobileNavIconClass} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
                      stroke="currentColor"
                      strokeWidth="1.65"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="auth-navbar-mobile-link__label">View Profile</span>
              </Link>
            </li>
            <li className="nav-item d-lg-none">
              <Link
                className={`nav-link auth-navbar-mobile-link${location.pathname.startsWith('/profile/transactions') ? ' auth-navbar-mobile-link--active' : ''}`}
                to="/profile/transactions"
                style={{ fontSize: '0.9rem', fontWeight: 500, color: palette.navMuted }}
                onClick={() => setShowMenu(false)}
              >
                <span className={mobileNavIconClass} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                      stroke="currentColor"
                      strokeWidth="1.65"
                      strokeLinejoin="round"
                    />
                    <path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="auth-navbar-mobile-link__label">Transactions</span>
              </Link>
            </li>
            <li className="nav-item d-lg-none">
              <Link
                className={`nav-link auth-navbar-mobile-link${location.pathname.startsWith('/profile/members') ? ' auth-navbar-mobile-link--active' : ''}`}
                to="/profile/members"
                style={{ fontSize: '0.9rem', fontWeight: 500, color: palette.navMuted }}
                onClick={() => setShowMenu(false)}
              >
                <span className={mobileNavIconClass} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM4 19c0-2.21 2.69-4 6-4M14 19c0-2.21 2.69-4 6-4"
                      stroke="currentColor"
                      strokeWidth="1.65"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="auth-navbar-mobile-link__label">Members</span>
              </Link>
            </li>
            <li className="nav-item d-lg-none">
              <Link
                className={`nav-link auth-navbar-mobile-link${location.pathname.startsWith('/profile/race-results') ? ' auth-navbar-mobile-link--active' : ''}`}
                to="/profile/race-results"
                style={{ fontSize: '0.9rem', fontWeight: 500, color: palette.navMuted }}
                onClick={() => setShowMenu(false)}
              >
                <span className={mobileNavIconClass} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M8 21h8M12 17V3M7 8l5-3 5 3v6H7V8Z"
                      stroke="currentColor"
                      strokeWidth="1.65"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="auth-navbar-mobile-link__label">Race Results</span>
              </Link>
            </li>
            <li className="nav-item d-lg-none auth-navbar-mobile-logout">
              <button
                type="button"
                className="nav-link auth-navbar-mobile-link auth-navbar-mobile-link--danger btn border-0 bg-transparent w-100 text-start d-inline-flex align-items-center gap-2"
                style={{ fontSize: '0.9rem', fontWeight: 600 }}
                disabled={isLoggingOut}
                onClick={() => {
                  setShowMenu(false)
                  handleLogout()
                }}
              >
                <span className={mobileNavIconClass} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M10 17l5-5-5-5M15 12H3M8 5V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-1"
                      stroke="currentColor"
                      strokeWidth="1.65"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="auth-navbar-mobile-link__label">{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
              </button>
            </li>
          </ul>

          <div className="auth-navbar-actions d-flex align-items-center flex-shrink-0 gap-2 ms-lg-0">
            <button
              type="button"
              className="auth-navbar-mobile-search-trigger d-lg-none btn border-0 bg-transparent d-inline-flex align-items-center justify-content-center p-0"
              aria-label="Search people"
              onClick={() => {
                setShowMenu(false)
                setMobileSearchOpen(true)
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: '999px',
                color: palette.navMuted,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm9.7 16.3-3.4-3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <ul className="navbar-nav auth-navbar-quick-tray flex-row align-items-center gap-2 gap-lg-3 mb-0">
              <li className="nav-item auth-navbar-notifications-slot" ref={notificationsRef}>
                <div className="auth-navbar-notifications-anchor">
                  <button
                    type="button"
                    className="btn p-0 border-0 bg-transparent d-flex align-items-center justify-content-center auth-navbar-notifications-trigger"
                    aria-label="Notifications"
                    aria-expanded={showNotifications}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setShowMenu(false)
                      setShowUserMenu(false)
                      setShowWorkoutMenu(false)
                      setShowNotifications((prev) => !prev)
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '999px',
                      color: palette.navMuted,
                    }}
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 3C9.79086 3 8 4.79086 8 7V8.05172C8 8.74227 7.78047 9.4152 7.37227 9.97236L6.21922 11.5459C5.4452 12.6076 6.20409 14.125 7.52288 14.125H16.4771C17.7959 14.125 18.5548 12.6076 17.7808 11.5459L16.6277 9.97237C16.2195 9.4152 16 8.74227 16 8.05172V7C16 4.79086 14.2091 3 12 3Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 15.5C10 16.6046 10.8954 17.5 12 17.5C13.1046 17.5 14 16.6046 14 15.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="auth-navbar-notifications-badge" aria-hidden="true">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <NotificationsPanel
                    open={showNotifications}
                    onClose={() => setShowNotifications(false)}
                    palette={palette}
                  />
                </div>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className="btn p-0 border-0 bg-transparent d-flex align-items-center justify-content-center"
                  aria-label="Toggle theme"
                  onClick={toggleTheme}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '999px',
                    color: palette.navMuted,
                  }}
                >
                  {isDark ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 4V2M12 22v-2M4 12H2m20 0h-2M6.34 6.34 4.93 4.93m14.14 14.14-1.41-1.41M17.66 6.34l1.41-1.41M6.34 17.66l-1.41 1.41M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </li>
              <li className="nav-item auth-navbar-profile-slot d-none d-lg-block">
                <div className="auth-navbar-profile-anchor" ref={userMenuRef}>
                  <button
                    className="btn d-inline-flex align-items-center justify-content-center border-0 bg-transparent p-0 rounded-circle"
                    type="button"
                    aria-expanded={showUserMenu}
                    aria-haspopup="true"
                    onClick={() => {
                      setShowWorkoutMenu(false)
                      setShowUserMenu((prev) => !prev)
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      minWidth: 36,
                      minHeight: 36,
                    }}
                  >
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: 32,
                        height: 32,
                        backgroundColor: palette.avatarBg,
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: palette.avatarText,
                        overflow: 'hidden',
                      }}
                    >
                      {avatarUrl ? (
                        <img
                          src={resolveMediaUrl(avatarUrl)}
                          alt="Profile"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        (client?.email?.charAt(0) || 'U').toUpperCase()
                      )}
                    </div>
                  </button>
                  <ul
                    className={`dropdown-menu dropdown-menu-end profile-dropdown-menu auth-navbar-profile-menu ${showUserMenu ? 'show' : ''}`}
                    style={{
                      background: palette.dropdownBg,
                      borderColor: palette.dropdownBorder,
                    }}
                  >
                  <li className="dropdown-header profile-dropdown-email" style={{ color: palette.dropdownHeader }}>
                    {client?.email}
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/profile"
                      onClick={() => {
                        setShowMenu(false)
                        setShowUserMenu(false)
                      }}
                    >
                      View Profile
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/profile/transactions"
                      onClick={() => {
                        setShowMenu(false)
                        setShowUserMenu(false)
                      }}
                    >
                      Transactions
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/profile/members"
                      onClick={() => {
                        setShowMenu(false)
                        setShowUserMenu(false)
                      }}
                    >
                      Members
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/profile/race-results"
                      onClick={() => {
                        setShowMenu(false)
                        setShowUserMenu(false)
                      }}
                    >
                      Race Results
                    </Link>
                  </li>
                  <li>
                    <button
                      className="dropdown-item text-danger d-flex align-items-center justify-content-between"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                    >
                      <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                    </button>
                  </li>
                </ul>
                </div>
              </li>
            </ul>

            <button
              type="button"
              className={`auth-navbar-menu-trigger d-lg-none${showMenu ? ' is-open' : ''}${isDark ? ' is-dark' : ''}`}
              onClick={() => {
                closeAllSearch()
                closeNavbarMenus()
                setShowMenu(!showMenu)
              }}
              aria-expanded={showMenu}
              aria-controls="auth-navbar-mobile-drawer"
              aria-label={showMenu ? 'Close menu' : 'Open menu'}
              style={{ color: palette.navMuted }}
            >
              <span className="auth-navbar-menu-trigger__bars" aria-hidden>
                <span className="auth-navbar-menu-trigger__bar" />
                <span className="auth-navbar-menu-trigger__bar" />
                <span className="auth-navbar-menu-trigger__bar" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </nav>
    {mobileSearchOpen &&
      createPortal(
        <div
          ref={mobileSearchRootRef}
          className={`auth-navbar-mobile-search d-lg-none ${isDark ? 'is-dark' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Search people"
        >
          <div className="auth-navbar-mobile-search__chrome">
            <div className="auth-navbar-mobile-search__top">
              <button
                type="button"
                className="auth-navbar-mobile-search__back"
                onClick={closeAllSearch}
                aria-label="Close search"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M14 7l-5 5 5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className={`auth-navbar-mobile-search__field ${isDark ? 'is-dark' : ''}${searchQuery ? ' has-clear' : ''}`}>
                <svg className="auth-navbar-mobile-search__field-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm9.7 16.3-3.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  id="auth-navbar-mobile-search-input"
                  ref={mobileSearchInputRef}
                  type="search"
                  enterKeyHint="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  className="auth-navbar-mobile-search__input"
                  placeholder="Search people"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="auth-navbar-mobile-search__clear"
                    onClick={clearSearchQuery}
                    aria-label="Clear search"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="auth-navbar-mobile-search__results">{renderPeopleSearchResults()}</div>
          </div>
        </div>,
        document.body
      )}
    <div className="auth-navbar-body-spacer" aria-hidden="true" />
    </>
  )
}

export default AuthNavbar

