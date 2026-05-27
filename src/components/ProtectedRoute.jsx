import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../utils/api'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  const [requiresOnboarding, setRequiresOnboarding] = useState(false)

  useEffect(() => {
    let mounted = true

    const checkOnboardingStatus = async () => {
      if (!isAuthenticated) {
        if (mounted) {
          setRequiresOnboarding(false)
        }
        return
      }

      // Do not block the onboarding page itself.
      if (location.pathname === '/onboarding') {
        if (mounted) {
          setRequiresOnboarding(false)
        }
        return
      }

      try {
        const statusRes = await apiRequest('/v1/onboarding/status', { method: 'GET' })
        const onboardingCompleted = Boolean(statusRes?.data?.data?.onboarding_completed)
        if (mounted) {
          setRequiresOnboarding(!onboardingCompleted)
        }
      } catch {
        // Fail open to avoid trapping authenticated users due to transient API issues.
        if (mounted) {
          setRequiresOnboarding(false)
        }
      } finally {
        // No-op: do not block rendering while checking onboarding status.
      }
    }

    checkOnboardingStatus()

    return () => {
      mounted = false
    }
  }, [isAuthenticated, location.pathname])

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiresOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

export default ProtectedRoute

