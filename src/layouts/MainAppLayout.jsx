import React from 'react'
import { Outlet } from 'react-router-dom'
import AuthNavbar from '../components/AuthNavbar'
import Footer from '../components/Footer'
import MobileBottomNav from '../components/MobileBottomNav'
import './MainAppLayout.css'

/**
 * Shell for authenticated app pages: top bar, scrollable main, desktop footer,
 * mobile fixed bottom tab bar (FB-style). Child routes render via <Outlet />.
 */
const MainAppLayout = () => {
  return (
    <>
      <AuthNavbar />
      <div className="main-app-shell d-flex flex-column min-vh-100">
        <main className="main-app-shell__main flex-grow-1">
          <Outlet />
        </main>
        <div className="main-app-shell__footer d-none d-md-block">
          <Footer />
        </div>
      </div>
      <MobileBottomNav />
    </>
  )
}

export default MainAppLayout
