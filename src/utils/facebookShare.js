/**
 * Facebook sharing — Feed Dialog and helpers.
 * Avoid share_channel popups; they often drop href and show only fitness365pro.com.
 */

const SDK_SCRIPT_ID = 'facebook-jssdk'
const SDK_VERSION = 'v21.0'

export const getFacebookAppId = () => {
  const id = import.meta.env.VITE_FACEBOOK_APP_ID
  return id && String(id).trim() ? String(id).trim() : ''
}

export const hasFacebookAppId = () => Boolean(getFacebookAppId())

export const isLocalDevelopmentUrl = (url) => {
  if (!url) return false
  try {
    const { hostname, protocol } = new URL(url)
    const host = hostname.toLowerCase()
    return protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1')
  } catch {
    return false
  }
}

export const getFacebookRedirectUri = (shareUrl) => {
  const frontend = import.meta.env.VITE_FRONTEND_URL
  if (frontend && String(frontend).trim()) {
    return `${String(frontend).trim().replace(/\/$/, '')}/`
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}/`
  }
  if (isLocalDevelopmentUrl(shareUrl)) {
    return 'http://localhost:5173/'
  }
  return shareUrl
}

/**
 * Feed Dialog — passes link + picture + title directly (best for leaderboard rank cards).
 */
export const buildFacebookFeedDialogUrl = ({ link, picture, name, description }) => {
  const appId = getFacebookAppId()
  if (!appId || !link) return ''

  const params = new URLSearchParams({
    app_id: appId,
    display: 'popup',
    link,
    redirect_uri: getFacebookRedirectUri(link),
  })

  if (picture) params.set('picture', picture)
  if (name) params.set('name', name)
  if (description) params.set('description', description)

  return `https://www.facebook.com/dialog/feed?${params.toString()}`
}

export const openFacebookFeedDialog = ({ link, picture, name, description }) => {
  const url = buildFacebookFeedDialogUrl({ link, picture, name, description })
  if (!url || typeof window === 'undefined') return false
  return Boolean(window.open(url, '_blank', 'noopener,noreferrer'))
}

export const buildFacebookPageShareUrl = (shareUrl) => {
  const appId = getFacebookAppId()
  if (!appId || !shareUrl) return ''

  const params = new URLSearchParams({
    app_id: appId,
    display: 'page',
    href: shareUrl,
    redirect_uri: getFacebookRedirectUri(shareUrl),
  })

  return `https://www.facebook.com/dialog/share?${params.toString()}`
}

export const openFacebookPageShare = (shareUrl) => {
  const url = buildFacebookPageShareUrl(shareUrl)
  if (!url || typeof window === 'undefined') return false
  return Boolean(window.open(url, '_blank', 'noopener,noreferrer'))
}

const loadFacebookSdk = () =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Facebook SDK requires a browser'))
      return
    }

    if (window.FB) {
      resolve(window.FB)
      return
    }

    const appId = getFacebookAppId()
    if (!appId) {
      reject(new Error('Facebook App ID is not configured'))
      return
    }

    const existing = document.getElementById(SDK_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.FB))
      existing.addEventListener('error', () => reject(new Error('Failed to load Facebook SDK')))
      return
    }

    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({
        appId,
        cookie: false,
        xfbml: false,
        version: SDK_VERSION,
      })
      resolve(window.FB)
    }

    const script = document.createElement('script')
    script.id = SDK_SCRIPT_ID
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'))
    document.head.appendChild(script)
  })

export const openFacebookShareDialog = async ({ shareUrl, hashtag = null }) => {
  const appId = getFacebookAppId()
  if (!appId) {
    return { ok: false, reason: 'missing_app_id' }
  }

  if (!shareUrl) {
    return { ok: false, reason: 'missing_url' }
  }

  const dialogParams = {
    method: 'share',
    href: shareUrl,
  }

  if (hashtag && String(hashtag).trim()) {
    const tag = String(hashtag).trim()
    dialogParams.hashtag = tag.startsWith('#') ? tag : `#${tag}`
  }

  try {
    const FB = await loadFacebookSdk()

    return await new Promise((resolve) => {
      FB.ui(
        dialogParams,
        (response) => {
          if (!response || response.error_message) {
            resolve({
              ok: false,
              reason: response?.error_message ? 'facebook_error' : 'cancelled',
              message: response?.error_message || null,
            })
            return
          }

          resolve({ ok: true, response })
        },
      )
    })
  } catch (err) {
    return {
      ok: false,
      reason: 'sdk_failed',
      message: err?.message || 'Could not load Facebook',
    }
  }
}

export const buildFacebookDialogShareUrl = ({ shareUrl, hashtag = null }) => {
  const appId = getFacebookAppId()
  if (!appId || !shareUrl) return ''

  const params = new URLSearchParams({
    app_id: appId,
    display: 'popup',
    href: shareUrl,
    redirect_uri: getFacebookRedirectUri(shareUrl),
  })

  if (hashtag && String(hashtag).trim()) {
    const tag = String(hashtag).trim()
    params.set('hashtag', tag.startsWith('#') ? tag : `#${tag}`)
  }

  return `https://www.facebook.com/dialog/share?${params.toString()}`
}

export const openFacebookLegacySharerPopup = (shareUrl) => {
  if (!shareUrl || typeof window === 'undefined') return false

  const params = new URLSearchParams({
    u: shareUrl,
    display: 'popup',
  })
  const appId = getFacebookAppId()
  if (appId) {
    params.set('app_id', appId)
  }

  const url = `https://www.facebook.com/sharer/sharer.php?${params.toString()}`
  const w = 626
  const h = 436
  const left = Math.max(0, (window.screen.width - w) / 2)
  const top = Math.max(0, (window.screen.height - h) / 2)
  const popup = window.open(url, 'facebook-sharer', `width=${w},height=${h},left=${left},top=${top}`)

  return Boolean(popup)
}

export const openFacebookDialogSharePopup = ({ shareUrl, hashtag }) => {
  const url = buildFacebookDialogShareUrl({ shareUrl, hashtag })
  if (!url) return false

  const w = 626
  const h = 436
  const left = Math.max(0, (window.screen.width - w) / 2)
  const top = Math.max(0, (window.screen.height - h) / 2)
  const popup = window.open(url, 'facebook-share-dialog', `width=${w},height=${h},left=${left},top=${top}`)

  return Boolean(popup)
}
