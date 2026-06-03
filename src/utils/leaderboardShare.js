/**
 * Share links and captions for event leaderboard standings.
 */

import { getClientAppOrigin, getPublicShareOrigin } from './badgeShare'
import {
  canUseNativeShare,
  copyTextToClipboard,
  downloadBadgeImage,
  isPublicShareUrl,
  shareNative,
  shareViaPlatform,
} from './badgeShare'
import { hasFacebookAppId, isLocalDevelopmentUrl, openFacebookFeedDialog } from './facebookShare'

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
 * Facebook uses /share/event/{eventId}/standing/{clientId} — rank-card OG (not event registration banner).
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
 * Leaderboard Facebook: Feed Dialog with explicit picture (rank card) — never share_channel popup.
 */
export const shareLeaderboardToFacebook = async ({
  eventId,
  clientId,
  category = 'all',
  shareCaption,
  imageUrl,
  eventTitle,
  rank,
}) => {
  if (!hasFacebookAppId()) {
    return {
      ok: false,
      reason: 'missing_app_id',
      opened: false,
      copied: false,
      downloaded: false,
    }
  }

  const link = buildLeaderboardFacebookShareUrl({ eventId, clientId, category })
  const picture =
    imageUrl || buildLeaderboardShareCardUrl({ eventId, clientId, category })
  const name = buildLeaderboardOgTitle({ rank, eventTitle })

  if (!link) {
    return { ok: false, reason: 'missing_url', opened: false, copied: false, downloaded: false }
  }

  const bundle = `${shareCaption}\n\n${link}`
  let copied = false
  try {
    copied = await copyTextToClipboard(bundle)
  } catch {
    copied = false
  }

  if (isLocalDevelopmentUrl(link)) {
    const downloaded = picture
      ? await downloadBadgeImage(picture, 'leaderboard-rank.png')
      : false
    if (typeof window !== 'undefined') {
      window.open('https://www.facebook.com/', '_blank', 'noopener,noreferrer')
    }
    return {
      ok: true,
      method: 'localhost_manual',
      opened: true,
      copied,
      downloaded,
      mode: 'timeline_local_dev_manual',
    }
  }

  const opened = openFacebookFeedDialog({
    link,
    picture,
    name,
    description: shareCaption,
  })

  if (opened) {
    return {
      ok: true,
      method: 'facebook_feed_dialog',
      opened: true,
      copied,
      downloaded: false,
      mode: isPublicShareUrl(link) ? 'timeline_with_preview' : 'timeline_local_dev',
    }
  }

  const downloaded = picture
    ? await downloadBadgeImage(picture, 'leaderboard-rank.png')
    : false
  if (typeof window !== 'undefined') {
    window.open('https://www.facebook.com/', '_blank', 'noopener,noreferrer')
  }

  return {
    ok: true,
    method: 'manual_compose',
    opened: true,
    copied,
    downloaded,
    mode: 'fallback_manual',
  }
}

export const shareLeaderboardNative = async ({ eventTitle, shareCaption, shareUrl, imageUrl }) =>
  shareNative({
    title: `${eventTitle || 'Leaderboard'} — Fitness 365 Pro`,
    text: shareCaption,
    shareUrl,
    imageUrl,
  })
