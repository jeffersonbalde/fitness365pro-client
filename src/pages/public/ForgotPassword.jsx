import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import bg1 from '../../assets/images/bg1.jpg'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { getAuthHeroStyle } from '../../utils/authPageStyles'

const ForgotPassword = () => {
  const { forgotPassword } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
  })
  const [touched, setTouched] = useState({
    email: false,
  })
  const [apiErrors, setApiErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const errors = useMemo(() => {
    const next = {}
    if (!form.email) next.email = 'Email is required.'
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.'

    // Merge API errors
    Object.keys(apiErrors).forEach((key) => {
      if (apiErrors[key]) {
        next[key] = Array.isArray(apiErrors[key]) ? apiErrors[key][0] : apiErrors[key]
      }
    })

    return next
  }, [form.email, apiErrors])

  const isValid = Object.keys(errors).length === 0

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
    setTouched({ email: true })
    setApiErrors({})

    if (!isValid) return

    setIsSubmitting(true)

    try {
      const result = await forgotPassword(form.email)

      if (result.success) {
        setIsSuccess(true)
      } else {
        if (result.errors) {
          setApiErrors(result.errors)
          setTouched({ email: true })
        } else if (result.message) {
          setApiErrors({ email: [result.message] })
          setTouched({ email: true })
        }
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      setApiErrors({ email: ['An unexpected error occurred. Please try again.'] })
      setIsSubmitting(false)
    }
  }

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
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ 
                    duration: 0.4, 
                    ease: [0.25, 0.1, 0.25, 1]
                  }}
                >
                  <div className="auth-card-header">
                    <h1 className="h4 fw-semibold mb-0">Forgot Password</h1>
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
                        <h2 className="auth-success-title mb-3">Check your email</h2>
                        <p className="auth-helper-text mb-4">
                          If that email exists, we sent a password reset link to <strong className="auth-highlight-text">{form.email}</strong>. 
                          Please check your inbox and click the link to reset your password.
                        </p>
                        <Link 
                          to="/login" 
                          className="btn w-100 fw-semibold py-2"
                          style={{
                            backgroundColor: '#1D79BC',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            display: 'inline-block',
                          }}
                        >
                          Back to Login
                        </Link>
                      </div>
                    ) : (
                      <>
                        <p className="auth-helper-text mb-4">
                          Enter your email address and we'll send you a link to reset your password.
                        </p>

                        <form onSubmit={onSubmit} noValidate>
                          <div className="mb-3">
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
                            {touched.email && errors.email && (
                              <div className="invalid-feedback">
                                {errors.email}
                              </div>
                            )}
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
                            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPassword

