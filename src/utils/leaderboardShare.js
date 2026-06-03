/**
 * Share links and captions for event leaderboard standings.
 */

import { getClientAppOrigin, getPublicShareOrigin } from './badgeShare'
import {
  canUseNativeShare,
  copyTextToClipboard,
  shareNative,
  shareToFacebook,
  shareViaPlatform,
} from './badgeShare'

export { canUseNativeShare, copyTextToClipboard, shareViaPlatform, shareToFacebook }

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
 * Facebook preview URL — /share/event/{eventId}/standing/{clientId} (rank-card OG, not event banner).
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

/** Dynamic OG card image (rank + stats). */
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

/** In-app leaderboard route. */
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

/** Caption + standing link (for clipboard / non-Facebook channels). */
export const buildLeaderboardShareCaptionWithLink = (params, standingUrl) => {
  const caption = buildLeaderboardShareCaption(params)
  if (!standingUrl) return caption
  return `${caption}\n${standingUrl}`
}

/** Facebook: event share path + standing query → rank-card OG image (not plain event banner). */
export const shareLeaderboardToFacebook = async ({
  eventId,
  clientId,
  category = 'all',
  shareCaption,
  imageUrl,
}) => {
  const facebookUrl = buildLeaderboardFacebookShareUrl({ eventId, clientId, category })

  return shareToFacebook({
    shareUrl: facebookUrl,
    shareCaption,
    imageUrl,
    hashtag: null,
    preCopyCaption: true,
  })
}

export const shareLeaderboardNative = async ({ eventTitle, shareCaption, shareUrl, imageUrl }) =>
  shareNative({
    title: `${eventTitle || 'Leaderboard'} — Fitness 365 Pro`,
    text: shareCaption,
    shareUrl,
    imageUrl,
  })
