import { getApiBaseUrl } from './apiBaseUrl'

const API_BASE_URL = getApiBaseUrl()

const ACCESS_TOKEN_KEY = 'auth_token' // short-lived (store in sessionStorage)
const REFRESH_TOKEN_KEY = 'refresh_token' // long-lived (dev: localStorage)

const looksLikeHtmlResponse = (raw) => {
  const trimmed = (raw || '').trim().toLowerCase()
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')
}

const isLikelyApiPayload = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  return 'success' in data || 'message' in data || 'data' in data
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

export const ensureAccessToken = async () => {
  // If we already have a valid access token in sessionStorage, keep it.
  const existing = getAccessToken()
  if (existing) return existing

  // Otherwise, try to mint a new access token using refresh token.
  return await refreshAccessToken()
}

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

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
    // refresh token invalid/expired
    setAccessToken(null)
    setRefreshToken(null)
    localStorage.removeItem('auth_client')
    return null
  }

  const token = data?.data?.token
  const newRefresh = data?.data?.refresh_token
  if (token) setAccessToken(token)
  if (newRefresh) setRefreshToken(newRefresh) // rotation
  return token || null
}

/**
 * Make API request
 */
export const apiRequest = async (endpoint, options = {}) => {
  const token = getAccessToken()
  const isPublicAuthEndpoint =
    endpoint === '/v1/auth/login' || endpoint === '/v1/auth/register'
  const isFormDataBody = options.body instanceof FormData
  
  const config = {
    method: options.method || 'GET',
    headers: {
      'Accept': 'application/json',
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

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)

    // Some failures return HTML/text (or empty response). Parse safely.
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

    if (looksLikeHtmlResponse(raw) || (response.ok && data && !isLikelyApiPayload(data))) {
      throw {
        response: {
          data: {
            message:
              'API URL is misconfigured. Set VITE_LARAVEL_API to your Laravel API URL (for example https://your-api.ondigitalocean.app/fitness365pro-server/api), then redeploy the client.',
            errors: {},
          },
          status: 502,
        },
      }
    }

    // Handle 401 Unauthorized
    if (response.status === 401) {
      // If access token is missing/expired, try refresh once for protected endpoints.
      if (!isPublicAuthEndpoint && !options._retry) {
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

      // Don't hard-redirect. Clear only when this was a protected call with an access token.
      if (token && !isPublicAuthEndpoint) {
        setAccessToken(null)
        localStorage.removeItem('auth_client')
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
    if (error.response) {
      throw error
    }
    // Network error
    throw {
      response: {
        data: {
          message: 'Network error. Please check your connection.',
          errors: {},
        },
        status: 0,
      },
    }
  }
}

