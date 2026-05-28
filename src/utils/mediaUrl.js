import { getApiOrigin } from './apiBaseUrl'

/**
 * Resolve profile/workout media paths for the current API deployment.
 * Handles relative /api/v1/profile/media/... paths and legacy absolute URLs
 * that were generated with a wrong APP_URL (missing /fitness365pro-server).
 */
export function resolveMediaUrl(url) {
  if (!url) return ''
  const raw = String(url).trim()
  if (!raw) return ''

  const mediaMatch = raw.match(/\/api\/v1\/profile\/media\/(.+)$/i)
  if (mediaMatch) {
    const origin = getApiOrigin()
    const pathAndQuery = mediaMatch[1]
    return `${origin}/api/v1/profile/media/${pathAndQuery}`
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  if (raw.startsWith('/')) return `${getApiOrigin()}${raw}`

  return `${getApiOrigin()}/${raw}`
}
