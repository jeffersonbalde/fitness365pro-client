import React, { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import Footer from './Footer'
import './Layout.css'

const Layout = ({ user, onLogout, children }) => {
  const [sidebarToggled, setSidebarToggled] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1400
  )
  const location = useLocation()

  const toggleSidebar = () => setSidebarToggled((previous) => !previous)
  const closeSidebar = () => setSidebarToggled(false)

  const handleMainClick = () => {
    if (viewportWidth < 1200 && sidebarToggled) {
      closeSidebar()
    }
  }

  useEffect(() => {
    const body = document.body
    if (sidebarToggled) body.classList.add('sb-sidenav-toggled')
    else body.classList.remove('sb-sidenav-toggled')
    return () => body.classList.remove('sb-sidenav-toggled')
  }, [sidebarToggled])

  useEffect(() => {
    document.body.classList.add('admin-shell-active')
    return () => {
      document.body.classList.remove('admin-shell-active')
      document.body.classList.remove('sb-sidenav-toggled')
    }
  }, [])

  useEffect(() => {
    setSidebarToggled(false)
  }, [location.pathname])

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="sb-nav-fixed">
      <Topbar user={user} onToggleSidebar={toggleSidebar} onLogout={onLogout} />
      <div id="layoutSidenav">
        <div id="layoutSidenav_nav">
          <Sidebar user={user} onCloseSidebar={closeSidebar} />
        </div>
        <div id="layoutSidenav_content" onClick={handleMainClick} role="presentation">
          <main>
            <div className="container-fluid page-enter py-4 px-3 px-lg-4">
              {children || <Outlet key={location.pathname} />}
            </div>
          </main>
          <Footer />
        </div>
      </div>
      {sidebarToggled && viewportWidth < 1200 ? (
        <div
          className="mobile-sidebar-overlay"
          onClick={closeSidebar}
          onKeyDown={() => {}}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      ) : null}
    </div>
  )
}

export default Layout