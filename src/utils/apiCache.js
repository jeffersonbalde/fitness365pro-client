const store = new Map()
const inFlight = new Map()

export const DEFAULT_GET_CACHE_TTL_MS = {
  '/v1/cms/events': 30_000,
  '/v1/cms/feed': 60_000,
  '/v1/workouts/feed': 20_000,
  '/v1/profile': 30_000,
  '/v1/workouts/stats': 45_000,
  '/v1/social/stats': 30_000,
  '/v1/onboarding/goals': 120_000,
  '/v1/social/suggested-buddies': 30_000,
}

export const resolveDefaultCacheTtl = (endpoint) => {
  const path = String(endpoint || '').split('?')[0]
  if (DEFAULT_GET_CACHE_TTL_MS[path] != null) {
    return DEFAULT_GET_CACHE_TTL_MS[path]
  }
  if (path.startsWith('/v1/social/profile/')) {
    return 30_000
  }
  if (path.startsWith('/v1/cms/events/') && path.endsWith('/leaderboard')) {
    return 15_000
  }
  if (path.startsWith('/v1/workouts') && !path.includes('/feed')) {
    return 20_000
  }
  return 0
}

export const buildApiCacheKey = (token, method, endpoint) => `${token || 'anon'}:${method}:${endpoint}`

export const getCachedApiResponse = (key) => {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.value
}

export const setCachedApiResponse = (key, value, ttlMs) => {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export const invalidateApiCache = (prefix = '') => {
  for (const key of store.keys()) {
    if (!prefix || key.includes(prefix)) {
      store.delete(key)
    }
  }
}

export const dedupeInFlightRequest = (key, factory) => {
  if (inFlight.has(key)) {
    return inFlight.get(key)
  }
  const promise = Promise.resolve()
    .then(factory)
    .finally(() => {
      inFlight.delete(key)
    })
  inFlight.set(key, promise)
  return promise
}
