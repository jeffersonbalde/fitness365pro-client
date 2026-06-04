import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { resolveEarnedRewardThumbnailUrl } from '../../utils/mediaUrl'

/**
 * Badge/trophy tile image — uses base artwork (media proxy) with fallback to personalized URL.
 */
export default function EarnedRewardThumbnail({ item, resolveMediaUrl, alt, className = 'profile-earned-event-reward-img' }) {
  const primarySrc = useMemo(
    () => resolveEarnedRewardThumbnailUrl(item, resolveMediaUrl),
    [item, resolveMediaUrl],
  )

  const [src, setSrc] = useState(primarySrc)

  useEffect(() => {
    setSrc(primarySrc)
  }, [primarySrc])

  const handleError = useCallback(() => {
    setSrc('')
  }, [])

  if (!src) {
    return <div className="profile-earned-event-reward-fallback" aria-hidden />
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={handleError}
    />
  )
}
