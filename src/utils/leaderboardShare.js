/**
 * Share links and captions for event leaderboard standings.
 */

import { getClientAppOrigin, getPublicShareOrigin } from './badgeShare'
import {
  canUseNativeShare,
  copyTextToClipboard,
  shareNative,
  shareViaPlatform,
} from './badgeShare'
import {
  hasFacebookAppId,
  isLocalDevelopmentUrl,
  openFacebookFeedDialog,
  openFacebookLegacySharerPopup,
  openFacebookShareDialog,
} from './facebookShare'

export { canUseNativeShare, copyTextToClipboard, shareViaPlatform }

/**
 * Canonical URL for copy / WhatsApp (dedicated leaderboard OG page).
 */
export const buildLeaderboardShareUrl = ({ eventId, clientId, category = 'all' }) => {
  if (!eventId || !clientId) return ''
  const origin = getPublicShareOrigin()
  const base = `${origin}/share/leaderboard/${encodeURIComponent(String(eventId))}/${encodeURIComponent(String(clientId))}`
  const cat = String(category || '').trim()
  if (cat && cat !== 'all') {
    return `${base}?category=${encodeURIComponent(cat)}`
  }
  return base
}

/**
 * Facebook crawls this URL for rank-card preview (under /share/event/ like event shares).
 */
export const buildLeaderboardFacebookShareUrl = ({ eventId, clientId, category = 'all' }) => {
  if (!eventId || !clientId) return ''
  const origin = getPublicShareOrigin()
  const base = `${origin}/share/event/${encodeURIComponent(String(eventId))}/standing/${encodeURIComponent(String(clientId))}`
  const cat = String(category || '').trim()
  if (cat && cat !== 'all') {
    return `${base}?category=${encodeURIComponent(cat)}`
  }
  return base
}

/** Dynamic OG rank-card image (1200×630 PNG). */
export const buildLeaderboardShareCardUrl = ({ eventId, clientId, category = 'all' }) => {
  if (!eventId || !clientId) return ''
  const origin = getPublicShareOrigin()
  const base = `${origin}/share/leaderboard/${encodeURIComponent(String(eventId))}/${encodeURIComponent(String(clientId))}/card.png`
  const cat = String(category || '').trim()
  if (cat && cat !== 'all') {
    return `${base}?category=${encodeURIComponent(cat)}`
  }
  return base
}

/** SVG rank card (fallback when PNG generation fails). */
export const buildLeaderboardShareCardSvgUrl = ({ eventId, clientId, category = 'all' }) => {
  if (!eventId || !clientId) return ''
  const origin = getPublicShareOrigin()
  const base = `${origin}/share/leaderboard/${encodeURIComponent(String(eventId))}/${encodeURIComponent(String(clientId))}/card.svg`
  const cat = String(category || '').trim()
  if (cat && cat !== 'all') {
    return `${base}?category=${encodeURIComponent(cat)}`
  }
  return base
}

export const buildLeaderboardClientUrl = (eventId) => {
  if (!eventId) return ''
  const origin = getClientAppOrigin().replace(/\/$/, '')
  return `${origin}/leaderboards/${encodeURIComponent(String(eventId))}`
}

const formatKm = (value) => {
  const num = Number(value)
  if (Number.isNaN(num)) return '0 km'
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`
}

export const buildLeaderboardShareText = ({
  ownerName,
  eventTitle,
  rank,
  loggedKm,
  progressPercent,
  goalCompleted,
  categoryLabel,
  shareUrl,
}) => {
  const who = ownerName?.trim() || 'I'
  const event = eventTitle?.trim() || 'a Fitness 365 Pro event'
  const place = rank != null ? `#${rank}` : 'on the leaderboard'
  const progressBits = []
  if (loggedKm != null) progressBits.push(`${formatKm(loggedKm)} logged`)
  if (goalCompleted) {
    progressBits.push('goal completed')
  } else if (progressPercent != null) {
    progressBits.push(`${Number(progressPercent).toLocaleString(undefined, { maximumFractionDigits: 1 })}% of goal`)
  }
  if (categoryLabel && categoryLabel !== 'General') {
    progressBits.push(categoryLabel)
  }
  const stats = progressBits.length ? ` ${progressBits.join(' · ')}` : ''
  const lines = [
    `${who} is ranked ${place} on "${event}"!${stats}`,
    'Live leaderboard on Fitness 365 Pro.',
  ]
  if (shareUrl) lines.push(shareUrl)
  return lines.join('\n')
}

