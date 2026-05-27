/**
 * Facebook Share Dialog — posts a link (with OG preview) to the user's timeline.
 * Requires a Meta App ID: https://developers.facebook.com/apps/
 */

const SDK_SCRIPT_ID = 'facebook-jssdk'
const SDK_VERSION = 'v21.0'

export const getFacebookAppId = () => {
  const id = import.meta.env.VITE_FACEBOOK_APP_ID
  return id && String(id).trim() ? String(id).trim() : ''
}

export const hasFacebookAppId = () => Boolean(getFacebookAppId())

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
    script.src = `https://connect.facebook.net/en_US/sdk.js`
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'))
    document.head.appendChild(script)
  })

/**
 * Opens Meta's official Share Dialog so the user can post to their Facebook timeline.
 */
export const openFacebookShareDialog = async ({ shareUrl, hashtag = '#Fitness365Pro' }) => {
  const appId = getFacebookAppId()
  if (!appId) {
    return { ok: false, reason: 'missing_app_id' }
  }

  if (!shareUrl) {
    return { ok: false, reason: 'missing_url' }
  }

  try {
    const FB = await loadFacebookSdk()

    return await new Promise((resolve) => {
      FB.ui(
        {
          method: 'share',
          href: shareUrl,
          hashtag: hashtag.startsWith('#') ? hashtag : `#${hashtag}`,
        },
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

/**
 * Fallback share dialog URL (popup) when SDK is unavailable.
 */
export const buildFacebookDialogShareUrl = ({ shareUrl, hashtag = '#Fitness365Pro' }) => {
  const appId = getFacebookAppId()
  if (!appId || !shareUrl) return ''

  const params = new URLSearchParams({
    app_id: appId,
    display: 'popup',
    href: shareUrl,
    redirect_uri: shareUrl,
    hashtag: hashtag.startsWith('#') ? hashtag : `#${hashtag}`,
  })

  return `https://www.facebook.com/dialog/share?${params.toString()}`
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
