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
