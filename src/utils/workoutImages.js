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

const MOBILE_PHOTO_NAME_PATTERN = /^(?:image|photo|img[-_]?\d+|dsc[-_]?\d+|100[-_]?\d+)/i

const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
  'image/x-tiff': 'tiff',
}

export const resolveUploadFilename = (file, fallbackBase = 'photo') => {
  const rawName = String(file?.name || '').trim()
  if (rawName.includes('.')) {
    return rawName
  }

  const mime = String(file?.type || '').toLowerCase()
  const extension = MIME_EXTENSION_MAP[mime] || 'jpg'
  const baseName = rawName || fallbackBase

  return `${baseName}.${extension}`
}

export const isAcceptableWorkoutImageFile = (file) => {
  if (!file || typeof file !== 'object') return false
  if (!(Number(file.size) > 0)) return false

  const mime = String(file.type || '').toLowerCase()
  if (mime.startsWith('image/')) return true

  const name = String(file.name || '')
  const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : ''

  if (ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return true
  }

  // Mobile browsers often send camera/library photos as octet-stream blobs with generic names.
  if (mime === 'application/octet-stream' || mime === '') {
    const baseName = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name
    return MOBILE_PHOTO_NAME_PATTERN.test(baseName)
  }

  return false
}

export const normalizeApiFieldErrors = (errors = {}) => {
  const normalized = {}

  if (Array.isArray(errors)) {
    if (errors[0]) normalized._form = errors[0]
    return normalized
  }

  Object.entries(errors).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      normalized[key] = value[0]
    } else if (value && typeof value === 'object') {
      const nested = Object.values(value).find(Boolean)
      normalized[key] = nested
    } else {
      normalized[key] = value
    }
  })
  return normalized
}

export const PROFILE_IMAGE_ACCEPT = WORKOUT_IMAGE_ACCEPT

export const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_COVER_IMAGE_BYTES = 15 * 1024 * 1024

export const isAcceptableProfileImageFile = isAcceptableWorkoutImageFile

export const validateProfileImageFile = (file, { maxBytes, label = 'Image' } = {}) => {
  if (!file || !(Number(file.size) > 0)) {
    return `${label} appears to be empty. Please choose another photo.`
  }

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
  const payload = error?.response?.data || {}
  const apiErrors = normalizeApiFieldErrors(payload.errors || {})

  if (apiErrors[fieldName]) {
    return apiErrors[fieldName]
  }

  const firstFieldError = Object.values(apiErrors).find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  )
  if (firstFieldError) {
    return firstFieldError
  }

  const message = typeof payload.message === 'string' ? payload.message.trim() : ''
  if (message && message.toLowerCase() !== 'validation failed') {
    return message
  }

  return fallback
}
