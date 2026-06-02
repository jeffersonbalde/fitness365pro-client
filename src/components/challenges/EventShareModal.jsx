import React, { useCallback, useMemo, useState } from 'react'
import AppModalTransition, { useAppModalDismiss } from '../AppModalTransition.jsx'
import { notifyError, notifySuccess } from '../../utils/notifications'
import { trackEvent } from '../../utils/telemetry'
import {
  buildEventShareCaption,
  buildEventShareText,
  buildEventShareUrl,
  canUseNativeShare,
  copyTextToClipboard,
  shareEventNative,
  shareEventToFacebook,
  shareViaPlatform,
} from '../../utils/eventShare'
import '../profile/BadgeShareModal.css'

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

function EventShareModalBody({ event, resolveMediaUrl }) {
  const dismiss = useAppModalDismiss()
  const [busyKey, setBusyKey] = useState('')

  const imageSrc = useMemo(() => {
    const raw = event?.imageUrl || ''
    return resolveMediaUrl ? resolveMediaUrl(raw) : raw
  }, [event?.imageUrl, resolveMediaUrl])

  const eventName = event?.name || 'Fitness Event'
  const shareUrl = useMemo(() => buildEventShareUrl(event?.id), [event?.id])

  const shareText = useMemo(
    () =>
      buildEventShareText({
        eventName,
        location: event?.location,
        timelineLabel: event?.timelineLabel,
        feeLabel: event?.feeLabel,
        shareUrl,
      }),
    [eventName, event?.location, event?.timelineLabel, event?.feeLabel, shareUrl],
  )

  const shareCaption = useMemo(
    () =>
      buildEventShareCaption({
        eventName,
        location: event?.location,
        timelineLabel: event?.timelineLabel,
        feeLabel: event?.feeLabel,
      }),
    [eventName, event?.location, event?.timelineLabel, event?.feeLabel],
  )

  const trackShare = useCallback(
    (channel) => {
      trackEvent('event_share', {
        channel,
        event_id: event?.id,
      })
    },
    [event?.id],
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
        notifySuccess('Event link copied!')
      } else {
        notifyError('Could not copy link.')
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

  const onNativeShare = () =>
    runShare('native', async () => {
      const result = await shareEventNative({
        eventName,
        shareCaption,
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
      if (shareUrl && !shareUrl.includes('/share/event/')) {
        notifyError(
          'Share preview is misconfigured. Set VITE_LARAVEL_API to your Laravel API URL, rebuild the client, then try again.',
        )
        return
      }

      const result = await shareEventToFacebook({
        shareUrl,
        shareCaption,
        imageUrl: imageSrc,
      })
      trackShare('facebook')

      if (result.reason === 'missing_app_id') {
        notifyError(
          'Facebook sharing needs VITE_FACEBOOK_APP_ID in client/.env. Rebuild the app after setting it.',
        )
        return
      }

      if (result.ok) {
        if (result.mode === 'timeline_local_dev_manual') {
          notifySuccess(
            'Caption copied and event image saved (if available). On Facebook: start a post, paste (Ctrl+V), and add the image.',
          )
        } else if (result.mode === 'timeline_local_dev') {
          notifySuccess(
            'Facebook opened. On production (HTTPS), friends will see the event cover and details in the preview.',
          )
        } else {
          notifySuccess('Facebook share opened! Confirm the post to publish.')
        }
        return
      }

      if (result.reason === 'cancelled') return

      if (result.reason === 'localhost_share_blocked') {
        if (result.copied && result.downloaded) {
          notifyError(
            'Facebook blocked localhost. Caption copied and image saved — paste into a Facebook post.',
          )
        } else {
          notifyError(result.message)
        }
        return
      }

      notifyError(
        result.message || 'Could not open Facebook. Allow pop-ups or use Copy link.',
      )
    })

  const onPlatformShare = (platform, label) =>
    runShare(platform, async () => {
      const opened = shareViaPlatform(platform, { shareUrl, shareText })
      if (opened) {
        trackShare(platform)
        notifySuccess(`Opening ${label}…`)
      } else {
        notifyError(`Could not open ${label}.`)
      }
    })

  return (
    <>
      <div className="profile-social-modal-head">
        <div className="profile-social-modal-title-wrap">
          <div className="profile-social-modal-title">Share event</div>
          <div className="profile-social-modal-subtitle">Invite friends to register on Fitness 365 Pro</div>
        </div>
        <button type="button" className="profile-social-modal-close" onClick={dismiss} aria-label="Close">
          ×
        </button>
      </div>

      <div className="badge-share-modal-body">
        <div className="badge-share-hero">
          <div className="badge-share-image-ring event-share-cover-ring">
            {imageSrc ? (
              <img className="badge-share-image event-share-cover-image" src={imageSrc} alt={eventName} />
            ) : (
              <div className="badge-share-image-fallback" aria-hidden />
            )}
          </div>
          <h3 className="badge-share-title">{eventName}</h3>
          {event?.location ? <p className="badge-share-event">{event.location}</p> : null}
          {event?.timelineLabel ? (
            <p className="badge-share-earned">{event.timelineLabel}</p>
          ) : null}
          {event?.feeLabel ? <p className="badge-share-owner">{event.feeLabel}</p> : null}
        </div>

        <div className="badge-share-section">
          <div className="badge-share-section-label">Share this event</div>
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
              sublabel={
                shareUrl
                  ? `Rich preview · ${(() => {
                      try {
                        return new URL(shareUrl).host
                      } catch {
                        return 'preview link'
                      }
                    })()}`
                  : 'Post to timeline'
              }
              busy={Boolean(busyKey)}
              onClick={onFacebookShare}
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              }
            />

            <ShareActionButton
              label="X (Twitter)"
              sublabel="Tweet event link"
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
          </div>
        </div>
      </div>
    </>
  )
}

export default function EventShareModal({ open, onRequestClose, event, resolveMediaUrl }) {
  if (!event) return null

  return (
    <AppModalTransition
      open={open}
      onRequestClose={onRequestClose}
      backdropClassName="profile-social-modal-backdrop badge-share-modal-backdrop"
      panelClassName="profile-social-modal badge-share-modal"
    >
      <EventShareModalBody event={event} resolveMediaUrl={resolveMediaUrl} />
    </AppModalTransition>
  )
}
