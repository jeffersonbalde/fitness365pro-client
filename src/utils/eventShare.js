/**
 * Share links and captions for public CMS events (marketing / social).
 */

import { getClientAppOrigin, getPublicShareOrigin, isPublicShareUrl } from './badgeShare'
import {
  canUseNativeShare,
  copyTextToClipboard,
  openExternalUrl,
  shareNative,
  shareToFacebook,
  shareViaPlatform,
} from './badgeShare'

export { canUseNativeShare, copyTextToClipboard, shareViaPlatform, shareToFacebook }

/**
 * Canonical URL Facebook crawls (server-rendered OG page at /share/event/{id}).
 */
export const buildEventShareUrl = (eventId) => {
  if (!eventId) return ''
  const origin = getPublicShareOrigin()
  return `${origin}/share/event/${encodeURIComponent(String(eventId))}`
}

/** In-app event details route. */
export const buildEventClientUrl = (eventId) => {
  if (!eventId) return ''
  const origin = getClientAppOrigin().replace(/\/$/, '')
  return `${origin}/challenges/${encodeURIComponent(String(eventId))}`
}

export const buildEventShareText = ({
  eventName,
  location,
  timelineLabel,
  feeLabel,
  shareUrl,
}) => {
  const title = eventName?.trim() || 'a Fitness 365 Pro event'
  const where = location?.trim() || 'Join online or onsite'
  const when = timelineLabel?.trim() || 'Registration open now'
  const fee = feeLabel?.trim() || 'See event page for fees'
  const lines = [
    `Join "${title}" on Fitness 365 Pro!`,
    `${where} · ${when} · ${fee}`,
    'Register in the app and track your progress.',
  ]
  if (shareUrl) lines.push(shareUrl)
  return lines.join('\n')
}

export const buildEventShareCaption = ({
  eventName,
  location,
  timelineLabel,
  feeLabel,
}) => {
  const title = eventName?.trim() || 'a Fitness 365 Pro event'
  const where = location?.trim() || ''
  const when = timelineLabel?.trim() || ''
  const fee = feeLabel?.trim() || ''
  const bits = [where, when, fee].filter(Boolean).join(' · ')
  return `Join "${title}" on Fitness 365 Pro!${bits ? ` ${bits}.` : ''} #Fitness365Pro #FitnessEvent`
}

export const shareEventToFacebook = async ({ shareUrl, shareCaption, imageUrl }) =>
  shareToFacebook({ shareUrl, shareCaption, imageUrl })

export const shareEventNative = async ({ eventName, shareCaption, shareUrl, imageUrl }) =>
  shareNative({
    title: `${eventName || 'Event'} — Fitness 365 Pro`,
    text: shareCaption,
    shareUrl,
    imageUrl,
  })

export { isPublicShareUrl, openExternalUrl }
