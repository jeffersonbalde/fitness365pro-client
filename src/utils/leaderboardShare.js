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
  downloadBlob,
  exportLeaderboardCardBlob,
  openFacebookHome,
} from './leaderboardCardExport'

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

/** Same-origin proxy for CDN images (html2canvas export). */
export { buildShareMediaProxyUrl } from './badgeShare'

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
 * Facebook: save rank-card PNG + open Facebook (photo post — same big image as Events preview).
 * Meta link-share popups ignore our URL; uploading the card image always works.
 */
export const shareLeaderboardToFacebook = async ({
  cardElement,
  cardImageUrl,
  cardSvgUrl,
  shareCaption,
  rank,
  shareUrl,
}) => {
  let blob = null
  try {
    blob = await exportLeaderboardCardBlob(cardElement, { cardImageUrl, cardSvgUrl })
  } catch {
    blob = null
  }

  if (!blob) {
    return {
      ok: false,
      reason: 'export_failed',
      opened: false,
      copied: false,
      downloaded: false,
      message: 'Could not prepare rank card image. Try again or use Copy link.',
    }
  }

  const captionLines = [shareCaption]
  if (shareUrl) captionLines.push(shareUrl)
  const copied = await copyTextToClipboard(captionLines.filter(Boolean).join('\n\n'))

  const filename =
    rank != null ? `fitness365-rank-${rank}.png` : 'fitness365-leaderboard-rank.png'
  const downloaded = downloadBlob(blob, filename)

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'image/png' })
      const withFile = { text: shareCaption, files: [file] }
      if (navigator.canShare(withFile)) {
        await navigator.share(withFile)
        return {
          ok: true,
          method: 'native_photo',
          opened: true,
          copied,
          downloaded,
          mode: 'native_photo',
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { ok: false, reason: 'cancelled', opened: false, copied, downloaded }
      }
    }
  }

  const opened = openFacebookHome()

  return {
    ok: true,
    method: 'photo_upload',
    opened,
    copied,
    downloaded,
    mode: 'photo_post',
  }
}

export const shareLeaderboardNative = async ({ eventTitle, shareCaption, shareUrl, imageUrl }) =>
  shareNative({
    title: `${eventTitle || 'Leaderboard'} — Fitness 365 Pro`,
    text: shareCaption,
    shareUrl,
    imageUrl,
  })
