import React, { useMemo } from 'react'
import { resolveEarnedRewardThumbnailUrl } from '../../utils/mediaUrl'

const truncateName = (name, max = 28) => {
  const t = String(name || '').trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/**
 * Badge/trophy tile with base artwork + runner name ribbon (matches personalized reward UX).
 */
export default function EarnedRewardArtwork({
  item,
  resolveMediaUrl,
  ownerName = '',
  alt = '',
  variant = 'tile',
  imgClassName = 'profile-earned-event-reward-img',
}) {
  const src = useMemo(
    () => resolveEarnedRewardThumbnailUrl(item, resolveMediaUrl),
    [item, resolveMediaUrl],
  )

  const ribbonName = useMemo(() => {
    if (variant === 'hero') return truncateName(ownerName, 34)
    if (variant === 'panel') return truncateName(ownerName, 28)
    return truncateName(ownerName, 22)
  }, [ownerName, variant])

  if (!src) {
    return <div className="profile-earned-event-reward-fallback" aria-hidden />
  }

  return (
    <div className={`profile-earned-reward-artwork is-${variant}`}>
      <img className={imgClassName} src={src} alt={alt} loading={variant === 'hero' ? 'eager' : 'lazy'} />
      {ribbonName ? (
        <span className="profile-earned-reward-name-ribbon" title={ownerName}>
          {ribbonName}
        </span>
      ) : null}
    </div>
  )
}
