/** Common image extensions including mobile camera formats (HEIC/HEIF). */
export const WORKOUT_IMAGE_ACCEPT =
  'image/*,.heic,.heif,.avif,.bmp,.tif,.tiff,.svg,.ico,.jfif'

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
  'svgz',
  'heic',
  'heif',
  'avif',
  'tif',
  'tiff',
  'ico',
  'jfif',
  'pjpeg',
  'pjp',
])

export const isAcceptableWorkoutImageFile = (file) => {
  if (!file || typeof file !== 'object') return false

  const mime = String(file.type || '').toLowerCase()
  if (mime.startsWith('image/')) return true

  const name = String(file.name || '')
  const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : ''

  return ALLOWED_IMAGE_EXTENSIONS.has(extension)
}

export const normalizeApiFieldErrors = (errors = {}) => {
  const normalized = {}
  Object.entries(errors).forEach(([key, value]) => {
    normalized[key] = Array.isArray(value) ? value[0] : value
  })
  return normalized
}

export const PROFILE_IMAGE_ACCEPT = WORKOUT_IMAGE_ACCEPT

export const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_COVER_IMAGE_BYTES = 15 * 1024 * 1024

export const isAcceptableProfileImageFile = isAcceptableWorkoutImageFile

export const validateProfileImageFile = (file, { maxBytes, label = 'Image' } = {}) => {
  if (!isAcceptableProfileImageFile(file)) {
    return `${label} must be a valid image file (PNG, JPG, JPEG, GIF, WebP, HEIC, BMP, and other common formats).`
  }

  if (maxBytes && file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024))
    return `${label} must be ${maxMb} MB or smaller.`
  }

  return null
}

export const getProfileUploadErrorMessage = (error, fieldName, fallback) => {
  const apiErrors = normalizeApiFieldErrors(error?.response?.data?.errors || {})
  return apiErrors[fieldName] || error?.response?.data?.message || fallback
}
