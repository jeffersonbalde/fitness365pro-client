const DEFAULT_API_BASE = 'http://localhost:8000/api'

/**
 * Normalize VITE_LARAVEL_API so requests always hit Laravel's /api prefix.
 * Production builds often set the host only (e.g. https://my-api.ondigitalocean.app).
 */
export function getApiBaseUrl() {
  const raw = (import.meta.env.VITE_LARAVEL_API || DEFAULT_API_BASE).trim()
  if (!raw) return DEFAULT_API_BASE

  const normalized = raw.replace(/\/+$/, '')
  if (normalized.endsWith('/api')) return normalized

  return `${normalized}/api`
}

/** Origin for public storage/media URLs (strip trailing /api). */
export function getApiOrigin() {
  return getApiBaseUrl().replace(/\/api\/?$/, '')
}
