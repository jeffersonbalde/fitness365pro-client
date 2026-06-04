import React from 'react'
import EarnedRewardArtwork from './EarnedRewardArtwork.jsx'

/**
 * Badge/trophy sidebar tile — base artwork with runner name ribbon.
 */
export default function EarnedRewardThumbnail({
  item,
  resolveMediaUrl,
  ownerName = '',
  alt,
  className = 'profile-earned-event-reward-img',
}) {
  return (
    <EarnedRewardArtwork
      item={item}
      resolveMediaUrl={resolveMediaUrl}
      ownerName={ownerName}
      alt={alt}
      variant="tile"
      imgClassName={className}
    />
  )
}
