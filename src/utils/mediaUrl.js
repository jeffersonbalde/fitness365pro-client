import { getApiOrigin } from './apiBaseUrl'

const MEDIA_PROXY_PREFIX = '/api/v1/profile/media/'
const UPLOAD_DIRECTORY_PATTERN =
  '(?:profile-pictures|cover-photos|workout-photos|profile-badges|admin-events|admin-event-badges|admin-event-trophies)'

/**
 * Resolve profile/workout/CMS media paths for the current API deployment.
 * Handles relative /api/v1/profile/media/... paths, legacy /storage/... paths,
 * and absolute URLs generated with a wrong APP_URL (missing /fitness365pro-server).
 */
export function resolveMediaUrl(url) {
  if (!url) return ''
  const raw = String(url).trim()
  if (!raw) return ''

  const origin = getApiOrigin()

  const mediaMatch = raw.match(/\/api\/v1\/profile\/media\/(.+)$/i)
  if (mediaMatch) {
    return `${origin}${MEDIA_PROXY_PREFIX}${mediaMatch[1]}`
  }

  const storageMatch = raw.match(
    new RegExp(`/storage/(${UPLOAD_DIRECTORY_PATTERN}/.+)$`, 'i'),
  )
  if (storageMatch) {
    return `${origin}${MEDIA_PROXY_PREFIX}${storageMatch[1]}`
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`

  return `${origin}/${raw}`
}

const isPersonalizedRewardPath = (url) => String(url || '').includes('/share/reward/')

/** In-app badge/trophy display — never use /share/reward (SVG/PNG overlays break in <img>). */
export function resolveEarnedRewardThumbnailUrl(item, resolveMediaUrlFn = resolveMediaUrl) {
  const candidates = [item?.base_image_url, item?.image_url]
    .filter(Boolean)
    .map(String)

  for (const raw of candidates) {
    if (isPersonalizedRewardPath(raw)) continue
    const resolved = resolveMediaUrlFn(raw)
    if (resolved) return resolved
  }

  return ''
}

/** Optional personalized overlay URL for share/download only. */
export function resolveEarnedRewardPersonalizedUrl(item, resolveMediaUrlFn = resolveMediaUrl) {
  const raw = item?.personalized_image_url || item?.image_url
  if (!raw || !isPersonalizedRewardPath(raw)) return ''
  return resolveMediaUrlFn(String(raw))
}
