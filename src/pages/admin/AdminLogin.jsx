import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import bg1 from '../../assets/images/bg1.jpg'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { getAuthHeroStyle } from '../../utils/authPageStyles'

const AdminLogin = () => {
  const { adminLogin } = useAdminAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [touched, setTouched] = useState({ email: false, password: false })
  const [showPassword, setShowPassword] = useState(false)
  const [apiErrors, setApiErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitButtonRef = useRef(null)

  useEffect(() => {
    if (submitButtonRef.current) {
      const btn = submitButtonRef.current
      btn.style.setProperty('background-color', '#1D79BC', 'important')
      btn.style.setProperty('color', '#ffffff', 'important')
      btn.style.setProperty('border', 'none', 'important')
    }
  }, [])

  const errors = useMemo(() => {
    const next = {}
    if (!form.email) next.email = 'Email is required.'
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.'
    if (!form.password) next.password = 'Password is required.'

    Object.keys(apiErrors).forEach((k) => {
      if (apiErrors[k]) next[k] = Array.isArray(apiErrors[k]) ? apiErrors[k][0] : apiErrors[k]
    })
    return next
  }, [form.email, form.password, apiErrors])

  const isValid = Object.keys(errors).length === 0

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  const onBlur = (e) => setTouched((p) => ({ ...p, [e.target.name]: true }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    setApiErrors({})

    if (!isValid) return
    setIsSubmitting(true)

    const result = await adminLogin(form.email, form.password)
    if (!result.success) {
      if (result.errors) setApiErrors(result.errors)
      else if (result.message) setApiErrors({ email: [result.message] })
      setIsSubmitting(false)
      return
    }

    // success navigation handled in AdminAuthContext
    setIsSubmitting(false)
  }

  // If already has admin token, go dashboard
  useEffect(() => {
    const token = sessionStorage.getItem('admin_token')
    const refreshToken = localStorage.getItem('admin_refresh_token')
    const storedAdmin = localStorage.getItem('auth_admin')
    if ((token || refreshToken) && storedAdmin) navigate('/admin/cms/posts', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="d-flex flex-column admin-auth-page">
      <Navbar />

      <main style={{ marginTop: '64px' }}>
        <section
          className="auth-hero d-flex align-items-center py-3 py-md-4"
          style={getAuthHeroStyle(bg1, true)}
        >
          <div className="container px-4 px-md-5 py-2 py-md-3">
            <div className="row justify-content-center">
              <div className="col-11 col-sm-9 col-md-7 col-lg-5 col-xl-4">
                <motion.div
                  className="card border-0 auth-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <div className="auth-card-header">
                    <h1 className="h4 fw-semibold mb-0">Admin Log In</h1>
                  </div>

                  <div className="card-body p-3 p-md-4 auth-card-body">
                    <form onSubmit={onSubmit} noValidate>
                      <div className="mb-3">
                        <label htmlFor="email" className="form-label auth-form-label">
                          Email
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          className={`form-control ${touched.email && errors.email ? 'is-invalid' : ''}`}
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

                      <div className="mb-3">
                        <label htmlFor="password" className="form-label auth-form-label">
                          Password
                        </label>
                        <div className="position-relative">
                          <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            className={`form-control ${touched.password && errors.password ? 'is-invalid' : ''}`}
                            placeholder="Enter Password"
                            value={form.password}
                            onChange={onChange}
                            onBlur={onBlur}
                            autoComplete="current-password"
                            required
                            style={{ paddingRight: '45px' }}
                          />
                          <button
                            type="button"
                            className="btn btn-link position-absolute top-50 translate-middle-y auth-password-toggle"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? (
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
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

                      <button
                        ref={submitButtonRef}
                        type="submit"
                        className="w-100 fw-semibold py-2"
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
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Logging In...' : 'Log In'}
                      </button>

                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          className="btn btn-link small text-decoration-none forgot-password-link"
                          style={{ background: 'transparent', border: 'none', padding: 0 }}
                          onClick={() => navigate('/login')}
                        >
                          Back to Client Login
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

export default AdminLogin


