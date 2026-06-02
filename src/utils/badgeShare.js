/**
 * Build share URL, caption text, and platform links for earned event badges.
 */

import {
  getFacebookAppId,
  hasFacebookAppId,
  isLocalDevelopmentUrl,
  openFacebookDialogSharePopup,
  openFacebookLegacySharerPopup,
  openFacebookShareDialog,
} from './facebookShare'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'

/** Public server origin used for Facebook OG share pages (Laravel /share/badge/...). */
export const getPublicShareOrigin = () => {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL
  if (configured && String(configured).trim()) {
    return String(configured).trim().replace(/\/$/, '')
  }
  return API_BASE_URL.replace(/\/api\/?$/, '')
}

/** Client SPA origin for in-app navigation. */
export const getClientAppOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'
}

/**
 * Canonical URL Facebook crawls for badge image/title preview (server-rendered OG page).
 */
export const buildBadgeShareUrl = ({ clientId, eventId, badgeKey }) => {
  if (!clientId || !eventId || !badgeKey) return ''
  const origin = getPublicShareOrigin()
  const encodedKey = encodeURIComponent(String(badgeKey))
  return `${origin}/share/badge/${encodeURIComponent(String(clientId))}/${encodeURIComponent(String(eventId))}/${encodedKey}`
}

/** In-app badge page (React route). */
export const buildBadgeClientUrl = ({ clientId, eventId, badgeKey }) => {
  if (!clientId || !eventId || !badgeKey) return ''
  const origin = getClientAppOrigin().replace(/\/$/, '')
  const encodedKey = encodeURIComponent(String(badgeKey))
  return `${origin}/badge/${encodeURIComponent(String(clientId))}/${encodeURIComponent(String(eventId))}/${encodedKey}`
}

export const buildBadgeShareText = ({ ownerName, badgeTitle, eventTitle, shareUrl }) => {
  const who = ownerName?.trim() || 'I'
  const badge = badgeTitle?.trim() || 'a challenge badge'
  const event = eventTitle?.trim() || 'a Fitness 365 Pro challenge'
  const lines = [
    `${who} earned the "${badge}" badge in ${event}!`,
    'Verified achievement on Fitness 365 Pro.',
  ]
  if (shareUrl) lines.push(shareUrl)
  return lines.join('\n')
}

export const buildBadgeShareCaption = ({ ownerName, badgeTitle, eventTitle }) => {
  const who = ownerName?.trim() || 'I'
  const badge = badgeTitle?.trim() || 'a challenge badge'
  const event = eventTitle?.trim() || 'a Fitness 365 Pro challenge'
  return `${who} earned the "${badge}" badge in ${event}! Verified on Fitness 365 Pro. #Fitness365Pro #ChallengeComplete`
}

/** Facebook link previews require a public HTTPS URL in production. */
export const isPublicShareUrl = (shareUrl) => {
  if (!shareUrl) return false
  try {
    const { hostname, protocol } = new URL(shareUrl)
    if (protocol !== 'https:') return false
    const host = hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false
    return true
  } catch {
    return false
  }
}

export const openExternalUrl = (url) => {
  if (!url || typeof window === 'undefined') return false
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    return true
  } catch {
    try {
      window.open(url, '_blank', 'noopener,noreferrer')
      return true
    } catch {
      return false
    }
  }
}

export const getPlatformShareLinks = ({ shareUrl, shareText }) => {
  const url = encodeURIComponent(shareUrl || '')
  const text = encodeURIComponent(shareText || '')

  return {
    facebook: hasFacebookAppId()
      ? `https://www.facebook.com/dialog/share?app_id=${encodeURIComponent(getFacebookAppId())}&display=popup&href=${url}&redirect_uri=${url}`
      : `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    twitter: `https://twitter.com/intent/tweet?text=${text}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    whatsapp: `https://wa.me/?text=${text}`,
  }
}

export const shareViaPlatform = (platform, { shareUrl, shareText }) => {
  const links = getPlatformShareLinks({ shareUrl, shareText })
  const target = links[platform]
  if (!target) return false
  return openExternalUrl(target)
}

/**
 * Share badge to the user's Facebook timeline via Meta Share Dialog.
 * Uses server OG page so Facebook shows badge image + achievement text in the post preview.
 */