export const buildLeaderboardShareCaption = ({
  ownerName,
  eventTitle,
  rank,
  loggedKm,
  progressPercent,
  goalCompleted,
  categoryLabel,
}) => {
  const who = ownerName?.trim() || 'I'
  const event = eventTitle?.trim() || 'this event'
  const place = rank != null ? `#${rank}` : 'on the leaderboard'

  const progressBits = []
  if (loggedKm != null) progressBits.push(`${formatKm(loggedKm)} logged`)
  if (goalCompleted) {
    progressBits.push('goal completed')
  } else if (progressPercent != null) {
    progressBits.push(
      `${Number(progressPercent).toLocaleString(undefined, { maximumFractionDigits: 1 })}% of goal`,
    )
  }
  if (categoryLabel && categoryLabel !== 'General') {
    progressBits.push(categoryLabel)
  }

  const stats = progressBits.length ? ` (${progressBits.join(' · ')})` : ''

  return `I'm ranked ${place} in "${event}" on Fitness 365 Pro${stats}.`
}

export const buildLeaderboardShareCaptionWithLink = (params, standingUrl) => {
  const caption = buildLeaderboardShareCaption(params)
  if (!standingUrl) return caption
  return `${caption}\n${standingUrl}`
}

export const buildLeaderboardOgTitle = ({ rank, eventTitle }) => {
  const event = eventTitle?.trim() || 'Fitness 365 Pro'
  if (rank != null) {
    return `#${rank} on ${event} — Fitness 365 Pro`
  }
  return `${event} — Fitness 365 Pro Leaderboard`
}

/**
 * Facebook share dialog with rank-card OG preview (never download-to-device).
 * Uses Laravel standing URL so Meta can scrape og:image (card.png).
 */
export const shareLeaderboardToFacebook = async ({
  eventId,
  clientId,
  category = 'all',
  shareCaption,
  eventTitle,
  rank,
  cardImageUrl,
}) => {
  const shareUrl = buildLeaderboardFacebookShareUrl({ eventId, clientId, category })
  const appUrl = buildLeaderboardClientUrl(eventId)
  const ogTitle = buildLeaderboardOgTitle({ rank, eventTitle })

  if (!hasFacebookAppId()) {
    return {
      ok: false,
      reason: 'missing_app_id',
      opened: false,
      copied: false,
      downloaded: false,
      message: 'Facebook sharing needs VITE_FACEBOOK_APP_ID. Rebuild the client after setting it.',
    }
  }

  if (!shareUrl) {
    return { ok: false, reason: 'missing_url', opened: false, copied: false, downloaded: false }
  }

  const captionForClipboard = appUrl
    ? `${shareCaption}\n\n${shareUrl}\n\nView in app: ${appUrl}`
    : `${shareCaption}\n\n${shareUrl}`

  const copied = await copyTextToClipboard(captionForClipboard)

  if (isLocalDevelopmentUrl(shareUrl)) {
    return {
      ok: false,
      reason: 'local_dev',
      opened: false,
      copied,
      downloaded: false,
      message: 'Facebook preview requires production URLs. Deploy and share from fitness365pro.com.',
    }
  }

  const sharerOpened = openFacebookLegacySharerPopup(shareUrl)
  if (sharerOpened) {
    return {
      ok: true,
      method: 'facebook_legacy_sharer',
      opened: true,
      copied,
      downloaded: false,
      mode: 'timeline_with_preview',
    }
  }

  const feedOpened = openFacebookFeedDialog({
    link: shareUrl,
    picture: cardImageUrl,
    name: ogTitle,
    description: shareCaption,
  })
  if (feedOpened) {
    return {
      ok: true,
      method: 'facebook_feed_dialog',
      opened: true,
      copied,
      downloaded: false,
      mode: 'timeline_with_preview',
    }
  }

  const sdkResult = await openFacebookShareDialog({ shareUrl, hashtag: null })
  if (sdkResult.ok) {
    return {
      ok: true,
      method: 'facebook_share_dialog',
      opened: true,
      copied,
      downloaded: false,
      mode: 'timeline_with_preview',
    }
  }

  if (sdkResult.reason === 'cancelled') {
    return { ok: false, reason: 'cancelled', opened: false, copied, downloaded: false }
  }

  return {
    ok: false,
    reason: 'blocked',
    opened: false,
    copied,
    downloaded: false,
    message: 'Allow pop-ups for Facebook, then try again.',
  }
}

export const shareLeaderboardNative = async ({ eventTitle, shareCaption, shareUrl, imageUrl }) =>
  shareNative({
    title: `${eventTitle || 'Leaderboard'} — Fitness 365 Pro`,
    text: shareCaption,
    shareUrl,
    imageUrl,
  })
