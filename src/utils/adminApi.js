const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'

const ADMIN_ACCESS_TOKEN_KEY = 'admin_token' // short-lived (sessionStorage)
const ADMIN_REFRESH_TOKEN_KEY = 'admin_refresh_token' // long-lived (dev localStorage)

const getAdminAccessToken = () => sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY)
const setAdminAccessToken = (token) => {
  if (token) sessionStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, token)
  else sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY)
}

export const getAdminRefreshToken = () => localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY)
export const setAdminRefreshToken = (token) => {
  if (token) localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, token)
  else localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY)
}

export const ensureAdminAccessToken = async () => {
  const existing = getAdminAccessToken()
  if (existing) return existing
  return await refreshAdminAccessToken()
}

const refreshAdminAccessToken = async () => {
  const refreshToken = getAdminRefreshToken()
  if (!refreshToken) return null

  const res = await fetch(`${API_BASE_URL}/v1/admin/auth/refresh`, {
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
    setAdminAccessToken(null)
    setAdminRefreshToken(null)
    localStorage.removeItem('auth_admin')
    return null
  }

  const token = data?.data?.token
  const newRefresh = data?.data?.refresh_token
  if (token) setAdminAccessToken(token)
  if (newRefresh) setAdminRefreshToken(newRefresh)
  return token || null
}

/**
 * Make Admin API request (uses admin token)
 */
export const adminApiRequest = async (endpoint, options = {}) => {
  const token = getAdminAccessToken()
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  const config = {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  }

  if (!isFormData) {
    config.headers['Content-Type'] = 'application/json'
  }

  if (options.body) {
    config.body = isFormData
      ? options.body
      : typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
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

  if (!response.ok) {
    if (response.status === 401 && !options._retry) {
      const refreshed = await refreshAdminAccessToken()
      if (refreshed) {
        return adminApiRequest(endpoint, {
          ...options,
          _retry: true,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${refreshed}`,
          },
        })
      }

      // access token invalid and refresh failed
      if (token) {
        setAdminAccessToken(null)
        localStorage.removeItem('auth_admin')
      }
    }

    throw {
      response: {
        data: data || { message: 'Request failed', errors: {} },
        status: response.status,
      },
    }
  }

  return { data, status: response.status }
}


