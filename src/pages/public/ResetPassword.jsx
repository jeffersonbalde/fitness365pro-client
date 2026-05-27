import React, { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import bg1 from '../../assets/images/bg1.jpg'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { getAuthHeroStyle } from '../../utils/authPageStyles'

const ResetPassword = () => {
  const { verifyResetToken, resetPassword } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
  })
  const [touched, setTouched] = useState({
    password: false,
    confirmPassword: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [apiErrors, setApiErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [isTokenValid, setIsTokenValid] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const token = searchParams.get('token')
  const email = searchParams.get('email')

  // Password validation function
  const validatePassword = (password) => {
    if (!password) return 'Password is required.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password.length > 128) return 'Password must be less than 128 characters.'
    if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter.'
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
    return null
  }

  const errors = useMemo(() => {
    const next = {}

    const passwordError = validatePassword(form.password)
    if (passwordError) next.password = passwordError

    if (!form.confirmPassword) next.confirmPassword = 'Please confirm your password.'
    else if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match.'

    // Merge API errors
    Object.keys(apiErrors).forEach((key) => {
      if (apiErrors[key]) {
        next[key] = Array.isArray(apiErrors[key]) ? apiErrors[key][0] : apiErrors[key]
      }
    })

    return next
  }, [form.password, form.confirmPassword, apiErrors])

  const isValid = Object.keys(errors).length === 0

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token || !email) {
        setIsTokenValid(false)
        setIsVerifying(false)
        return
      }

      try {
        const result = await verifyResetToken(token, email)
        if (result.success) {
          setIsTokenValid(true)
        } else {
          setIsTokenValid(false)
          if (result.errors) {
            setApiErrors(result.errors)
          }
        }
      } catch (error) {
        console.error('Token verification error:', error)
        setIsTokenValid(false)
      } finally {
        setIsVerifying(false)
      }
    }

    verifyToken()
  }, [token, email, verifyResetToken])

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onBlur = (e) => {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setTouched({ password: true, confirmPassword: true })
    setApiErrors({})

    if (!isValid) return

    setIsSubmitting(true)

    try {
      const result = await resetPassword(token, email, form.password, form.confirmPassword)

      if (result.success) {
        setIsSuccess(true)
        setTimeout(() => {
          navigate('/login', { replace: true })
        }, 2000)
      } else {
        if (result.errors) {
          setApiErrors(result.errors)
          setTouched({ password: true, confirmPassword: true })
        } else if (result.message) {
          setApiErrors({ password: [result.message] })
          setTouched({ password: true, confirmPassword: true })
        }
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Reset password error:', error)
      setApiErrors({ password: ['An unexpected error occurred. Please try again.'] })
      setIsSubmitting(false)
    }
  }

  if (isVerifying) {
    return (
      <div className="d-flex flex-column">
        <Navbar />
        <main style={{ marginTop: '64px' }}>
          <section
            className="auth-hero d-flex align-items-center py-3 py-md-4"
            style={getAuthHeroStyle(bg1, isDark)}
          >
            <div className="container px-4 px-md-5 py-2 py-md-3">
              <div className="row justify-content-center">
                <div className="col-11 col-sm-9 col-md-7 col-lg-5 col-xl-4">
                  <motion.div
                    className="card border-0 auth-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="card-body p-3 p-md-4 auth-card-body text-center">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="auth-helper-text mt-3 mb-0">Verifying reset link...</p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    )
  }

  if (!isTokenValid) {
    return (
      <div className="d-flex flex-column">
        <Navbar />
        <main style={{ marginTop: '64px' }}>
          <section
            className="auth-hero d-flex align-items-center py-3 py-md-4"
            style={getAuthHeroStyle(bg1, isDark, { minHeight: 'calc(100vh - 72px)' })}
          >
            <div className="container px-4 px-md-5 py-2 py-md-3">
              <div className="row justify-content-center">
                <div className="col-11 col-sm-9 col-md-7 col-lg-5 col-xl-4">
                  <motion.div
                    className="card border-0 auth-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="auth-card-header">
                      <h1 className="h4 fw-semibold mb-0">Invalid Reset Link</h1>
                    </div>
                    <div className="card-body p-3 p-md-4 auth-card-body text-center">
                      <div className="mb-3">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ef4444' }}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                      </div>
                      <h2 className="auth-success-title mb-3">Link Expired or Invalid</h2>
                      <p className="auth-helper-text mb-4">
                        {apiErrors.token || 'This password reset link is invalid or has expired. Please request a new one.'}
                      </p>
                      <Link 
                        to="/forgot-password" 
                        className="btn w-100 fw-semibold py-2"
                        style={{
                          backgroundColor: '#1D79BC',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          display: 'inline-block',
                          transition: 'background-color 0.2s ease, transform 0.12s ease',
                          boxShadow: 'none',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.setProperty('background-color', '#165A8F', 'important')
                          e.currentTarget.style.setProperty('transform', 'translateY(-1px)', 'important')
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.setProperty('background-color', '#1D79BC', 'important')
                          e.currentTarget.style.setProperty('transform', 'translateY(0)', 'important')
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.setProperty('transform', 'translateY(0)', 'important')
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.setProperty('transform', 'translateY(-1px)', 'important')
                        }}
                      >
                        Request New Link
                      </Link>
                      <div className="text-center mt-3">
                        <Link className="fw-semibold sign-up-link" to="/login">
                          Back to Login
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="d-flex flex-column">
      <Navbar />

      <main>
        <section
          className="auth-hero d-flex align-items-center py-3 py-md-4"
          style={getAuthHeroStyle(bg1, isDark, { minHeight: 'calc(100vh - 72px)' })}
        >
          <div className="container px-4 px-md-5 py-2 py-md-3">
            <div className="row justify-content-center">
              <div className="col-11 col-sm-9 col-md-7 col-lg-5 col-xl-4">
                <motion.div
                  className="card border-0 auth-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ 
                    duration: 0.4, 
                    ease: [0.25, 0.1, 0.25, 1]
                  }}
                >
                  <div className="auth-card-header">
                    <h1 className="h4 fw-semibold mb-0">Reset Password</h1>
                  </div>
                  
                  <div className="card-body p-3 p-md-4 auth-card-body">
                    {isSuccess ? (
                      <div className="text-center">
                        <div className="mb-3">
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981' }}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                        </div>
                        <h2 className="auth-success-title mb-3">Password Reset Successful</h2>
                        <p className="auth-helper-text mb-4">
                          Your password has been reset successfully. Redirecting to login...
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="auth-helper-text mb-4">
                          Enter your new password below.
                        </p>

                        <form onSubmit={onSubmit} noValidate>
                          <div className="mb-2">
                            <label htmlFor="password" className="form-label auth-form-label">
                              New Password
                            </label>
                            <div className="position-relative">
                              <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                className={`form-control ${
                                  touched.password && errors.password ? 'is-invalid' : ''
                                }`}
                                placeholder="Enter New Password"
                                value={form.password}
                                onChange={onChange}
                                onBlur={onBlur}
                                autoComplete="new-password"
                                required
                                style={{ 
                                  paddingRight: touched.password && errors.password ? '70px' : '45px' 
                                }}
                              />
                              {touched.password && errors.password && (
                                <div 
                                  className="position-absolute top-50 translate-middle-y"
                                  style={{
                                    right: '45px',
                                    zIndex: 5,
                                    pointerEvents: 'none',
                                    width: '20px',
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ color: '#dc3545' }}>
                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                    <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
                                  </svg>
                                </div>
                              )}
                              <button
                                type="button"
                                className="btn btn-link position-absolute top-50 translate-middle-y"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: '0.375rem 0.5rem',
                                  color: '#6b7280',
                                  textDecoration: 'none',
                                  cursor: 'pointer',
                                  transition: 'color 0.3s ease',
                                  zIndex: 10,
                                  right: '5px',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#374151'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#6b7280'
                                }}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                              >
                                {showPassword ? (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                  </svg>
                                ) : (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                  </svg>
                                )}
                              </button>
                            </div>
                            <AnimatePresence>
                              {touched.password && errors.password && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                                  className="invalid-feedback"
                                >
                                  {errors.password}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="mb-3">
                            <label htmlFor="confirmPassword" className="form-label auth-form-label">
                              Confirm Password
                            </label>
                            <div className="position-relative">
                              <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                className={`form-control ${
                                  touched.confirmPassword && errors.confirmPassword ? 'is-invalid' : ''
                                }`}
                                placeholder="Confirm New Password"
                                value={form.confirmPassword}
                                onChange={onChange}
                                onBlur={onBlur}
                                autoComplete="new-password"
                                required
                                style={{ 
                                  paddingRight: touched.confirmPassword && errors.confirmPassword ? '70px' : '45px' 
                                }}
                              />
                              {touched.confirmPassword && errors.confirmPassword && (
                                <div 
                                  className="position-absolute top-50 translate-middle-y"
                                  style={{
                                    right: '45px',
                                    zIndex: 5,
                                    pointerEvents: 'none',
                                    width: '20px',
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ color: '#dc3545' }}>
                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                    <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
                                  </svg>
                                </div>
                              )}
                              <button
                                type="button"
                                className="btn btn-link position-absolute top-50 translate-middle-y"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: '0.375rem 0.5rem',
                                  color: '#6b7280',
                                  textDecoration: 'none',
                                  cursor: 'pointer',
                                  transition: 'color 0.3s ease',
                                  zIndex: 10,
                                  right: '5px',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#374151'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#6b7280'
                                }}
                                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                              >
                                {showConfirmPassword ? (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                  </svg>
                                ) : (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                  </svg>
                                )}
                              </button>
                            </div>
                            <AnimatePresence>
                              {touched.confirmPassword && errors.confirmPassword && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                                  className="invalid-feedback"
                                >
                                  {errors.confirmPassword}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <button
                            type="submit"
                            className="w-100 fw-semibold py-2"
                            disabled={isSubmitting}
                            style={{
                              backgroundColor: isSubmitting ? '#4A9FD4' : '#1D79BC',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: 600,
                              letterSpacing: '0.3px',
                              transition: 'background-color 0.2s ease, transform 0.12s ease',
                              cursor: isSubmitting ? 'not-allowed' : 'pointer',
                              opacity: isSubmitting ? 0.7 : 1,
                              boxShadow: 'none',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSubmitting) {
                                e.currentTarget.style.setProperty('background-color', '#165A8F', 'important')
                                e.currentTarget.style.setProperty('transform', 'translateY(-1px)', 'important')
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSubmitting) {
                                e.currentTarget.style.setProperty('background-color', '#1D79BC', 'important')
                                e.currentTarget.style.setProperty('transform', 'translateY(0)', 'important')
                              }
                            }}
                            onMouseDown={(e) => {
                              if (!isSubmitting) {
                                e.currentTarget.style.setProperty('transform', 'translateY(0)', 'important')
                              }
                            }}
                            onMouseUp={(e) => {
                              if (!isSubmitting) {
                                e.currentTarget.style.setProperty('transform', 'translateY(-1px)', 'important')
                              }
                            }}
                          >
                            {isSubmitting ? 'Resetting...' : 'Reset Password'}
                          </button>

                          <div className="text-center mt-4">
                            <Link className="fw-semibold sign-up-link" to="/login">
                              Back to Login
                            </Link>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>
        </main>

        <Footer />
      </div>
    )
}

export default ResetPassword

