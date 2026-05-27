import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiRequest } from '../../utils/api'
import { notifySuccess, notifyError } from '../../utils/notifications'

const Settings = () => {
  const { client } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    bio: '',
    date_of_birth: '',
    gender: '',
    height_cm: '',
    current_weight_kg: '',
    target_weight_kg: '',
    city: '',
    province: '',
    country: '',
    activity_level: '',
    experience_level: '',
  })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await apiRequest('/v1/profile', { method: 'GET' })
        if (response.data.success) {
          const profileData = response.data.data.profile
          setProfile(profileData)
          setFormData({
            first_name: profileData?.first_name || '',
            last_name: profileData?.last_name || '',
            display_name: profileData?.display_name || '',
            bio: profileData?.bio || '',
            date_of_birth: profileData?.date_of_birth || '',
            gender: profileData?.gender || '',
            height_cm: profileData?.height_cm || '',
            current_weight_kg: profileData?.current_weight_kg || '',
            target_weight_kg: profileData?.target_weight_kg || '',
            city: profileData?.city || '',
            province: profileData?.province || '',
            country: profileData?.country || '',
            activity_level: profileData?.activity_level || '',
            experience_level: profileData?.experience_level || '',
          })
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error)
        notifyError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    if (client) {
      fetchProfile()
    }
  }, [client])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    try {
      const response = await apiRequest('/v1/profile', {
        method: 'PUT',
        body: formData,
      })

      if (response.data.success) {
        setProfile(response.data.data.profile)
        setErrors({})
        notifySuccess('Profile updated successfully')
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
      
      // Extract validation errors from API response
      const errorData = error?.response?.data || {}
      const apiErrors = errorData.errors || {}
      const errorMessage = errorData.message || 'Failed to update profile'

      // Convert Laravel validation errors format to flat object
      const formattedErrors = {}
      Object.keys(apiErrors).forEach(key => {
        const errorArray = Array.isArray(apiErrors[key]) ? apiErrors[key] : [apiErrors[key]]
        formattedErrors[key] = errorArray[0] // Take first error message
      })

      setErrors(formattedErrors)

      // Show notification with first error or general message
      if (Object.keys(formattedErrors).length > 0) {
        const firstError = Object.values(formattedErrors)[0]
        notifyError(firstError)
      } else {
        notifyError(errorMessage)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center py-5" style={{ minHeight: '50vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="d-flex flex-column" style={{ minHeight: '100vh', backgroundColor: '#F7F7F7' }}>
      <main className="flex-grow-1">
          <div className="container px-4 py-4">
            <div className="row">
              <div className="col-12">
                <h1 className="mb-4" style={{ fontSize: '2rem', fontWeight: 700 }}>Settings</h1>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-12 col-lg-8">
                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                  <div className="card-body">
                    <h5 className="card-title mb-4">Profile Information</h5>
                    
                    {/* Error Alert */}
                    {Object.keys(errors).length > 0 && (
                      <div className="alert alert-danger mb-4" role="alert" style={{ borderRadius: '12px' }}>
                        <strong>Please fix the following errors:</strong>
                        <ul className="mb-0 mt-2">
                          {Object.entries(errors).map(([field, message]) => (
                            <li key={field}>
                              <strong>{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> {message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <form onSubmit={handleSubmit}>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">First Name</label>
                          <input
                            type="text"
                            className={`form-control ${errors.first_name ? 'is-invalid' : ''}`}
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleChange}
                          />
                          {errors.first_name && (
                            <div className="invalid-feedback d-block">
                              {errors.first_name}
                            </div>
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Last Name</label>
                          <input
                            type="text"
                            className={`form-control ${errors.last_name ? 'is-invalid' : ''}`}
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleChange}
                          />
                          {errors.last_name && (
                            <div className="invalid-feedback d-block">
                              {errors.last_name}
                            </div>
                          )}
                        </div>
                        <div className="col-12">
                          <label className="form-label">Display Name</label>
                          <input
                            type="text"
                            className={`form-control ${errors.display_name ? 'is-invalid' : ''}`}
                            name="display_name"
                            value={formData.display_name}
                            onChange={handleChange}
                            placeholder="How you want to be displayed"
                          />
                          {errors.display_name && (
                            <div className="invalid-feedback d-block">
                              {errors.display_name}
                            </div>
                          )}
                        </div>
                        <div className="col-12">
                          <label className="form-label">Bio</label>
                          <textarea
                            className={`form-control ${errors.bio ? 'is-invalid' : ''}`}
                            name="bio"
                            value={formData.bio}
                            onChange={handleChange}
                            rows="3"
                            maxLength="500"
                            placeholder="Tell us about yourself..."
                          />
                          {errors.bio && (
                            <div className="invalid-feedback d-block">
                              {errors.bio}
                            </div>
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Date of Birth</label>
                          <input
                            type="date"
                            className={`form-control ${errors.date_of_birth ? 'is-invalid' : ''}`}
                            name="date_of_birth"
                            value={formData.date_of_birth}
                            onChange={handleChange}
                          />
                          {errors.date_of_birth && (
                            <div className="invalid-feedback d-block">
                              {errors.date_of_birth}
                            </div>
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Gender</label>
                          <select
                            className={`form-select ${errors.gender ? 'is-invalid' : ''}`}
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                          >
                            <option value="">Select...</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="prefer_not_to_say">Prefer not to say</option>
                          </select>
                          {errors.gender && (
                            <div className="invalid-feedback d-block">
                              {errors.gender}
                            </div>
                          )}
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Height (cm)</label>
                          <input
                            type="number"
                            className={`form-control ${errors.height_cm ? 'is-invalid' : ''}`}
                            name="height_cm"
                            value={formData.height_cm}
                            onChange={handleChange}
                            min="50"
                            max="300"
                          />
                          {errors.height_cm && (
                            <div className="invalid-feedback d-block">
                              {errors.height_cm}
                            </div>
                          )}
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Current Weight (kg)</label>
                          <input
                            type="number"
                            className={`form-control ${errors.current_weight_kg ? 'is-invalid' : ''}`}
                            name="current_weight_kg"
                            value={formData.current_weight_kg}
                            onChange={handleChange}
                            min="20"
                            max="500"
                            step="0.1"
                          />
                          {errors.current_weight_kg && (
                            <div className="invalid-feedback d-block">
                              {errors.current_weight_kg}
                            </div>
                          )}
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Target Weight (kg)</label>
                          <input
                            type="number"
                            className={`form-control ${errors.target_weight_kg ? 'is-invalid' : ''}`}
                            name="target_weight_kg"
                            value={formData.target_weight_kg}
                            onChange={handleChange}
                            min="20"
                            max="500"
                            step="0.1"
                          />
                          {errors.target_weight_kg && (
                            <div className="invalid-feedback d-block">
                              {errors.target_weight_kg}
                            </div>
                          )}
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">City</label>
                          <input
                            type="text"
                            className={`form-control ${errors.city ? 'is-invalid' : ''}`}
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                          />
                          {errors.city && (
                            <div className="invalid-feedback d-block">
                              {errors.city}
                            </div>
                          )}
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Province</label>
                          <input
                            type="text"
                            className={`form-control ${errors.province ? 'is-invalid' : ''}`}
                            name="province"
                            value={formData.province}
                            onChange={handleChange}
                          />
                          {errors.province && (
                            <div className="invalid-feedback d-block">
                              {errors.province}
                            </div>
                          )}
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Country</label>
                          <input
                            type="text"
                            className={`form-control ${errors.country ? 'is-invalid' : ''}`}
                            name="country"
                            value={formData.country}
                            onChange={handleChange}
                          />
                          {errors.country && (
                            <div className="invalid-feedback d-block">
                              {errors.country}
                            </div>
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Activity Level</label>
                          <select
                            className={`form-select ${errors.activity_level ? 'is-invalid' : ''}`}
                            name="activity_level"
                            value={formData.activity_level}
                            onChange={handleChange}
                          >
                            <option value="">Select...</option>
                            <option value="sedentary">Sedentary</option>
                            <option value="light">Light</option>
                            <option value="moderate">Moderate</option>
                            <option value="active">Active</option>
                            <option value="very_active">Very Active</option>
                          </select>
                          {errors.activity_level && (
                            <div className="invalid-feedback d-block">
                              {errors.activity_level}
                            </div>
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Experience Level</label>
                          <select
                            className={`form-select ${errors.experience_level ? 'is-invalid' : ''}`}
                            name="experience_level"
                            value={formData.experience_level}
                            onChange={handleChange}
                          >
                            <option value="">Select...</option>
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                          {errors.experience_level && (
                            <div className="invalid-feedback d-block">
                              {errors.experience_level}
                            </div>
                          )}
                        </div>
                        <div className="col-12">
                          <button
                            type="submit"
                            className="btn"
                            disabled={saving}
                            style={{ 
                              backgroundColor: '#FC4C02', 
                              color: '#FFFFFF',
                              minWidth: '120px'
                            }}
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </main>
    </div>
  )
}

export default Settings

