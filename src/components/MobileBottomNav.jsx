import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import './MobileBottomNav.css'

const feedIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      d="M4 5.5h16M4 10h10M4 14.5h14M4 19h8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const plusIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.75" />
    <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
)

const podiumIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      d="M6 20V10H2v10h4Zm8 0V4h-4v16h4Zm8 0v-8h-4v8h4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinejoin="round"
    />
  </svg>
)

const calendarIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      d="M7 4V2M17 4V2M4 9h16M6 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const meIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const SHEET_CLOSE_MS = 340
const SHEET_CLOSE_MS_REDUCED = 45

const MobileBottomNav = () => {
  const location = useLocation()
  const [sheetMounted, setSheetMounted] = useState(false)
  const [sheetEntered, setSheetEntered] = useState(false)
  const [sheetClosing, setSheetClosing] = useState(false)
  const closeTimerRef = useRef(null)
  const trainingActive = location.pathname.startsWith('/workout')
  /** Same tap that opens the sheet can synthesize a click on the new backdrop (mobile). Ignore briefly. */
  const ignoreBackdropDismissUntilRef = useRef(0)

  const sheetOpen = sheetMounted && sheetEntered

  const resetSheet = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setSheetClosing(false)
    setSheetEntered(false)
    setSheetMounted(false)
  }, [])

  const requestCloseSheet = useCallback(() => {
    if (!sheetMounted) return
    if (!sheetEntered) {
      resetSheet()
      return
    }
    setSheetClosing(true)
    setSheetEntered(false)
  }, [sheetMounted, sheetEntered, resetSheet])

  const openSheet = useCallback(() => {
    setSheetClosing(false)
    setSheetEntered(false)
    setSheetMounted(true)
    ignoreBackdropDismissUntilRef.current = Date.now() + 500
  }, [])

  useEffect(() => {
    resetSheet()
  }, [location.pathname, resetSheet])

  useEffect(() => {
    if (!sheetOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') requestCloseSheet()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, requestCloseSheet])

  /** After mount, next frames apply .is-visible so CSS transitions run from rest state. */
  useLayoutEffect(() => {
    if (!sheetMounted || sheetEntered || sheetClosing) return undefined
    let raf1 = 0
    let raf2 = 0
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setSheetEntered(true)
      })
    })
    return () => {
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
    }
  }, [sheetMounted, sheetEntered, sheetClosing])

  /** Unmount after exit transition (timeout matches CSS duration). */
  useEffect(() => {
    if (!sheetClosing || !sheetMounted || sheetEntered) return undefined
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
    }
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const closeMs = reducedMotion ? SHEET_CLOSE_MS_REDUCED : SHEET_CLOSE_MS
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setSheetMounted(false)
      setSheetClosing(false)
      setSheetEntered(false)
    }, closeMs)
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [sheetClosing, sheetMounted, sheetEntered])

  const toggleTrainingSheet = () => {
    if (sheetMounted && sheetEntered) {
      requestCloseSheet()
      return
    }
    if (sheetMounted && !sheetEntered) {
      return
    }
    openSheet()
  }

  const dismissBackdrop = () => {
    if (Date.now() < ignoreBackdropDismissUntilRef.current) return
    requestCloseSheet()
  }

  const closeSheetForNavigation = () => {
    resetSheet()
  }

  const backdropClass = `mobile-bottom-nav__backdrop${sheetEntered ? ' is-visible' : ''}`
  const sheetClass = `mobile-bottom-nav__sheet${sheetEntered ? ' is-visible' : ''}`

  const sheetOverlay = sheetMounted ? (
    <>
      <button
        type="button"
        className={backdropClass}
        aria-label="Close menu"
        onClick={dismissBackdrop}
      />
      <div className={sheetClass} role="dialog" aria-label="Log activity">
        <div className="mobile-bottom-nav__sheet-title">Add to your log</div>
        <Link
          className="mobile-bottom-nav__sheet-link"
          to="/workout"
          state={{ entryType: 'workout' }}
          onClick={closeSheetForNavigation}
        >
          <span className="mobile-bottom-nav__sheet-link-main">Workout entry</span>
          <span className="mobile-bottom-nav__sheet-link-sub">Log a run, ride, gym session, and more</span>
        </Link>
        <Link
          className="mobile-bottom-nav__sheet-link"
          to="/workout"
          state={{ entryType: 'post' }}
          onClick={closeSheetForNavigation}
        >
          <span className="mobile-bottom-nav__sheet-link-main">Share update</span>
          <span className="mobile-bottom-nav__sheet-link-sub">Quick post for your followers</span>
        </Link>
        <button type="button" className="mobile-bottom-nav__sheet-cancel" onClick={requestCloseSheet}>
          Cancel
        </button>
      </div>
    </>
  ) : null

  return (
    <>
      {typeof document !== 'undefined' && sheetOverlay
        ? createPortal(sheetOverlay, document.body)
        : null}

      <nav className="mobile-bottom-nav d-md-none" aria-label="Main">
        <div className="mobile-bottom-nav__inner">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) => `mobile-bottom-nav__tab${isActive ? ' is-active' : ''}`}
          >
            <span className="mobile-bottom-nav__icon">{feedIcon}</span>
            <span className="mobile-bottom-nav__label">Feed</span>
          </NavLink>

          <NavLink
            to="/leaderboards"
            className={({ isActive }) => `mobile-bottom-nav__tab${isActive ? ' is-active' : ''}`}
          >
            <span className="mobile-bottom-nav__icon">{podiumIcon}</span>
            <span className="mobile-bottom-nav__label">Ranks</span>
          </NavLink>

          <button
            type="button"
            className={`mobile-bottom-nav__tab mobile-bottom-nav__tab--action${trainingActive ? ' is-active' : ''}${sheetOpen ? ' is-open' : ''}`}
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
            onClick={toggleTrainingSheet}
          >
            <span className="mobile-bottom-nav__icon mobile-bottom-nav__icon--plus">{plusIcon}</span>
            <span className="mobile-bottom-nav__label">Log</span>
          </button>

          <NavLink
            to="/challenges"
            className={({ isActive }) => `mobile-bottom-nav__tab${isActive ? ' is-active' : ''}`}
          >
            <span className="mobile-bottom-nav__icon">{calendarIcon}</span>
            <span className="mobile-bottom-nav__label">Events</span>
          </NavLink>

          <NavLink
            to="/profile"
            end
            className={({ isActive }) => `mobile-bottom-nav__tab${isActive ? ' is-active' : ''}`}
          >
            <span className="mobile-bottom-nav__icon">{meIcon}</span>
            <span className="mobile-bottom-nav__label">Profile</span>
          </NavLink>
        </div>
      </nav>
    </>
  )
}

export default MobileBottomNav
