import React, { createContext, useContext, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  apiRequest,
  cancelAccessTokenRefresh,
  clearAuthSession,
  ensureAccessToken,
  getRefreshToken,
  isRefreshTokenExpired,
  persistAuthSession,
  scheduleAccessTokenRefresh,
} from '../utils/api'
import { notifySuccess, notifyError, showLoadingModal, closeLoadingModal } from '../utils/notifications'
import { signInWithGoogle } from '../utils/firebase'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  const PUBLIC_AUTH_ROUTES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password']

  const resolvePostAuthRoute = async (fallbackClient = null) => {
    try {
      const statusRes = await apiRequest('/v1/onboarding/status', { method: 'GET' })
      if (statusRes?.data?.success) {
        const status = statusRes.data.data || {}
        setOnboardingCompleted(Boolean(status.onboarding_completed))
        return status.onboarding_completed ? '/dashboard' : '/onboarding'
      }
    } catch {
      // Fall back to client payload hints if status endpoint is temporarily unavailable
      const payloadStep = Number(fallbackClient?.onboarding_step || 0)
      const payloadCompleted = Boolean(fallbackClient?.onboarding_completed)
      if (payloadCompleted) {
        setOnboardingCompleted(true)
        return '/dashboard'
      }
      if (payloadStep >= 0) {
        setOnboardingCompleted(false)
        return '/onboarding'
      }
    }

    return '/dashboard'
  }

  useEffect(() => {
    const onSessionCleared = () => {
      cancelAccessTokenRefresh()
      setClient(null)
      setIsAuthenticated(false)
      setOnboardingCompleted(null)
    }

    window.addEventListener('auth:session-cleared', onSessionCleared)
    return () => window.removeEventListener('auth:session-cleared', onSessionCleared)
  }, [])

  useEffect(() => {
    checkAuth()
    return () => cancelAccessTokenRefresh()
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      cancelAccessTokenRefresh()
      return undefined
    }

    scheduleAccessTokenRefresh()
    return () => cancelAccessTokenRefresh()
  }, [isAuthenticated])

  const checkAuth = async () => {
    try {
      const storedClient = localStorage.getItem('auth_client')
      const hasRefresh = !!getRefreshToken()

      if (storedClient) {
        try {
          setClient(JSON.parse(storedClient))
        } catch {
          // ignore parse
        }
      }

      if (!hasRefresh || isRefreshTokenExpired()) {
        if (hasRefresh && isRefreshTokenExpired()) {
          clearAuthSession()
        }
        setClient(null)
        setIsAuthenticated(false)
        setOnboardingCompleted(null)
        return
      }

      const accessToken = await ensureAccessToken()
      if (!accessToken) {
        clearAuthSession()
        setClient(null)
        setIsAuthenticated(false)
        setOnboardingCompleted(null)
        return
      }

      const response = await apiRequest('/v1/auth/me', { method: 'GET' })
      const clientData = response.data.data.client
      persistAuthSession({ client: clientData })
      setClient(clientData)
      setIsAuthenticated(true)

      const targetRoute = await resolvePostAuthRoute(clientData)
      const currentPath = location.pathname
      const isPublicRoute = PUBLIC_AUTH_ROUTES.includes(currentPath)
      const isOnboardingRoute = currentPath === '/onboarding'

      // Keep users on onboarding until fully completed.
      if (targetRoute === '/onboarding' && !isOnboardingRoute) {
        navigate('/onboarding', { replace: true })
      }

      // If user completed onboarding, avoid keeping them on public/onboarding screens.
      if (targetRoute === '/dashboard' && (isPublicRoute || isOnboardingRoute)) {
        navigate('/dashboard', { replace: true })
      }
    } catch (error) {
      const status = error?.response?.status

      // Only clear if auth is actually invalid (401). Network errors should not wipe state.
      if (status === 401) {
        clearAuthSession()
        setClient(null)
        setIsAuthenticated(false)
        setOnboardingCompleted(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const response = await apiRequest('/v1/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      
      if (response.data.success && response.data.data) {
        const { client: clientData, token, refresh_token, expires_in, refresh_expires_in } = response.data.data

        persistAuthSession({
          token,
          expires_in,
          refresh_token,
          refresh_expires_in,
          client: clientData,
        })

        setClient(clientData)
        setIsAuthenticated(true)
        
        const targetRoute = await resolvePostAuthRoute(clientData)
        setTimeout(() => {
          navigate(targetRoute, { replace: true })
        }, 0)

        notifySuccess('Welcome back! You are now logged in.')
        
        return { success: true, data: response.data.data }
      }
      
      throw new Error(response.data.message || 'Login failed')
    } catch (error) {
      console.error('Login error:', error)
      const errorData = error.response?.data || {}
      notifyError(errorData.message || 'Login failed')
      return {
        success: false,
        message: errorData.message || 'Login failed',
        errors: errorData.errors || {},
      }
    }
  }

  const continueWithGoogle = async (intent = 'login') => {
    try {
      const { idToken } = await signInWithGoogle()

      if (!idToken || typeof idToken !== 'string') {
        notifyError('Failed to get Google token. Please try again.')
        return { success: false, message: 'Failed to get Google token', errors: {} }
      }

      // Ensure we're sending clean data with valid intent
      const validIntent = intent === 'signup' ? 'signup' : 'login'
      const requestBody = {
        id_token: String(idToken).trim(),
        intent: validIntent,
      }

      const res = await apiRequest('/v1/auth/google', {
        method: 'POST',
        body: requestBody,
      })

      if (res && res.data && res.data.success && res.data.data) {
        const { client: clientData, token, refresh_token, expires_in, refresh_expires_in } = res.data.data

        persistAuthSession({
          token,
          expires_in,
          refresh_token,
          refresh_expires_in,
          client: clientData,
        })

        setClient(clientData)
        setIsAuthenticated(true)

        const targetRoute = await resolvePostAuthRoute(clientData)
        setTimeout(() => navigate(targetRoute, { replace: true }), 0)
        notifySuccess(intent === 'signup' ? 'Signed up with Google successfully!' : 'Signed in with Google.')

        return { success: true, data: res.data.data }
      }

      const errorMsg = res?.data?.message || 'Google sign in failed'
      notifyError(errorMsg)
      return { success: false, message: errorMsg, errors: res?.data?.errors || {} }
    } catch (error) {
      // Handle user-cancelled popup gracefully
      if (error && (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request')) {
        const msg = 'Google sign in was cancelled.'
        notifyError(msg)
        return { success: false, message: msg, errors: {} }
      }

      // Handle Firebase errors
      if (error && error.code && error.code.startsWith('auth/')) {
        const msg = 'Google authentication failed. Please try again.'
        notifyError(msg)
        return { success: false, message: msg, errors: {} }
      }

      // Handle API errors
      const errData = error?.response?.data || {}
      let msg = errData.message || error?.message || 'Google sign in failed'
      if (/route v1\/auth\/google could not be found/i.test(msg)) {
        msg = 'API URL is misconfigured. Set VITE_LARAVEL_API to your Laravel server URL (must include /api), then redeploy the client.'
      }
      notifyError(msg)
      return { success: false, message: msg, errors: errData.errors || {} }
    }
  }

  const register = async (email, password, confirmPassword) => {
    try {
      const response = await apiRequest('/v1/auth/register', {
        method: 'POST',
        body: {
          email,
          password,
          password_confirmation: confirmPassword,
        },
      })
      
      if (response.data.success && response.data.data) {
        const { client: clientData, requires_verification } = response.data.data

        // Save pending email for OTP screen
        if (clientData?.email) {
          localStorage.setItem('pending_verification_email', clientData.email)
        }

        if (requires_verification) {
          navigate('/verify-email', { replace: true, state: { email: clientData.email } })
          notifySuccess('Verification code sent. Please check your email.')
          return { success: true, requires_verification: true, email: clientData.email }
        }

        return { success: true, data: response.data.data }
      }
      
      throw new Error(response.data.message || 'Registration failed')
    } catch (error) {
      const errorData = error.response?.data || {}
      notifyError(errorData.message || 'Registration failed')
      return {
        success: false,
        message: errorData.message || 'Registration failed',
        errors: errorData.errors || {},
      }
    }
  }

  const verifyEmailOtp = async (email, code) => {
    try {
      showLoadingModal('Verifying code...')
      const res = await apiRequest('/v1/auth/verify-email', {
        method: 'POST',
        body: { email, code },
      })

      if (res.data.success && res.data.data) {
        const { client: clientData, token, refresh_token, expires_in, refresh_expires_in } = res.data.data

        persistAuthSession({
          token,
          expires_in,
          refresh_token,
          refresh_expires_in,
          client: clientData,
        })

        localStorage.removeItem('pending_verification_email')

        setClient(clientData)
        setIsAuthenticated(true)

        const targetRoute = await resolvePostAuthRoute(clientData)
        setTimeout(() => navigate(targetRoute, { replace: true }), 0)
        notifySuccess('Email verified successfully. You are now logged in.')
        return { success: true, data: res.data.data }
      }

      return { success: false, message: res.data.message || 'Verification failed', errors: res.data.errors || {} }
    } catch (error) {
      const errData = error.response?.data || {}
      notifyError(errData.message || 'Verification failed')
      return { success: false, message: errData.message || 'Verification failed', errors: errData.errors || {} }
    } finally {
      closeLoadingModal()
    }
  }

  const resendOtp = async (email) => {
    try {
      const res = await apiRequest('/v1/auth/resend-otp', {
        method: 'POST',
        body: { email },
      })
      if (res.data.success) {
        notifySuccess('We sent you a new verification code.')
        return { success: true, cooldown: res.data.data?.cooldown || 60 }
      }
      notifyError(res.data.message || 'Failed to resend code')
      return { success: false, message: res.data.message || 'Failed to resend code', errors: res.data.errors || {} }
    } catch (error) {
      const errData = error.response?.data || {}
      notifyError(errData.message || 'Failed to resend code')
      return { success: false, message: errData.message || 'Failed to resend code', errors: errData.errors || {} }
    }
  }

  const forgotPassword = async (email) => {
    try {
      const res = await apiRequest('/v1/auth/forgot-password', {
        method: 'POST',
        body: { email },
      })
      if (res.data.success) {
        notifySuccess('If that email exists, we sent a password reset link.')
        return { success: true }
      }
      notifyError(res.data.message || 'Failed to send reset link')
      return { success: false, message: res.data.message || 'Failed to send reset link', errors: res.data.errors || {} }
    } catch (error) {
      const errData = error.response?.data || {}
      notifyError(errData.message || 'Failed to send reset link')
      return { success: false, message: errData.message || 'Failed to send reset link', errors: errData.errors || {} }
    }
  }

  const verifyResetToken = async (token, email) => {
    try {
      const res = await apiRequest('/v1/auth/verify-reset-token', {
        method: 'POST',
        body: { token, email },
      })
      if (res.data.success) {
        return { success: true }
      }
      return { success: false, message: res.data.message || 'Invalid token', errors: res.data.errors || {} }
    } catch (error) {
      const errData = error.response?.data || {}
      return { success: false, message: errData.message || 'Invalid token', errors: errData.errors || {} }
    }
  }

  const resetPassword = async (token, email, password, confirmPassword) => {
    try {
      showLoadingModal('Resetting password...')
      const res = await apiRequest('/v1/auth/reset-password', {
        method: 'POST',
        body: { token, email, password, password_confirmation: confirmPassword },
      })
      if (res.data.success) {
        notifySuccess('Password reset successfully. You can now log in with your new password.')
        return { success: true }
      }
      notifyError(res.data.message || 'Failed to reset password')
      return { success: false, message: res.data.message || 'Failed to reset password', errors: res.data.errors || {} }
    } catch (error) {
      const errData = error.response?.data || {}
      notifyError(errData.message || 'Failed to reset password')
      return { success: false, message: errData.message || 'Failed to reset password', errors: errData.errors || {} }
    } finally {
      closeLoadingModal()
    }
  }

  const logout = async () => {
    try {
      await apiRequest('/v1/auth/logout', {
        method: 'POST',
        body: { refresh_token: getRefreshToken() },
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuthSession()
      setClient(null)
      setIsAuthenticated(false)
      setOnboardingCompleted(null)
      navigate('/login')
      notifySuccess('You have been logged out.')
    }
  }

  const value = {
    client,
    isAuthenticated,
    loading,
    onboardingCompleted,
    login,
    continueWithGoogle,
    register,
    verifyEmailOtp,
    resendOtp,
    forgotPassword,
    verifyResetToken,
    resetPassword,
    logout,
    checkAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext

