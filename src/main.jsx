import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationsProvider } from './contexts/NotificationsContext'
import { AdminAuthProvider } from './contexts/AdminAuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastContainer } from 'react-toastify'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
          <AdminAuthProvider>
            <ThemeProvider>
              <App />
              <ToastContainer 
                style={{ zIndex: 100000 }}
              />
            </ThemeProvider>
          </AdminAuthProvider>
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
