import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../../utils/api'
import { notifyError, notifySuccess } from '../../utils/notifications'
import { buildGymChoices, buildRunningChoices, normalizeDeliveryAreas, toEvent } from './eventCatalog'
import {
  validateParticipantStep,
  validateFulfillmentDelivery,
  laravelErrorsByPrefix,
  normalizePhilippineMobile,
  sanitizePhilippineMobileInput,
  formatPhilippineMobileForDisplay,
  philippineMobileHint,
} from './registrationFormValidation'
import { AppLoadingState } from '../../components/AppLoadingState.jsx'
import './Challenges.css'

const formatPhp = (n) => `PHP ${Number(n || 0).toLocaleString()}`

const RegSummaryIconUser = () => (
  <svg className="registration-summary-h-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M4.5 19.125a7.125 7.125 0 0 1 15 0"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const RegSummaryIconFulfillment = () => (
  <svg className="registration-summary-h-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M12 12 4 7.5M12 12v9M12 12l8-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const decodeRunningDistance = (optionValue) => {
  if (!optionValue || !optionValue.includes('|')) {
    return { distance_key: String(optionValue || '').toLowerCase(), distance_label: null }
  }
  const parts = optionValue.split('|')
  if (parts[0] !== 'other') {
    return { distance_key: String(parts[0] || '').toLowerCase(), distance_label: null }
  }
  return {
    distance_key: 'other',
    distance_label: decodeURIComponent(parts[1] || ''),
  }
}

const decodeRunningPackage = (optionValue) => {
  if (!optionValue) {
    return { package_key: '', package_label: null, package_includes_shirt: false }
  }
  if (!optionValue.includes('|')) {
    const key = optionValue.toLowerCase()
    return {
      package_key: key,
      package_label: null,
      package_includes_shirt: key === 'medal_shirt' || key === 'medal_shirt_kit',
    }
  }
  const parts = optionValue.split('|')
  if (parts[0] === 'other') {
    return {
      package_key: 'other',
      package_label: decodeURIComponent(parts[1] || ''),
      package_includes_shirt: parts[2] === '1',
    }
  }
  const key = String(parts[0] || '').toLowerCase()
  return {
    package_key: key,
    package_label: null,
    package_includes_shirt: key === 'medal_shirt' || key === 'medal_shirt_kit',
  }
}

const decodeGymProgram = (optionValue) => {
  if (!optionValue || !optionValue.includes('|')) {
    return { program_key: String(optionValue || '').toLowerCase(), program_label: null }
  }
  const parts = optionValue.split('|')
  if (parts[0] !== 'other') {
    return { program_key: String(parts[0] || '').toLowerCase(), program_label: null }
  }
  return { program_key: 'other', program_label: decodeURIComponent(parts[1] || '') }
}

const decodeGymPackage = (optionValue) => decodeRunningPackage(optionValue)

const buildSteps = (includePackageStep) =>
  includePackageStep ? ['participant', 'fulfillment', 'summary'] : ['participant', 'summary']

function RegistrationDeliveryFields({
  deliveryAreas,
  fulfillmentErrors,
  clearFulfillmentFieldError,
  deliveryAreaKey,
  setDeliveryAreaKey,
  shipSameAsRegistration,
  setShipSameAsRegistration,
  deliveryAddressLine,
  setDeliveryAddressLine,
  deliveryProvince,
  setDeliveryProvince,
  deliveryCity,
  setDeliveryCity,
  deliveryBarangay,
  setDeliveryBarangay,
  deliveryNotes,
  setDeliveryNotes,
  wrapperClassName = '',
}) {
  return (
    <div className={wrapperClassName}>
      <label htmlFor="reg-delivery-zone" className="form-label registration-form-field-label">
        Kit / finisher delivery option <span className="text-danger" aria-hidden>*</span>
      </label>
      <p className="form-text registration-form-help mb-1">
        Pickup or courier — fee shown beside each option.
      </p>
      <select
        id="reg-delivery-zone"
        aria-invalid={!!fulfillmentErrors.delivery_zone}
        className={`form-select form-control-registration mb-2${fulfillmentErrors.delivery_zone ? ' is-invalid' : ''}`}
        value={deliveryAreaKey}
        onChange={(e) => {
          clearFulfillmentFieldError('delivery_zone')
          setDeliveryAreaKey(e.target.value)
        }}
      >
        <option value="">Select option…</option>
        {deliveryAreas.map((row) => (
          <option key={row.key} value={row.key}>
            {row.label}
            {' '}
            (
            {formatPhp(row.fee_php)}
            )
          </option>
        ))}
      </select>
      {fulfillmentErrors.delivery_zone && (
        <div className="invalid-feedback d-block">{fulfillmentErrors.delivery_zone}</div>
      )}
      <div className="form-check mb-3">
        <input
          id="ship-same"
          type="checkbox"
          className="form-check-input"
          checked={shipSameAsRegistration}
          onChange={(e) => {
            setShipSameAsRegistration(e.target.checked)
            clearFulfillmentFieldError('delivery_address_line')
            clearFulfillmentFieldError('delivery_province')
            clearFulfillmentFieldError('delivery_city')
            clearFulfillmentFieldError('delivery_barangay')
          }}
        />
        <label className="form-check-label" htmlFor="ship-same">
          Ship to the same address as my registration profile
        </label>
      </div>
      {!shipSameAsRegistration && (
        <div className="row g-3 mb-2">
          <div className="col-12">
            <label htmlFor="reg-del-street" className="form-label registration-form-field-label">
              Courier street / building <span className="text-danger" aria-hidden>*</span>
            </label>
            <input
              id="reg-del-street"
              autoComplete="off"
              className={`form-control form-control-registration${fulfillmentErrors.delivery_address_line ? ' is-invalid' : ''}`}
              value={deliveryAddressLine}
              onChange={(e) => {
                clearFulfillmentFieldError('delivery_address_line')
                setDeliveryAddressLine(e.target.value)
              }}
            />
            {fulfillmentErrors.delivery_address_line && (
              <div className="invalid-feedback d-block">{fulfillmentErrors.delivery_address_line}</div>
            )}
          </div>
          <div className="col-md-4">
            <label htmlFor="reg-del-prov" className="form-label registration-form-field-label">
              Courier province <span className="text-danger" aria-hidden>*</span>
            </label>
            <input
              id="reg-del-prov"
              autoComplete="off"
              className={`form-control form-control-registration${fulfillmentErrors.delivery_province ? ' is-invalid' : ''}`}
              value={deliveryProvince}
              onChange={(e) => {
                clearFulfillmentFieldError('delivery_province')
                setDeliveryProvince(e.target.value)
              }}
            />
            {fulfillmentErrors.delivery_province && (
              <div className="invalid-feedback d-block">{fulfillmentErrors.delivery_province}</div>
            )}
          </div>
          <div className="col-md-4">
            <label htmlFor="reg-del-city" className="form-label registration-form-field-label">
              Courier city <span className="text-danger" aria-hidden>*</span>
            </label>
            <input
              id="reg-del-city"
              autoComplete="off"
              className={`form-control form-control-registration${fulfillmentErrors.delivery_city ? ' is-invalid' : ''}`}
              value={deliveryCity}
              onChange={(e) => {
                clearFulfillmentFieldError('delivery_city')
                setDeliveryCity(e.target.value)
              }}
            />
            {fulfillmentErrors.delivery_city && (
              <div className="invalid-feedback d-block">{fulfillmentErrors.delivery_city}</div>
            )}
          </div>
          <div className="col-md-4">
            <label htmlFor="reg-del-brgy" className="form-label registration-form-field-label">
              Courier barangay <span className="text-danger" aria-hidden>*</span>
            </label>
            <input
              id="reg-del-brgy"
              autoComplete="off"
              className={`form-control form-control-registration${fulfillmentErrors.delivery_barangay ? ' is-invalid' : ''}`}
              value={deliveryBarangay}
              onChange={(e) => {
                clearFulfillmentFieldError('delivery_barangay')
                setDeliveryBarangay(e.target.value)
              }}
            />
            {fulfillmentErrors.delivery_barangay && (
              <div className="invalid-feedback d-block">{fulfillmentErrors.delivery_barangay}</div>
            )}
          </div>
        </div>
      )}
      <label htmlFor="reg-del-notes" className="form-label registration-form-field-label">
        Logistics notes (optional)
      </label>
      <p className="form-text registration-form-help mb-1">Gate code, hours, or delivery notes.</p>
      <textarea
        id="reg-del-notes"
        className="form-control form-control-registration"
        rows={2}
        value={deliveryNotes}
        onChange={(e) => setDeliveryNotes(e.target.value)}
      />
    </div>
  )
}

const paymayaCheckoutStorageKey = (id) => `f365paymaya_checkout:${id}`

/** User cancelled Maya in-browser; suppress auto-opening payment summary until they reach it again */
const skipPayResumeStorageKey = (id) => `f365_reg_skip_pay_resume:${id}`

const emptyParticipant = () => ({
  first_name: '',
  last_name: '',
  date_of_birth: '',
  email: '',
  phone: '',
  country: 'Philippines',
  street_address: '',
  province: '',
  city: '',
  barangay: '',
})

const EventRegistrationFlow = () => {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const verifyOnce = useRef(false)
  const autoSyncOnce = useRef(false)
  const checkoutResumeHydratedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [eventPayload, setEventPayload] = useState(null)
  const [registrationState, setRegistrationState] = useState(null)
  const [participantForm, setParticipantForm] = useState(emptyParticipant())
  const [accountEmail, setAccountEmail] = useState('')
  const [participantErrors, setParticipantErrors] = useState({})
  const [fulfillmentErrors, setFulfillmentErrors] = useState({})
  const [stepIndex, setStepIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [summarySyncing, setSummarySyncing] = useState(false)

  const [distanceValue, setDistanceValue] = useState('')
  const [packageValue, setPackageValue] = useState('')
  const [programValue, setProgramValue] = useState('')
  const [gymPackageValue, setGymPackageValue] = useState('')
  const [shirtSize, setShirtSize] = useState('')

  const [deliveryAreaKey, setDeliveryAreaKey] = useState('')
  const [shipSameAsRegistration, setShipSameAsRegistration] = useState(true)
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [deliveryAddressLine, setDeliveryAddressLine] = useState('')
  const [deliveryProvince, setDeliveryProvince] = useState('')
  const [deliveryCity, setDeliveryCity] = useState('')
  const [deliveryBarangay, setDeliveryBarangay] = useState('')

  const event = useMemo(() => (eventPayload ? toEvent(eventPayload) : null), [eventPayload])
  const runningChoices = useMemo(
    () => (eventPayload ? buildRunningChoices(eventPayload) : null),
    [eventPayload],
  )
  const gymChoices = useMemo(
    () => (eventPayload ? buildGymChoices(eventPayload) : null),
    [eventPayload],
  )

  const feePhp = Number(eventPayload?.fee || 0)

  const needsPackageSelections = useMemo(() => {
    const cat = eventPayload?.category
    if (cat === 'running' && runningChoices) {
      return (runningChoices.packagesOffered?.length ?? 0) > 0
    }
    if (cat === 'gym' && gymChoices) {
      return (gymChoices.packagesOffered?.length ?? 0) > 0
    }
    return false
  }, [eventPayload?.category, runningChoices, gymChoices])

  const steps = useMemo(() => buildSteps(needsPackageSelections), [needsPackageSelections])

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(Math.max(0, steps.length - 1))
    }
  }, [steps.length, stepIndex])

  const deliveryAreas = useMemo(
    () => normalizeDeliveryAreas(event?.deliveryAreas || registrationState?.delivery_areas_catalog),
    [event, registrationState?.delivery_areas_catalog],
  )

  const reloadAll = useCallback(async (options = {}) => {
    const withSpinner = options.withSpinner !== false
    if (!eventId) return
    if (withSpinner) setLoading(true)
    try {
      const [evRes, rsRes] = await Promise.all([
        apiRequest(`/v1/cms/events/${eventId}`, { method: 'GET' }),
        apiRequest(`/v1/cms/events/${eventId}/registration`, { method: 'GET' }),
      ])
      if (evRes.data?.success && evRes.data?.data?.event) {
        setEventPayload(evRes.data.data.event)
      } else {
        setEventPayload(null)
      }
      if (rsRes.data?.success) {
        setRegistrationState(rsRes.data.data)
      } else {
        setRegistrationState(null)
      }
    } catch (error) {
      if (error?.response?.data?.event_status === 'completed') {
        navigate(`/profile/race-results?event=${encodeURIComponent(eventId)}`, { replace: true })
        return
      }
      console.error(error)
      setEventPayload(null)
      setRegistrationState(null)
    } finally {
      if (withSpinner) setLoading(false)
    }
  }, [eventId, navigate])

  const refreshRegistrationState = useCallback(async () => {
    setSummarySyncing(true)
    try {
      await reloadAll({ withSpinner: false })
    } catch (error) {
      console.warn('Registration refresh skipped', error)
    } finally {
      setSummarySyncing(false)
    }
  }, [reloadAll])

  useEffect(() => {
    reloadAll({ withSpinner: true })
  }, [reloadAll])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await apiRequest('/v1/profile', { method: 'GET' })
        if (cancelled || !res.data?.success) return
        const client = res.data.data?.client
        const profile = res.data.data?.profile
        if (client?.email) {
          setAccountEmail((prev) => prev || String(client.email).trim().toLowerCase())
        }
        setParticipantForm((prev) => ({
          ...prev,
          first_name: prev.first_name || profile?.first_name || '',
          last_name: prev.last_name || profile?.last_name || '',
          date_of_birth: prev.date_of_birth || (profile?.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : ''),
          email: prev.email || client?.email || '',
          phone: sanitizePhilippineMobileInput(prev.phone || profile?.phone || ''),
          country: prev.country || profile?.country || 'Philippines',
          street_address: prev.street_address || profile?.street_address || '',
          province: prev.province || profile?.province || '',
          city: prev.city || profile?.city || '',
          barangay: prev.barangay || profile?.barangay || '',
        }))
      } catch (e) {
        console.warn('Profile prefetch skipped', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const row = registrationState?.registration?.participant_details
    if (!row || typeof row !== 'object') return

    setParticipantForm((prev) => ({
      ...prev,
      first_name: row.first_name != null ? String(row.first_name) : prev.first_name,
      last_name: row.last_name != null ? String(row.last_name) : prev.last_name,
      date_of_birth:
        row.date_of_birth != null ? String(row.date_of_birth).slice(0, 10) : prev.date_of_birth,
      email: row.email != null ? String(row.email) : prev.email,
      phone:
        row.phone != null
          ? sanitizePhilippineMobileInput(String(row.phone))
          : prev.phone,
      country: row.country != null ? String(row.country) : prev.country,
      street_address:
        row.street_address != null ? String(row.street_address) : prev.street_address,
      province: row.province != null ? String(row.province) : prev.province,
      city: row.city != null ? String(row.city) : prev.city,
      barangay: row.barangay != null ? String(row.barangay) : prev.barangay,
    }))
  }, [registrationState?.registration?.participant_details])

  useEffect(() => {
    const w = registrationState?.registration?.participant_details?.wizard_running_distance
    if (!w || typeof w !== 'object') return
    const lab = w.distance_label
    const key = String(w.distance_key || '')
    const distOpt = lab ? `other|${encodeURIComponent(lab)}` : key
    setDistanceValue(distOpt || '')
  }, [registrationState?.registration?.participant_details?.wizard_running_distance])

  useEffect(() => {
    const w = registrationState?.registration?.participant_details?.wizard_gym_program
    if (!w || typeof w !== 'object') return
    const progOpt = w.program_label
      ? `other|${encodeURIComponent(w.program_label)}`
      : String(w.program_key || '')
    setProgramValue(progOpt || '')
  }, [registrationState?.registration?.participant_details?.wizard_gym_program])

  useEffect(() => {
    if (!registrationState?.running_selection) return
    const row = registrationState.running_selection
    const dLab = row.distance_label
    const dKey = String(row.distance_key || '')
    const distOpt = dLab ? `other|${encodeURIComponent(dLab)}` : dKey
    setDistanceValue(distOpt || '')
    const pLab = row.package_label
    const pKey = String(row.package_key || '')
    const pic = Boolean(row.package_includes_shirt)
    const pkgOpt = pLab ? `other|${encodeURIComponent(pLab)}|${pic ? '1' : '0'}` : pKey
    setPackageValue(pkgOpt || '')
    setShirtSize(row.shirt_size ? String(row.shirt_size).toUpperCase() : '')
  }, [registrationState?.running_selection])

  useEffect(() => {
    if (!registrationState?.gym_selection) return
    const row = registrationState.gym_selection
    const progOpt = row.program_label
      ? `other|${encodeURIComponent(row.program_label)}`
      : String(row.program_key || '')
    const pLab = row.package_label
    const pKey = String(row.package_key || '')
    const pic = Boolean(row.package_includes_shirt)
    const pkgOpt = pLab ? `other|${encodeURIComponent(pLab)}|${pic ? '1' : '0'}` : pKey
    setProgramValue(progOpt)
    setGymPackageValue(pkgOpt)
    setShirtSize(row.shirt_size ? String(row.shirt_size).toUpperCase() : '')
  }, [registrationState?.gym_selection])

  useEffect(() => {
    const dd = registrationState?.registration?.delivery_details
    if (!dd || typeof dd !== 'object') return
    setDeliveryAreaKey(String(dd.area_key || ''))
    setShipSameAsRegistration(dd.ship_same_as_registration !== false)
    setDeliveryNotes(String(dd.delivery_notes || ''))
    setDeliveryAddressLine(String(dd.delivery_address_line || ''))
    setDeliveryProvince(String(dd.delivery_province || ''))
    setDeliveryCity(String(dd.delivery_city || ''))
    setDeliveryBarangay(String(dd.delivery_barangay || ''))
  }, [registrationState?.registration?.delivery_details])

  useEffect(() => {
    if (
      registrationState?.confirmed
      || registrationState?.registration?.registration_status === 'confirmed'
    ) {
      navigate(`/challenges/${eventId}`)

      return
    }

    const summaryIdx = steps.indexOf('summary')
    const awaitingCheckout =
      registrationState?.registration?.payment_status === 'pending_checkout'
      && registrationState?.registration?.registration_status === 'pending_payment'

    if (!awaitingCheckout || summaryIdx < 0) {
      checkoutResumeHydratedRef.current = false

      return
    }

    if (checkoutResumeHydratedRef.current) return
    checkoutResumeHydratedRef.current = true

    if (eventId && sessionStorage.getItem(skipPayResumeStorageKey(eventId)) === '1') {
      const participantIdx = steps.indexOf('participant')
      setStepIndex(participantIdx >= 0 ? participantIdx : 0)

      return
    }

    setStepIndex(summaryIdx)
  }, [registrationState, steps, navigate, eventId])

  // QR / Maya app payments often skip the success redirect — poll gateway on resume.
  useEffect(() => {
    if (!eventId || autoSyncOnce.current) return

    const awaitingCheckout =
      registrationState?.registration?.payment_status === 'pending_checkout'
      && registrationState?.registration?.registration_status === 'pending_payment'

    if (!awaitingCheckout) return

    autoSyncOnce.current = true
    void (async () => {
      setBusy(true)
      try {
        await syncPendingPayment({ silent: true })
      } finally {
        setBusy(false)
      }
    })()
  }, [eventId, registrationState, syncPendingPayment])

  /** After cancelling PayMaya, user may walk forward again — allow normal “resume at summary” on later reloads */
  useEffect(() => {
    if (!eventId) return
    if (steps[stepIndex] === 'summary') {
      sessionStorage.removeItem(skipPayResumeStorageKey(eventId))
    }
  }, [eventId, stepIndex, steps])

  const needsShirt = useMemo(() => {
    const cat = eventPayload?.category
    if (cat === 'running' && packageValue && runningChoices) {
      const p = runningChoices.packagesOffered?.find((x) => x.optionValue === packageValue)

      return Boolean(p?.includesShirt)
    }
    if (cat === 'gym' && gymPackageValue && gymChoices) {
      const p = gymChoices.packagesOffered?.find((x) => x.optionValue === gymPackageValue)

      return Boolean(p?.includesShirt)
    }

    return false
  }, [eventPayload?.category, packageValue, gymPackageValue, runningChoices, gymChoices])

  const clearParticipantFieldError = useCallback((field) => {
    setParticipantErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const clearFulfillmentFieldError = useCallback((field) => {
    setFulfillmentErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const saveParticipantPayload = async (participantSnapshot = participantForm) => {
    const cat = eventPayload?.category

    const body = {
      participant: { ...participantSnapshot },
      wizard_running_distance: null,
      wizard_gym_program: null,
    }

    if (cat === 'running' && runningChoices) {
      const d = decodeRunningDistance(distanceValue)
      body.wizard_running_distance = {
        distance_key: d.distance_key,
        distance_label: d.distance_label,
      }
    }
    if (cat === 'gym' && gymChoices) {
      const prog = decodeGymProgram(programValue)
      body.wizard_gym_program = {
        program_key: prog.program_key,
        program_label: prog.program_label,
      }
    }

    const res = await apiRequest(`/v1/cms/events/${eventId}/registration/participant`, {
      method: 'PUT',
      body,
    })
    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Could not save participant info.')
    }
  }

  const saveDeliveryPayload = async () => {
    const res = await apiRequest(`/v1/cms/events/${eventId}/registration/delivery`, {
      method: 'PUT',
      body: {
        delivery: {
          area_key: deliveryAreaKey,
          ship_same_as_registration: shipSameAsRegistration,
          delivery_notes: deliveryNotes || null,
          delivery_address_line: shipSameAsRegistration ? null : deliveryAddressLine || null,
          delivery_province: shipSameAsRegistration ? null : deliveryProvince || null,
          delivery_city: shipSameAsRegistration ? null : deliveryCity || null,
          delivery_barangay: shipSameAsRegistration ? null : deliveryBarangay || null,
        },
      },
    })
    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Could not save delivery preferences.')
    }
  }

  const submitRunningSelection = async () => {
    const d = decodeRunningDistance(distanceValue)
    const p = needsPackageSelections ? decodeRunningPackage(packageValue) : decodeRunningPackage('')

    await apiRequest(`/v1/cms/events/${eventId}/running-selection`, {
      method: 'PUT',
      body: {
        distance_key: d.distance_key,
        distance_label: d.distance_label,
        package_key: p.package_key,
        package_label: p.package_label,
        package_includes_shirt: p.package_includes_shirt,
        shirt_size: needsShirt ? shirtSize : null,
      },
    })
  }

  const submitGymSelection = async () => {
    const prog = decodeGymProgram(programValue)
    const pkg = needsPackageSelections ? decodeGymPackage(gymPackageValue) : decodeGymPackage('')

    await apiRequest(`/v1/cms/events/${eventId}/gym-selection`, {
      method: 'PUT',
      body: {
        program_key: prog.program_key,
        program_label: prog.program_label,
        package_key: pkg.package_key,
        package_label: pkg.package_label,
        package_includes_shirt: pkg.package_includes_shirt,
        shirt_size: needsShirt ? shirtSize : null,
      },
    })
  }

  const goNext = async () => {
    const step = steps[stepIndex]
    if (!step) return
    setBusy(true)

    try {
      if (step === 'participant') {
        const { errors: pErrs, sanitized } = validateParticipantStep(participantForm, {
          accountEmail: accountEmail || undefined,
        })

        const mergedErrs = { ...pErrs }
        if (eventPayload?.category === 'running' && runningChoices) {
          if (!distanceValue?.trim()) {
            mergedErrs.race_distance = 'Choose a race distance.'
          }
        }
        if (eventPayload?.category === 'gym' && gymChoices) {
          if (!programValue?.trim()) {
            mergedErrs.program_focus = 'Choose a programme.'
          }
        }

        setParticipantErrors(mergedErrs)
        if (Object.keys(mergedErrs).length) {
          notifyError('Fix the errors below.')
          return
        }

        setParticipantErrors({})
        setParticipantForm(sanitized)

        await saveParticipantPayload(sanitized)

        if (!needsPackageSelections) {
          if (eventPayload?.category === 'running' && runningChoices) {
            await submitRunningSelection()
          } else if (eventPayload?.category === 'gym' && gymChoices) {
            await submitGymSelection()
          }
        }
      }

      if (step === 'fulfillment') {
        const fe = validateFulfillmentDelivery({
          needsPackageSelections,
          category: eventPayload?.category,
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
        })

        setFulfillmentErrors(fe)
        if (Object.keys(fe).length) {
          notifyError('Fix the errors below.')
          return
        }

        setFulfillmentErrors({})

        const fulfillmentTasks = [saveDeliveryPayload()]
        if (eventPayload?.category === 'running' && runningChoices) {
          fulfillmentTasks.unshift(submitRunningSelection())
        } else if (eventPayload?.category === 'gym' && gymChoices) {
          fulfillmentTasks.unshift(submitGymSelection())
        }
        await Promise.all(fulfillmentTasks)
      }

      if (steps[stepIndex + 1]) {
        const nextStepKey = steps[stepIndex + 1]
        setStepIndex((i) => i + 1)
        if (nextStepKey === 'summary') {
          void refreshRegistrationState()
        }
      }
    } catch (error) {
      const data = error?.response?.data
      const step = steps[stepIndex]

      if (step === 'participant') {
        const flat = laravelErrorsByPrefix(data?.errors || {}, 'participant')
        if (Object.keys(flat).length) setParticipantErrors(flat)
      }
      if (step === 'fulfillment') {
        const dFlat = laravelErrorsByPrefix(data?.errors || {}, 'delivery')
        if (Object.keys(dFlat).length) setFulfillmentErrors((prev) => ({ ...prev, ...dFlat }))
      }

      const msg =
        typeof data?.message === 'string' && data.message.trim()
          ? data.message.trim()
          : error?.response?.status === 422
            ? 'Please fix the form and try again.'
            : 'Could not save — try again.'
      notifyError(msg)
    } finally {
      setBusy(false)
    }
  }

  const goBack = () => {
    setFulfillmentErrors({})
    setStepIndex((i) => Math.max(0, i - 1))
  }

  const leaveRegistrationWizard = () => {
    navigate('/challenges')
  }

  const confirmRegistration = async () => {
    setBusy(true)
    try {
      const res = await apiRequest(`/v1/cms/events/${eventId}/registration/confirm`, {
        method: 'POST',
        body: {},
      })
      if (!res.data?.success) return

      if (res.data?.data?.requires_payment) {
        const redirected = await launchPaymaya({ manageBusy: false })
        if (!redirected) {
          const summaryIdx = steps.indexOf('summary')
          if (summaryIdx >= 0) setStepIndex(summaryIdx)
        }

        return
      }
      notifySuccess(res.data.message || 'You are registered.')
      navigate(`/challenges/${eventId}`)
    } catch (error) {
      const msg = error?.response?.data?.message || 'Confirmation failed.'
      notifyError(msg)
    } finally {
      setBusy(false)
    }
  }

  /** Poll Maya using stored checkout / reference numbers (works after QR pay without redirect). */
  const syncPendingPayment = useCallback(async ({ silent = false } = {}) => {
    if (!eventId) return false

    try {
      const res = await apiRequest(`/v1/cms/events/${eventId}/registration/paymaya/sync`, {
        method: 'POST',
        body: {},
      })
      if (res.data?.success && res.data?.data?.paid) {
        if (!silent) {
          notifySuccess(res.data.message || 'Payment verified. Welcome aboard!')
        }
        navigate(`/challenges/${eventId}`)
        return true
      }
      if (!silent) {
        notifyError(res.data?.message || 'Payment is not finalized yet.')
      }
    } catch (error) {
      if (!silent) {
        notifyError(error?.response?.data?.message || 'Could not verify payment yet.')
      }
    }

    return false
  }, [eventId, navigate])

  /** @returns {Promise<boolean>} true if browser is redirecting to Maya checkout */
  const launchPaymaya = async (options = {}) => {
    const manageBusy = options.manageBusy !== false
    if (manageBusy) setBusy(true)
    try {
      const res = await apiRequest(`/v1/cms/events/${eventId}/registration/paymaya/checkout`, {
        method: 'POST',
        body: {},
      })
      const checkoutId = res.data?.data?.checkout_id
      if (typeof checkoutId === 'string' && checkoutId && eventId) {
        sessionStorage.setItem(paymayaCheckoutStorageKey(eventId), checkoutId)
      }
      const url = res.data?.data?.redirect_url
      if (typeof url === 'string' && url.startsWith('http')) {
        window.location.assign(url)

        return true
      }
      notifyError('Checkout URL was not returned. Check PayMaya configuration on the server.')
      if (eventId) sessionStorage.removeItem(paymayaCheckoutStorageKey(eventId))

      return false
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Could not start payment.')
      if (eventId) sessionStorage.removeItem(paymayaCheckoutStorageKey(eventId))

      return false
    } finally {
      if (manageBusy) setBusy(false)
    }
  }

  useLayoutEffect(() => {
    if (!eventId) return

    const p = searchParams.get('payment')
    if (p !== 'cancelled' && p !== 'failed') return

    const summaryIdx = steps.indexOf('summary')

    if (p === 'cancelled') {
      sessionStorage.setItem(skipPayResumeStorageKey(eventId), '1')
      const participantIdx = steps.indexOf('participant')
      setStepIndex(participantIdx >= 0 ? participantIdx : 0)
      notifySuccess('Checkout cancelled.')
    } else if (p === 'failed') {
      sessionStorage.removeItem(skipPayResumeStorageKey(eventId))
      checkoutResumeHydratedRef.current = false
      if (summaryIdx >= 0) setStepIndex(summaryIdx)
      notifyError('Payment failed or declined. Review your summary and try again.')
    }

    setSearchParams({}, { replace: true })
  }, [eventId, searchParams, setSearchParams, steps])

  useEffect(() => {
    if (!eventId) return

    const paymentSuccessHint = searchParams.get('payment') === 'success'

    let checkoutId =
      searchParams.get('checkoutId')
      || searchParams.get('checkout_id')
      || searchParams.get('id')
      || ''

    if (
      (!checkoutId || typeof checkoutId !== 'string')
      && paymentSuccessHint
      && typeof registrationState?.registration?.paymaya_checkout_id === 'string'
    ) {
      checkoutId = registrationState.registration.paymaya_checkout_id
    }

    if ((!checkoutId || typeof checkoutId !== 'string') && eventId) {
      const stored = sessionStorage.getItem(paymayaCheckoutStorageKey(eventId))
      if (stored) checkoutId = stored
    }

    const checkoutHintInUrl = Boolean(
      searchParams.get('checkoutId')
        || searchParams.get('checkout_id')
        || searchParams.get('id'),
    )
    const storedForEvent = Boolean(eventId && sessionStorage.getItem(paymayaCheckoutStorageKey(eventId)))

    const awaitingCheckout =
      registrationState?.registration?.payment_status === 'pending_checkout'
      && registrationState?.registration?.registration_status === 'pending_payment'

    const shouldAttemptVerify =
      awaitingCheckout
      && (paymentSuccessHint || checkoutHintInUrl || storedForEvent)

    if (!shouldAttemptVerify || verifyOnce.current) return

    verifyOnce.current = true
    if (eventId) sessionStorage.removeItem(paymayaCheckoutStorageKey(eventId))

    void (async () => {
      setBusy(true)
      let verifiedPaid = false
      try {
        if (paymentSuccessHint || !checkoutId) {
          verifiedPaid = await syncPendingPayment({ silent: true })
        } else {
          const res = await apiRequest(`/v1/cms/events/${eventId}/registration/paymaya/verify`, {
            method: 'POST',
            body: { checkout_id: checkoutId },
          })
          if (res.data?.success && res.data?.data?.paid) {
            verifiedPaid = true
            notifySuccess(res.data.message || 'Payment verified. Welcome aboard!')
            setSearchParams({}, { replace: true })
            navigate(`/challenges/${eventId}`)
            return
          }
          verifiedPaid = await syncPendingPayment({ silent: true })
        }

        if (verifiedPaid) {
          setSearchParams({}, { replace: true })
          notifySuccess('Payment verified. Welcome aboard!')
          return
        }

        notifyError('Payment is not finalized yet. Tap “Check payment status” if you already paid.')
        setSearchParams({}, { replace: true })
      } catch (error) {
        const synced = await syncPendingPayment({ silent: true })
        if (synced) {
          setSearchParams({}, { replace: true })
          return
        }
        notifyError(error?.response?.data?.message || 'Could not verify payment yet.')
        setSearchParams({}, { replace: true })
      } finally {
        setBusy(false)
        if (!verifiedPaid) verifyOnce.current = false
      }
    })()
  }, [eventId, navigate, registrationState, searchParams, setSearchParams, syncPendingPayment])

  const currentStepKey = steps[stepIndex]

  const participantSummaryBlocks = () => {
    const p = participantForm

    const mobileCanon = normalizePhilippineMobile(p.phone)

    return [
      ['Name', `${p.first_name} ${p.last_name}`.trim()],
      ['Birth date', p.date_of_birth || '—'],
      ['Email', p.email],
      ['Mobile', mobileCanon ? formatPhilippineMobileForDisplay(mobileCanon) : (p.phone || '—')],
      ['Address', `${p.street_address}, Barangay ${p.barangay}, ${p.city}, ${p.province}, ${p.country}`],
    ]
  }

  /** @returns {Array<[string, string]>} */
  const fulfillmentSummaryRows = () => {
    const rows = []
    if (registrationState?.running_selection) {
      const r = registrationState.running_selection
      const dist =
        `${String(r.distance_key || '').toUpperCase()}${r.distance_label ? ` — ${r.distance_label}` : ''}`
      rows.push(['Race distance', dist])
      if (String(r.package_key || '').trim()) {
        const pkg =
          `${String(r.package_key || '').replace(/_/g, ' ')}${r.package_label ? ` — ${r.package_label}` : ''}`
        rows.push(['Package', pkg])
      }
      if (r.shirt_size) rows.push(['Shirt size', String(r.shirt_size)])
    }
    if (registrationState?.gym_selection) {
      const r = registrationState.gym_selection
      rows.push([
        'Program',
        `${String(r.program_key || '')}${r.program_label ? ` — ${r.program_label}` : ''}`,
      ])
      if (String(r.package_key || '').trim()) {
        rows.push([
          'Package',
          `${String(r.package_key || '').replace(/_/g, ' ')}${r.package_label ? ` — ${r.package_label}` : ''}`,
        ])
      }
      if (r.shirt_size) rows.push(['Apparel size', String(r.shirt_size)])
    }
    const d = registrationState?.registration?.delivery_details
    if (d?.area_label) rows.push(['Fulfillment', String(d.area_label)])
    const same = d ? d.ship_same_as_registration !== false : shipSameAsRegistration
    if (!same && d?.delivery_address_line) {
      rows.push([
        'Courier address',
        `${d.delivery_address_line}, ${d.delivery_barangay}, ${d.delivery_city}, ${d.delivery_province}`,
      ])
    }

    return rows
  }

  if (loading) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center registration-flow-loading challenges-page px-3"
        style={{ minHeight: '100vh' }}
      >
        <AppLoadingState hint="Loading registration…" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="container py-4 px-3 px-md-4 challenges-page">
        <div className="challenges-empty mb-3">Could not load this event.</div>
        <Link className="btn btn-outline-brand" to="/challenges">
          Back to events
        </Link>
      </div>
    )
  }

  if (!registrationState?.registration_window_open) {
    return (
      <div className="container py-4 px-3 px-md-4 challenges-page">
        <div className="challenges-empty mb-3">Registration is closed or not active.</div>
        <Link className="btn btn-outline-brand" to={`/challenges/${eventId}`}>Back to event</Link>
      </div>
    )
  }

  const baseRegistrationFee = Number(
    registrationState?.registration?.registration_fee_php ?? eventPayload.fee ?? 0,
  )
  const deliveryFeeSaved = registrationState?.registration?.delivery_fee_snapshot
  const totalPreview =
    registrationState?.registration?.estimated_total_php != null
      ? Number(registrationState.registration.estimated_total_php)
      : deliveryFeeSaved != null
        ? baseRegistrationFee + Number(deliveryFeeSaved)
        : null

  const feeLabel = eventPayload.fee_type === 'paid' ? formatPhp(feePhp) : 'Free'

  const showPaymentUnavailable = registrationState?.needs_payment_setup && feePhp > 0 && eventPayload.fee_type === 'paid'

  const summaryDueTotal = Number(
    totalPreview ?? baseRegistrationFee + Number(deliveryFeeSaved ?? 0),
  )

  const paymentSummaryFulfillmentRows = fulfillmentSummaryRows()
  const summaryFulfillmentHeading = needsPackageSelections ? 'Package & delivery' : 'Event choices'
  const summaryFulfillmentAria = needsPackageSelections
    ? 'Package and delivery'
    : 'Event choices'
  const showFulfillmentSummaryPanel =
    needsPackageSelections || paymentSummaryFulfillmentRows.length > 0

  const deliveryFieldProps = {
    deliveryAreas,
    fulfillmentErrors,
    clearFulfillmentFieldError,
    deliveryAreaKey,
    setDeliveryAreaKey,
    shipSameAsRegistration,
    setShipSameAsRegistration,
    deliveryAddressLine,
    setDeliveryAddressLine,
    deliveryProvince,
    setDeliveryProvince,
    deliveryCity,
    setDeliveryCity,
    deliveryBarangay,
    setDeliveryBarangay,
    deliveryNotes,
    setDeliveryNotes,
  }

  return (
    <div className="challenges-page registration-wizard" style={{ minHeight: '100vh' }}>
      <div className="container py-4 px-3 px-md-4" style={{ maxWidth: 720 }}>
        <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
          <div>
            <h1 className="challenges-title" style={{ fontSize: '1.35rem' }}>{event.name}</h1>
            <p className="challenges-subtitle mb-0">Event registration</p>
          </div>
          <button type="button" className="btn btn-outline-brand btn-sm registration-wizard-cancel" onClick={leaveRegistrationWizard}>
            Cancel
          </button>
        </div>

        {showPaymentUnavailable && (
          <div className="alert alert-warning small registration-wizard-alert">
            Paid registration is unavailable until your admin adds Maya Checkout keys (<code>PAYMAYA_PUBLIC_KEY</code>,
            {' '}<code>PAYMAYA_SECRET_KEY</code>) and <code>FRONTEND_URL</code> on the server.
          </div>
        )}

        <div className="card shadow-sm border rounded-3 p-3 p-md-4 mb-4 registration-wizard-card">
          {currentStepKey === 'participant' && (
            <div>
              <h2 className="h6 fw-bold mb-1 registration-form-section-title">Participant & category</h2>
              <p className="small registration-form-help mb-3">
                Fields marked <span className="text-danger" aria-hidden>*</span> are required.
              </p>
              {eventPayload?.category === 'running' && runningChoices && (
                <div className="mb-3">
                  <label htmlFor="reg-race-distance" className="form-label registration-form-field-label">
                    Race distance <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <select
                    id="reg-race-distance"
                    aria-invalid={!!participantErrors.race_distance}
                    className={`form-select form-control-registration${participantErrors.race_distance ? ' is-invalid' : ''}`}
                    value={distanceValue}
                    onChange={(e) => {
                      clearParticipantFieldError('race_distance')
                      setDistanceValue(e.target.value)
                    }}
                  >
                    <option value="">Select distance…</option>
                    {runningChoices.distancesOffered.map((row) => (
                      <option key={row.optionKey} value={row.optionValue}>{row.label}</option>
                    ))}
                  </select>
                  {participantErrors.race_distance && (
                    <div className="invalid-feedback d-block">{participantErrors.race_distance}</div>
                  )}
                </div>
              )}
              {eventPayload?.category === 'gym' && gymChoices && (
                <div className="mb-3">
                  <label htmlFor="reg-program-focus" className="form-label registration-form-field-label">
                    Program focus <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <select
                    id="reg-program-focus"
                    aria-invalid={!!participantErrors.program_focus}
                    className={`form-select form-control-registration${participantErrors.program_focus ? ' is-invalid' : ''}`}
                    value={programValue}
                    onChange={(e) => {
                      clearParticipantFieldError('program_focus')
                      setProgramValue(e.target.value)
                    }}
                  >
                    <option value="">Select program…</option>
                    {gymChoices.programsOffered.map((row) => (
                      <option key={row.optionKey} value={row.optionValue}>{row.label}</option>
                    ))}
                  </select>
                  {participantErrors.program_focus && (
                    <div className="invalid-feedback d-block">{participantErrors.program_focus}</div>
                  )}
                </div>
              )}
              <div className="row g-3 registration-participant-grid">
                <div className="col-md-6">
                  <label htmlFor="reg-fn" className="form-label registration-form-field-label">
                    First name <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <input
                    id="reg-fn"
                    autoComplete="given-name"
                    className={`form-control form-control-registration${participantErrors.first_name ? ' is-invalid' : ''}`}
                    value={participantForm.first_name}
                    onChange={(e) => {
                      clearParticipantFieldError('first_name')
                      setParticipantForm((p) => ({ ...p, first_name: e.target.value }))
                    }}
                  />
                  {participantErrors.first_name && (
                    <div className="invalid-feedback d-block">{participantErrors.first_name}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label htmlFor="reg-ln" className="form-label registration-form-field-label">
                    Last name <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <input
                    id="reg-ln"
                    autoComplete="family-name"
                    className={`form-control form-control-registration${participantErrors.last_name ? ' is-invalid' : ''}`}
                    value={participantForm.last_name}
                    onChange={(e) => {
                      clearParticipantFieldError('last_name')
                      setParticipantForm((p) => ({ ...p, last_name: e.target.value }))
                    }}
                  />
                  {participantErrors.last_name && (
                    <div className="invalid-feedback d-block">{participantErrors.last_name}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label htmlFor="reg-dob" className="form-label registration-form-field-label">
                    Birth date <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <input
                    id="reg-dob"
                    type="date"
                    autoComplete="bday"
                    aria-invalid={!!participantErrors.date_of_birth}
                    className={`form-control form-control-registration${participantErrors.date_of_birth ? ' is-invalid' : ''}`}
                    value={participantForm.date_of_birth}
                    onChange={(e) => {
                      clearParticipantFieldError('date_of_birth')
                      setParticipantForm((p) => ({ ...p, date_of_birth: e.target.value }))
                    }}
                  />
                  {participantErrors.date_of_birth && (
                    <div className="invalid-feedback d-block">{participantErrors.date_of_birth}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label htmlFor="reg-email" className="form-label registration-form-field-label">
                    Registered account email <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <p className="form-text registration-form-help mb-1">
                    Must match your login email.
                  </p>
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    readOnly={Boolean(accountEmail)}
                    title={
                      accountEmail
                        ? 'From your account.'
                        : undefined
                    }
                    aria-invalid={!!participantErrors.email}
                    className={`form-control form-control-registration registration-form-email${participantErrors.email ? ' is-invalid' : ''}`}
                    value={participantForm.email}
                    onChange={(e) => {
                      clearParticipantFieldError('email')
                      setParticipantForm((p) => ({ ...p, email: e.target.value }))
                    }}
                  />
                  {participantErrors.email && (
                    <div className="invalid-feedback d-block">{participantErrors.email}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label htmlFor="reg-phone" className="form-label registration-form-field-label">
                    Philippine mobile number <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <p id="reg-phone-help" className="form-text registration-form-help mb-1">{philippineMobileHint}</p>
                  <input
                    id="reg-phone"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="tel-national"
                    maxLength={12}
                    aria-invalid={!!participantErrors.phone}
                    aria-describedby="reg-phone-help"
                    className={`form-control form-control-registration${participantErrors.phone ? ' is-invalid' : ''}`}
                    value={participantForm.phone}
                    onChange={(e) => {
                      clearParticipantFieldError('phone')
                      const next = sanitizePhilippineMobileInput(e.target.value)
                      setParticipantForm((p) => ({ ...p, phone: next }))
                    }}
                    onBlur={() => {
                      const n = normalizePhilippineMobile(participantForm.phone)
                      if (n) setParticipantForm((p) => ({ ...p, phone: n }))
                    }}
                  />
                  {participantErrors.phone && (
                    <div className="invalid-feedback d-block">{participantErrors.phone}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label htmlFor="reg-country" className="form-label registration-form-field-label">
                    Country / territory <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <input
                    id="reg-country"
                    autoComplete="country-name"
                    className={`form-control form-control-registration${participantErrors.country ? ' is-invalid' : ''}`}
                    value={participantForm.country}
                    onChange={(e) => {
                      clearParticipantFieldError('country')
                      setParticipantForm((p) => ({ ...p, country: e.target.value }))
                    }}
                  />
                  {participantErrors.country && (
                    <div className="invalid-feedback d-block">{participantErrors.country}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label htmlFor="reg-street" className="form-label registration-form-field-label">
                    Street address <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <p id="reg-street-help" className="form-text registration-form-help mb-1">
                    Include street or building — not numbers only.
                  </p>
                  <input
                    id="reg-street"
                    autoComplete="street-address"
                    aria-describedby="reg-street-help"
                    className={`form-control form-control-registration${participantErrors.street_address ? ' is-invalid' : ''}`}
                    value={participantForm.street_address}
                    onChange={(e) => {
                      clearParticipantFieldError('street_address')
                      setParticipantForm((p) => ({ ...p, street_address: e.target.value }))
                    }}
                  />
                  {participantErrors.street_address && (
                    <div className="invalid-feedback d-block">{participantErrors.street_address}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label htmlFor="reg-barangay" className="form-label registration-form-field-label">
                    Barangay / district <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <input
                    id="reg-barangay"
                    autoComplete="off"
                    className={`form-control form-control-registration${participantErrors.barangay ? ' is-invalid' : ''}`}
                    value={participantForm.barangay}
                    onChange={(e) => {
                      clearParticipantFieldError('barangay')
                      setParticipantForm((p) => ({ ...p, barangay: e.target.value }))
                    }}
                  />
                  {participantErrors.barangay && (
                    <div className="invalid-feedback d-block">{participantErrors.barangay}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label htmlFor="reg-province" className="form-label registration-form-field-label">
                    Province / region <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <input
                    id="reg-province"
                    autoComplete="address-level1"
                    className={`form-control form-control-registration${participantErrors.province ? ' is-invalid' : ''}`}
                    value={participantForm.province}
                    onChange={(e) => {
                      clearParticipantFieldError('province')
                      setParticipantForm((p) => ({ ...p, province: e.target.value }))
                    }}
                  />
                  {participantErrors.province && (
                    <div className="invalid-feedback d-block">{participantErrors.province}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label htmlFor="reg-city" className="form-label registration-form-field-label">
                    City / municipality <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <input
                    id="reg-city"
                    autoComplete="address-level2"
                    className={`form-control form-control-registration${participantErrors.city ? ' is-invalid' : ''}`}
                    value={participantForm.city}
                    onChange={(e) => {
                      clearParticipantFieldError('city')
                      setParticipantForm((p) => ({ ...p, city: e.target.value }))
                    }}
                  />
                  {participantErrors.city && (
                    <div className="invalid-feedback d-block">{participantErrors.city}</div>
                  )}
                </div>
              </div>

            </div>
          )}

          {currentStepKey === 'fulfillment' && needsPackageSelections && (
            <div>
              <h2 className="h6 fw-bold mb-1 registration-form-section-title">Package & fulfillment</h2>
              <p className="small registration-form-help mb-3">
                Choose your package and delivery, then continue.
              </p>

              {needsPackageSelections && eventPayload?.category === 'running' && runningChoices && (
                <div className="mb-3">
                  <label htmlFor="reg-run-pkg" className="form-label registration-form-field-label">
                    Registration package <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <select
                    id="reg-run-pkg"
                    aria-invalid={!!fulfillmentErrors.package}
                    className={`form-select form-control-registration mb-2${fulfillmentErrors.package ? ' is-invalid' : ''}`}
                    value={packageValue}
                    onChange={(e) => {
                      clearFulfillmentFieldError('package')
                      clearFulfillmentFieldError('shirt_size')
                      setPackageValue(e.target.value)
                      setShirtSize('')
                    }}
                  >
                    <option value="">Select package…</option>
                    {runningChoices.packagesOffered.map((row) => (
                      <option key={row.optionKey} value={row.optionValue}>{row.label}</option>
                    ))}
                  </select>
                  {fulfillmentErrors.package && (
                    <div className="invalid-feedback d-block mb-2">{fulfillmentErrors.package}</div>
                  )}
                  {needsShirt && (
                    <>
                      <label htmlFor="reg-shirt" className="form-label registration-form-field-label mt-2">
                        Shirt size <span className="text-danger" aria-hidden>*</span>
                      </label>
                      <select
                        id="reg-shirt"
                        aria-invalid={!!fulfillmentErrors.shirt_size}
                        className={`form-select form-control-registration${fulfillmentErrors.shirt_size ? ' is-invalid' : ''}`}
                        value={shirtSize}
                        onChange={(e) => {
                          clearFulfillmentFieldError('shirt_size')
                          setShirtSize(e.target.value)
                        }}
                      >
                        <option value="">Select shirt size…</option>
                        {runningChoices.shirtSizesOffered.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {fulfillmentErrors.shirt_size && (
                        <div className="invalid-feedback d-block">{fulfillmentErrors.shirt_size}</div>
                      )}
                    </>
                  )}
                </div>
              )}
              {needsPackageSelections && eventPayload?.category === 'gym' && gymChoices && (
                <div className="mb-3">
                  <label htmlFor="reg-gym-pkg" className="form-label registration-form-field-label">
                    Membership / pass package <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <select
                    id="reg-gym-pkg"
                    aria-invalid={!!fulfillmentErrors.membership_package}
                    className={`form-select form-control-registration mb-2${fulfillmentErrors.membership_package ? ' is-invalid' : ''}`}
                    value={gymPackageValue}
                    onChange={(e) => {
                      clearFulfillmentFieldError('membership_package')
                      clearFulfillmentFieldError('shirt_size')
                      setGymPackageValue(e.target.value)
                      setShirtSize('')
                    }}
                  >
                    <option value="">Select package…</option>
                    {gymChoices.packagesOffered.map((row) => (
                      <option key={row.optionKey} value={row.optionValue}>{row.label}</option>
                    ))}
                  </select>
                  {fulfillmentErrors.membership_package && (
                    <div className="invalid-feedback d-block mb-2">{fulfillmentErrors.membership_package}</div>
                  )}
                  {needsShirt && (
                    <>
                      <label htmlFor="reg-apparel" className="form-label registration-form-field-label mt-2">
                        Apparel size <span className="text-danger" aria-hidden>*</span>
                      </label>
                      <select
                        id="reg-apparel"
                        aria-invalid={!!fulfillmentErrors.shirt_size}
                        className={`form-select form-control-registration${fulfillmentErrors.shirt_size ? ' is-invalid' : ''}`}
                        value={shirtSize}
                        onChange={(e) => {
                          clearFulfillmentFieldError('shirt_size')
                          setShirtSize(e.target.value)
                        }}
                      >
                        <option value="">Select size…</option>
                        {gymChoices.shirtSizesOffered.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {fulfillmentErrors.shirt_size && (
                        <div className="invalid-feedback d-block">{fulfillmentErrors.shirt_size}</div>
                      )}
                    </>
                  )}
                </div>
              )}

              <RegistrationDeliveryFields {...deliveryFieldProps} wrapperClassName="border-top pt-3 mt-2" />
            </div>
          )}

          {currentStepKey === 'summary' && (
            <div className="registration-payment-summary">
              <header className="registration-payment-summary__header">
                <p className="registration-payment-summary__eyebrow">Registration summary</p>
                <h2 className="registration-payment-summary__title">Payment summary</h2>
                <p className="registration-payment-summary__subtitle">
                  Verify the amounts and your details before you confirm or proceed to checkout.
                </p>
              </header>

              <section className="registration-payment-ledger" aria-labelledby="registration-fees-heading">
                <div className="registration-payment-ledger__accent" aria-hidden />
                <h3 id="registration-fees-heading" className="visually-hidden">
                  Fee breakdown
                </h3>
                <table className="registration-payment-table">
                  <tbody>
                    <tr>
                      <th scope="row">Event fee</th>
                      <td>{feeLabel}</td>
                    </tr>
                    {needsPackageSelections && (
                      <tr>
                        <th scope="row">Delivery fee</th>
                        <td>{formatPhp(Number(deliveryFeeSaved ?? 0))}</td>
                      </tr>
                    )}
                    <tr className="registration-payment-table__total">
                      <th scope="row">Total due</th>
                      <td>{formatPhp(summaryDueTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <div className="row g-3 registration-payment-panels">
                <div className="col-md-6">
                  <section className="registration-summary-panel" aria-label="Participant details">
                    <div className="registration-summary-panel__head">
                      <RegSummaryIconUser />
                      <span className="registration-summary-panel__heading">Participant</span>
                    </div>
                    <dl className="registration-summary-dl">
                      {participantSummaryBlocks().map(([k, v]) => (
                        <div key={k} className="registration-summary-dl__row">
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>
                {showFulfillmentSummaryPanel && (
                  <div className="col-md-6">
                    <section className="registration-summary-panel" aria-label={summaryFulfillmentAria}>
                      <div className="registration-summary-panel__head">
                        <RegSummaryIconFulfillment />
                        <span className="registration-summary-panel__heading">{summaryFulfillmentHeading}</span>
                      </div>
                      {summarySyncing && paymentSummaryFulfillmentRows.length === 0 ? (
                        <p className="registration-summary-panel__empty mb-0">
                          Loading registration details…
                        </p>
                      ) : paymentSummaryFulfillmentRows.length === 0 ? (
                        <p className="registration-summary-panel__empty mb-0">
                          No package or delivery lines apply to this registration.
                        </p>
                      ) : (
                        <dl className="registration-summary-dl">
                          {paymentSummaryFulfillmentRows.map(([k, v], idx) => (
                            <div key={`${k}-${idx}`} className="registration-summary-dl__row">
                              <dt>{k}</dt>
                              <dd>{v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </section>
                  </div>
                )}
              </div>

              <div className="registration-payment-cta">
                <button
                  type="button"
                  disabled={busy || showPaymentUnavailable}
                  className="btn btn-primary-brand registration-payment-confirm-btn"
                  onClick={() => confirmRegistration()}
                >
                  {busy
                    ? 'Please wait…'
                    : summaryDueTotal > 0
                      ? 'Confirm & continue to checkout'
                      : 'Confirm registration'}
                </button>
              </div>
            </div>
          )}

        </div>

        {currentStepKey !== 'summary' && (
          <div className="d-flex gap-2 registration-wizard-footer-actions">
            <button type="button" className="btn btn-outline-brand" disabled={busy || stepIndex === 0} onClick={goBack}>Back</button>
            <button type="button" className="btn btn-primary-brand" disabled={busy} onClick={() => goNext()}>
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </div>
        )}

        {currentStepKey === 'summary' && (
          <div className="d-flex gap-2 registration-wizard-footer-actions">
            <button type="button" className="btn btn-outline-brand" disabled={busy} onClick={goBack}>Back</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default EventRegistrationFlow
