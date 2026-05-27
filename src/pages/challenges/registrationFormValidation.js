/**
 * Corporate-style participant validation aligned with Laravel EventRegistrationController.
 */

const collapseWhitespace = (s) => String(s || '').trim().replace(/\s+/g, ' ')

// Letters (Unicode letter), apostrophe/dash/dot; min 2 non-space chars enforced separately
const NAME_ALLOWED = /^[\p{L}\s\-'.,"]+$/u

export const philippineMobileHint = 'Digits only. Example: 09171234567 or 639171234567.'

/**
 * Real-time input: keep digits only and cap length for PH mobile variants while typing.
 */
export function sanitizePhilippineMobileInput(raw) {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('63')) return d.slice(0, 12)
  if (d.startsWith('09')) return d.slice(0, 11)
  if (d.startsWith('9')) return d.slice(0, 10)

  return d.slice(0, 11)
}

/** Digits-only canonical storage: /^09\d{9}$/ */
export function normalizePhilippineMobile(raw) {
  const digits = String(raw || '').replace(/\D+/g, '')
  if (!digits) return ''

  let m = ''

  if (digits.startsWith('63') && digits.length === 12 && digits[2] === '9') {
    m = `0${digits.slice(2)}`
  } else if (digits.startsWith('09') && digits.length === 11) {
    m = digits
  } else if (digits.startsWith('9') && digits.length === 10) {
    m = `0${digits}`
  }

  return /^09\d{9}$/.test(m) ? m : ''
}

