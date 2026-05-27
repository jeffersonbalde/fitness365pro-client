import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '../contexts/AdminAuthContext'

const AdminProtectedRoute = ({ children }) => {
  const { loading, isAdminAuthenticated } = useAdminAuth()

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (!isAdminAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}

export default AdminProtectedRoute


