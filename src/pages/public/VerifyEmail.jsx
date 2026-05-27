import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import bg1 from '../../assets/images/bg1.jpg'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { getAuthHeroStyle } from '../../utils/authPageStyles'

const VerifyEmail = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { verifyEmailOtp, resendOtp } = useAuth()
  const { isDark } = useTheme()

  const email = useMemo(() => {
    const fromState = location.state?.email
    const stored = localStorage.getItem('pending_verification_email')
    return fromState || stored || ''
  }, [location.state])

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // seconds until user can request another code
  const [cooldown, setCooldown] = useState(60)
  const inputsRef = useRef([])

  const formattedCooldown = useMemo(() => {
    if (cooldown <= 0) return ''
    const m = Math.floor(cooldown / 60)
    const s = cooldown % 60
    const mm = m.toString().padStart(2, '0')
    const ss = s.toString().padStart(2, '0')
    return `${mm}:${ss}`
  }, [cooldown])

  useEffect(() => {
    if (!email) navigate('/register', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const onVerify = async (e) => {
    e.preventDefault()
    setError('')
    if (!email) return
    const clean = code.replace(/\s+/g, '')
    if (clean.length < 6) {
      setError('Enter the 6-digit code.')
      return
    }

    setIsSubmitting(true)
    const res = await verifyEmailOtp(email, clean)
    if (!res.success) {
      setError(res.message || 'Verification failed. Please try again.')
      setIsSubmitting(false)
      return
    }

    // success handled in AuthContext (navigate to dashboard)
    setIsSubmitting(false)
  }

  const setDigit = (idx, val) => {
    const digit = (val || '').replace(/\D/g, '').slice(-1)
    const arr = code.split('')
    while (arr.length < 6) arr.push('')
    arr[idx] = digit
    const next = arr.join('').slice(0, 6)
    setCode(next)
    if (digit && idx < 5) {
      inputsRef.current[idx + 1]?.focus?.()
    }
  }

  const onKeyDown = (idx, e) => {
    if (e.key === 'Backspace') {
      const arr = code.split('')
      while (arr.length < 6) arr.push('')
      if (!arr[idx] && idx > 0) {
        inputsRef.current[idx - 1]?.focus?.()
      }
    }
    if (e.key === 'ArrowLeft' && idx > 0) inputsRef.current[idx - 1]?.focus?.()
    if (e.key === 'ArrowRight' && idx < 5) inputsRef.current[idx + 1]?.focus?.()
  }

  const onPaste = (e) => {
    const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    e.preventDefault()
    setCode(text)
    const last = Math.min(text.length, 6) - 1
    if (last >= 0) inputsRef.current[last]?.focus?.()
  }

  const onResend = async () => {
    setError('')
    if (!email) return
    const res = await resendOtp(email)
    if (!res.success) {
      setError(res.message || 'Could not resend code. Please try again.')
      return
    }
    setCooldown(res.cooldown || 60)
  }

  const onBackToSignup = () => {
    setError('')
    setCode('')
    navigate('/register', { replace: true })
  }

  return (
    <div className="d-flex flex-column">
      <Navbar />
      <main style={{ marginTop: '64px' }}>
        <section
          className="auth-hero d-flex align-items-center py-3 py-md-4"
          style={{
            ...getAuthHeroStyle(bg1, isDark, { minHeight: 'calc(100vh - 72px)' }),
            paddingLeft: '0',
            paddingRight: '0',
          }}
        >
          <div className="container px-3 px-md-5 py-2 py-md-3">
            <div className="row justify-content-center">
              <div className="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4">
                <motion.div
                  className="card border-0 auth-card"
                  initial={{ opacity: 0, y: 48 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="auth-card-header px-3">
                    <h1 className="h4 fw-semibold mb-0" style={{ fontSize: 'clamp(1.1rem, 4vw, 1.25rem)' }}>Verify Email</h1>
                  </div>

                  <div className="card-body p-4 p-md-4 auth-card-body">
                    <p className="auth-helper-text small mb-4" style={{ fontSize: 'clamp(0.8rem, 3vw, 0.875rem)' }}>
                      Enter the 6-digit code we sent to <span className="auth-highlight-text d-inline-block">{email}</span>.
                    </p>

                    <form onSubmit={onVerify} noValidate>
                      <div className="d-flex justify-content-center mb-4">
                        <div className="d-flex justify-content-center" onPaste={onPaste} style={{ gap: 'clamp(4px, 1.5vw, 8px)', maxWidth: '100%', flexWrap: 'nowrap' }}>
                          {Array.from({ length: 6 }).map((_, idx) => {
                            const val = code[idx] || ''
                            return (
                              <input
                                key={idx}
                                ref={(el) => {
                                  inputsRef.current[idx] = el
                                }}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                className="auth-otp-input"
                                value={val}
                                onChange={(e) => setDigit(idx, e.target.value)}
                                onKeyDown={(e) => onKeyDown(idx, e)}
                                autoFocus={idx === 0}
                              />
                            )
                          })}
                        </div>
                      </div>

                      <AnimatePresence>
                        {!!error && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="text-danger small mb-3 text-center px-2"
                            style={{ fontSize: 'clamp(0.8rem, 3vw, 0.875rem)' }}
                          >
                            {error}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        type="submit"
                        className="w-100 fw-semibold"
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
                          padding: 'clamp(12px, 3vw, 14px)',
                          fontSize: 'clamp(0.95rem, 3.5vw, 1rem)',
                          minHeight: '48px',
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
                        {isSubmitting ? 'Verifying...' : 'Verify'}
                      </button>

                      <div className="mt-4 text-center">
                        {cooldown > 0 && (
                          <p className="auth-cooldown-text small mb-2">
                            You can request a new code in <span className="auth-highlight-text">{formattedCooldown}</span>.
                          </p>
                        )}
                        <button
                          type="button"
                          className="btn btn-link small forgot-password-link"
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            padding: '8px 4px',
                            fontSize: 'clamp(0.8rem, 3vw, 0.875rem)',
                            minHeight: '44px',
                          }}
                          onClick={onResend}
                          disabled={cooldown > 0}
                        >
                          {cooldown > 0 ? 'Resend code' : 'Resend code'}
                        </button>
                      </div>

                      <div className="mt-2 text-center">
                        <button
                          type="button"
                          className="btn btn-link small forgot-password-link"
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            padding: '8px 4px',
                            fontSize: 'clamp(0.8rem, 3vw, 0.875rem)',
                            minHeight: '44px',
                          }}
                          onClick={onBackToSignup}
                        >
                          Back to Sign Up
                        </button>
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

export default VerifyEmail


