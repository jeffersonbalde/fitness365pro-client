import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import ProtectedRoute from '../../components/ProtectedRoute'
import { apiRequest } from '../../utils/api'
import { notifySuccess, notifyError } from '../../utils/notifications'
import { motion, AnimatePresence } from 'framer-motion'
import { CountryDropdown, RegionDropdown } from 'react-country-region-selector'
import logoFinal from '../../assets/images/logo_final.png'
import './Onboarding.css'

const feetInchesToCm = (feet, inches) => {
  const ft = parseInt(feet, 10) || 0
  const inc = parseInt(inches, 10) || 0
  return Math.round((ft * 12 + inc) * 2.54)
}

const validateHeightFeetInches = (feet, inches) => {
  if (feet === '' && inches === '') {
    return 'Height is required'
  }

  const ft = parseInt(feet, 10)
  const inc = inches === '' ? 0 : parseInt(inches, 10)

  if (Number.isNaN(ft) || ft < 1 || ft > 9) {
    return 'Enter a valid height in feet (1–9)'
  }
  if (Number.isNaN(inc) || inc < 0 || inc > 11) {
    return 'Inches must be between 0 and 11'
  }

  const cm = feetInchesToCm(ft, inc)
  if (cm < 50 || cm > 300) {
    return 'Height must be between 1\'8" and 9\'10"'
  }

  return null
}

