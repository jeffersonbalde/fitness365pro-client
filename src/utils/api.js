import { getApiBaseUrl } from './apiBaseUrl'
import {
  buildApiCacheKey,
  dedupeInFlightRequest,
  getCachedApiResponse,
  resolveDefaultCacheTtl,
  setCachedApiResponse,
} from './apiCache'

export { invalidateApiCache } from './apiCache'

const API_BASE_URL = getApiBaseUrl()

const ACCESS_TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const ACCESS_TOKEN_EXPIRES_AT_KEY = 'auth_token_expires_at'
const REFRESH_TOKEN_EXPIRES_AT_KEY = 'refresh_token_expires_at'
const AUTH_CLIENT_KEY = 'auth_client'

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000
const DEFAULT_ACCESS_SECONDS = 3600
const DEFAULT_REQUEST_TIMEOUT_MS = 25000

const looksLikeHtmlResponse = (raw) => {
  const trimmed = (raw || '').trim().toLowerCase()
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')
}

const getAccessToken = () => sessionStorage.getItem(ACCESS_TOKEN_KEY)

const setAccessToken = (token) => {
  if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  else sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}

export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY)

export const setRefreshToken = (token) => {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token)
  else localStorage.removeItem(REFRESH_TOKEN_KEY)
}

const setAccessTokenExpiry = (expiresInSeconds) => {
  const seconds = Number(expiresInSeconds) || DEFAULT_ACCESS_SECONDS
  sessionStorage.setItem(
    ACCESS_TOKEN_EXPIRES_AT_KEY,
    String(Date.now() + seconds * 1000),
  )
}

const setRefreshTokenExpiry = (expiresInSeconds) => {
  if (!expiresInSeconds) return
  localStorage.setItem(
    REFRESH_TOKEN_EXPIRES_AT_KEY,
    String(Date.now() + Number(expiresInSeconds) * 1000),
  )
}

export const isAccessTokenExpired = () => {
  const token = getAccessToken()
  if (!token) return true

  const raw = sessionStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY)
  if (!raw) return false

  return Date.now() >= Number(raw) - TOKEN_REFRESH_BUFFER_MS
}

export const isRefreshTokenExpired = () => {
  const token = getRefreshToken()
  if (!token) return true

  const raw = localStorage.getItem(REFRESH_TOKEN_EXPIRES_AT_KEY)
  if (!raw) return false

  return Date.now() >= Number(raw)
}

export const persistAuthSession = ({
  token,
  expires_in,
  refresh_token,
  refresh_expires_in,
  client,
} = {}) => {
  if (token) {
    setAccessToken(token)
    setAccessTokenExpiry(expires_in)
  }
  if (refresh_token) {
    setRefreshToken(refresh_token)
    setRefreshTokenExpiry(refresh_expires_in)
  }
  if (client) {
    try {
      localStorage.setItem(AUTH_CLIENT_KEY, JSON.stringify(client))
    } catch {
      // ignore quota / private mode
    }
  }
}

export const clearAuthSession = () => {
  setAccessToken(null)
  setRefreshToken(null)
  sessionStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY)
  localStorage.removeItem(REFRESH_TOKEN_EXPIRES_AT_KEY)
  localStorage.removeItem(AUTH_CLIENT_KEY)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:session-cleared'))
  }
}

let refreshInFlight = null
let refreshTimerId = null

const applyRefreshPayload = (data) => {
  if (!data) return null
  persistAuthSession({
    token: data.token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
    refresh_expires_in: data.refresh_expires_in,
  })
  return data.token || null
}

const refreshAccessToken = async () => {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken || isRefreshTokenExpired()) {
      clearAuthSession()
      return null
    }

    const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    const raw = await res.text()
    const data = raw
      ? (() => {
          try {
            return JSON.parse(raw)
          } catch {
            return { message: raw }
          }
        })()
      : null

    if (!res.ok) {
      clearAuthSession()
      return null
    }

    return applyRefreshPayload(data?.data)
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

export const ensureAccessToken = async () => {
  if (isRefreshTokenExpired()) {
    clearAuthSession()
    return null
  }

  const existing = getAccessToken()
  if (existing && !isAccessTokenExpired()) {
    return existing
  }

  return refreshAccessToken()
}

