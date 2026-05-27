import { toast } from 'react-toastify'
import Swal from 'sweetalert2'

const defaultToastOptions = {
  position: 'top-right',
  autoClose: 4000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'light',
}

export const notifySuccess = (message, options = {}) => {
  if (!message) return
  toast.success(message, { ...defaultToastOptions, ...options })
}

export const notifyError = (message) => {
  if (!message) return
  toast.error(message, defaultToastOptions)
}

export const showLoadingModal = (title = 'Processing...') => {
  Swal.fire({
    title,
    showClass: {
      backdrop: 'swal2-backdrop-show app-modal-swal-backdrop-in',
      popup: 'app-modal-swal-popup-in',
    },
    hideClass: {
      backdrop: 'swal2-backdrop-hide app-modal-swal-backdrop-out',
      popup: 'app-modal-swal-popup-out',
    },
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading()
    },
    background: '#020617',
    color: '#e5e7eb',
  })
}

export const closeLoadingModal = () => {
  Swal.close()
}