const Onboarding = () => {
  const { client, markOnboardingComplete } = useAuth()
  const { theme, setTheme, toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [goals, setGoals] = useState([])
  const [selectedGoals, setSelectedGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [showGenderHelp, setShowGenderHelp] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    gender: '',
    date_of_birth: '',
    height_feet: '',
    height_inches: '',
    current_weight_kg: '',
    target_weight_kg: '',
    workout_days_per_week: '',
    workout_location: '',
    training_focus: '',
    food_preference: '',
    experience_level: '',
    experience_running: '',
    experience_gym: '',
    experience_biking: '',
    experience_others_title: '',
    experience_others: '',
    city: '',
    province: '',
    country: '',
  })

  const [bmi, setBmi] = useState(null)
  const [bmiCategory, setBmiCategory] = useState(null)
  const [bodyType, setBodyType] = useState(null)
  const saveQueueRef = useRef(Promise.resolve())
  const pendingSaveCountRef = useRef(0)

  // High-level goal groups for Screen 1
  const primaryGoalGroups = [
    { key: 'lose_weight', label: 'Lose Weight', slug: 'lose-weight' },
    { key: 'gain_muscle', label: 'Gain Muscle', slug: 'build-muscle' },
    { key: 'running_cardio', label: 'Running / Cardio', slug: 'improve-cardio' },
    { key: 'general_fitness', label: 'General Fitness', slug: 'stay-active' },
  ]

  const steps = [
    { id: 1, name: 'Goals', slug: 'goals' },
    { id: 2, name: 'Profile & Metrics', slug: 'profile-metrics' },
    { id: 3, name: 'Location', slug: 'location' },
    { id: 4, name: 'Preferences', slug: 'preferences' },
    { id: 5, name: 'Experience', slug: 'experience' },
    { id: 6, name: 'Welcome', slug: 'welcome' },
  ]

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [goalsRes, statusRes] = await Promise.all([
          apiRequest('/v1/onboarding/goals', { method: 'GET' }),
          apiRequest('/v1/onboarding/status', { method: 'GET' }),
        ])

        if (goalsRes.data.success) {
          setGoals(goalsRes.data.data.goals)
        }

        if (statusRes.data.success) {
          const data = statusRes.data.data
          const step = data.onboarding_step || 1
          setCurrentStep(step > 0 ? step : 1)

          // Set BMI and body type if available
          if (data.bmi !== null && data.bmi !== undefined) {
            setBmi(data.bmi)
          }
          if (data.bmi_category) {
            setBmiCategory(data.bmi_category)
          }
          if (data.body_type) {
            setBodyType(data.body_type)
          }

          if (data.theme_mode === 'light' || data.theme_mode === 'dark') {
            await setTheme(data.theme_mode, { persistRemote: false })
          }

          if (data.onboarding_completed) {
            navigate('/dashboard')
            return
          }

          if (Array.isArray(data.goals) && data.goals.length > 0) {
            setSelectedGoals(data.goals.map((goal) => goal.id))
          }
        }
      } catch (error) {
        console.error('Failed to fetch onboarding data:', error)
        // If 401 Unauthorized, redirect to login (ProtectedRoute should handle this, but ensure it)
        if (error?.response?.status === 401) {
          notifyError('Your session has expired. Please log in again.')
          navigate('/login', { replace: true })
          return
        }
      } finally {
        setLoading(false)
      }
    }

    if (client) {
      fetchData()
    } else {
      // If no client, set loading to false (ProtectedRoute will redirect)
      setLoading(false)
    }
  }, [client, navigate, setTheme])

  // Nuclear fix: Ensure onboarding header stays fixed on mobile
  useEffect(() => {
    const header = document.getElementById('onboarding-header-fixed')
    if (!header) return

    const forceFixed = () => {
      if (header) {
        header.style.setProperty('position', 'fixed', 'important')
        header.style.setProperty('top', '0', 'important')
        header.style.setProperty('left', '0', 'important')
        header.style.setProperty('right', '0', 'important')
        header.style.setProperty('z-index', '99999', 'important')
        header.style.setProperty('width', '100vw', 'important')
        header.style.setProperty('max-width', '100vw', 'important')
        header.style.setProperty('margin', '0', 'important')
        header.style.setProperty('-webkit-transform', 'translateZ(0)', 'important')
        header.style.setProperty('transform', 'translateZ(0)', 'important')
      }
    }

    forceFixed()
    
    const events = ['resize', 'scroll', 'orientationchange', 'touchmove']
    events.forEach(event => {
      window.addEventListener(event, forceFixed, { passive: true })
    })

    const observer = new MutationObserver(forceFixed)
    observer.observe(header, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    })

    return () => {
      observer.disconnect()
      events.forEach(event => {
        window.removeEventListener(event, forceFixed)
      })
    }
  }, [])

  const handleGoalToggle = (goalId) => {
    setSelectedGoals(prev => {
      // If already selected, unselect it
      if (prev.includes(goalId)) {
        return prev.filter(id => id !== goalId)
      }
      // Enforce max of 3 goals
      if (prev.length >= 3) {
        setErrors(prevErrors => ({
          ...prevErrors,
          goals: 'You can select up to 3 goals.',
        }))
        return prev
      }
      return [...prev, goalId]
    })
    if (errors.goals) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.goals
        return newErrors
      })
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
    if ((name === 'height_feet' || name === 'height_inches') && errors.height) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.height
        return newErrors
      })
    }
    if (generalError) {
      setGeneralError(null)
    }
  }

  const applyStepResponse = (step, profile) => {
    if (step === 5 && profile) {
      if (profile.bmi !== null && profile.bmi !== undefined) {
        setBmi(profile.bmi)
      }
      if (profile.bmi_category) {
        setBmiCategory(profile.bmi_category)
      }
      if (profile.body_type) {
        setBodyType(profile.body_type)
      }
    }
  }

  const beginTrackedSave = () => {
    pendingSaveCountRef.current += 1
    setSaving(true)
  }

  const endTrackedSave = () => {
    pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1)
    if (pendingSaveCountRef.current === 0) {
      setSaving(false)
    }
  }

  const persistOnboardingStep = (stepToCall, payload) => {
    beginTrackedSave()

    const saveTask = saveQueueRef.current
      .catch(() => undefined)
      .then(() => apiRequest(`/v1/onboarding/step/${stepToCall}`, {
        method: 'POST',
        body: payload,
      }))
      .finally(() => {
        endTrackedSave()
      })

    saveQueueRef.current = saveTask.catch(() => undefined)
    return saveTask
  }

  const handleNext = async () => {
    setErrors({})
    setGeneralError(null)

    if (currentStep === 1) {
      if (selectedGoals.length < 1) {
        setErrors({ goals: ['Please select 1–3 goals'] })
        notifyError('Please select 1–3 goals')
        return
      }
      if (selectedGoals.length > 3) {
        setErrors({ goals: ['You can select up to 3 goals'] })
        notifyError('You can select up to 3 goals')
        return
      }
    }

    if (currentStep === 2) {
      if (!formData.first_name.trim()) {
        setErrors({ first_name: 'First name is required' })
        return
      }
      if (!formData.last_name.trim()) {
        setErrors({ last_name: 'Last name is required' })
        return
      }
      if (!formData.gender) {
        setErrors({ gender: 'Please select your gender' })
        return
      }
      if (!formData.date_of_birth) {
        setErrors({ date_of_birth: 'Date of birth is required' })
        return
      }
      const heightError = validateHeightFeetInches(formData.height_feet, formData.height_inches)
      if (heightError) {
        setErrors({ height: heightError })
        return
      }
      if (!formData.current_weight_kg) {
        setErrors({ current_weight_kg: 'Current weight is required' })
        return
      }
    }

    if (currentStep === 3) {
      if (!formData.province.trim()) {
        setErrors({ province: 'Province is required' })
        return
      }
      if (!formData.country) {
        setErrors({ country: 'Country is required' })
        return
      }
    }

    if (currentStep === 4) {
      if (!formData.workout_days_per_week) {
        setErrors({ workout_days_per_week: 'Please select workout days per week' })
        return
      }
      if (!formData.workout_location) {
        setErrors({ workout_location: 'Please select where you usually work out' })
        return
      }
      if (!formData.training_focus) {
        setErrors({ training_focus: 'Please select your training focus' })
        return
      }
    }

    if (currentStep === 5) {
      const experienceErrors = {}
      if (formData.training_focus === 'running' && !formData.experience_running) {
        experienceErrors.experience_running = 'Please select your running experience level'
      }
      if (formData.training_focus === 'gym' && !formData.experience_gym) {
        experienceErrors.experience_gym = 'Please select your gym workout experience level'
      }
      if (formData.training_focus === 'biking' && !formData.experience_biking) {
        experienceErrors.experience_biking = 'Please select your biking experience level'
      }
      // Only validate others if at least one field is filled
      const hasOthersTitle = formData.experience_others_title && formData.experience_others_title.trim().length > 0
      const hasOthersLevel = formData.experience_others && formData.experience_others.trim().length > 0
      
      if (hasOthersLevel && !hasOthersTitle) {
        experienceErrors.experience_others_title = 'Please enter the activity title'
      }
      if (Object.keys(experienceErrors).length > 0) {
        setErrors(experienceErrors)
        return
      }
    }

    const stepToCall = currentStep
    let payload = {}

    if (currentStep === 1) {
      payload = { goals: selectedGoals }
    } else if (currentStep === 2) {
      payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        gender: formData.gender,
        date_of_birth: formData.date_of_birth,
        height_cm: feetInchesToCm(formData.height_feet, formData.height_inches),
        current_weight_kg: formData.current_weight_kg,
        target_weight_kg: formData.target_weight_kg,
      }
    } else if (currentStep === 3) {
      payload = {
        city: formData.city,
        province: formData.province,
        country: formData.country,
      }
    } else if (currentStep === 4) {
      payload = {
        workout_days_per_week: formData.workout_days_per_week,
        workout_location: formData.workout_location,
        training_focus: formData.training_focus,
        food_preference: formData.food_preference,
      }
    } else if (currentStep === 5) {
      payload = {
        experience_running: formData.experience_running,
        experience_gym: formData.experience_gym,
        experience_biking: formData.experience_biking,
        experience_others_title: formData.experience_others_title,
        experience_others: formData.experience_others,
      }
    }

    const nextStep = currentStep === 5 ? 6 : currentStep + 1
    setCurrentStep(nextStep)
    if (currentStep === 4) {
      setSelectedGoals([])
    }

    try {
      const response = await persistOnboardingStep(stepToCall, payload)

      if (response.data.success) {
        setErrors({})
        setGeneralError(null)
        applyStepResponse(stepToCall, response.data.data?.profile)
      }
    } catch (error) {
      console.error('Failed to save step:', error)

      const expectedNextStep = stepToCall === 5 ? 6 : stepToCall + 1
      setCurrentStep((activeStep) => (activeStep === expectedNextStep ? stepToCall : activeStep))

      const errorData = error?.response?.data || {}
      const apiErrors = errorData.errors || {}
      const errorMessage = errorData.message || 'Failed to save. Please try again.'

      const formattedErrors = {}
      Object.keys(apiErrors).forEach(key => {
        const errorArray = Array.isArray(apiErrors[key]) ? apiErrors[key] : [apiErrors[key]]
        formattedErrors[key] = errorArray[0]
      })

      if (formattedErrors.height_cm) {
        formattedErrors.height = formattedErrors.height_cm
        delete formattedErrors.height_cm
      }

      setErrors(formattedErrors)

      if (Object.keys(formattedErrors).length === 0) {
        setGeneralError(errorMessage)
        notifyError(errorMessage)
      } else {
        const firstError = Object.values(formattedErrors)[0]
        notifyError(firstError)
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
      setErrors({})
      setGeneralError(null)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="d-flex align-items-center justify-content-center onboarding-page" style={{ 
          minHeight: '100vh', 
          backgroundColor: 'var(--app-bg)',
        }}>
          <div className="spinner-border" role="status" style={{ color: '#1D79BC' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const currentStepData = steps.find(s => s.id === currentStep)
  const stepProgress = (currentStep / steps.length) * 100

  const navIconColor = isDark ? '#cbd5e1' : '#374151'

  return (
    <ProtectedRoute>
      <div
        className="onboarding-page"
        style={{ 
        minHeight: '100vh', 
        backgroundColor: 'var(--app-bg)',
        color: 'var(--app-text)',
        paddingTop: '64px', // offset for fixed onboarding header
      }}>
        {/* Header with Logo Left - Responsive */}
        <header
          className="onboarding-header fixed-top"
          id="onboarding-header-fixed"
          style={{
            padding: '12px 48px',
            borderBottom: '1px solid var(--app-border)',
            backgroundColor: 'var(--app-surface)',
            zIndex: 99999,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            width: '100vw',
            margin: 0,
          }}
        >
          <div className="d-flex align-items-center justify-content-between gap-3" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            <div className="d-flex align-items-center">
              <Link to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                <img src={logoFinal} alt="Fitness 365 Pro" className="onboarding-logo" height="40" />
              </Link>
            </div>
            <button
              type="button"
              className="btn p-0 border-0 bg-transparent d-flex align-items-center justify-content-center"
              aria-label="Toggle theme"
              onClick={toggleTheme}
              style={{
                width: 32,
                height: 32,
                borderRadius: '999px',
                color: navIconColor,
              }}
            >
              {isDark ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 4V2M12 22v-2M4 12H2m20 0h-2M6.34 6.34 4.93 4.93m14.14 14.14-1.41-1.41M17.66 6.34l1.41-1.41M6.34 17.66l-1.41 1.41M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Main Content - Centered - Responsive */}
        <main className="onboarding-main" style={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 80px)',
          padding: '40px 20px',
          backgroundColor: 'var(--app-bg)',
        }}>
          <div style={{ width: '100%', maxWidth: '1200px' }}>
            {/* Step Indicator - Full width (matches navbar container) */}
            <div
              className="mb-5 onboarding-stepper-wrapper"
              style={{ marginBottom: '28px' }}
            >
              {/* Desktop stepper */}
              <div className="onboarding-stepper onboarding-stepper-desktop" style={{ width: '100%' }}>
                <div
                  className="onboarding-stepper-inner"
                >
                  {steps.map((step, idx) => {
                    const isDone = step.id < currentStep
                    const isCurrent = step.id === currentStep
                    const isUpcoming = step.id > currentStep

                    const dotBg = isDone || isCurrent ? 'var(--brand-green)' : 'var(--app-surface)'
                    const dotBorder = isUpcoming ? 'var(--app-border)' : 'var(--brand-green)'
                    const dotFg = isDone || isCurrent ? '#FFFFFF' : 'var(--app-text-muted)'
                    const labelColor = isCurrent ? 'var(--app-text)' : isDone ? 'var(--brand-green-dark)' : 'var(--app-text-muted)'

                    return (
                      <React.Fragment key={step.id}>
                        <div
                          className={`onboarding-stepper-item ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <div
                            className="onboarding-stepper-dot"
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '9999px',
                              backgroundColor: dotBg,
                              border: `1px solid ${dotBorder}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: dotFg,
                              fontSize: '12px',
                              fontWeight: 800,
                              flexShrink: 0,
                              boxShadow: isCurrent ? '0 2px 10px rgba(34, 197, 94, 0.18)' : 'none',
                            }}
                          >
                            {isDone ? (
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <path
                                  d="M13.3333 4L6 11.3333L2.66667 8"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : (
                              step.id
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div
                              className="onboarding-stepper-label"
                              style={{
                                fontSize: '13px',
                                fontWeight: isCurrent ? 700 : 600,
                                color: labelColor,
                                lineHeight: '1',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {step.name}
                            </div>
                            <div
                              className="onboarding-stepper-underline"
                              style={{
                                height: '2px',
                                width: '100%',
                                backgroundColor: isCurrent ? 'var(--brand-green)' : 'transparent',
                                borderRadius: '9999px',
                              }}
                            />
                          </div>
                        </div>

                        {idx < steps.length - 1 && (
                          <div
                            aria-hidden="true"
                            className="onboarding-stepper-separator"
                            style={{
                              width: '28px',
                              height: '1px',
                              backgroundColor: 'var(--app-border)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>

              {/* Mobile simple progress bar + text */}
              <div className="onboarding-stepper-mobile-simple">
                <div className="onboarding-stepper-mobile-text">
                  Step {currentStep} of {steps.length} · {currentStepData?.name}
                  {saving && currentStep < 6 && (
                    <span className="onboarding-stepper-save-hint"> · Saving...</span>
                  )}
                </div>
                <div className="onboarding-stepper-mobile-bar">
                  <div
                    className="onboarding-stepper-mobile-bar-fill"
                    style={{ width: `${stepProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Form stays compact + centered */}
            <div
              className="onboarding-form-container"
              style={{
                width: '100%',
                maxWidth: '520px',
                margin: '0 auto',
              }}
            >

            {/* Error Alert */}
            <AnimatePresence>
              {(generalError || Object.keys(errors).length > 0) && (
                <motion.div
                  key="global-error"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="alert alert-danger mb-4"
                  role="alert"
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #FEE2E2',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    fontSize: '12px',
                    padding: '12px 16px',
                  }}
                >
                  {generalError || Object.values(errors)[0]}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {/* Step 1: Goals */}
              {currentStep === 1 && (
                <motion.div
                  key="step1-goals"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 style={{ 
                    fontSize: '24px', 
                    fontWeight: 700, 
                    color: 'var(--app-text)',
                    marginBottom: '8px',
                    textAlign: 'center',
                    lineHeight: '1.2'
                  }}>
                    What are your fitness goals?
                  </h1>
                  <p style={{ 
                    fontSize: '14px', 
                    color: 'var(--app-text-muted)', 
                    marginBottom: '6px',
                    textAlign: 'center',
                    lineHeight: '1.5'
                  }}>
                    Select your primary goals so we can tailor recommendations for you.
                  </p>
                  <p style={{ 
                    fontSize: '12px',
                    color: 'var(--app-text-muted)',
                    marginBottom: '18px',
                    textAlign: 'center'
                  }}>
                    Please choose <span style={{ fontWeight: 600, color: 'var(--app-text)' }}>1–3 options</span>.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {primaryGoalGroups.map(group => {
                      const matched = goals.find(g => g.slug === group.slug)
                      if (!matched) return null
                      const isSelected = selectedGoals.includes(matched.id)
                      return (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => handleGoalToggle(matched.id)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: isSelected
                              ? '2px solid var(--brand-primary)'
                              : '1px solid var(--app-border)',
                            backgroundColor: isSelected ? 'var(--app-surface-2)' : 'var(--app-surface)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: isSelected ? 'var(--brand-primary)' : 'var(--app-text)',
                            transition: 'all 0.18s ease',
                            boxShadow: isSelected ? '0 6px 18px rgba(15, 23, 42, 0.08)' : 'none',
                          }}
                        >
                          <span style={{ textAlign: 'left' }}>{group.label}</span>
                          {isSelected && (
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '999px',
                                backgroundColor: 'var(--brand-green)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#FFFFFF',
                              }}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M12.5 4.5L7 11L3.5 8"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Profile & Metrics */}
              {currentStep === 2 && (
                <motion.div
                  key="step2-profile"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="onboarding-title" style={{ 
                    fontSize: '24px', 
                    fontWeight: 700, 
                    color: 'var(--app-text)',
                    marginBottom: '6px',
                    textAlign: 'center',
                    lineHeight: '1.2'
                  }}>
                    Let's get to know you
                  </h1>
                  <p className="onboarding-description" style={{ 
                    fontSize: '14px', 
                    color: 'var(--app-text-muted)', 
                    marginBottom: '24px',
                    textAlign: 'center',
                    lineHeight: '1.5'
                  }}>
                    We'll use this information to personalize your experience and help you achieve your fitness goals.
                  </p>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ 
                      fontSize: '13px', 
                      fontWeight: 500, 
                      color: 'var(--app-text-muted)',
                      marginBottom: '6px',
                      display: 'block'
                    }}>
                      First Name
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.first_name ? 'is-invalid' : ''}`}
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      placeholder="Enter your first name"
                      style={{
                        borderRadius: '6px',
                        border: errors.first_name ? '1px solid #DC2626' : '1px solid var(--app-border)',
                        padding: '10px 14px',
                        fontSize: '14px',
                        backgroundColor: 'var(--app-surface)',
                        transition: 'border-color 0.2s'
                      }}
                    />
                    {errors.first_name && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.first_name}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ 
                      fontSize: '13px', 
                      fontWeight: 500, 
                      color: 'var(--app-text-muted)',
                      marginBottom: '6px',
                      display: 'block'
                    }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.last_name ? 'is-invalid' : ''}`}
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      placeholder="Enter your last name"
                      style={{
                        borderRadius: '6px',
                        border: errors.last_name ? '1px solid #DC2626' : '1px solid var(--app-border)',
                        padding: '10px 14px',
                        fontSize: '14px',
                        backgroundColor: 'var(--app-surface)'
                      }}
                    />
                    {errors.last_name && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.last_name}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label className="form-label" style={{ 
                      fontSize: '13px', 
                      fontWeight: 500, 
                      color: 'var(--app-text-muted)',
                      marginBottom: '6px',
                      display: 'block'
                    }}>
                      Gender
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {[
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className="onboarding-gender-option"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: formData.gender === option.value 
                              ? '2px solid var(--brand-primary)' 
                              : '1px solid var(--app-border)',
                            backgroundColor: formData.gender === option.value ? 'var(--app-surface-2)' : 'var(--app-surface)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: formData.gender === option.value ? 'var(--brand-primary)' : '#374151',
                            transition: 'all 0.18s ease',
                            boxShadow: formData.gender === option.value ? '0 6px 18px rgba(15, 23, 42, 0.08)' : 'none',
                          }}
                        >
                          <input
                            type="radio"
                            name="gender"
                            value={option.value}
                            checked={formData.gender === option.value}
                            onChange={handleChange}
                            style={{ display: 'none' }}
                          />
                          <span style={{ textAlign: 'left' }}>{option.label}</span>
                          {formData.gender === option.value && (
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '999px',
                                backgroundColor: 'var(--brand-green)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#FFFFFF',
                              }}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M12.5 4.5L7 11L3.5 8"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGenderHelp(true)}
                      style={{
                        marginTop: '8px',
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        color: 'var(--brand-primary)',
                        fontSize: '12px',
                        fontWeight: 500,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        transition: 'color 0.18s ease, opacity 0.18s ease',
                      }}
                    >
                      Which one should I choose?
                    </button>
                    {errors.gender && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.gender}
                      </div>
                    )}
                  </div>
                  {/* Physical metrics section under same step */}
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px' }}>
                        Date of Birth *
                      </label>
                      <input
                        type="date"
                        className={`form-control ${errors.date_of_birth ? 'is-invalid' : ''}`}
                        name="date_of_birth"
                        value={formData.date_of_birth}
                        onChange={handleChange}
                        style={{
                          borderRadius: '8px',
                          border: errors.date_of_birth ? '1px solid #DC2626' : '1px solid var(--app-border)',
                          padding: '10px 14px',
                          fontSize: '14px'
                        }}
                      />
                      {errors.date_of_birth && (
                        <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                          {errors.date_of_birth}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px' }}>
                        Height *
                      </label>
                      <div className={`onboarding-height-inputs ${errors.height ? 'is-invalid' : ''}`}>
                        <div className="onboarding-height-field">
                          <input
                            type="number"
                            className={`form-control ${errors.height ? 'is-invalid' : ''}`}
                            name="height_feet"
                            value={formData.height_feet}
                            onChange={handleChange}
                            min="1"
                            max="9"
                            placeholder="5"
                            inputMode="numeric"
                            aria-label="Height in feet"
                            style={{
                              borderRadius: '8px',
                              border: errors.height ? '1px solid #DC2626' : '1px solid var(--app-border)',
                              padding: '10px 14px',
                              fontSize: '14px'
                            }}
                          />
                          <span className="onboarding-height-unit">ft</span>
                        </div>
                        <div className="onboarding-height-field">
                          <input
                            type="number"
                            className={`form-control ${errors.height ? 'is-invalid' : ''}`}
                            name="height_inches"
                            value={formData.height_inches}
                            onChange={handleChange}
                            min="0"
                            max="11"
                            placeholder="10"
                            inputMode="numeric"
                            aria-label="Height in inches"
                            style={{
                              borderRadius: '8px',
                              border: errors.height ? '1px solid #DC2626' : '1px solid var(--app-border)',
                              padding: '10px 14px',
                              fontSize: '14px'
                            }}
                          />
                          <span className="onboarding-height-unit">in</span>
                        </div>
                      </div>
                      {errors.height && (
                        <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                          {errors.height}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px' }}>
                        Current Weight (kg) *
                      </label>
                      <input
                        type="number"
                        className={`form-control ${errors.current_weight_kg ? 'is-invalid' : ''}`}
                        name="current_weight_kg"
                        value={formData.current_weight_kg}
                        onChange={handleChange}
                        min="20"
                        max="500"
                        step="0.1"
                        placeholder="e.g. 70.5"
                        style={{
                          borderRadius: '8px',
                          border: errors.current_weight_kg ? '1px solid #DC2626' : '1px solid var(--app-border)',
                          padding: '10px 14px',
                          fontSize: '14px'
                        }}
                      />
                      {errors.current_weight_kg && (
                        <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                          {errors.current_weight_kg}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px' }}>
                        Target Weight (kg)
                      </label>
                      <input
                        type="number"
                        className={`form-control ${errors.target_weight_kg ? 'is-invalid' : ''}`}
                        name="target_weight_kg"
                        value={formData.target_weight_kg}
                        onChange={handleChange}
                        min="20"
                        max="500"
                        step="0.1"
                        placeholder="e.g. 65.0"
                        style={{
                          borderRadius: '8px',
                          border: errors.target_weight_kg ? '1px solid #DC2626' : '1px solid var(--app-border)',
                          padding: '10px 14px',
                          fontSize: '14px'
                        }}
                      />
                      {errors.target_weight_kg && (
                        <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                          {errors.target_weight_kg}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Location */}
              {currentStep === 3 && (
                <motion.div
                  key="step3-location"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 style={{ 
                    fontSize: '24px', 
                    fontWeight: 700, 
                    color: 'var(--app-text)',
                    marginBottom: '8px',
                    textAlign: 'center',
                    lineHeight: '1.2'
                  }}>
                    Location
                  </h1>
                  <p style={{ 
                    fontSize: '14px', 
                    color: 'var(--app-text-muted)', 
                    marginBottom: '20px',
                    textAlign: 'center',
                    lineHeight: '1.5'
                  }}>
                    Help us connect you with local leaderboards and nearby fitness communities.
                  </p>

                  {/* Country */}
                  <div style={{ marginBottom: '14px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px' }}>
                      Country *
                    </label>
                    <div className="onboarding-location-select">
                      <CountryDropdown
                        value={formData.country}
                        onChange={(val) =>
                          handleChange({ target: { name: 'country', value: val } })
                        }
                        classes={`form-control ${errors.country ? 'is-invalid' : ''}`}
                      />
                    </div>
                    {errors.country && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.country}
                      </div>
                    )}
                  </div>

                  {/* Region */}
                  <div style={{ marginBottom: '14px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px' }}>
                      Region / State / Province *
                    </label>
                    <div className="onboarding-location-select">
                      <RegionDropdown
                        country={formData.country}
                        value={formData.province}
                        onChange={(val) =>
                          handleChange({ target: { name: 'province', value: val } })
                        }
                        classes={`form-control ${errors.province ? 'is-invalid' : ''}`}
                        blankOptionLabel="Select region"
                        defaultOptionLabel="Select region"
                      />
                    </div>
                    {errors.province && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.province}
                      </div>
                    )}
                  </div>

                  {/* City (optional) */}
                  <div style={{ marginBottom: '14px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px' }}>
                      City (optional)
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.city ? 'is-invalid' : ''}`}
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Enter city"
                      style={{
                        borderRadius: '8px',
                        border: errors.city ? '1px solid #DC2626' : '1px solid var(--app-border)',
                        padding: '10px 14px',
                        fontSize: '14px',
                      }}
                    />
                    {errors.city && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.city}
                      </div>
                    )}
                  </div>

                  {/* City is optional, so no more timezone field here */}
                </motion.div>
              )}

              {/* Step 4: Workout & nutrition preferences */}
              {currentStep === 4 && (
                <motion.div
                  key="step4-preferences"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 style={{ 
                    fontSize: '24px', 
                    fontWeight: 700, 
                    color: 'var(--app-text)',
                    marginBottom: '8px',
                    textAlign: 'center',
                    lineHeight: '1.2'
                  }}>
                    Workout & nutrition preferences
                  </h1>
                  <p style={{ 
                    fontSize: '14px', 
                    color: 'var(--app-text-muted)', 
                    marginBottom: '24px',
                    textAlign: 'center',
                    lineHeight: '1.5'
                  }}>
                    Help us understand how you like to train and eat so we can fine‑tune your plan.
                  </p>
                  {/* Workout days */}
                  <div style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '8px', display: 'block' }}>
                      Workout days per week *
                    </label>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--app-text-muted)',
                        marginBottom: '8px',
                        lineHeight: 1.5,
                      }}
                    >
                      This isn’t medical advice. If you have any health conditions, injuries, or are
                      new to exercise, please talk to your doctor or a qualified healthcare
                      professional before increasing your training load.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px' }}>
                      {[
                        { value: '3-4', label: '3–4', sub: 'Light' },
                        { value: '4-5', label: '4–5', sub: 'Moderate' },
                        { value: '5-6', label: '5–6', sub: 'Intense' },
                      ].map(option => {
                        const active = formData.workout_days_per_week === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleChange({ target: { name: 'workout_days_per_week', value: option.value } })}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: active ? '2px solid var(--brand-primary)' : '1px solid var(--app-border)',
                              backgroundColor: active ? 'var(--app-surface-2)' : 'var(--app-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '13px',
                              fontWeight: 500,
                              color: active ? 'var(--brand-primary)' : '#374151',
                              transition: 'all 0.18s ease',
                              boxShadow: active ? '0 6px 18px rgba(15, 23, 42, 0.08)' : 'none',
                            }}
                          >
                            <div style={{ textAlign: 'left' }}>
                              <div>{option.label} days</div>
                              <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginTop: 2 }}>{option.sub}</div>
                            </div>
                            {active && (
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '999px',
                                  backgroundColor: 'var(--brand-green)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#FFFFFF',
                                }}
                              >
                                <svg
                                  width="11"
                                  height="11"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M12.5 4.5L7 11L3.5 8"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {errors.workout_days_per_week && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.workout_days_per_week}
                      </div>
                    )}
                  </div>

                  {/* Home or gym */}
                  <div style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '8px', display: 'block' }}>
                      Where do you usually work out? *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {[
                        { value: 'home', label: 'At home' },
                        { value: 'gym', label: 'At the gym' },
                        { value: 'outdoor', label: 'Outdoor' },
                      ].map(option => {
                        const active = formData.workout_location === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleChange({ target: { name: 'workout_location', value: option.value } })}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: active ? '2px solid var(--brand-primary)' : '1px solid var(--app-border)',
                              backgroundColor: active ? 'var(--app-surface-2)' : 'var(--app-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '13px',
                              fontWeight: 500,
                              color: active ? 'var(--brand-primary)' : '#374151',
                              transition: 'all 0.18s ease',
                              boxShadow: active ? '0 6px 18px rgba(15, 23, 42, 0.08)' : 'none',
                            }}
                          >
                            <span style={{ textAlign: 'left' }}>{option.label}</span>
                            {active && (
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '999px',
                                  backgroundColor: 'var(--brand-green)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#FFFFFF',
                                }}
                              >
                                <svg
                                  width="11"
                                  height="11"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M12.5 4.5L7 11L3.5 8"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {errors.workout_location && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.workout_location}
                      </div>
                    )}
                  </div>

                  {/* Food preference */}
                  <div style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '8px', display: 'block' }}>
                      What should your plan focus more on? *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '10px' }}>
                      {[
                        { value: 'running', label: 'Running' },
                        { value: 'gym', label: 'Gym' },
                        { value: 'biking', label: 'Biking' },
                      ].map(option => {
                        const active = formData.training_focus === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleChange({ target: { name: 'training_focus', value: option.value } })}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: active ? '2px solid var(--brand-primary)' : '1px solid var(--app-border)',
                              backgroundColor: active ? 'var(--app-surface-2)' : 'var(--app-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '13px',
                              fontWeight: 500,
                              color: active ? 'var(--brand-primary)' : '#374151',
                              transition: 'all 0.18s ease',
                              boxShadow: active ? '0 6px 18px rgba(15, 23, 42, 0.08)' : 'none',
                            }}
                          >
                            <span style={{ textAlign: 'left' }}>{option.label}</span>
                            {active && (
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '999px',
                                  backgroundColor: 'var(--brand-green)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#FFFFFF',
                                }}
                              >
                                <svg
                                  width="11"
                                  height="11"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M12.5 4.5L7 11L3.5 8"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {errors.training_focus && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.training_focus}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px', display: 'block' }}>
                      Food preference (optional)
                    </label>
                    <select
                      className="form-control"
                      name="food_preference"
                      value={formData.food_preference}
                      onChange={handleChange}
                      style={{
                        borderRadius: '8px',
                        border: '1px solid var(--app-border)',
                        padding: '10px 14px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">No specific preference</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="low_carb">Low‑carb</option>
                      <option value="high_protein">High‑protein</option>
                    </select>
                  </div>
                </motion.div>
              )}

              {/* Step 5: Experience */}
              {currentStep === 5 && (
                <motion.div
                  key="step5-experience"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 style={{ 
                    fontSize: '24px', 
                    fontWeight: 700, 
                    color: 'var(--app-text)',
                    marginBottom: '8px',
                    textAlign: 'center',
                    lineHeight: '1.2'
                  }}>
                    Experience Level
                  </h1>
                  <p style={{ 
                    fontSize: '14px', 
                    color: 'var(--app-text-muted)', 
                    marginBottom: '24px',
                    textAlign: 'center',
                    lineHeight: '1.5'
                  }}>
                    Tell us your experience level for each activity type so we can personalize your training program.
                  </p>
                  
                  {/* Running Experience */}
                  <div style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px', display: 'block' }}>
                      Running {formData.training_focus === 'running' ? '*' : ''}
                    </label>
                    <select
                      className={`form-control ${errors.experience_running ? 'is-invalid' : ''}`}
                      name="experience_running"
                      value={formData.experience_running}
                      onChange={handleChange}
                      style={{
                        borderRadius: '8px',
                        border: errors.experience_running ? '1px solid #DC2626' : '1px solid var(--app-border)',
                        padding: '10px 14px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select experience level...</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                    {errors.experience_running && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.experience_running}
                      </div>
                    )}
                  </div>

                  {/* PRT/Gym Workout Experience */}
                  <div style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px', display: 'block' }}>
                      PRT/Gym Workout {formData.training_focus === 'gym' ? '*' : ''}
                    </label>
                    <select
                      className={`form-control ${errors.experience_gym ? 'is-invalid' : ''}`}
                      name="experience_gym"
                      value={formData.experience_gym}
                      onChange={handleChange}
                      style={{
                        borderRadius: '8px',
                        border: errors.experience_gym ? '1px solid #DC2626' : '1px solid var(--app-border)',
                        padding: '10px 14px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select experience level...</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                    {errors.experience_gym && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.experience_gym}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px', display: 'block' }}>
                      Biking {formData.training_focus === 'biking' ? '*' : ''}
                    </label>
                    <select
                      className={`form-control ${errors.experience_biking ? 'is-invalid' : ''}`}
                      name="experience_biking"
                      value={formData.experience_biking}
                      onChange={handleChange}
                      style={{
                        borderRadius: '8px',
                        border: errors.experience_biking ? '1px solid #DC2626' : '1px solid var(--app-border)',
                        padding: '10px 14px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select experience level...</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                    {errors.experience_biking && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.experience_biking}
                      </div>
                    )}
                  </div>

                  {/* Other Activity (Custom) - Optional */}
                  <div style={{ marginBottom: '8px', marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--app-border)' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px', display: 'block' }}>
                      Other Activity / Hobby <span style={{ color: 'var(--app-text-muted)', fontWeight: 400, fontSize: '12px' }}>(optional)</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.experience_others_title ? 'is-invalid' : ''}`}
                      name="experience_others_title"
                      value={formData.experience_others_title}
                      onChange={handleChange}
                      placeholder="e.g., Yoga, Swimming, Cycling, Martial Arts"
                      style={{
                        borderRadius: '8px',
                        border: errors.experience_others_title ? '1px solid #DC2626' : '1px solid var(--app-border)',
                        padding: '10px 14px',
                        fontSize: '14px',
                        backgroundColor: 'var(--app-surface)',
                        transition: 'border-color 0.2s',
                        marginBottom: '12px',
                      }}
                    />
                    {errors.experience_others_title && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.experience_others_title}
                      </div>
                    )}
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: '6px', display: 'block' }}>
                      Experience Level <span style={{ color: 'var(--app-text-muted)', fontWeight: 400, fontSize: '12px' }}>(optional)</span>
                    </label>
                    <select
                      className={`form-control ${errors.experience_others ? 'is-invalid' : ''}`}
                      name="experience_others"
                      value={formData.experience_others}
                      onChange={handleChange}
                      style={{
                        borderRadius: '8px',
                        border: errors.experience_others ? '1px solid #DC2626' : '1px solid var(--app-border)',
                        padding: '10px 14px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select experience level...</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                    {errors.experience_others && (
                      <div className="invalid-feedback d-block" style={{ fontSize: '13px', color: '#DC2626', marginTop: '6px' }}>
                        {errors.experience_others}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 6: Welcome — no generated fitness plan (community / social product) */}
              {currentStep === 6 && (
                <motion.div
                  key="step6-welcome"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className="onboarding-plan-shell"
                    style={{ padding: '24px 0', maxWidth: '760px', margin: '0 auto' }}
                  >
                    <div className="onboarding-plan-hero">
                      <div className="onboarding-plan-hero-top">
                        <span className="onboarding-plan-hero-kicker">You&apos;re in</span>
                        <span className="onboarding-plan-hero-pill">Community</span>
                      </div>
                      <h1 className="onboarding-plan-hero-title">
                        Welcome to Fitness 365 Pro
                      </h1>
                      <p
                        style={{
                          margin: '12px 0 0',
                          fontSize: '15px',
                          lineHeight: 1.55,
                          color: 'var(--app-text-muted)',
                          maxWidth: '560px',
                        }}
                      >
                        Your profile is set. Explore leaderboards, join events, and connect with others. This app
                        focuses on community and motivation — not calorie tracking or generated workout plans.
                      </p>
                      <ul className="onboarding-plan-hero-list" style={{ marginTop: '18px' }}>
                        <li>
                          <span className="onboarding-plan-hero-list-dot" aria-hidden="true" />
                          <span>Compete and climb the leaderboards</span>
                        </li>
                        <li>
                          <span className="onboarding-plan-hero-list-dot" aria-hidden="true" />
                          <span>Discover and participate in events</span>
                        </li>
                        <li>
                          <span className="onboarding-plan-hero-list-dot" aria-hidden="true" />
                          <span>Share progress and stay accountable with the community</span>
                        </li>
                      </ul>
                    </div>

                    {(bmi !== null || bodyType) && (
                      <div className="onboarding-plan-bmi-row">
                        {bmi !== null && bmi !== undefined && (
                          <div className="onboarding-plan-stat-card">
                            <div className="onboarding-plan-stat-icon">📊</div>
                            <div className="onboarding-plan-stat-value">
                              {typeof bmi === 'number'
                                ? bmi.toFixed(1)
                                : parseFloat(bmi || 0).toFixed(1)}
                            </div>
                            <div className="onboarding-plan-stat-label">BMI</div>
                            <div className="onboarding-plan-stat-meta">{bmiCategory || '—'}</div>
                          </div>
                        )}
                        {bodyType && (
                          <div className="onboarding-plan-stat-card">
                            <div className="onboarding-plan-stat-icon">
                              {bodyType === 'endomorph'
                                ? '⚡'
                                : bodyType === 'ectomorph'
                                ? '🔥'
                                : bodyType === 'mesomorph'
                                ? '💪'
                                : '⚖️'}
                            </div>
                            <div
                              className="onboarding-plan-stat-value is-sm"
                              style={{ textTransform: 'capitalize' }}
                            >
                              {bodyType === 'endomorph'
                                ? 'Endomorph'
                                : bodyType === 'ectomorph'
                                ? 'Ectomorph'
                                : bodyType === 'mesomorph'
                                ? 'Mesomorph'
                                : 'Balanced'}
                            </div>
                            <div className="onboarding-plan-stat-label">Body Type</div>
                            <div className="onboarding-plan-stat-meta">From your profile & goals</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div
              className="d-flex gap-3 mt-5"
              style={{
                marginTop: '40px',
                width: '100%',
              }}
            >
              {currentStep > 1 && (
                <button
                  className="onboarding-btn onboarding-btn-secondary"
                  type="button"
                  onClick={handleBack}
                  disabled={saving && currentStep === 6}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text-muted)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ color: 'var(--app-text-muted)' }}
                  >
                    <path
                      d="M9.5 3.5L5 8L9.5 12.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Back</span>
                </button>
              )}
              <button
                className="onboarding-btn onboarding-btn-primary"
                type="button"
                onClick={async () => {
                  if (currentStep < 6) {
                    await handleNext()
                    return
                  }
                  // Step 6: finalize onboarding and go to app
                  try {
                    beginTrackedSave()
                    await saveQueueRef.current.catch(() => undefined)
                    await apiRequest('/v1/onboarding/step/6', { method: 'POST', body: {} })
                    markOnboardingComplete()
                    notifySuccess('Onboarding completed!')
                    navigate('/dashboard', { replace: true })
                  } catch (err) {
                    console.error('Failed to complete onboarding', err)
                    notifyError(err?.response?.data?.message || 'Failed to complete onboarding. Please try again.')
                  } finally {
                    endTrackedSave()
                  }
                }}
                disabled={saving && currentStep === 6}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: (saving && currentStep === 6) ? '#9CA3AF' : 'var(--brand-primary)',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: (saving && currentStep === 6) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>
                  {saving && currentStep === 6
                    ? 'Finishing...'
                    : currentStep === 5
                    ? 'Complete'
                    : currentStep === 6
                    ? 'Enter the app'
                    : 'Continue'}
                </span>
              </button>
            </div>
            </div>
          </div>
        </main>

        {/* Gender help modal */}
        <AnimatePresence>
          {showGenderHelp && (
            <motion.div
              key="gender-help"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGenderHelp(false)}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                  width: '100%',
                  maxWidth: '520px',
                  // On small screens leave comfortable side margins
                  margin: '0 16px',
                  backgroundColor: 'var(--app-surface)',
                  borderRadius: '12px',
                  boxShadow: '0 22px 45px rgba(15, 23, 42, 0.25)',
                  padding: '18px 18px 20px',
                }}
              >
                <div
                  className="d-flex justify-content-between align-items-center"
                  style={{ marginBottom: '10px' }}
                >
                  <h2
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      margin: 0,
                      color: 'var(--app-text)',
                    }}
                  >
                    Which one should I choose?
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowGenderHelp(false)}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 4,
                      cursor: 'pointer',
                    }}
                    aria-label="Close"
                  >
                    <span style={{ fontSize: '18px', lineHeight: 1, color: 'var(--app-text-muted)' }}>×</span>
                  </button>
                </div>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--app-text-muted)',
                    marginBottom: '10px',
                    lineHeight: 1.6,
                  }}
                >
                  We use this information together with your age, height, and weight to estimate
                  things like calorie needs, training load, and recovery.
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--app-text-muted)',
                    marginBottom: '14px',
                    lineHeight: 1.6,
                  }}
                >
                  If you’re not sure which option fits best, choose the one that most closely
                  matches your current body and how your doctor would assess you for things like
                  lab results or medication.
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--app-text-muted)',
                    marginBottom: '0',
                  }}
                >
                  This doesn’t change how we treat you as a person—it only helps us personalize
                  your training and nutrition estimates.
                </p>
                <div
                  style={{
                    marginTop: '16px',
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    className="onboarding-btn onboarding-btn-primary"
                    onClick={() => setShowGenderHelp(false)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: 'var(--brand-primary)',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Got it
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  )
}

export default Onboarding
