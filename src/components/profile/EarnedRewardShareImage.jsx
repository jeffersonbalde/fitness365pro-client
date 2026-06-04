import React from 'react'
import { resolveEarnedRewardThumbnailUrl } from '../../utils/mediaUrl'

/**
 * Large reward image for share modals — always uses base CMS artwork (media proxy).
 * Personalized /share/reward URLs are not used here; they often render as broken SVG in <img>.
 */
export default function EarnedRewardShareImage({
  item,
  resolveMediaUrl,
  alt,
  className = 'badge-share-image',
  fallbackClassName = 'badge-share-image-fallback',
}) {
  const src = resolveEarnedRewardThumbnailUrl(item, resolveMediaUrl)

  if (!src) {
    return <div className={fallbackClassName} aria-hidden />
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="eager"
    />
  )
}
