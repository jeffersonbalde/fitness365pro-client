/**
 * Export the in-app brag card DOM to PNG (works even when server card.png fails).
 */

import html2canvas from 'html2canvas'

const waitForImages = (root) => {
  const imgs = root.querySelectorAll('img')
  const pending = [...imgs].map(
    (img) =>
      new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve()
          return
        }
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      }),
  )
  return Promise.all(pending)
}

export const exportLeaderboardCardBlob = async (element) => {
  if (!element) return null

  await waitForImages(element)

  const canvas = await html2canvas(element, {
    backgroundColor: '#0f172a',
    scale: Math.min(2, window.devicePixelRatio || 2),
    useCORS: true,
    allowTaint: false,
    logging: false,
  })

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92)
  })
}

export const downloadBlob = (blob, filename) => {
  if (!blob || typeof window === 'undefined') return false
  try {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    return true
  } catch {
    return false
  }
}

export const openFacebookHome = () => {
  if (typeof window === 'undefined') return false
  return Boolean(window.open('https://www.facebook.com/', '_blank', 'noopener,noreferrer'))
}
