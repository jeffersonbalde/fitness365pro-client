import React from 'react'
import AdminProtectedRoute from '../../components/AdminProtectedRoute'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import Layout from '../../layout/Layout'

const AdminModuleLayout = ({ title, subtitle, children }) => {
  const { admin, adminLogout } = useAdminAuth()

  return (
    <AdminProtectedRoute>
      <Layout user={admin} onLogout={adminLogout}>
        <div className="container-fluid py-2 py-md-3">
          <div className="card border mb-3">
            <div className="card-body py-3">
              <h1 className="h5 mb-1">{title}</h1>
              <p className="text-muted mb-0 small">{subtitle}</p>
            </div>
          </div>
          {children}
        </div>
      </Layout>
    </AdminProtectedRoute>
  )
}

export default AdminModuleLayout

