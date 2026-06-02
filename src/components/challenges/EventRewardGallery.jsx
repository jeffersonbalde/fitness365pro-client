import React, { useCallback, useState } from 'react'
import AppModalTransition from '../AppModalTransition.jsx'
import '../../pages/profile/Profile.css'

/**
 * Badges / trophies grid on event details — tap to open full image preview.
 */
export default function EventRewardGallery({ items = [], resolveMediaUrl }) {
  const [preview, setPreview] = useState(null)

  const closePreview = useCallback(() => setPreview(null), [])

  const openPreview = useCallback((item) => {
    if (!item?.imageUrl) return
    setPreview({ imageUrl: item.imageUrl, title: item.title || '' })
  }, [])

  if (!Array.isArray(items) || items.length === 0) return null

  const previewSrc = preview?.imageUrl
    ? resolveMediaUrl
      ? resolveMediaUrl(preview.imageUrl)
      : preview.imageUrl
    : ''

  return (
    <>
      <div className="event-reward-gallery" role="list">
        {items.map((item, idx) => {
          const src = resolveMediaUrl ? resolveMediaUrl(item.imageUrl) : item.imageUrl
          const label = item.title || 'Reward'
          return (
            <figure
              key={`reward-${item.title}-${idx}`}
              className="event-reward-card"
              role="listitem"
            >
              <button
                type="button"
                className="event-reward-card-btn"
                onClick={() => openPreview(item)}
                disabled={!src}
                aria-label={`Preview ${label}`}
              >
                <div className="event-reward-card-media">
                  {src ? (
                    <img
                      src={src}
                      alt=""
                      className="event-reward-card-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="event-reward-card-fallback" aria-hidden />
                  )}
                </div>
                <span className="event-reward-card-caption">{label}</span>
              </button>
            </figure>
          )
        })}
      </div>

      <AppModalTransition
        open={Boolean(previewSrc)}
        onRequestClose={closePreview}
        backdropClassName="profile-media-viewer-backdrop profile-post-image-backdrop"
        panelClassName="profile-media-viewer profile-post-image-viewer event-reward-preview-viewer"
      >
        {(dismiss) =>
          previewSrc ? (
            <>
              <button
                type="button"
                className="profile-media-viewer-close"
                onClick={dismiss}
                aria-label="Close preview"
              >
                ×
              </button>
              <div className="profile-media-viewer-image-wrap profile-post-image-wrap event-reward-preview-wrap">
                {preview?.title ? (
                  <p className="event-reward-preview-title">{preview.title}</p>
                ) : null}
                <img
                  src={previewSrc}
                  alt={preview?.title || 'Reward preview'}
                  className="profile-media-viewer-image is-post event-reward-preview-image"
                />
              </div>
            </>
          ) : null
        }
      </AppModalTransition>
    </>
  )
}
