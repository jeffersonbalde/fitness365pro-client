import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AppModalTransition, { useAppModalDismiss } from '../AppModalTransition.jsx'
import LeaderboardBragCard from './LeaderboardBragCard.jsx'
import { notifyError, notifySuccess } from '../../utils/notifications'
import { trackEvent } from '../../utils/telemetry'
import {
  buildLeaderboardShareCaption,
  buildLeaderboardShareCardUrl,
  buildLeaderboardShareText,
  buildLeaderboardShareUrl,
  canUseNativeShare,
  copyTextToClipboard,
  isLeaderboardShareOgUrl,
  shareLeaderboardNative,
  shareLeaderboardToFacebook,
  shareViaPlatform,
  verifyLeaderboardShareReady,
} from '../../utils/leaderboardShare'
import '../profile/BadgeShareModal.css'
import './LeaderboardShareModal.css'

function ShareChip({ label, className, icon, onClick, busy }) {
  return (
    <button
      type="button"
      className={`lb-share-chip ${className}`}
      onClick={onClick}
      disabled={busy}
      aria-label={label}
    >
      <span className="lb-share-chip__icon" aria-hidden>
        {icon}
      </span>
      <span className="lb-share-chip__label">{label}</span>
    </button>
  )
}

function LeaderboardShareModalBody({
  eventTitle,
  eventId,
  clientId,
  ownerName,
  rank,
  progress,
  categoryLabel,
  categoryFilter,
  resolveMediaUrl,
  eventImageUrl,
}) {
  const dismiss = useAppModalDismiss()
  const [busyKey, setBusyKey] = useState('')
  const [previewStatus, setPreviewStatus] = useState({ state: 'checking', message: '' })

  const cardImageSrc = useMemo(
    () =>
      buildLeaderboardShareCardUrl({
        eventId,
        clientId,
        category: categoryFilter,
      }),
    [eventId, clientId, categoryFilter],
  )

  const shareUrl = useMemo(
    () =>
      buildLeaderboardShareUrl({
        eventId,
        clientId,
        category: categoryFilter,
      }),
    [eventId, clientId, categoryFilter],
  )

  useEffect(() => {
    let cancelled = false
    setPreviewStatus({ state: 'checking', message: '' })

    if (!isLeaderboardShareOgUrl(shareUrl)) {
      setPreviewStatus({
        state: 'error',
        message:
          'Share link points at the website app, not the API. Set VITE_LARAVEL_API to https://fitness365pro.com/fitness365pro-server/api and rebuild.',
      })
      return () => {
        cancelled = true
      }
    }

    verifyLeaderboardShareReady({ eventId, clientId, category: categoryFilter }).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setPreviewStatus({ state: 'ready', message: '' })
        return
      }
      setPreviewStatus({
        state: 'error',
        message: result.message || 'Facebook cannot load a preview for this link.',
      })
    })

    return () => {
      cancelled = true
    }
  }, [shareUrl, eventId, clientId, categoryFilter])

  const loggedKm = progress?.logged_distance_km
  const progressPercent = progress?.progress_percent
  const goalCompleted = Boolean(progress?.goal_completed)

  const shareText = useMemo(
    () =>
      buildLeaderboardShareText({
        ownerName,
        eventTitle,
        rank,
        loggedKm,
        progressPercent,
        goalCompleted,
        categoryLabel,
        shareUrl,
      }),
    [
      ownerName,
      eventTitle,
      rank,
      loggedKm,
      progressPercent,
      goalCompleted,
      categoryLabel,
      shareUrl,
    ],
  )

  const shareCaption = useMemo(
    () =>
      buildLeaderboardShareCaption({
        ownerName,
        eventTitle,
        rank,
        loggedKm,
        progressPercent,
        goalCompleted,
        categoryLabel,
      }),
    [ownerName, eventTitle, rank, loggedKm, progressPercent, goalCompleted, categoryLabel],
  )

  const trackShare = useCallback(
    (channel) => {
      trackEvent('leaderboard_share', {
        channel,
        event_id: eventId,
        rank,
      })
    },
    [eventId, rank],
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
        notifySuccess('Link copied!')
      } else {
        notifyError('Could not copy link.')
      }
    })

  const onCopyCaption = () =>
    runShare('caption', async () => {
      const ok = await copyTextToClipboard(shareCaption)
      if (ok) {
        trackShare('copy_caption')
        notifySuccess('Caption copied!')
      } else {
        notifyError('Could not copy caption.')
      }
    })

  const onNativeShare = () =>
    runShare('native', async () => {
      const result = await shareLeaderboardNative({
        eventTitle,
        shareCaption,
        shareUrl,
        imageUrl: cardImageSrc,
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
      if (!isLeaderboardShareOgUrl(shareUrl)) {
        notifyError(
          'Share link is misconfigured. Set VITE_LARAVEL_API to your server URL (e.g. …/fitness365pro-server/api), rebuild the client, then try again.',
        )
        return
      }

      if (previewStatus.state === 'error') {
        notifyError(previewStatus.message)
        return
      }

      if (previewStatus.state === 'checking') {
        const check = await verifyLeaderboardShareReady({ eventId, clientId, category: categoryFilter })
        if (!check.ok) {
          notifyError(check.message || 'Share preview is not ready yet.')
          return
        }
      }

      const result = await shareLeaderboardToFacebook({
        shareUrl,
        shareCaption,
        imageUrl: cardImageSrc,
      })
      trackShare('facebook')

      if (result.reason === 'missing_app_id') {
        notifyError('Facebook sharing needs VITE_FACEBOOK_APP_ID. Rebuild after setting it.')
        return
      }

      if (result.ok) {
        if (result.copied) {
          notifySuccess(
            'Caption copied. In Facebook, paste (Ctrl+V) to add your message — the image preview comes from the server link.',
          )
        } else {
          notifySuccess('Facebook share opened. The preview loads from your server share link.')
        }
        return
      }

      if (result.reason === 'cancelled') return

      notifyError(result.message || 'Could not open Facebook. Allow pop-ups or copy the link.')
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

  const busy = Boolean(busyKey)

  return (
    <>
      <div className="profile-social-modal-head leaderboard-share-modal-head">
        <div className="profile-social-modal-title-wrap">
          <div className="profile-social-modal-title">Share your achievement</div>
        </div>
        <button type="button" className="profile-social-modal-close" onClick={dismiss} aria-label="Close">
          ×
        </button>
      </div>

      <div className="badge-share-modal-body leaderboard-share-modal-body">
        <section className="leaderboard-share-preview-section">
          <div className="leaderboard-share-preview-label">
            <span>Preview</span>
          </div>
          <LeaderboardBragCard
            ownerName={ownerName}
            eventTitle={eventTitle}
            rank={rank}
            progress={progress}
            categoryLabel={categoryLabel}
            eventImageUrl={eventImageUrl}
            resolveMediaUrl={resolveMediaUrl}
          />
        </section>

        <section className="leaderboard-share-social-panel">
          <h4 className="leaderboard-share-social-title">Share to</h4>

          {previewStatus.state === 'error' ? (
            <p className="leaderboard-share-preview-warning" role="alert">
              {previewStatus.message}
            </p>
          ) : previewStatus.state === 'checking' ? (
            <p className="leaderboard-share-preview-warning is-muted">Checking Facebook preview…</p>
          ) : (
            <p className="leaderboard-share-preview-hint">
              Caption copies when you tap Facebook — paste it in the post. Preview image loads from the server
              link below.
            </p>
          )}

          <div className="leaderboard-share-chips">
            <ShareChip
              label="Facebook"
              className="lb-share-chip--facebook"
              busy={busy}
              onClick={onFacebookShare}
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              }
            />
            <ShareChip
              label="X"
              className="lb-share-chip--twitter"
              busy={busy}
              onClick={() => onPlatformShare('twitter', 'X')}
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              }
            />
            <ShareChip
              label="WhatsApp"
              className="lb-share-chip--whatsapp"
              busy={busy}
              onClick={() => onPlatformShare('whatsapp', 'WhatsApp')}
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              }
            />
            <ShareChip
              label="LinkedIn"
              className="lb-share-chip--linkedin"
              busy={busy}
              onClick={() => onPlatformShare('linkedin', 'LinkedIn')}
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              }
            />
            {canUseNativeShare() ? (
              <ShareChip
                label="More"
                className="lb-share-chip--native"
                busy={busy}
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
          </div>

          <div className="leaderboard-share-link-preview" title={shareUrl}>
            <span className="leaderboard-share-link-preview__label">Facebook crawls</span>
            <code className="leaderboard-share-link-preview__url">{shareUrl}</code>
          </div>

          <div className="leaderboard-share-util-row">
            <button type="button" className="leaderboard-share-util-btn" disabled={busy} onClick={onCopyLink}>
              Copy link
            </button>
            <button type="button" className="leaderboard-share-util-btn" disabled={busy} onClick={onCopyCaption}>
              Copy caption
            </button>
          </div>
        </section>
      </div>
    </>
  )
}

export default function LeaderboardShareModal({
  open,
  onRequestClose,
  eventTitle,
  eventId,
  clientId,
  ownerName,
  rank,
  progress,
  categoryLabel,
  categoryFilter = 'all',
  resolveMediaUrl,
  eventImageUrl,
}) {
  if (!eventId || !clientId || rank == null) return null

  return (
    <AppModalTransition
      open={open}
      onRequestClose={onRequestClose}
      backdropClassName="profile-social-modal-backdrop badge-share-modal-backdrop leaderboard-share-modal-backdrop"
      panelClassName="profile-social-modal badge-share-modal leaderboard-share-modal"
    >
      <LeaderboardShareModalBody
        eventTitle={eventTitle}
        eventId={eventId}
        clientId={clientId}
        ownerName={ownerName}
        rank={rank}
        progress={progress}
        categoryLabel={categoryLabel}
        categoryFilter={categoryFilter}
        resolveMediaUrl={resolveMediaUrl}
        eventImageUrl={eventImageUrl}
      />
    </AppModalTransition>
  )
}
