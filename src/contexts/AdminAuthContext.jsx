import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  adminApiRequest,
  ensureAdminAccessToken,
  getAdminRefreshToken,
  setAdminRefreshToken,
} from '../utils/adminApi'
import { notifySuccess, notifyError } from '../utils/notifications'

const AdminAuthContext = createContext(null)

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  return ctx
}

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    checkAdminAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAdminAuth = async () => {
    try {
      const storedAdmin = localStorage.getItem('auth_admin')
      const hasRefresh = !!getAdminRefreshToken()

      if (storedAdmin) {
        try {
          setAdmin(JSON.parse(storedAdmin))
        } catch {
          // ignore
        }
      }

      if (!hasRefresh) {
        setIsAdminAuthenticated(false)
        return
      }

      await ensureAdminAccessToken()
      const res = await adminApiRequest('/v1/admin/auth/me', { method: 'GET' })
      setAdmin(res.data.data.admin)
      setIsAdminAuthenticated(true)
    } catch (err) {
      const status = err?.response?.status
      if (status === 401) {
        sessionStorage.removeItem('admin_token')
        setAdminRefreshToken(null)
        localStorage.removeItem('auth_admin')
        setAdmin(null)
        setIsAdminAuthenticated(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const adminLogin = async (email, password) => {
    try {
      const res = await adminApiRequest('/v1/admin/auth/login', {
        method: 'POST',
        body: { email, password },
      })

      if (res.data.success && res.data.data) {
        const { admin: adminData, token, refresh_token } = res.data.data
        sessionStorage.setItem('admin_token', token)
        localStorage.setItem('auth_admin', JSON.stringify(adminData))
        if (refresh_token) setAdminRefreshToken(refresh_token)
        setAdmin(adminData)
        setIsAdminAuthenticated(true)
        setTimeout(() => navigate('/admin/cms/posts', { replace: true }), 0)
        notifySuccess('Admin login successful.')
        return { success: true, data: res.data.data }
      }

      notifyError(res.data.message || 'Login failed')
      return { success: false, message: res.data.message || 'Login failed', errors: res.data.errors || {} }
    } catch (error) {
      const errData = error.response?.data || {}
      notifyError(errData.message || 'Login failed')
      return {
        success: false,
        message: errData.message || 'Login failed',
        errors: errData.errors || {},
      }
    }
  }

  const adminLogout = async () => {
    try {
      await adminApiRequest('/v1/admin/auth/logout', {
        method: 'POST',
        body: { refresh_token: getAdminRefreshToken() },
      })
    } catch {
      // ignore
    } finally {
      sessionStorage.removeItem('admin_token')
      setAdminRefreshToken(null)
      localStorage.removeItem('auth_admin')
      setAdmin(null)
      setIsAdminAuthenticated(false)
      navigate('/admin/login', { replace: true })
      notifySuccess('You have been logged out (admin).')
    }
  }

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        isAdminAuthenticated,
        adminLogin,
        adminLogout,
        checkAdminAuth,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export default AdminAuthContext


