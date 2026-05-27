import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import bg1 from '../../assets/images/bg1.jpg'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { getAuthHeroStyle } from '../../utils/authPageStyles'

const Register = () => {
  const { register, continueWithGoogle, isAuthenticated, loading: authLoading } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirmPassword: false,
  })
  const [apiErrors, setApiErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

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

    if (!form.email) next.email = 'Email is required.'
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.'

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
  }, [form, apiErrors])

  const isValid = Object.keys(errors).length === 0
  const submitButtonRef = useRef(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Password requirements checker
  const passwordRequirements = useMemo(() => {
    const password = form.password
    return {
      minLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    }
  }, [form.password])

  // Show requirements when user starts typing
  const showPasswordRequirements = form.password.length > 0

  useEffect(() => {
    if (submitButtonRef.current) {
      const btn = submitButtonRef.current
      btn.style.setProperty('background-color', '#1D79BC', 'important')
      btn.style.setProperty('color', '#ffffff', 'important')
      btn.style.setProperty('border', 'none', 'important')
    }
  }, [])

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
    setTouched({ email: true, password: true, confirmPassword: true })
    setApiErrors({})

    if (!isValid) return

    setIsSubmitting(true)

    try {
      const result = await register(form.email, form.password, form.confirmPassword)

      if (!result.success) {
        // Handle API validation errors
        if (result.errors) {
          setApiErrors(result.errors)
          setTouched({ email: true, password: true, confirmPassword: true })
        }
      }
    } catch (error) {
      console.error('Registration error:', error)
      setApiErrors({ email: ['An unexpected error occurred. Please try again.'] })
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [authLoading, isAuthenticated, navigate])

  return (
    <div className="d-flex flex-column">
      <Navbar />

      {/* Hero section with background image below navbar (Strava-style) */}
      <main style={{ marginTop: '64px' }}>
        <section
          className="auth-hero d-flex align-items-start pt-4 pt-md-5 pb-3 pb-md-4"
          style={getAuthHeroStyle(bg1, isDark)}
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
                    <h1 className="h4 fw-semibold mb-0">Sign Up for Free</h1>
                  </div>
                  
                  <div className="card-body p-3 p-md-4 auth-card-body">

                  <div className="d-grid">
                    <button type="button" className="btn btn-google-signin" onClick={() => continueWithGoogle('signup')}>
                      <span className="d-inline-flex align-items-center justify-content-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                          <path
                            fill="#FFC107"
                            d="M43.611 20.083H42V20H24v8h11.303C33.729 32.658 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                          />
                          <path
                            fill="#FF3D00"
                            d="M6.306 14.691l6.571 4.819C14.655 16.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.354 4.337-17.694 10.691z"
                          />
                          <path
                            fill="#4CAF50"
                            d="M24 44c5.117 0 9.805-1.966 13.314-5.166l-6.146-5.205C29.136 35.091 26.701 36 24 36c-5.202 0-9.692-3.319-11.279-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                          />
                          <path
                            fill="#1976D2"
                            d="M43.611 20.083H42V20H24v8h11.303c-.792 2.257-2.231 4.158-4.135 5.629h.002l6.146 5.205C36.88 39.111 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </span>
                    </button>
                  </div>

                  <div className="d-flex align-items-center my-4">
                    <div className="flex-grow-1 border-top auth-divider-line" />
                    <span className="px-3 auth-divider-text">or</span>
                    <div className="flex-grow-1 border-top auth-divider-line" />
                  </div>

                  <form onSubmit={onSubmit} noValidate>
                    <div className="mb-2">
                      <label htmlFor="email" className="form-label auth-form-label">
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        className={`form-control ${
                          touched.email && errors.email ? 'is-invalid' : ''
                        }`}
                        placeholder="Enter Email"
                        value={form.email}
                        onChange={onChange}
                        onBlur={onBlur}
                        autoComplete="email"
                        required
                      />
                      <AnimatePresence>
                        {touched.email && errors.email && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="invalid-feedback"
                          >
                            {errors.email}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="mb-2">
                      <label htmlFor="password" className="form-label auth-form-label">
                        Password
                      </label>
                      <div className="position-relative">
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          className={`form-control ${
                            touched.password && errors.password ? 'is-invalid' : ''
                          }`}
                          placeholder="Create Password"
                          value={form.password}
                          onChange={onChange}
                          onBlur={onBlur}
                          autoComplete="new-password"
                          required
                          minLength={8}
                          style={{ 
                            paddingRight: touched.password && errors.password ? '70px' : '45px' 
                          }}
                        />
                        {/* Error Icon - positioned at 45px from right (before eye icon) */}
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
                        {/* Eye Icon - positioned at 5px from right (far right, last) */}
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
                      
                      {/* Password Requirements List - Smooth Dropdown */}
                      <AnimatePresence>
                        {showPasswordRequirements && (
                          <motion.div
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            transition={{ 
                              duration: 0.3, 
                              ease: [0.25, 0.1, 0.25, 1],
                              height: { duration: 0.3 }
                            }}
                            className="password-requirements mt-2"
                          >
                            <div className="d-flex flex-column gap-1">
                              <motion.div
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.05, duration: 0.2 }}
                                className="d-flex align-items-center gap-2"
                              >
                                {passwordRequirements.minLength ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981', flexShrink: 0 }}>
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255, 255, 255, 0.5)', flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="16"></line>
                                  </svg>
                                )}
                                <span className={passwordRequirements.minLength ? 'requirement-met' : 'requirement-unmet'}>
                                  At least 8 characters
                                </span>
                              </motion.div>
                              <motion.div
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1, duration: 0.2 }}
                                className="d-flex align-items-center gap-2"
                              >
                                {passwordRequirements.hasLetter ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981', flexShrink: 0 }}>
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255, 255, 255, 0.5)', flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="16"></line>
                                  </svg>
                                )}
                                <span className={passwordRequirements.hasLetter ? 'requirement-met' : 'requirement-unmet'}>
                                  At least one letter
                                </span>
                              </motion.div>
                              <motion.div
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.15, duration: 0.2 }}
                                className="d-flex align-items-center gap-2"
                              >
                                {passwordRequirements.hasNumber ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981', flexShrink: 0 }}>
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255, 255, 255, 0.5)', flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="16"></line>
                                  </svg>
                                )}
                                <span className={passwordRequirements.hasNumber ? 'requirement-met' : 'requirement-unmet'}>
                                  At least one number
                                </span>
                              </motion.div>
                            </div>
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
                          placeholder="Confirm Password"
                          value={form.confirmPassword}
                          onChange={onChange}
                          onBlur={onBlur}
                          autoComplete="new-password"
                          required
                          style={{ 
                            paddingRight: touched.confirmPassword && errors.confirmPassword ? '70px' : '45px' 
                          }}
                        />
                        {/* Error Icon - positioned at 45px from right (before eye icon) */}
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
                        {/* Eye Icon - positioned at 5px from right (far right, last) */}
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
                      ref={submitButtonRef}
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
                      {isSubmitting ? 'Signing Up...' : 'Sign Up'}
                    </button>

                    <p className="text-center mt-3 mb-0 auth-legal-text">
                      By continuing, you are agreeing to our{' '}
                      <a href="/terms" className="terms-link">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="/privacy" className="terms-link">
                        Privacy Policy
                      </a>
                      .
                    </p>

                    <div className="text-center mt-4">
                      <span className="auth-muted-text">Already have an account?</span>{' '}
                      <Link className="fw-semibold sign-up-link" to="/login">
                        Log in
                      </Link>
                    </div>
                  </form>
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

export default Register