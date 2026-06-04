import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  resolveEarnedRewardPersonalizedUrl,
  resolveEarnedRewardThumbnailUrl,
} from '../../utils/mediaUrl'
import EarnedRewardArtwork from './EarnedRewardArtwork.jsx'

/**
 * Share modal reward — try server-rendered PNG with name; fall back to base + CSS ribbon.
 */
export default function EarnedRewardShareImage({
  item,
  resolveMediaUrl,
  ownerName = '',
  alt,
  className = 'badge-share-image',
  fallbackClassName = 'badge-share-image-fallback',
}) {
  const personalizedPng = useMemo(() => {
    const url = resolveEarnedRewardPersonalizedUrl(item, resolveMediaUrl)
    if (!url || /\.svg($|\?)/i.test(url)) return ''
    return url
  }, [item, resolveMediaUrl])

  const [usePersonalized, setUsePersonalized] = useState(Boolean(personalizedPng))

  useEffect(() => {
    setUsePersonalized(Boolean(personalizedPng))
  }, [personalizedPng])

  const handlePersonalizedError = useCallback(() => {
    setUsePersonalized(false)
  }, [])

  if (usePersonalized && personalizedPng) {
    return (
      <img
        className={className}
        src={personalizedPng}
        alt={alt}
        loading="eager"
        onError={handlePersonalizedError}
      />
    )
  }

  const baseSrc = resolveEarnedRewardThumbnailUrl(item, resolveMediaUrl)
  if (!baseSrc) {
    return <div className={fallbackClassName} aria-hidden />
  }

  return (
    <EarnedRewardArtwork
      item={item}
      resolveMediaUrl={resolveMediaUrl}
      ownerName={ownerName}
      alt={alt}
      variant="hero"
      imgClassName={className}
    />
  )
}