export const shareToFacebook = async ({ shareUrl, shareCaption, imageUrl }) => {
  if (!hasFacebookAppId()) {
    return {
      ok: false,
      reason: 'missing_app_id',
      opened: false,
      copied: false,
      downloaded: false,
    }
  }

  if (!shareUrl) {
    return { ok: false, reason: 'missing_url', opened: false, copied: false, downloaded: false }
  }

  const localDev = isLocalDevelopmentUrl(shareUrl)

  // Facebook's crawlers cannot read http://localhost — link previews and badge images will not appear.
  // Prepare caption + image for a manual post instead of opening an empty composer.
  if (localDev) {
    const copied = shareCaption ? await copyTextToClipboard(shareCaption) : false
    const downloaded = imageUrl ? await downloadBadgeImage(imageUrl) : false
    const opened = openExternalUrl('https://www.facebook.com/')

    return {
      ok: true,
      method: 'localhost_manual_post',
      opened,
      copied,
      downloaded,
      mode: 'timeline_local_dev_manual',
    }
  }

  const sdkResult = await openFacebookShareDialog({
    shareUrl,
    hashtag: '#Fitness365Pro',
  })

  if (sdkResult.ok) {
    return {
      ok: true,
      method: 'facebook_share_dialog',
      opened: true,
      copied: false,
      downloaded: false,
      mode: isPublicShareUrl(shareUrl) ? 'timeline_with_preview' : 'timeline_local_dev',
    }
  }

  if (sdkResult.reason === 'cancelled') {
    return { ok: false, reason: 'cancelled', opened: false, copied: false, downloaded: false }
  }

  const popupOpened = openFacebookDialogSharePopup({ shareUrl, hashtag: '#Fitness365Pro' })
  if (popupOpened) {
    return {
      ok: true,
      method: 'facebook_dialog_popup',
      opened: true,
      copied: false,
      downloaded: false,
      mode: isPublicShareUrl(shareUrl) ? 'timeline_with_preview' : 'timeline_local_dev',
    }
  }

  const copied = shareCaption ? await copyTextToClipboard(shareCaption) : false
  const downloaded = imageUrl ? await downloadBadgeImage(imageUrl) : false

  return {
    ok: false,
    reason: sdkResult.reason || 'popup_blocked',
    message: sdkResult.message,
    opened: false,
    copied,
    downloaded,
    mode: 'fallback_manual',
  }
}

export const copyTextToClipboard = async (text) => {
  if (!text) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

const fetchImageBlob = async (imageUrl) => {
  const res = await fetch(imageUrl, { mode: 'cors' })
  if (!res.ok) throw new Error('Could not fetch badge image')
  return res.blob()
}

export const downloadBadgeImage = async (imageUrl, filename = 'fitness365-badge.png') => {
  if (!imageUrl) return false
  try {
    const blob = await fetchImageBlob(imageUrl)
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
    return true
  } catch {
    return false
  }
}

export const shareNative = async ({ title, text, shareUrl, imageUrl }) => {
  if (!navigator.share) return { ok: false, reason: 'unsupported' }

  const payload = {
    title: title || 'Fitness 365 Pro Badge',
    text: text || '',
    url: shareUrl || undefined,
  }

  try {
    if (imageUrl && navigator.canShare) {
      try {
        const blob = await fetchImageBlob(imageUrl)
        const file = new File([blob], 'fitness365-badge.png', { type: blob.type || 'image/png' })
        const withFile = { ...payload, files: [file] }
        if (navigator.canShare(withFile)) {
          await navigator.share(withFile)
          return { ok: true, method: 'native-with-image' }
        }
      } catch {
        // fall back to text/url share
      }
    }

    await navigator.share(payload)
    return { ok: true, method: 'native' }
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, reason: 'cancelled' }
    return { ok: false, reason: 'failed' }
  }
}

export const prepareInstagramShare = async ({ imageUrl, caption }) => {
  const copied = await copyTextToClipboard(caption || '')
  const downloaded = imageUrl ? await downloadBadgeImage(imageUrl) : false
  return { copied, downloaded }
}

export const canUseNativeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export { hasFacebookAppId, getFacebookAppId }