export const scheduleAccessTokenRefresh = (onRefresh = null) => {
  if (refreshTimerId) {
    clearTimeout(refreshTimerId)
    refreshTimerId = null
  }

  const raw = sessionStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY)
  if (!raw) return

  const delay = Number(raw) - Date.now() - TOKEN_REFRESH_BUFFER_MS
  if (delay <= 0) {
    refreshAccessToken().then((token) => {
      if (token && typeof onRefresh === 'function') onRefresh(token)
      scheduleAccessTokenRefresh(onRefresh)
    })
    return
  }

  refreshTimerId = setTimeout(async () => {
    const token = await refreshAccessToken()
    if (token && typeof onRefresh === 'function') onRefresh(token)
    scheduleAccessTokenRefresh(onRefresh)
  }, delay)
}

export const cancelAccessTokenRefresh = () => {
  if (refreshTimerId) {
    clearTimeout(refreshTimerId)
    refreshTimerId = null
  }
}

const isPublicAuthEndpoint = (endpoint) =>
  endpoint === '/v1/auth/login'
  || endpoint === '/v1/auth/register'
  || endpoint === '/v1/auth/refresh'
  || endpoint === '/v1/auth/google'
  || endpoint === '/v1/auth/verify-email'
  || endpoint === '/v1/auth/resend-otp'
  || endpoint === '/v1/auth/forgot-password'
  || endpoint === '/v1/auth/verify-reset-token'
  || endpoint === '/v1/auth/reset-password'

const executeApiRequest = async (endpoint, options = {}) => {
  const isPublicAuthEndpointCall = isPublicAuthEndpoint(endpoint)
  const isFormDataBody = options.body instanceof FormData

  if (!isPublicAuthEndpointCall && !options._retry) {
    const existing = getAccessToken()
    if (!existing || isAccessTokenExpired()) {
      await ensureAccessToken()
    }
  }

  const token = getAccessToken()

  const config = {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  }

  if (!isFormDataBody) {
    config.headers['Content-Type'] = 'application/json'
  }

  if (options.body) {
    config.body = isFormDataBody
      ? options.body
      : typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body)
  }

  const timeoutMs = Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : (isFormDataBody ? 120000 : DEFAULT_REQUEST_TIMEOUT_MS)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  config.signal = controller.signal

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
    clearTimeout(timeoutId)

    const raw = await response.text()
    const data = raw
      ? (() => {
          try {
            return JSON.parse(raw)
          } catch {
            return { message: raw }
          }
        })()
      : null

    if (looksLikeHtmlResponse(raw)) {
      const gatewayStatuses = [502, 503, 504]
      const timedOut = gatewayStatuses.includes(response.status)
      throw {
        response: {
          data: {
            message: timedOut
              ? 'The server took too long to respond (gateway timeout). Please try again.'
              : `The server returned a web page instead of JSON from ${API_BASE_URL}${endpoint}.`,
            errors: {},
          },
          status: response.status || 502,
        },
      }
    }

    if (response.status === 401) {
      if (!isPublicAuthEndpointCall && !options._retry) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          return apiRequest(endpoint, {
            ...options,
            _retry: true,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${refreshed}`,
            },
          })
        }
      }

      if (token && !isPublicAuthEndpointCall) {
        clearAuthSession()
      }

      throw {
        response: {
          data: data || { message: 'Unauthorized', errors: {} },
          status: response.status,
        },
      }
    }

    if (!response.ok) {
      throw {
        response: {
          data: data || { message: 'Request failed', errors: {} },
          status: response.status,
        },
      }
    }

    return { data, status: response.status }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error.response) {
      throw error
    }

    const timedOut = error?.name === 'AbortError'
    throw {
      response: {
        data: {
          message: timedOut
            ? 'The request took too long. Please check your connection and try again.'
            : 'Network error. Please check your connection.',
          errors: {},
        },
        status: timedOut ? 408 : 0,
      },
    }
  }
}

/**
 * Make API request (GET responses cached briefly to speed tab switches).
 */
export const apiRequest = async (endpoint, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase()
  const isGet = method === 'GET' && !options.body
  const cacheTtlMs = options.skipCache
    ? 0
    : (Number(options.cacheTtlMs) > 0
      ? Number(options.cacheTtlMs)
      : (isGet ? resolveDefaultCacheTtl(endpoint) : 0))

  if (!isGet || cacheTtlMs <= 0 || options._retry) {
    return executeApiRequest(endpoint, options)
  }

  const token = getAccessToken()
  const cacheKey = buildApiCacheKey(token, method, endpoint)
  const cached = getCachedApiResponse(cacheKey)
  if (cached) {
    return cached
  }

  return dedupeInFlightRequest(cacheKey, async () => {
    const fresh = getCachedApiResponse(cacheKey)
    if (fresh) return fresh

    const result = await executeApiRequest(endpoint, options)
    setCachedApiResponse(cacheKey, result, cacheTtlMs)
    return result
  })
}