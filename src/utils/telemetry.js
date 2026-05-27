const TELEMETRY_STORAGE_KEY = 'fitness365_telemetry_events'
const MAX_EVENTS = 200

const readEvents = () => {
  try {
    const raw = window.localStorage.getItem(TELEMETRY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeEvents = (events) => {
  try {
    window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)))
  } catch {
    // Ignore storage failures; telemetry should never break UX.
  }
}

export const trackEvent = (name, metadata = {}) => {
  if (typeof window === 'undefined' || !name) return

  const event = {
    name,
    metadata,
    timestamp: new Date().toISOString(),
  }

  const events = readEvents()
  events.push(event)
  writeEvents(events)

  if (import.meta.env.DEV) {
    // Helpful while validating feature rollout locally.
    console.debug('[telemetry]', event)
  }
}

