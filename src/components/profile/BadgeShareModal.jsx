import React, { useCallback, useMemo, useState } from 'react'
import AppModalTransition, { useAppModalDismiss } from '../AppModalTransition.jsx'
import { notifyError, notifySuccess } from '../../utils/notifications'
import { trackEvent } from '../../utils/telemetry'
import {
  buildBadgeShareCaption,
  buildBadgeShareText,
  buildBadgeShareUrl,
  buildTrophyShareUrl,
  canUseNativeShare,
  copyTextToClipboard,
  downloadBadgeImage,
  prepareInstagramShare,
  shareNative,
  shareToFacebook,
  shareViaPlatform,
} from '../../utils/badgeShare'
import EarnedRewardShareImage from './EarnedRewardShareImage.jsx'
import './BadgeShareModal.css'

const formatEarnedDate = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

function ShareActionButton({ label, sublabel, icon, onClick, busy, variant = 'default' }) {
  return (
    <button
      type="button"
      className={`badge-share-action-btn is-${variant}`}
      onClick={onClick}
      disabled={busy}
      aria-label={label}
    >
      <span className="badge-share-action-icon" aria-hidden>
        {icon}
      </span>
      <span className="badge-share-action-copy">
        <span className="badge-share-action-label">{label}</span>
        {sublabel ? <span className="badge-share-action-sublabel">{sublabel}</span> : null}
      </span>
    </button>
  )
}

