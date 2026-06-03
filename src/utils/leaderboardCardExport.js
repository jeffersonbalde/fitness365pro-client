/**
 * Rank-card PNG for Facebook: server card.png first (no CDN CORS), html2canvas fallback.
 */

import html2canvas from 'html2canvas'

const EXPORT_TIMEOUT_MS = 18000

const withTimeout = (promise, ms, label = 'operation') =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    }),
  ])

const waitForImages = (root, maxMs = 8000) => {
  const imgs = root.querySelectorAll('img')
  const pending = [...imgs].map(
    (img) =>
      new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve()
          return
        }
        const done = () => resolve()
        img.addEventListener('load', done, { once: true })
        img.addEventListener('error', done, { once: true })
      }),
  )
  return Promise.race([
    Promise.all(pending),
    new Promise((resolve) => setTimeout(resolve, maxMs)),
  ])
}

/** Fetch Laravel-generated rank card (same host in prod; server proxies event banner). */
export const fetchLeaderboardCardBlob = async (cardImageUrl, timeoutMs = EXPORT_TIMEOUT_MS) => {
  if (!cardImageUrl || typeof fetch === 'undefined') return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(cardImageUrl, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob || blob.size < 64) return null
    return blob
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const exportLeaderboardCardBlob = async (element, { cardImageUrl } = {}) => {
  if (cardImageUrl) {
    const remote = await fetchLeaderboardCardBlob(cardImageUrl)
    if (remote) return remote
  }

  if (!element) return null

  await waitForImages(element)

  try {
    const canvas = await withTimeout(
      html2canvas(element, {
        backgroundColor: '#0f172a',
        scale: Math.min(2, window.devicePixelRatio || 2),
        useCORS: false,
        allowTaint: true,
        logging: false,
      }),
      EXPORT_TIMEOUT_MS,
      'html2canvas',
    )

    return await new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92)
      } catch {
        resolve(null)
      }
    })
  } catch {
    return null
  }
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
