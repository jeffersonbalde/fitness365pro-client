const clampInt = (value, min, max) => {
  const parsed = parseInt(String(value ?? '').trim(), 10)
  if (Number.isNaN(parsed)) return min
  return Math.min(max, Math.max(min, parsed))
}

export const hmsToTotalSeconds = (hours, minutes, seconds) => {
  const h = clampInt(hours, 0, 99)
  const m = clampInt(minutes, 0, 59)
  const s = clampInt(seconds, 0, 59)
  return h * 3600 + m * 60 + s
}

export const totalSecondsToHms = (totalSeconds) => {
  const total = Math.max(0, parseInt(String(totalSeconds ?? 0), 10) || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return {
    hours: String(hours),
    minutes: String(minutes),
    seconds: String(seconds),
  }
}

export const totalSecondsToDurationMinutes = (totalSeconds) => {
  const total = Math.max(0, parseInt(String(totalSeconds ?? 0), 10) || 0)
  if (total <= 0) return 0
  return Math.max(1, Math.floor(total / 60))
}

export const parseHmsFieldValue = (value, part) => {
  const raw = String(value ?? '').trim()
  if (raw === '') return ''
  const parsed = parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 0) return ''
  if (part === 'hours') return String(Math.min(parsed, 99))
  return String(Math.min(parsed, 59))
}

export const validateWorkoutHms = (hours, minutes, seconds) => {
  const hasAnyValue = [hours, minutes, seconds].some((part) => String(part ?? '').trim() !== '')
  if (!hasAnyValue) {
    return { valid: false, message: 'Duration is required.', field: 'duration' }
  }

  const minutePart = String(minutes ?? '').trim()
  const secondPart = String(seconds ?? '').trim()
  if (minutePart !== '' && (Number(minutePart) < 0 || Number(minutePart) > 59)) {
    return { valid: false, message: 'Minutes must be between 0 and 59.', field: 'duration_minutes' }
  }
  if (secondPart !== '' && (Number(secondPart) < 0 || Number(secondPart) > 59)) {
    return { valid: false, message: 'Seconds must be between 0 and 59.', field: 'duration_seconds' }
  }

  const totalSeconds = hmsToTotalSeconds(hours, minutes, seconds)
  if (totalSeconds < 1) {
    return { valid: false, message: 'Duration must be at least 1 second.', field: 'duration' }
  }

  return { valid: true, totalSeconds }
}

export const formatWorkoutDurationLabel = (totalSeconds) => {
  const total = Math.max(0, parseInt(String(totalSeconds ?? 0), 10) || 0)
  if (total <= 0) return null
  const { hours, minutes, seconds } = totalSecondsToHms(total)
  const parts = []
  if (Number(hours) > 0) parts.push(`${hours}h`)
  if (Number(minutes) > 0) parts.push(`${minutes}m`)
  if (Number(seconds) > 0 || parts.length === 0) parts.push(`${seconds}s`)
  return parts.join(' ')
}