/** Display-only: 0917 123 4567 */
export function formatPhilippineMobileForDisplay(canonical09) {
  const d = String(canonical09 || '').replace(/\D/g, '')
  if (!/^09\d{9}$/.test(d)) return String(canonical09 || '').trim()
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 11)}`
}

function validatePersonName(value, label) {
  const t = collapseWhitespace(value)
  if (t.length < 2) {
    return `${label}: use at least 2 letters.`
  }
  if (t.length > 100) return `${label}: max 100 characters.`
  if (!NAME_ALLOWED.test(t)) {
    return `${label}: letters and basic punctuation only.`
  }

  const letterish = [...t].filter((ch) => /\p{L}/u.test(ch)).length

  return letterish >= 2 ? '' : `${label}: use at least 2 letters.`
}

function validateAdministrativePlace(value, label, minLen, maxLen) {
  const t = collapseWhitespace(value)
  if (t.length < minLen) return `${label}: at least ${minLen} characters.`
  if (t.length > maxLen) return `${label}: max ${maxLen} characters.`
  const placeOk = /^[\p{L}\p{N}\s\-'./(),#]+$/u.test(t)
  if (!placeOk) {
    return `${label}: invalid characters.`
  }

  const alphaNum = [...t].some((ch) => /\p{L}/u.test(ch) || /\p{N}/u.test(ch))
  return alphaNum ? '' : `${label}: enter a valid value.`
}

function validateBirthDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Enter a complete date.'

  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return 'Invalid date.'
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  if (d.getTime() > today.getTime()) return "Date can't be in the future."
  let ageYears = today.getFullYear() - d.getFullYear()

  const m = today.getMonth() - d.getMonth()

  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) ageYears--

  if (ageYears > 115) return 'Check your birth date.'
  if (ageYears < 12) return 'You must be at least 12 years old.'

  return ''
}

function validateStreet(value) {
  const t = collapseWhitespace(value)

  const min = 8

  if (t.length < min) {
    return `At least ${min} characters (street name or building).`
  }
  if (t.length > 240) return 'Max 240 characters.'
  if (/^\d+$/.test(t)) return "Don't use numbers only — add street or building."

  return ''
}

/** @returns {{ errors: Record<string, string>, sanitized: typeof participantForm }} */
export function validateParticipantStep(form, { accountEmail }) {
  const errors = {}

  let first_name = collapseWhitespace(form.first_name)
  let last_name = collapseWhitespace(form.last_name)

  let err = validatePersonName(first_name, 'First name')

  if (err) errors.first_name = err
  err = validatePersonName(last_name, 'Last name')
  if (err) errors.last_name = err

  err = validateBirthDate(form.date_of_birth || '')
  if (err) errors.date_of_birth = err

  const email = collapseWhitespace(String(form.email || '')).toLowerCase()
  if (!email) errors.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email.'
  else if (accountEmail && email !== String(accountEmail).toLowerCase().trim())
    errors.email = 'Email must match your account login.'

  const phoneNorm = normalizePhilippineMobile(form.phone)
  if (!phoneNorm)
    errors.phone = 'Enter a valid PH mobile (e.g. 09XXXXXXXXX).'

  err = validateAdministrativePlace(form.country || '', 'Country', 2, 100)
  if (err) errors.country = err
  err = validateStreet(form.street_address || '')
  if (err) errors.street_address = err
  err = validateAdministrativePlace(form.province || '', 'Province', 2, 100)
  if (err) errors.province = err
  err = validateAdministrativePlace(form.city || '', 'City', 2, 100)
  if (err) errors.city = err
  err = validateAdministrativePlace(form.barangay || '', 'Barangay', 2, 120)

  if (err) errors.barangay = err

  const sanitized = {
    ...form,
    first_name,
    last_name,
    date_of_birth: form.date_of_birth || '',
    email,
    phone: phoneNorm,
    country: collapseWhitespace(form.country),
    street_address: collapseWhitespace(form.street_address),
    province: collapseWhitespace(form.province),
    city: collapseWhitespace(form.city),
    barangay: collapseWhitespace(form.barangay),
  }

  return { errors, sanitized }
}

/** @returns {Record<string,string>} */
export function validateFulfillmentDelivery({
  needsKitSelections,
  category,
  distanceValue,
  packageValue,
  programValue,
  gymPackageValue,
  needsShirt,
  shirtSize,
  deliveryAreaKey,
  shipSameAsRegistration,
  deliveryAddressLine,
  deliveryProvince,
  deliveryCity,
  deliveryBarangay,
}) {
  const errors = {}

  if (needsKitSelections && category === 'running') {
    if (!distanceValue?.trim())
      errors.distance = 'Choose a race distance.'
    if (!packageValue?.trim()) errors.package = 'Choose a package.'
    if (needsShirt && !shirtSize?.trim())
      errors.shirt_size = 'Choose a shirt size.'
  }
  if (needsKitSelections && category === 'gym') {
    if (!programValue?.trim()) errors.program = 'Choose a programme.'
    if (!gymPackageValue?.trim()) errors.membership_package = 'Choose a package.'
    if (needsShirt && !shirtSize?.trim())
      errors.shirt_size = 'Choose an apparel size.'
  }

  if (!deliveryAreaKey?.trim())
    errors.delivery_zone = 'Choose a delivery option.'

  if (!shipSameAsRegistration) {
    let er = validateStreet(deliveryAddressLine || '')
    if (er) errors.delivery_address_line = er
    er = validateAdministrativePlace(deliveryProvince || '', 'Province', 2, 120)
    if (er) errors.delivery_province = er
    er = validateAdministrativePlace(deliveryCity || '', 'City', 2, 120)
    if (er) errors.delivery_city = er
    er = validateAdministrativePlace(deliveryBarangay || '', 'Barangay', 2, 120)
    if (er) errors.delivery_barangay = er
  }

  return errors
}

/** Laravel error bags use dotted keys (e.g. participant.phone). */
export function laravelErrorsByPrefix(errorsObj, prefix) {
  const flat = {}
  if (!errorsObj || typeof errorsObj !== 'object') return flat
  const pref = `${prefix}.`
  for (const [key, val] of Object.entries(errorsObj)) {
    if (typeof key !== 'string' || !key.startsWith(pref)) continue
    const field = key.slice(pref.length)
    const msg = Array.isArray(val) ? String(val[0] || '').trim() : String(val || '').trim()
    if (field && msg) flat[field] = msg
  }

  return flat
}
