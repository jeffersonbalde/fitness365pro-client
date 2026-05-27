import React, { useEffect, useRef } from 'react'
import logoFinal from '../assets/images/logo_final.png'
import { useTheme } from '../contexts/ThemeContext'

const Navbar = () => {
  const { isDark, toggleTheme, isAdminForcedLight, isAdminForcedDark } = useTheme()
  const navRef = useRef(null)
  const styleId = 'navbar-nuclear-fix'

  useEffect(() => {
    // Inject style tag into head with nuclear CSS
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    
    styleEl.textContent = `
      #main-navbar-fixed,
      nav#main-navbar-fixed,
      .navbar#main-navbar-fixed {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 99999 !important;
        width: 100vw !important;
        max-width: 100vw !important;
        margin: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        -webkit-transform: translateZ(0) !important;
        transform: translateZ(0) !important;
        -webkit-backface-visibility: hidden !important;
        backface-visibility: hidden !important;
        will-change: transform !important;
      }
      
      /* Mobile: Keep fixed but ensure parent doesn't interfere */
      @media (max-width: 768px) {
        #main-navbar-fixed,
        nav#main-navbar-fixed,
        .navbar#main-navbar-fixed {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 99999 !important;
          width: 100vw !important;
          max-width: 100vw !important;
          margin: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          -webkit-transform: translateZ(0) !important;
          transform: translateZ(0) !important;
        }
        
        /* CRITICAL: Remove any properties from parent that break fixed positioning */
        div.d-flex.flex-column {
          transform: none !important;
          perspective: none !important;
          filter: none !important;
          will-change: auto !important;
          overflow: visible !important;
          position: static !important;
        }
        
        /* Ensure navbar is positioned relative to viewport, not parent */
        div.d-flex.flex-column > nav#main-navbar-fixed {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
        }
      }
    `

    const nav = navRef.current
    if (!nav) return

    // Force fixed positioning via direct DOM manipulation
    const forceFixed = () => {
      if (nav) {
        // Always use fixed, never sticky
        nav.style.setProperty('position', 'fixed', 'important')
        nav.style.setProperty('top', '0', 'important')
        nav.style.setProperty('left', '0', 'important')
        nav.style.setProperty('right', '0', 'important')
        nav.style.setProperty('z-index', '99999', 'important')
        nav.style.setProperty('width', '100vw', 'important')
        nav.style.setProperty('max-width', '100vw', 'important')
        nav.style.setProperty('margin', '0', 'important')
        nav.style.setProperty('-webkit-transform', 'translateZ(0)', 'important')
        nav.style.setProperty('transform', 'translateZ(0)', 'important')
        
        // Also fix parent container if it exists
        const parent = nav.parentElement
        if (parent && parent.classList.contains('d-flex') && parent.classList.contains('flex-column')) {
          parent.style.setProperty('transform', 'none', 'important')
          parent.style.setProperty('perspective', 'none', 'important')
          parent.style.setProperty('filter', 'none', 'important')
          parent.style.setProperty('will-change', 'auto', 'important')
        }
      }
    }

    // Use requestAnimationFrame to continuously enforce
    let rafId
    const enforceFixed = () => {
      forceFixed()
      rafId = requestAnimationFrame(enforceFixed)
    }
    enforceFixed()

    // Also use MutationObserver to catch any style changes
    const observer = new MutationObserver(() => {
      forceFixed()
    })
    observer.observe(nav, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      subtree: false
    })

    // Re-apply on all events
    const events = ['resize', 'scroll', 'orientationchange', 'touchmove', 'touchstart']
    events.forEach(event => {
      window.addEventListener(event, forceFixed, { passive: true })
    })

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      events.forEach(event => {
        window.removeEventListener(event, forceFixed)
      })
    }
  }, [])

  const palette = isDark
    ? {
        navBg: '#0a0b0f',
        navBorder: '#2a3042',
        icon: '#cbd5e1',
      }
    : {
        navBg: '#ffffff',
        navBorder: '#d6dee8',
        icon: '#374151',
      }

  return (
    <nav
      id="main-navbar-fixed"
      ref={navRef}
      className="navbar navbar-expand-lg fixed-top"
      style={{
        paddingTop: '12px',
        paddingBottom: '12px',
        minHeight: '64px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        width: '100vw',
        margin: 0,
        backgroundColor: palette.navBg,
        borderBottom: `1px solid ${palette.navBorder}`,
        boxShadow: isDark ? 'none' : '0 1px 4px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div className="container px-4 px-md-5">
        <a className="navbar-brand d-flex align-items-center" href="/" style={{ padding: 0, margin: 0, height: '40px', display: 'flex', alignItems: 'center' }}>
          <img
            src={logoFinal}
            alt="Fitness 365 Pro"
            style={{ height: '40px', width: 'auto', display: 'block' }}
          />
        </a>

        <div className="ms-auto d-flex align-items-center">
          {!isAdminForcedLight && !isAdminForcedDark ? (
            <button
              type="button"
              className="btn p-0 border-0 bg-transparent d-flex align-items-center justify-content-center"
              aria-label="Toggle theme"
              onClick={toggleTheme}
              style={{
                width: 32,
                height: 32,
                borderRadius: '999px',
                color: palette.icon,
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
          ) : null}
        </div>
      </div>
    </nav>
  )
}

export default Navbar