function BadgeShareModalBody({ badge, ownerName, clientId, resolveMediaUrl, kind = 'badge' }) {
  const dismiss = useAppModalDismiss()
  const [busyKey, setBusyKey] = useState('')
  const isTrophy = kind === 'trophy'

  const isPersonalizedReward = useMemo(() => {
    if (badge?.base_image_url) return true
    const url = badge?.image_url ? String(badge.image_url) : ''
    return url.includes('/share/reward/')
  }, [badge?.base_image_url, badge?.image_url])

  const imageSrc = useMemo(() => {
    const raw = badge?.image_url || badge?.base_image_url || ''
    return resolveMediaUrl ? resolveMediaUrl(String(raw)) : String(raw)
  }, [badge?.image_url, badge?.base_image_url, resolveMediaUrl])

  const rewardTitle = badge?.title || (isTrophy ? 'Challenge Trophy' : 'Challenge Badge')
  const eventTitle = badge?.event_title || 'Challenge'
  const earnedLabel = formatEarnedDate(badge?.earned_at)
  const rewardKey = isTrophy ? badge?.trophy_key : badge?.badge_key

  const shareUrl = useMemo(
    () =>
      isTrophy
        ? buildTrophyShareUrl({
            clientId,
            eventId: badge?.event_id,
            trophyKey: rewardKey,
          })
        : buildBadgeShareUrl({
            clientId,
            eventId: badge?.event_id,
            badgeKey: rewardKey,
          }),
    [isTrophy, clientId, badge?.event_id, rewardKey],
  )

  const shareText = useMemo(
    () =>
      buildBadgeShareText({
        ownerName,
        badgeTitle: rewardTitle,
        eventTitle,
        shareUrl,
        kind,
      }),
    [ownerName, rewardTitle, eventTitle, shareUrl, kind],
  )

  const shareCaption = useMemo(
    () =>
      buildBadgeShareCaption({
        ownerName,
        badgeTitle: rewardTitle,
        eventTitle,
        kind,
      }),
    [ownerName, rewardTitle, eventTitle, kind],
  )

  const trackShare = useCallback(
    (channel) => {
      trackEvent('badge_share', {
        channel,
        badge_id: badge?.id,
        event_id: badge?.event_id,
        client_id: clientId,
      })
    },
    [badge?.id, badge?.event_id, clientId],
  )

  const runShare = useCallback(
    async (key, fn) => {
      if (busyKey) return
      setBusyKey(key)
      try {
        await fn()
      } finally {
        setBusyKey('')
      }
    },
    [busyKey],
  )

  const onCopyLink = () =>
    runShare('copy', async () => {
      const ok = await copyTextToClipboard(shareUrl)
      if (ok) {
        trackShare('copy_link')
        notifySuccess('Share link copied!')
      } else {
        notifyError('Could not copy link. Please try again.')
      }
    })

  const onCopyCaption = () =>
    runShare('caption', async () => {
      const ok = await copyTextToClipboard(shareCaption)
      if (ok) {
        trackShare('copy_caption')
        notifySuccess('Caption copied — paste it on your post!')
      } else {
        notifyError('Could not copy caption.')
      }
    })

  const onDownload = () =>
    runShare('download', async () => {
      const ok = await downloadBadgeImage(imageSrc, `fitness365-${rewardKey || (isTrophy ? 'trophy' : 'badge')}.png`)
      if (ok) {
        trackShare('download')
        notifySuccess(isTrophy ? 'Trophy image downloaded!' : 'Badge image downloaded!')
      } else {
        notifyError('Could not download badge image.')
      }
    })

  const onNativeShare = () =>
    runShare('native', async () => {
      const result = await shareNative({
        title: `${rewardTitle} — Fitness 365 Pro`,
        text: shareCaption,
        shareUrl,
        imageUrl: imageSrc,
      })
      if (result.ok) {
        trackShare('native')
        notifySuccess('Shared successfully!')
      } else if (result.reason !== 'cancelled') {
        notifyError('Share is not available on this device.')
      }
    })

  const onFacebookShare = () =>
    runShare('facebook', async () => {
      const result = await shareToFacebook({
        shareUrl,
        shareCaption,
        imageUrl: imageSrc,
      })
      trackShare('facebook')

      if (result.reason === 'missing_app_id') {
        notifyError(
          'Facebook sharing needs a Meta App ID. Add VITE_FACEBOOK_APP_ID to client/.env (see FACEBOOK_APP_ID in server/.env).',
        )
        return
      }

      if (result.ok) {
        if (result.mode === 'timeline_local_dev_manual') {
          if (result.copied && result.downloaded) {
            notifySuccess(
              'Caption copied and badge downloaded. On Facebook: start a post, paste (Ctrl+V), then upload the badge image from your Downloads folder.',
            )
          } else if (result.copied) {
            notifySuccess(
              'Caption copied. On Facebook: start a post and paste (Ctrl+V). Download the badge image first if you want to attach it.',
            )
          } else {
            notifySuccess(
              'Facebook opened. Localhost links cannot show badge previews — use Copy caption and Download, then paste and attach the image manually.',
            )
          }
          return
        }

        notifySuccess(
          result.mode === 'timeline_local_dev'
            ? 'Facebook share opened! Confirm the post on Facebook. (Use a public HTTPS domain in production for badge image previews.)'
            : 'Facebook share opened! Confirm the post to publish the badge to your timeline.',
        )
        return
      }

      if (result.reason === 'cancelled') {
        return
      }

      if (result.copied && result.downloaded) {
        notifyError(
          'Facebook popup was blocked. Caption copied and badge saved — create a post on Facebook, paste (Ctrl+V), and upload the badge image.',
        )
        return
      }

      if (result.reason === 'localhost_share_blocked') {
        if (result.copied && result.downloaded) {
          notifyError(
            'Facebook blocked localhost sharing. Caption copied and badge saved — paste them into a new Facebook post.',
          )
        } else {
          notifyError(result.message)
        }
        return
      }

      if (result.reason === 'facebook_error' || result.reason === 'sdk_failed') {
        notifyError(
          'Facebook blocked this share URL. In Meta → App settings: App domains = localhost; add Website platform (http://localhost:5173 and http://localhost:8000); Facebook Login → Valid OAuth Redirect URIs = those URLs. Allow pop-ups, restart npm run dev, then retry.',
        )
        return
      }

      notifyError(
        result.message ||
          'Could not open Facebook Share Dialog. Allow pop-ups for this site and try again.',
      )
    })

  const onPlatformShare = (platform, label) =>
    runShare(platform, async () => {
      const opened = shareViaPlatform(platform, { shareUrl, shareText })
      if (opened) {
        trackShare(platform)
        notifySuccess(`Opening ${label}…`)
      } else {
        notifyError(`Could not open ${label}. Allow pop-ups or copy the link instead.`)
      }
    })

  const onInstagramShare = () =>
    runShare('instagram', async () => {
      const { copied, downloaded } = await prepareInstagramShare({
        imageUrl: imageSrc,
        caption: `${shareCaption}\n\n${shareUrl}`,
      })
      trackShare('instagram')
      if (copied && downloaded) {
        notifySuccess('Caption copied and badge saved! Open Instagram and share from your gallery.')
      } else if (downloaded) {
        notifySuccess('Badge saved! Open Instagram and share from your gallery.')
      } else if (copied) {
        notifySuccess('Caption copied! Save the badge image, then post on Instagram.')
      } else {
        notifyError('Could not prepare Instagram share. Try Download or Copy link.')
      }
    })

  return (
    <>
      <div className="profile-social-modal-head">
        <div className="profile-social-modal-title-wrap">
          <div className="profile-social-modal-title">
            {isTrophy ? 'Achievement Trophy' : 'Achievement Badge'}
          </div>
          <div className="profile-social-modal-subtitle">Show off your verified challenge win</div>
        </div>
        <button type="button" className="profile-social-modal-close" onClick={dismiss} aria-label="Close">
          ×
        </button>
      </div>

      <div className="badge-share-modal-body">
        <div className="badge-share-hero">
          <div className={`badge-share-image-ring ${isPersonalizedReward ? 'is-personalized-reward' : ''}`}>
            <EarnedRewardShareImage
              item={badge}
              resolveMediaUrl={resolveMediaUrl}
              alt={rewardTitle}
              className={`badge-share-image ${isPersonalizedReward ? 'is-personalized-reward' : ''}`}
              fallbackClassName={`badge-share-image-fallback ${isPersonalizedReward ? 'is-personalized-reward' : ''}`}
            />
          </div>
          <div className="badge-share-verified-pill">
            <span className="badge-share-verified-dot" aria-hidden />
            Verified on Fitness 365 Pro
          </div>
          <h3 className="badge-share-title">{rewardTitle}</h3>
          <p className="badge-share-event">{eventTitle}</p>
          {earnedLabel ? <p className="badge-share-earned">Earned {earnedLabel}</p> : null}
          <p className="badge-share-owner">
            {ownerName ? `${ownerName} completed this challenge distance goal.` : 'Challenge distance goal completed.'}
          </p>
        </div>

        <div className="badge-share-section">
          <div className="badge-share-section-label">Share your win</div>
          <div className="badge-share-actions-grid">
            {canUseNativeShare() ? (
              <ShareActionButton
                label="Share"
                sublabel="Messages, apps & more"
                variant="primary"
                busy={Boolean(busyKey)}
                onClick={onNativeShare}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                    <path d="M16 6l-4-4-4 4" />
                    <path d="M12 2v14" />
                  </svg>
                }
              />
            ) : null}

            <ShareActionButton
              label="Facebook"
              sublabel="Post to your timeline"
              busy={Boolean(busyKey)}
              onClick={onFacebookShare}
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              }
            />

            <ShareActionButton
              label="Instagram"
              sublabel="Save image + caption"
              busy={Boolean(busyKey)}
              onClick={onInstagramShare}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              }
            />

            <ShareActionButton
              label="X (Twitter)"
              sublabel="Tweet achievement"
              busy={Boolean(busyKey)}
              onClick={() => onPlatformShare('twitter', 'X')}
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              }
            />

            <ShareActionButton
              label="WhatsApp"
              sublabel="Send to friends"
              busy={Boolean(busyKey)}
              onClick={() => onPlatformShare('whatsapp', 'WhatsApp')}
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              }
            />

            <ShareActionButton
              label="LinkedIn"
              sublabel="Share professionally"
              busy={Boolean(busyKey)}
              onClick={() => onPlatformShare('linkedin', 'LinkedIn')}
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              }
            />

            <ShareActionButton
              label="Copy link"
              sublabel="Share anywhere"
              busy={Boolean(busyKey)}
              onClick={onCopyLink}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              }
            />

            <ShareActionButton
              label="Copy caption"
              sublabel="For any platform"
              busy={Boolean(busyKey)}
              onClick={onCopyCaption}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              }
            />

            <ShareActionButton
              label="Download"
              sublabel={isTrophy ? 'Save trophy image' : 'Save badge image'}
              busy={Boolean(busyKey)}
              onClick={onDownload}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              }
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default function BadgeShareModal({
  open,
  onRequestClose,
  badge,
  ownerName,
  clientId,
  resolveMediaUrl,
  kind = 'badge',
}) {
  if (!badge) return null

  return (
    <AppModalTransition
      open={open}
      onRequestClose={onRequestClose}
      backdropClassName="profile-social-modal-backdrop badge-share-modal-backdrop"
      panelClassName="profile-social-modal badge-share-modal"
    >
      <BadgeShareModalBody
        badge={badge}
        ownerName={ownerName}
        clientId={clientId}
        resolveMediaUrl={resolveMediaUrl}
        kind={kind}
      />
    </AppModalTransition>
  )
}
