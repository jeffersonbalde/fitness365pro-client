import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { resolveEarnedRewardThumbnailUrl } from '../../utils/mediaUrl'

/**
 * Large reward image for share modals — personalized artwork first, base artwork on error.
 */
export default function EarnedRewardShareImage({
  item,
  resolveMediaUrl,
  alt,
  className = 'badge-share-image',
  fallbackClassName = 'badge-share-image-fallback',
}) {
  const baseSrc = useMemo(
    () => resolveEarnedRewardThumbnailUrl(item, resolveMediaUrl),
    [item, resolveMediaUrl],
  )

  const personalizedSrc = useMemo(() => {
    const raw = item?.image_url
    if (!raw || !resolveMediaUrl) return ''
    const resolved = resolveMediaUrl(String(raw))
    return resolved && resolved !== baseSrc ? resolved : ''
  }, [item?.image_url, baseSrc, resolveMediaUrl])

  const [src, setSrc] = useState(() => personalizedSrc || baseSrc)

  useEffect(() => {
    setSrc(personalizedSrc || baseSrc)
  }, [personalizedSrc, baseSrc])

  const handleError = useCallback(() => {
    setSrc((current) => {
      if (baseSrc && current !== baseSrc) return baseSrc
      return ''
    })
  }, [baseSrc])

  if (!src) {
    return <div className={fallbackClassName} aria-hidden />
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={handleError}
    />
  )
}
