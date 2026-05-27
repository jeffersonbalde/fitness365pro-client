import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Swal from 'sweetalert2'
import logoFinal from '../assets/images/logo_final.png'

const Topbar = ({ user, onToggleSidebar, onLogout }) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return

    const result = await Swal.fire({
      title: 'Log out now?',
      text: 'You will need to sign in again to continue.',
      icon: 'warning',
      showClass: {
        backdrop: 'swal2-backdrop-show app-modal-swal-backdrop-in',
        popup: 'app-modal-swal-popup-in',
      },
      hideClass: {
        backdrop: 'swal2-backdrop-hide app-modal-swal-backdrop-out',
        popup: 'app-modal-swal-popup-out',
      },
      showCancelButton: true,
      confirmButtonText: 'Yes, log out',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      allowOutsideClick: () => !Swal.isLoading(),
      allowEscapeKey: () => !Swal.isLoading(),
      width: 430,
      heightAuto: false,
      scrollbarPadding: false,
      customClass: {
        popup: 'admin-swal-popup',
        title: 'admin-swal-title',
        htmlContainer: 'admin-swal-text',
        confirmButton: 'admin-swal-confirm',
        cancelButton: 'admin-swal-cancel',
      },
      buttonsStyling: false,
      preConfirm: async () => {
        const confirmButton = Swal.getConfirmButton()
        const cancelButton = Swal.getCancelButton()
        if (confirmButton) {
          confirmButton.disabled = true
          confirmButton.textContent = 'Logging out...'
        }
        if (cancelButton) cancelButton.disabled = true

        try {
          setIsLoggingOut(true)
          await onLogout?.()
          return true
        } catch (error) {
          const message = error?.response?.data?.message || 'Logout failed. Please try again.'
          Swal.showValidationMessage(message)
          if (confirmButton) {
            confirmButton.disabled = false
            confirmButton.textContent = 'Yes, log out'
          }
          if (cancelButton) cancelButton.disabled = false
          return false
        } finally {
          setIsLoggingOut(false)
        }
      },
    })

    if (!result.isConfirmed) return
    setShowDropdown(false)
  }

  return (
    <nav className={`sb-topnav navbar navbar-expand ${showDropdown ? 'dropdown-open' : ''}`}>
      <Link to="/admin/cms/posts" className="navbar-brand d-flex align-items-center text-decoration-none">
        <div className="sb-topnav-logo-gap flex-shrink-0">
          <img src={logoFinal} alt="Fitness 365 Pro" className="sb-topnav-logo-single" />
        </div>
        <div className="d-flex flex-column sb-topnav-brand-text">
          <span className="sb-topnav-brand-name" title="Fitness 365 Pro">
            Fitness 365 Pro
          </span>
          <span className="sb-topnav-brand-tagline d-none d-sm-inline">
            Administration Panel
          </span>
        </div>
      </Link>

      <button
        type="button"
        className="btn btn-link text-decoration-none order-2 order-lg-0"
        id="sidebarToggle"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <i className="fas fa-bars" />
      </button>

      <ul className="navbar-nav ms-auto align-items-center">
        <li className="nav-item dropdown" ref={dropdownRef}>
          <button
            type="button"
            className="nav-link dropdown-toggle d-flex align-items-center"
            onClick={(event) => {
              event.preventDefault()
              setShowDropdown((previous) => !previous)
            }}
            aria-expanded={showDropdown}
            aria-haspopup="true"
            id="adminUserDropdown"
          >
            <div className="sb-topnav-user-icon-circle me-2 flex-shrink-0">
              <div className="sb-topnav-user-icon-inner">
                <i className="fas fa-user-shield sb-topnav-user-icon" />
              </div>
            </div>
            <span className="d-none d-lg-inline">{user?.name || user?.email || 'Admin'}</span>
          </button>
          <ul className={`dropdown-menu dropdown-menu-end ${showDropdown ? 'show' : ''}`} aria-labelledby="adminUserDropdown">
            <li className="dropdown-header">{user?.name || user?.email || 'Admin'}</li>
            <li>
              <span className="dropdown-item small text-muted py-1">
                {user?.email || 'No email'}
              </span>
            </li>
            <li>
              <span className="dropdown-item small text-muted py-1">
                Administrator
              </span>
            </li>
            <li className="dropdown-separator" />
            <li>
              <button type="button" className="dropdown-item custom-dropdown-item logout-item" onClick={handleLogout}>
                <i className="fas fa-sign-out-alt fa-fw me-2" />
                Logout
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  )
}

export default Topbar