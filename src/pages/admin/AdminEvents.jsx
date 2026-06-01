import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { adminApiRequest } from '../../utils/adminApi'
import { notifyError, notifySuccess } from '../../utils/notifications'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import AdminModuleLayout from './AdminModuleLayout'
import AdminCmsTabs from './AdminCmsTabs'
import './AdminEvents.css'

const DEFAULT_HOW_IT_WORKS = [
  'Register before the deadline to secure your slot.',
  'Complete the required distance within the event period.',
  'Upload or log your workout progress in-app to validate participation.',
  'Claim rewards and badges after event verification.',
]

const DEFAULT_PARTICIPANT_RULES = [
  'One account per participant only.',
  'Entries must be submitted before the registration deadline.',
  'Any misleading or duplicate submissions may be disqualified.',
]

const bulletListFromEventItem = (item, field, fallback) => {
  const v = item?.[field]
  if (!Array.isArray(v)) return [...fallback]
  const lines = v.map((s) => String(s || '').trim()).filter(Boolean)
  return lines.length ? lines : [...fallback]
}

const defaultForm = {
  title: '',
  description: '',
  image_url: '',
  badges: [],
  trophies: [],
  trophy_award_mode: 'all_finishers',
  trophy_top_n: 10,
  location_type: 'online',
  location: '',
  venue: '',
  category: 'running',
  running_preset_distances: ['5k'],
  running_custom_distances: [],
  running_preset_packages: [],
  running_custom_packages: [],
  running_shirt_sizes: [],
  gym_preset_programs: ['strength'],
  gym_custom_programs: [],
  gym_preset_packages: [],
  gym_custom_packages: [],
  gym_shirt_sizes: [],
  registration_starts_at: '',
  registration_deadline: '',
  starts_at: '',
  ends_at: '',
  fee_type: 'free',
  fee: '0',
  status: 'published',
  how_it_works: [...DEFAULT_HOW_IT_WORKS],
  participant_rules: [...DEFAULT_PARTICIPANT_RULES],
}

const EVENT_CATEGORIES = [
  { value: 'running', label: 'Running' },
  { value: 'gym', label: 'Gym' },
  { value: 'biking', label: 'Biking' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'strength', label: 'Strength' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' },
]

const LOCATION_TYPES = [
  { value: 'online', label: 'Online Event' },
  { value: 'global', label: 'Global Event' },
  { value: 'onsite', label: 'Onsite / Physical' },
]

const RUNNING_DISTANCES = [
  { value: '3k', label: '3K' },
  { value: '5k', label: '5K' },
  { value: '10k', label: '10K' },
  { value: '21k', label: 'Half marathon (21K)' },
  { value: '42k', label: 'Marathon (42K)' },
  { value: 'other', label: 'Other (specify)' },
]

const RUNNING_PACKAGES = [
  { value: 'medal', label: 'Finisher medal only' },
  { value: 'medal_shirt', label: 'Medal + event shirt' },
  { value: 'medal_shirt_kit', label: 'Medal + shirt + race kit' },
  { value: 'other', label: 'Other (describe below)' },
]

const GYM_PROGRAMS = [
  { value: 'strength', label: 'Strength / weights' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'classes', label: 'Group classes' },
  { value: 'hybrid', label: 'Hybrid training' },
  { value: 'functional', label: 'Functional fitness' },
  { value: 'other', label: 'Other (specify)' },
]

const GYM_PACKAGES = [
  { value: 'day_pass', label: 'Day pass' },
  { value: 'monthly_access', label: 'Monthly gym access' },
  { value: 'classes_bundle', label: 'Access + class bundle' },
  { value: 'premium_apparel', label: 'Premium membership (includes apparel)' },
  { value: 'full_kit', label: 'Full kit (apparel + extras)' },
  { value: 'other', label: 'Other (describe below)' },
]

const SHIRT_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']

const formRunningAnyShirtPackage = (form) => {
  const pkgs = new Set(form.running_preset_packages || [])
  if (pkgs.has('medal_shirt') || pkgs.has('medal_shirt_kit')) return true
  return (form.running_custom_packages || []).some((row) => (row?.label || '').trim() && row.includes_shirt)
}

const buildRunningDetailsPayload = (form) => {
  if (form.category !== 'running') return null
  const distances = []
  ;(form.running_preset_distances || []).forEach((k) => {
    if (['3k', '5k', '10k', '21k', '42k'].includes(k)) distances.push({ key: k })
  })
  ;(form.running_custom_distances || []).forEach((l) => {
    const t = String(l || '').trim()
    if (t) distances.push({ key: 'other', label: t.slice(0, 64) })
  })
  const packages = []
  ;(form.running_preset_packages || []).forEach((k) => {
    if (['medal', 'medal_shirt', 'medal_shirt_kit'].includes(k)) packages.push({ key: k })
  })
  ;(form.running_custom_packages || []).forEach((row) => {
    const t = (row?.label || '').trim()
    if (t) {
      packages.push({
        key: 'other',
        label: t.slice(0, 120),
        includes_shirt: Boolean(row?.includes_shirt),
      })
    }
  })
  const shirtSizes = formRunningAnyShirtPackage(form) ? [...(form.running_shirt_sizes || [])].sort() : []
  return { distances, packages, shirt_sizes: shirtSizes }
}

const runningDefaultsFromItem = (item) => {
  const rd = item?.running_details && typeof item.running_details === 'object' ? item.running_details : {}
  if (Array.isArray(rd.distances) && rd.distances.length > 0) {
    const presetsD = []
    const customsD = []
    rd.distances.forEach((d) => {
      if (!d || typeof d !== 'object') return
      const k = String(d.key || '').toLowerCase()
      if (k === 'other' && d.label) customsD.push(String(d.label))
      else if (['3k', '5k', '10k', '21k', '42k'].includes(k)) presetsD.push(k)
    })
    const presetsP = []
    const customsP = []
    ;(Array.isArray(rd.packages) ? rd.packages : []).forEach((p) => {
      if (!p || typeof p !== 'object') return
      const k = String(p.key || '').toLowerCase()
      if (k === 'other' && p.label) {
        customsP.push({ label: String(p.label), includes_shirt: Boolean(p.includes_shirt) })
      } else if (['medal', 'medal_shirt', 'medal_shirt_kit'].includes(k)) {
        presetsP.push(k)
      }
    })
    const useDistFallback = presetsD.length === 0 && customsD.length === 0
    return {
      running_preset_distances: useDistFallback ? ['5k'] : presetsD,
      running_custom_distances: customsD,
      running_preset_packages: presetsP,
      running_custom_packages: customsP,
      running_shirt_sizes: Array.isArray(rd.shirt_sizes) ? rd.shirt_sizes.map(String) : [],
    }
  }
  const dist = String(rd.distance || '').toLowerCase()
  const pkg = String(rd.package || '').toLowerCase()
  const presetsD = []
  const customsD = []
  if (['3k', '5k', '10k', '21k', '42k'].includes(dist)) presetsD.push(dist)
  else if (dist === 'other' && rd.distance_custom) customsD.push(String(rd.distance_custom))
  else presetsD.push('5k')
  const presetsP = []
  const customsP = []
  if (['medal', 'medal_shirt', 'medal_shirt_kit'].includes(pkg)) presetsP.push(pkg)
  else if (pkg === 'other' && rd.package_custom) {
    customsP.push({ label: String(rd.package_custom), includes_shirt: Boolean(rd.package_includes_shirt) })
  }
  return {
    running_preset_distances: presetsD,
    running_custom_distances: customsD,
    running_preset_packages: presetsP,
    running_custom_packages: customsP,
    running_shirt_sizes: Array.isArray(rd.shirt_sizes) ? rd.shirt_sizes.map(String) : [],
  }
}

const formGymAnyShirtPackage = (form) => {
  const pkgs = new Set(form.gym_preset_packages || [])
  if (pkgs.has('premium_apparel') || pkgs.has('full_kit')) return true
  return (form.gym_custom_packages || []).some((row) => (row?.label || '').trim() && row.includes_shirt)
}

const buildGymDetailsPayload = (form) => {
  if (form.category !== 'gym') return null
  const programs = []
  ;(form.gym_preset_programs || []).forEach((k) => {
    if (['strength', 'cardio', 'hiit', 'classes', 'hybrid', 'functional'].includes(k)) programs.push({ key: k })
  })
  ;(form.gym_custom_programs || []).forEach((l) => {
    const t = String(l || '').trim()
    if (t) programs.push({ key: 'other', label: t.slice(0, 64) })
  })
  const packages = []
  ;(form.gym_preset_packages || []).forEach((k) => {
    if (['day_pass', 'monthly_access', 'classes_bundle', 'premium_apparel', 'full_kit'].includes(k)) packages.push({ key: k })
  })
  ;(form.gym_custom_packages || []).forEach((row) => {
    const t = (row?.label || '').trim()
    if (t) {
      packages.push({
        key: 'other',
        label: t.slice(0, 120),
        includes_shirt: Boolean(row?.includes_shirt),
      })
    }
  })
  const shirtSizes = formGymAnyShirtPackage(form) ? [...(form.gym_shirt_sizes || [])].sort() : []
  return { programs, packages, shirt_sizes: shirtSizes }
}

const gymDefaultsFromItem = (item) => {
  const gd = item?.gym_details && typeof item.gym_details === 'object' ? item.gym_details : {}
  if (Array.isArray(gd.programs) && gd.programs.length > 0) {
    const presetsP = []
    const customsP = []
    gd.programs.forEach((row) => {
      if (!row || typeof row !== 'object') return
      const k = String(row.key || '').toLowerCase()
      if (k === 'other' && row.label) customsP.push(String(row.label))
      else if (['strength', 'cardio', 'hiit', 'classes', 'hybrid', 'functional'].includes(k)) presetsP.push(k)
    })
    const presetsPk = []
    const customsPk = []
    ;(Array.isArray(gd.packages) ? gd.packages : []).forEach((p) => {
      if (!p || typeof p !== 'object') return
      const k = String(p.key || '').toLowerCase()
      if (k === 'other' && p.label) {
        customsPk.push({ label: String(p.label), includes_shirt: Boolean(p.includes_shirt) })
      } else if (['day_pass', 'monthly_access', 'classes_bundle', 'premium_apparel', 'full_kit'].includes(k)) {
        presetsPk.push(k)
      }
    })
    const useProgFallback = presetsP.length === 0 && customsP.length === 0
    return {
      gym_preset_programs: useProgFallback ? ['strength'] : presetsP,
      gym_custom_programs: customsP,
      gym_preset_packages: presetsPk,
      gym_custom_packages: customsPk,
      gym_shirt_sizes: Array.isArray(gd.shirt_sizes) ? gd.shirt_sizes.map(String) : [],
    }
  }
  const prog = String(gd.program || '').toLowerCase()
  const pkg = String(gd.package || '').toLowerCase()
  const presetsProg = []
  const customsProg = []
  if (['strength', 'cardio', 'hiit', 'classes', 'hybrid', 'functional'].includes(prog)) presetsProg.push(prog)
  else if (prog === 'other' && gd.program_custom) customsProg.push(String(gd.program_custom))
  else presetsProg.push('strength')
  const presetsPkg = []
  const customsPkg = []
  if (['day_pass', 'monthly_access', 'classes_bundle', 'premium_apparel', 'full_kit'].includes(pkg)) presetsPkg.push(pkg)
  else if (pkg === 'other' && gd.package_custom) {
    customsPkg.push({ label: String(gd.package_custom), includes_shirt: Boolean(gd.package_includes_shirt) })
  }
  return {
    gym_preset_programs: presetsProg,
    gym_custom_programs: customsProg,
    gym_preset_packages: presetsPkg,
    gym_custom_packages: customsPkg,
    gym_shirt_sizes: Array.isArray(gd.shirt_sizes) ? gd.shirt_sizes.map(String) : [],
  }
}

const getLocationSummary = (item) => {
  if (item.location_type === 'onsite') return item.venue || item.location || 'Onsite'
  if (item.location_type === 'global') return item.location || 'Global'
  return item.location || 'Online'
}

const toUtcIsoOrNull = (dateTimeLocalValue) => {
  if (!dateTimeLocalValue) return null
  const date = new Date(dateTimeLocalValue)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const validateAdminEventForm = (form) => {
  const errors = {}
  const setErr = (key, msg) => {
    if (!errors[key]) errors[key] = msg
  }

  const title = (form.title || '').trim()
  if (!title) setErr('title', 'Required.')
  else if (title.length < 3) setErr('title', 'Minimum 3 characters.')
  else if (title.length > 180) setErr('title', 'Maximum 180 characters.')

  const desc = (form.description || '').trim()
  if (!desc) setErr('description', 'Required.')
  else if (desc.length < 20) {
    setErr('description', 'Minimum 20 characters.')
  } else if (desc.length > 10000) setErr('description', 'Maximum 10,000 characters.')

  if (!form.category) setErr('category', 'Required.')

  if (!form.location_type) setErr('location_type', 'Required.')

  const location = (form.location || '').trim()
  if (!location) {
    setErr('location', 'Required.')
  } else if (location.length > 180) setErr('location', 'Maximum 180 characters.')

  if (form.location_type === 'onsite') {
    const venue = (form.venue || '').trim()
    if (!venue) setErr('venue', 'Required.')
    else if (venue.length > 180) setErr('venue', 'Maximum 180 characters.')
  }

  const cover = String(form.image_url || '').trim()
  if (!cover) {
    setErr('image_url', 'Required.')
  }

  const howLines = (form.how_it_works || []).map((s) => String(s || '').trim()).filter(Boolean)
  if (howLines.length < 1) {
    setErr('how_it_works', 'At least one entry required.')
  }

  const ruleLines = (form.participant_rules || []).map((s) => String(s || '').trim()).filter(Boolean)
  if (ruleLines.length < 1) {
    setErr('participant_rules', 'At least one entry required.')
  }

  if (!form.registration_starts_at) {
    setErr('registration_starts_at', 'Required.')
  }
  if (!form.registration_deadline) setErr('registration_deadline', 'Required.')
  if (!form.starts_at) setErr('starts_at', 'Required.')
  if (!form.ends_at) setErr('ends_at', 'Required.')

  const regStartTs = form.registration_starts_at ? new Date(form.registration_starts_at).getTime() : null
  const regEndTs = form.registration_deadline ? new Date(form.registration_deadline).getTime() : null
  const startTs = form.starts_at ? new Date(form.starts_at).getTime() : null
  const endTs = form.ends_at ? new Date(form.ends_at).getTime() : null

  const allTimesFinite = [regStartTs, regEndTs, startTs, endTs].every(
    (t) => t != null && Number.isFinite(t),
  )
  if (allTimesFinite) {
    if (regStartTs > regEndTs) {
      setErr('registration_deadline', 'Must be on or after registration opens.')
    }
    if (startTs > endTs) {
      setErr('ends_at', 'Must be on or after event start.')
    }
  }

  if (!form.fee_type) setErr('fee_type', 'Required.')

  if (form.fee_type === 'paid') {
    const feeRaw = String(form.fee ?? '').trim()
    if (feeRaw === '') setErr('fee', 'Required.')
    else {
      const n = Number(feeRaw)
      if (!Number.isFinite(n) || n <= 0) {
        setErr('fee', 'Must be greater than zero.')
      } else if (n > 999999.99) {
        setErr('fee', 'Maximum 999,999.99.')
      }
    }
  }

  if (!form.status) setErr('status', 'Required.')

  if (form.category === 'running') {
    const distCount = (form.running_preset_distances || []).length
      + (form.running_custom_distances || []).filter((l) => String(l || '').trim()).length
    if (distCount === 0) setErr('running_distances', 'At least one distance required.')
    if (formRunningAnyShirtPackage(form) && (!form.running_shirt_sizes || form.running_shirt_sizes.length === 0)) {
      setErr('running_shirt_sizes', 'Shirt size selection required.')
    }
  }

  if (form.category === 'gym') {
    const progCount = (form.gym_preset_programs || []).length
      + (form.gym_custom_programs || []).filter((l) => String(l || '').trim()).length
    if (progCount === 0) setErr('gym_programs', 'At least one program required.')
    if (formGymAnyShirtPackage(form) && (!form.gym_shirt_sizes || form.gym_shirt_sizes.length === 0)) {
      setErr('gym_shirt_sizes', 'Apparel size required.')
    }
  }

  ;(form.badges || []).forEach((b, i) => {
    if (String(b?.image_url || '').trim() && !String(b?.title || '').trim()) {
      setErr(`badge_title_${i}`, 'Required.')
    }
  })

  ;(form.trophies || []).forEach((t, i) => {
    if (String(t?.image_url || '').trim() && !String(t?.title || '').trim()) {
      setErr(`trophy_title_${i}`, 'Required.')
    }
  })

  return { ok: Object.keys(errors).length === 0, errors }
}

const AdminEvents = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingBadgeImage, setUploadingBadgeImage] = useState(false)
  const [uploadingTrophyImage, setUploadingTrophyImage] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isFormClosing, setIsFormClosing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleteClosing, setIsDeleteClosing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const modalScrollRef = useRef(null)

  const dismissError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const normalizeDateTime = (value) => (value ? value.replace(' ', 'T').slice(0, 16) : '')
  const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'TBA')
  const modalRoot = typeof document !== 'undefined' ? document.body : null
  const isEditing = Boolean(editingId)
  const isPaidEvent = form.fee_type === 'paid'
  const locationIsOnsite = form.location_type === 'onsite'
  const publishedCount = useMemo(() => items.filter((item) => item.status === 'published').length, [items])
  const isRunningCategory = form.category === 'running'
  const isGymCategory = form.category === 'gym'

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminApiRequest('/v1/admin/events', { method: 'GET' })
      setItems(res.data?.data?.data || [])
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to load events.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toPayload = () => ({
    title: form.title,
    description: form.description,
    image_url: form.image_url || null,
    location_type: form.location_type,
    location: form.location || null,
    venue: form.venue || null,
    category: form.category || null,
    registration_starts_at: toUtcIsoOrNull(form.registration_starts_at),
    registration_deadline: toUtcIsoOrNull(form.registration_deadline),
    starts_at: toUtcIsoOrNull(form.starts_at),
    ends_at: toUtcIsoOrNull(form.ends_at),
    fee_type: form.fee_type,
    fee: form.fee_type === 'free' ? 0 : form.fee === '' ? 0 : Number(form.fee),
    status: form.status,
    badges: (form.badges || [])
      .filter((b) => b.image_url && String(b.image_url).trim())
      .slice(0, 12)
      .map((b) => ({
        title: (b.title || '').trim() || null,
        image_url: String(b.image_url).trim(),
      })),
    trophies: (form.trophies || [])
      .filter((t) => t.image_url && String(t.image_url).trim())
      .slice(0, 12)
      .map((t) => ({
        title: (t.title || '').trim() || null,
        image_url: String(t.image_url).trim(),
      })),
    trophy_award_mode: form.trophy_award_mode || 'all_finishers',
    trophy_top_n: form.trophy_award_mode === 'top_n' ? Math.min(100, Math.max(1, Number(form.trophy_top_n) || 10)) : 10,
    running_details: buildRunningDetailsPayload(form),
    gym_details: buildGymDetailsPayload(form),
    how_it_works: (form.how_it_works || []).map((s) => String(s || '').trim()).filter(Boolean),
    participant_rules: (form.participant_rules || []).map((s) => String(s || '').trim()).filter(Boolean),
  })

  const submit = async (event) => {
    event.preventDefault()
    const validation = validateAdminEventForm(form)
    if (!validation.ok) {
      setFieldErrors(validation.errors)
      modalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      requestAnimationFrame(() => {
        const firstInvalid = modalScrollRef.current?.querySelector?.('.is-invalid')
        if (firstInvalid && typeof firstInvalid.focus === 'function') firstInvalid.focus()
      })
      return
    }
    setFieldErrors({})
    setSaving(true)
    try {
      const endpoint = editingId ? `/v1/admin/events/${editingId}` : '/v1/admin/events'
      const method = editingId ? 'PUT' : 'POST'
      await adminApiRequest(endpoint, { method, body: toPayload() })
      notifySuccess(editingId ? 'Event updated.' : 'Event created.')
      setEditingId('')
      setForm(defaultForm)
      setFieldErrors({})
      setIsFormOpen(false)
      await load()
    } catch (error) {
      const apiErrors = error?.response?.data?.errors
      if (apiErrors && typeof apiErrors === 'object' && !Array.isArray(apiErrors)) {
        const mapped = {}
        Object.entries(apiErrors).forEach(([k, v]) => {
          const msg = Array.isArray(v) ? v[0] : String(v)
          const badgeMatch = /^badges\.(\d+)\.title$/.exec(k)
          const trophyMatch = /^trophies\.(\d+)\.title$/.exec(k)
          if (badgeMatch) {
            mapped[`badge_title_${badgeMatch[1]}`] = msg
          } else if (trophyMatch) {
            mapped[`trophy_title_${trophyMatch[1]}`] = msg
          } else {
            mapped[k] = msg
          }
        })
        setFieldErrors(mapped)
        modalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
      notifyError(error?.response?.data?.message || 'Failed to save event.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setFieldErrors({})
    setForm({
      ...defaultForm,
      title: item.title || '',
      description: item.description || '',
      image_url: item.image_url || '',
      location_type: item.location_type || 'online',
      location: item.location || '',
      venue: item.venue || '',
      category: item.category || 'running',
      registration_starts_at: normalizeDateTime(item.registration_starts_at),
      registration_deadline: normalizeDateTime(item.registration_deadline),
      starts_at: normalizeDateTime(item.starts_at),
      ends_at: normalizeDateTime(item.ends_at),
      fee_type: item.fee_type || (Number(item.fee || 0) > 0 ? 'paid' : 'free'),
      fee: item.fee != null ? String(item.fee) : '0',
      status: item.status === 'published' ? 'published' : 'draft',
      badges: Array.isArray(item.badges)
        ? item.badges
          .filter((b) => b?.image_url)
          .map((b) => ({
            title: b.title ? String(b.title) : '',
            image_url: String(b.image_url),
          }))
        : [],
      trophies: Array.isArray(item.trophies)
        ? item.trophies
          .filter((t) => t?.image_url)
          .map((t) => ({
            title: t.title ? String(t.title) : '',
            image_url: String(t.image_url),
          }))
        : [],
      trophy_award_mode: item.trophy_award_mode === 'top_n' ? 'top_n' : 'all_finishers',
      trophy_top_n: item.trophy_top_n != null ? Number(item.trophy_top_n) : 10,
      how_it_works: bulletListFromEventItem(item, 'how_it_works', DEFAULT_HOW_IT_WORKS),
      participant_rules: bulletListFromEventItem(item, 'participant_rules', DEFAULT_PARTICIPANT_RULES),
      ...(item.category === 'running' ? runningDefaultsFromItem(item) : {}),
      ...(item.category === 'gym' ? gymDefaultsFromItem(item) : {}),
    })
    setIsFormOpen(true)
  }

  const openCreate = () => {
    setEditingId('')
    setFieldErrors({})
    setForm(defaultForm)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setIsFormClosing(true)
    setTimeout(() => {
      setIsFormOpen(false)
      setIsFormClosing(false)
      setEditingId('')
      setUploadingImage(false)
      setUploadingBadgeImage(false)
      setUploadingTrophyImage(false)
      setFieldErrors({})
      setForm(defaultForm)
    }, 220)
  }

  const closeDeleteModal = () => {
    if (deleting) return
    setIsDeleteClosing(true)
    setTimeout(() => {
      setDeleteTarget(null)
      setIsDeleteClosing(false)
    }, 220)
  }

  const remove = async () => {
    if (!deleteTarget?.id) return
    setDeleting(true)
    try {
      await adminApiRequest(`/v1/admin/events/${deleteTarget.id}`, { method: 'DELETE' })
      notifySuccess('Event deleted.')
      closeDeleteModal()
      await load()
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to delete event.')
    } finally {
      setDeleting(false)
    }
  }

  const uploadImage = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const payload = new FormData()
    payload.append('image', file)
    setUploadingImage(true)
    try {
      const res = await adminApiRequest('/v1/admin/events/upload-image', {
        method: 'POST',
        body: payload,
      })
      const imageUrl = res.data?.data?.image_url || ''
      if (imageUrl) {
        setForm((prev) => ({ ...prev, image_url: imageUrl }))
        dismissError('image_url')
        notifySuccess('Event image uploaded.')
      } else {
        notifyError('Image uploaded but URL was not returned.')
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to upload event image.')
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  const uploadBadgeImage = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if ((form.badges || []).length >= 12) {
      notifyError('You can add at most 12 badge images per event.')
      event.target.value = ''
      return
    }

    const payload = new FormData()
    payload.append('image', file)
    setUploadingBadgeImage(true)
    try {
      const res = await adminApiRequest('/v1/admin/events/upload-badge-image', {
        method: 'POST',
        body: payload,
      })
      const imageUrl = res.data?.data?.image_url || ''
      if (imageUrl) {
        setForm((prev) => ({
          ...prev,
          badges: [...(prev.badges || []), { title: '', image_url: imageUrl }],
        }))
        notifySuccess('Badge image added. Optionally set a label for each badge.')
      } else {
        notifyError('Upload succeeded but no image URL was returned.')
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to upload badge image.')
    } finally {
      setUploadingBadgeImage(false)
      event.target.value = ''
    }
  }

  const updateBulletLine = (field, index, value) => {
    if (field === 'how_it_works') dismissError('how_it_works')
    if (field === 'participant_rules') dismissError('participant_rules')
    setForm((prev) => {
      const rows = [...(prev[field] || [])]
      if (index < 0 || index >= rows.length) return prev
      rows[index] = value
      return { ...prev, [field]: rows }
    })
  }

  const removeBulletLine = (field, index) => {
    if (field === 'how_it_works') dismissError('how_it_works')
    if (field === 'participant_rules') dismissError('participant_rules')
    setForm((prev) => {
      const rows = [...(prev[field] || [])]
      if (rows.length <= 1) return prev
      rows.splice(index, 1)
      return { ...prev, [field]: rows }
    })
  }

  const addBulletLine = (field) => {
    if (field === 'how_it_works') dismissError('how_it_works')
    if (field === 'participant_rules') dismissError('participant_rules')
    setForm((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), ''],
    }))
  }

  const removeBadgeRow = (index) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((k) => {
        if (k.startsWith('badge_title_')) delete next[k]
      })
      return next
    })
    setForm((prev) => ({
      ...prev,
      badges: (prev.badges || []).filter((_, i) => i !== index),
    }))
  }

  const updateBadgeTitle = (index, title) => {
    dismissError(`badge_title_${index}`)
    setForm((prev) => {
      const next = [...(prev.badges || [])]
      if (!next[index]) return prev
      next[index] = { ...next[index], title }
      return { ...prev, badges: next }
    })
  }

  const uploadTrophyImage = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if ((form.trophies || []).length >= 12) {
      notifyError('You can add at most 12 trophy images per event.')
      event.target.value = ''
      return
    }

    const payload = new FormData()
    payload.append('image', file)
    setUploadingTrophyImage(true)
    try {
      const res = await adminApiRequest('/v1/admin/events/upload-trophy-image', {
        method: 'POST',
        body: payload,
      })
      const imageUrl = res.data?.data?.image_url || ''
      if (imageUrl) {
        setForm((prev) => ({
          ...prev,
          trophies: [...(prev.trophies || []), { title: '', image_url: imageUrl }],
        }))
        notifySuccess('Trophy image added. Optionally set a label for each trophy.')
      } else {
        notifyError('Upload succeeded but no image URL was returned.')
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to upload trophy image.')
    } finally {
      setUploadingTrophyImage(false)
      event.target.value = ''
    }
  }

  const removeTrophyRow = (index) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((k) => {
        if (k.startsWith('trophy_title_')) delete next[k]
      })
      return next
    })
    setForm((prev) => ({
      ...prev,
      trophies: (prev.trophies || []).filter((_, i) => i !== index),
    }))
  }

  const updateTrophyTitle = (index, title) => {
    dismissError(`trophy_title_${index}`)
    setForm((prev) => {
      const next = [...(prev.trophies || [])]
      if (!next[index]) return prev
      next[index] = { ...next[index], title }
      return { ...prev, trophies: next }
    })
  }

  return (
    <AdminModuleLayout
      title="Events CMS"
      subtitle="Create events for the main user Events tab."
    >
      <AdminCmsTabs />
      <div className="card border mb-3 admin-events-page-hero">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div>
            <h2 className="h6 mb-1">Manage Events</h2>
            <p className="text-muted small mb-0">
              {publishedCount} published of {items.length} total events
            </p>
          </div>
          <button type="button" className="btn btn-primary-brand" onClick={openCreate}>
            Add New Event
          </button>
        </div>
      </div>

      <div className="card border">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm mb-0 admin-events-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Registration Deadline</th>
                  <th>Event Period</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-3">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-3 text-muted">No events yet.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="fw-semibold">{item.title}</div>
                      <div className="text-muted small">
                        {item.location_type === 'onsite' ? 'Onsite Event' : item.location_type === 'global' ? 'Global Event' : 'Online Event'}
                      </div>
                    </td>
                    <td>{EVENT_CATEGORIES.find((category) => category.value === item.category)?.label || 'Other'}</td>
                    <td>{getLocationSummary(item)}</td>
                    <td>{item.fee_type === 'paid' ? `PHP ${Number(item.fee || 0).toLocaleString()}` : 'Free'}</td>
                    <td><span className={`badge border admin-event-status status-${item.status}`}>{item.status}</span></td>
                    <td>{formatDateTime(item.registration_deadline)}</td>
                    <td>{formatDateTime(item.starts_at)} - {formatDateTime(item.ends_at)}</td>
                    <td className="d-flex gap-2">
                      <button className="btn btn-sm btn-outline-brand" onClick={() => startEdit(item)}>Edit</button>
                      <button className="btn btn-sm admin-events-btn-danger-outline" onClick={() => setDeleteTarget(item)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isFormOpen && modalRoot && createPortal(
        <div
          className={`admin-events-modal-overlay admin-events-modal-overlay--force-light ${isFormClosing ? 'is-closing' : ''}`}
          role="presentation"
          onClick={closeForm}
        >
          <div
            className={`admin-events-modal admin-events-modal--force-light ${isFormClosing ? 'is-closing' : ''}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-event-modal-title"
          >
            <div className="admin-events-modal-header">
              <h3 id="admin-event-modal-title" className="h6 mb-0">
                {isEditing ? 'Edit Event' : 'Create Event'}
              </h3>
              <button type="button" className="btn-close" aria-label="Close" onClick={closeForm} />
            </div>
            <form className="admin-events-form admin-events-modal-form-stack" onSubmit={submit} noValidate>
              <div ref={modalScrollRef} className="admin-events-modal-body">
              <div className="admin-events-form-section">
                <h4 className="admin-events-form-section-title">Event details</h4>
                <div className="admin-events-form-section-grid">
              <label htmlFor="admin-event-title">
                <span>Event title</span>
                <input
                  id="admin-event-title"
                  className={`form-control ${fieldErrors.title ? 'is-invalid' : ''}`}
                  placeholder="e.g., Atleta Manila Night Run 5K"
                  value={form.title}
                  onChange={(event) => {
                    dismissError('title')
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.title)}
                  aria-describedby={fieldErrors.title ? 'admin-event-title-error' : undefined}
                  autoComplete="off"
                />
                {fieldErrors.title && (
                  <div id="admin-event-title-error" className="admin-events-field-error">
                    {fieldErrors.title}
                  </div>
                )}
              </label>
              <label htmlFor="admin-event-category">
                <span>Category</span>
                <select
                  id="admin-event-category"
                  className={`form-select ${fieldErrors.category ? 'is-invalid' : ''}`}
                  value={form.category}
                  onChange={(event) => {
                    dismissError('category')
                    setForm((prev) => ({ ...prev, category: event.target.value }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.category)}
                  aria-describedby={fieldErrors.category ? 'admin-event-category-error' : undefined}
                >
                  {EVENT_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
                {fieldErrors.category && (
                  <div id="admin-event-category-error" className="admin-events-field-error">
                    {fieldErrors.category}
                  </div>
                )}
              </label>
                </div>
              </div>
              {(isRunningCategory || isGymCategory) && (
              <div className="admin-events-form-section">
                <h4 className="admin-events-form-section-title">Category options</h4>
              {isRunningCategory && (
                <div
                  className={`admin-events-running-panel ${fieldErrors.running_distances || fieldErrors.running_packages || fieldErrors.running_shirt_sizes ? 'admin-events-panel-has-error' : ''}`}
                >
                  <div className="admin-events-running-title">Running event options</div>
                  <p className="text-muted small mb-3">
                    Select every distance and package participants may choose from. Add custom lines when needed.
                  </p>

                  <div className="admin-events-form-full">
                    <span className="admin-events-subfield-label d-block mb-2">
                      Race distances offered
                    </span>
                    {fieldErrors.running_distances && (
                      <div className="admin-events-field-error mb-2">{fieldErrors.running_distances}</div>
                    )}
                    <div className={`admin-events-shirt-grid ${fieldErrors.running_distances ? 'admin-events-chip-group-invalid' : ''}`}>
                      {RUNNING_DISTANCES.filter((d) => d.value !== 'other').map((d) => (
                        <label key={d.value} className="admin-events-shirt-chip">
                          <input
                            type="checkbox"
                            checked={(form.running_preset_distances || []).includes(d.value)}
                            onChange={() => {
                              dismissError('running_distances')
                              setForm((prev) => {
                                const set = new Set(prev.running_preset_distances || [])
                                if (set.has(d.value)) set.delete(d.value)
                                else set.add(d.value)
                                return { ...prev, running_preset_distances: Array.from(set) }
                              })
                            }}
                          />
                          <span>{d.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2">
                      <span className="d-block mb-1 small text-muted">Custom distances</span>
                      {(form.running_custom_distances || []).map((line, idx) => (
                        <div key={`cd-${idx}`} className="d-flex gap-2 mb-2">
                          <input
                            className="form-control"
                            placeholder="e.g., 8K fun run, 15K trail"
                            value={line}
                            onChange={(e) => {
                              dismissError('running_distances')
                              const v = e.target.value
                              setForm((prev) => ({
                                ...prev,
                                running_custom_distances: (prev.running_custom_distances || []).map((x, i) => (i === idx ? v : x)),
                              }))
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-brand flex-shrink-0"
                            onClick={() => {
                              dismissError('running_distances')
                              setForm((prev) => ({
                                ...prev,
                                running_custom_distances: (prev.running_custom_distances || []).filter((_, i) => i !== idx),
                              }))
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-brand"
                        onClick={() => {
                          dismissError('running_distances')
                          setForm((prev) => ({
                            ...prev,
                            running_custom_distances: [...(prev.running_custom_distances || []), ''],
                          }))
                        }}
                      >
                        Add custom distance
                      </button>
                    </div>
                  </div>

                  <div className="admin-events-form-full mt-3">
                    <span className="admin-events-subfield-label d-block mb-2">
                      Registration packages offered
                      <small className="text-muted d-block fw-normal">Optional — leave unchecked if this event has no packages.</small>
                    </span>
                    {fieldErrors.running_packages && (
                      <div className="admin-events-field-error mb-2">{fieldErrors.running_packages}</div>
                    )}
                    <div className={`admin-events-shirt-grid ${fieldErrors.running_packages ? 'admin-events-chip-group-invalid' : ''}`}>
                      {RUNNING_PACKAGES.filter((p) => p.value !== 'other').map((p) => (
                        <label key={p.value} className="admin-events-shirt-chip">
                          <input
                            type="checkbox"
                            checked={(form.running_preset_packages || []).includes(p.value)}
                            onChange={() => {
                              dismissError('running_packages')
                              setForm((prev) => {
                                const set = new Set(prev.running_preset_packages || [])
                                if (set.has(p.value)) set.delete(p.value)
                                else set.add(p.value)
                                const nextPresets = Array.from(set)
                                const merged = {
                                  ...prev,
                                  running_preset_packages: nextPresets,
                                }
                                const shirtForm = { ...merged, running_custom_packages: prev.running_custom_packages }
                                if (!formRunningAnyShirtPackage(shirtForm)) {
                                  merged.running_shirt_sizes = []
                                }
                                return merged
                              })
                            }}
                          />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2">
                      <span className="d-block mb-1 small text-muted">Custom packages</span>
                      {(form.running_custom_packages || []).map((row, idx) => (
                        <div key={`cp-${idx}`} className="mb-2 p-2 admin-events-nested-box">
                          <div className="d-flex gap-2 mb-2">
                            <input
                              className="form-control"
                              placeholder="Describe the package (e.g., medal + buff)"
                              value={row?.label || ''}
                              onChange={(e) => {
                                dismissError('running_packages')
                                const v = e.target.value
                                setForm((prev) => ({
                                  ...prev,
                                  running_custom_packages: (prev.running_custom_packages || []).map((r, i) =>
                                    i === idx ? { ...r, label: v } : r,
                                  ),
                                }))
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-brand flex-shrink-0"
                              onClick={() => {
                                dismissError('running_packages')
                                setForm((prev) => {
                                  const nextPkgs = (prev.running_custom_packages || []).filter((_, i) => i !== idx)
                                  const merged = { ...prev, running_custom_packages: nextPkgs }
                                  if (!formRunningAnyShirtPackage(merged)) merged.running_shirt_sizes = []
                                  return merged
                                })
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <label className="admin-events-running-checkbox mb-0">
                            <input
                              type="checkbox"
                              checked={Boolean(row?.includes_shirt)}
                              onChange={(e) => {
                                const checked = e.target.checked
                                dismissError('running_shirt_sizes')
                                dismissError('running_packages')
                                setForm((prev) => {
                                  const nextRows = (prev.running_custom_packages || []).map((r, i) =>
                                    i === idx ? { ...r, includes_shirt: checked } : r,
                                  )
                                  const merged = { ...prev, running_custom_packages: nextRows }
                                  if (!formRunningAnyShirtPackage(merged)) merged.running_shirt_sizes = []
                                  return merged
                                })
                              }}
                            />
                            <span>Package includes an event shirt</span>
                          </label>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-brand"
                        onClick={() => {
                          dismissError('running_packages')
                          setForm((prev) => ({
                            ...prev,
                            running_custom_packages: [...(prev.running_custom_packages || []), { label: '', includes_shirt: false }],
                          }))
                        }}
                      >
                        Add custom package
                      </button>
                    </div>
                  </div>

                  {formRunningAnyShirtPackage(form) && (
                    <div className="admin-events-form-full mt-3">
                      <span className="admin-events-subfield-label d-block mb-2">
                        Shirt sizes offered
                      </span>
                      {fieldErrors.running_shirt_sizes && (
                        <div className="admin-events-field-error mb-2">{fieldErrors.running_shirt_sizes}</div>
                      )}
                      <div className={`admin-events-shirt-grid ${fieldErrors.running_shirt_sizes ? 'admin-events-chip-group-invalid' : ''}`}>
                        {SHIRT_SIZE_OPTIONS.map((size) => (
                          <label key={size} className="admin-events-shirt-chip">
                            <input
                              type="checkbox"
                              checked={(form.running_shirt_sizes || []).includes(size)}
                              onChange={() => {
                                dismissError('running_shirt_sizes')
                                setForm((prev) => {
                                  const next = new Set(prev.running_shirt_sizes || [])
                                  if (next.has(size)) next.delete(size)
                                  else next.add(size)
                                  return { ...prev, running_shirt_sizes: Array.from(next) }
                                })
                              }}
                            />
                            <span>{size}</span>
                          </label>
                        ))}
                      </div>
                      <small className="text-muted d-block mt-1">Select every size participants may choose from.</small>
                    </div>
                  )}
                </div>
              )}
              {isGymCategory && (
                <div
                  className={`admin-events-running-panel ${fieldErrors.gym_programs || fieldErrors.gym_packages || fieldErrors.gym_shirt_sizes ? 'admin-events-panel-has-error' : ''}`}
                >
                  <div className="admin-events-running-title">Gym event options</div>
                  <p className="text-muted small mb-3">
                    Select every program focus and pass or membership package participants may choose from.
                  </p>

                  <div className="admin-events-form-full">
                    <span className="admin-events-subfield-label d-block mb-2">
                      Program focus offered
                    </span>
                    {fieldErrors.gym_programs && (
                      <div className="admin-events-field-error mb-2">{fieldErrors.gym_programs}</div>
                    )}
                    <div className={`admin-events-shirt-grid ${fieldErrors.gym_programs ? 'admin-events-chip-group-invalid' : ''}`}>
                      {GYM_PROGRAMS.filter((d) => d.value !== 'other').map((d) => (
                        <label key={d.value} className="admin-events-shirt-chip">
                          <input
                            type="checkbox"
                            checked={(form.gym_preset_programs || []).includes(d.value)}
                            onChange={() => {
                              dismissError('gym_programs')
                              setForm((prev) => {
                                const set = new Set(prev.gym_preset_programs || [])
                                if (set.has(d.value)) set.delete(d.value)
                                else set.add(d.value)
                                return { ...prev, gym_preset_programs: Array.from(set) }
                              })
                            }}
                          />
                          <span>{d.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2">
                      <span className="d-block mb-1 small text-muted">Custom programs</span>
                      {(form.gym_custom_programs || []).map((line, idx) => (
                        <div key={`gp-${idx}`} className="d-flex gap-2 mb-2">
                          <input
                            className="form-control"
                            placeholder="e.g., Olympic lifting intro, Sports-specific prep"
                            value={line}
                            onChange={(e) => {
                              dismissError('gym_programs')
                              const v = e.target.value
                              setForm((prev) => ({
                                ...prev,
                                gym_custom_programs: (prev.gym_custom_programs || []).map((x, i) => (i === idx ? v : x)),
                              }))
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-brand flex-shrink-0"
                            onClick={() => {
                              dismissError('gym_programs')
                              setForm((prev) => ({
                                ...prev,
                                gym_custom_programs: (prev.gym_custom_programs || []).filter((_, i) => i !== idx),
                              }))
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-brand"
                        onClick={() => {
                          dismissError('gym_programs')
                          setForm((prev) => ({
                            ...prev,
                            gym_custom_programs: [...(prev.gym_custom_programs || []), ''],
                          }))
                        }}
                      >
                        Add custom program
                      </button>
                    </div>
                  </div>

                  <div className="admin-events-form-full mt-3">
                    <span className="admin-events-subfield-label d-block mb-2">
                      Passes &amp; packages offered
                      <small className="text-muted d-block fw-normal">Optional — leave unchecked if this event has no packages.</small>
                    </span>
                    {fieldErrors.gym_packages && (
                      <div className="admin-events-field-error mb-2">{fieldErrors.gym_packages}</div>
                    )}
                    <div className={`admin-events-shirt-grid ${fieldErrors.gym_packages ? 'admin-events-chip-group-invalid' : ''}`}>
                      {GYM_PACKAGES.filter((p) => p.value !== 'other').map((p) => (
                        <label key={p.value} className="admin-events-shirt-chip">
                          <input
                            type="checkbox"
                            checked={(form.gym_preset_packages || []).includes(p.value)}
                            onChange={() => {
                              dismissError('gym_packages')
                              setForm((prev) => {
                                const set = new Set(prev.gym_preset_packages || [])
                                if (set.has(p.value)) set.delete(p.value)
                                else set.add(p.value)
                                const nextPresets = Array.from(set)
                                const merged = {
                                  ...prev,
                                  gym_preset_packages: nextPresets,
                                }
                                const shirtForm = { ...merged, gym_custom_packages: prev.gym_custom_packages }
                                if (!formGymAnyShirtPackage(shirtForm)) {
                                  merged.gym_shirt_sizes = []
                                }
                                return merged
                              })
                            }}
                          />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2">
                      <span className="d-block mb-1 small text-muted">Custom packages</span>
                      {(form.gym_custom_packages || []).map((row, idx) => (
                        <div key={`gcp-${idx}`} className="mb-2 p-2 admin-events-nested-box">
                          <div className="d-flex gap-2 mb-2">
                            <input
                              className="form-control"
                              placeholder="Describe the package"
                              value={row?.label || ''}
                              onChange={(e) => {
                                dismissError('gym_packages')
                                const v = e.target.value
                                setForm((prev) => ({
                                  ...prev,
                                  gym_custom_packages: (prev.gym_custom_packages || []).map((r, i) =>
                                    i === idx ? { ...r, label: v } : r,
                                  ),
                                }))
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-brand flex-shrink-0"
                              onClick={() => {
                                dismissError('gym_packages')
                                setForm((prev) => {
                                  const nextPkgs = (prev.gym_custom_packages || []).filter((_, i) => i !== idx)
                                  const merged = { ...prev, gym_custom_packages: nextPkgs }
                                  if (!formGymAnyShirtPackage(merged)) merged.gym_shirt_sizes = []
                                  return merged
                                })
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <label className="admin-events-running-checkbox mb-0">
                            <input
                              type="checkbox"
                              checked={Boolean(row?.includes_shirt)}
                              onChange={(e) => {
                                const checked = e.target.checked
                                dismissError('gym_shirt_sizes')
                                dismissError('gym_packages')
                                setForm((prev) => {
                                  const nextRows = (prev.gym_custom_packages || []).map((r, i) =>
                                    i === idx ? { ...r, includes_shirt: checked } : r,
                                  )
                                  const merged = { ...prev, gym_custom_packages: nextRows }
                                  if (!formGymAnyShirtPackage(merged)) merged.gym_shirt_sizes = []
                                  return merged
                                })
                              }}
                            />
                            <span>Package includes apparel (shirt)</span>
                          </label>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-brand"
                        onClick={() => {
                          dismissError('gym_packages')
                          setForm((prev) => ({
                            ...prev,
                            gym_custom_packages: [...(prev.gym_custom_packages || []), { label: '', includes_shirt: false }],
                          }))
                        }}
                      >
                        Add custom package
                      </button>
                    </div>
                  </div>

                  {formGymAnyShirtPackage(form) && (
                    <div className="admin-events-form-full mt-3">
                      <span className="admin-events-subfield-label d-block mb-2">
                        Apparel sizes offered
                      </span>
                      {fieldErrors.gym_shirt_sizes && (
                        <div className="admin-events-field-error mb-2">{fieldErrors.gym_shirt_sizes}</div>
                      )}
                      <div className={`admin-events-shirt-grid ${fieldErrors.gym_shirt_sizes ? 'admin-events-chip-group-invalid' : ''}`}>
                        {SHIRT_SIZE_OPTIONS.map((size) => (
                          <label key={`gym-${size}`} className="admin-events-shirt-chip">
                            <input
                              type="checkbox"
                              checked={(form.gym_shirt_sizes || []).includes(size)}
                              onChange={() => {
                                dismissError('gym_shirt_sizes')
                                setForm((prev) => {
                                  const next = new Set(prev.gym_shirt_sizes || [])
                                  if (next.has(size)) next.delete(size)
                                  else next.add(size)
                                  return { ...prev, gym_shirt_sizes: Array.from(next) }
                                })
                              }}
                            />
                            <span>{size}</span>
                          </label>
                        ))}
                      </div>
                      <small className="text-muted d-block mt-1">Select every size participants may choose from.</small>
                    </div>
                  )}
                </div>
              )}
              </div>
              )}
              <div className="admin-events-form-section">
                <h4 className="admin-events-form-section-title">Location</h4>
                <div className="admin-events-form-section-grid">
              <label htmlFor="admin-event-location-type">
                <span>Location type</span>
                <select
                  id="admin-event-location-type"
                  className={`form-select ${fieldErrors.location_type ? 'is-invalid' : ''}`}
                  value={form.location_type}
                  onChange={(event) => {
                    dismissError('location_type')
                    dismissError('venue')
                    setForm((prev) => ({ ...prev, location_type: event.target.value }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.location_type)}
                  aria-describedby={fieldErrors.location_type ? 'admin-event-location-type-error' : undefined}
                >
                  {LOCATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {fieldErrors.location_type && (
                  <div id="admin-event-location-type-error" className="admin-events-field-error">
                    {fieldErrors.location_type}
                  </div>
                )}
              </label>
              <label htmlFor="admin-event-location">
                <span>{locationIsOnsite ? 'City / region' : 'Location label'}</span>
                <input
                  id="admin-event-location"
                  className={`form-control ${fieldErrors.location ? 'is-invalid' : ''}`}
                  placeholder={locationIsOnsite ? 'e.g., Quezon City, NCR' : 'e.g., Online, Nationwide'}
                  value={form.location}
                  onChange={(event) => {
                    dismissError('location')
                    setForm((prev) => ({ ...prev, location: event.target.value }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.location)}
                  aria-describedby={fieldErrors.location ? 'admin-event-location-error' : undefined}
                  autoComplete="address-level2"
                />
                {fieldErrors.location && (
                  <div id="admin-event-location-error" className="admin-events-field-error">
                    {fieldErrors.location}
                  </div>
                )}
              </label>
              {locationIsOnsite && (
                <label className="admin-events-span-2" htmlFor="admin-event-venue">
                  <span>Venue / specific place</span>
                  <input
                    id="admin-event-venue"
                    className={`form-control ${fieldErrors.venue ? 'is-invalid' : ''}`}
                    placeholder="e.g., Rizal Memorial Stadium, Manila"
                    value={form.venue}
                    onChange={(event) => {
                      dismissError('venue')
                      setForm((prev) => ({ ...prev, venue: event.target.value }))
                    }}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.venue)}
                    aria-describedby={fieldErrors.venue ? 'admin-event-venue-error' : undefined}
                  />
                  {fieldErrors.venue && (
                    <div id="admin-event-venue-error" className="admin-events-field-error">
                      {fieldErrors.venue}
                    </div>
                  )}
                </label>
              )}
                </div>
              </div>
              <div className="admin-events-form-section">
                <h4 className="admin-events-form-section-title">Description &amp; policies</h4>
                <div className="admin-events-form-section-grid">
              <label className="admin-events-form-full" htmlFor="admin-event-description">
                <span>Public description</span>
                <textarea
                  id="admin-event-description"
                  className={`form-control ${fieldErrors.description ? 'is-invalid' : ''}`}
                  rows={4}
                  placeholder="Write a short event overview, who it is for, and what participants should expect."
                  value={form.description}
                  onChange={(event) => {
                    dismissError('description')
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.description)}
                  aria-describedby={fieldErrors.description ? 'admin-event-description-error' : undefined}
                />
                {fieldErrors.description ? (
                  <div id="admin-event-description-error" className="admin-events-field-error">
                    {fieldErrors.description}
                  </div>
                ) : (
                  <small className="text-muted">20–10,000 characters.</small>
                )}
              </label>
              <label className="admin-events-form-full">
                <span>How this event works</span>
                <small className="text-muted d-block mb-2">One or more lines; each line is a bullet on the public page.</small>
                {fieldErrors.how_it_works && (
                  <div className="admin-events-field-error mb-2">{fieldErrors.how_it_works}</div>
                )}
                {(form.how_it_works || []).map((line, index) => (
                  <div key={`how-it-works-${index}`} className="d-flex gap-2 align-items-center mb-2">
                    <input
                      className={`form-control ${fieldErrors.how_it_works ? 'is-invalid' : ''}`}
                      type="text"
                      value={line}
                      placeholder="Describe a participation step..."
                      onChange={(e) => updateBulletLine('how_it_works', index, e.target.value)}
                      aria-invalid={Boolean(fieldErrors.how_it_works)}
                    />
                    <button
                      type="button"
                      className="btn btn-sm admin-events-btn-danger-outline flex-shrink-0"
                      disabled={(form.how_it_works || []).length <= 1}
                      onClick={() => removeBulletLine('how_it_works', index)}
                      aria-label="Remove step"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-outline-brand" onClick={() => addBulletLine('how_it_works')}>
                  Add step
                </button>
              </label>
              <label className="admin-events-form-full">
                <span>Participant rules</span>
                <small className="text-muted d-block mb-2">One or more lines shown under Rules on the event page.</small>
                {fieldErrors.participant_rules && (
                  <div className="admin-events-field-error mb-2">{fieldErrors.participant_rules}</div>
                )}
                {(form.participant_rules || []).map((line, index) => (
                  <div key={`participant-rule-${index}`} className="d-flex gap-2 align-items-center mb-2">
                    <input
                      className={`form-control ${fieldErrors.participant_rules ? 'is-invalid' : ''}`}
                      type="text"
                      value={line}
                      placeholder="e.g., One account per participant only."
                      onChange={(e) => updateBulletLine('participant_rules', index, e.target.value)}
                      aria-invalid={Boolean(fieldErrors.participant_rules)}
                    />
                    <button
                      type="button"
                      className="btn btn-sm admin-events-btn-danger-outline flex-shrink-0"
                      disabled={(form.participant_rules || []).length <= 1}
                      onClick={() => removeBulletLine('participant_rules', index)}
                      aria-label="Remove rule"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-outline-brand" onClick={() => addBulletLine('participant_rules')}>
                  Add rule
                </button>
              </label>
                </div>
              </div>
              <div className="admin-events-form-section">
                <h4 className="admin-events-form-section-title">Media</h4>
                <div className="admin-events-form-section-grid">
              <label className={`admin-events-form-full ${fieldErrors.image_url ? 'admin-events-upload-invalid' : ''}`}>
                <span>Event cover image</span>
                {fieldErrors.image_url && (
                  <div className="admin-events-field-error mb-2">{fieldErrors.image_url}</div>
                )}
                <div className="admin-events-upload-wrap">
                  <div className={`admin-events-image-preview ${fieldErrors.image_url ? 'border-danger' : ''}`}>
                    {form.image_url ? (
                      <img src={resolveMediaUrl(form.image_url)} alt="Event preview" />
                    ) : (
                      <div className="admin-events-image-placeholder">No image uploaded</div>
                    )}
                  </div>
                  <div className="admin-events-upload-actions">
                    <label className="btn btn-sm btn-outline-brand mb-0">
                      {uploadingImage ? 'Uploading...' : 'Upload image'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        hidden
                        onChange={uploadImage}
                        disabled={uploadingImage}
                      />
                    </label>
                    {form.image_url && (
                      <button
                        type="button"
                        className="btn btn-outline-brand"
                        onClick={() => {
                          dismissError('image_url')
                          setForm((prev) => ({ ...prev, image_url: '' }))
                        }}
                      >
                        Remove
                      </button>
                    )}
                <small className="text-muted">PNG, JPG, or WebP. Recommended 1200×630.</small>
                  </div>
                </div>
              </label>
              <label className="admin-events-form-full">
                <span>Event badge images</span>
                <small className="text-muted d-block mb-2">Optional. If used, each image needs a label.</small>
                <div className="admin-events-badge-list">
                  {(form.badges || []).map((row, index) => (
                    <div key={`${row.image_url}-${index}`} className="admin-events-badge-row">
                      <div className="admin-events-badge-thumb">
                        {row.image_url ? (
                          <img src={resolveMediaUrl(row.image_url)} alt="" />
                        ) : (
                          <div className="admin-events-image-placeholder">No image</div>
                        )}
                      </div>
                      <div className="admin-events-badge-fields w-100">
                        <input
                          id={`admin-event-badge-title-${index}`}
                          className={`form-control form-control-sm ${fieldErrors[`badge_title_${index}`] ? 'is-invalid' : ''}`}
                          placeholder="Badge label"
                          value={row.title}
                          onChange={(e) => updateBadgeTitle(index, e.target.value)}
                          aria-invalid={Boolean(fieldErrors[`badge_title_${index}`])}
                          aria-describedby={fieldErrors[`badge_title_${index}`] ? `admin-event-badge-title-${index}-err` : undefined}
                        />
                        {fieldErrors[`badge_title_${index}`] && (
                          <div
                            id={`admin-event-badge-title-${index}-err`}
                            className="admin-events-field-error"
                          >
                            {fieldErrors[`badge_title_${index}`]}
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm admin-events-btn-danger-outline"
                          onClick={() => removeBadgeRow(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="admin-events-upload-actions mt-2">
                  <label className="btn btn-sm btn-outline-brand mb-0">
                    {uploadingBadgeImage ? 'Uploading...' : 'Add badge image'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      hidden
                      onChange={uploadBadgeImage}
                      disabled={uploadingBadgeImage || (form.badges || []).length >= 12}
                    />
                  </label>
                  {(form.badges || []).length >= 12 && (
                    <small className="text-muted">Maximum of 12 badge images reached.</small>
                  )}
                </div>
              </label>

              <label className="admin-events-form-full">
                <span>Event trophy images</span>
                <small className="text-muted d-block mb-2">
                  Optional. Shown on member profiles based on the award rule below.
                </small>
                <div className="admin-events-trophy-award-row mb-3">
                  <label htmlFor="admin-event-trophy-award-mode" className="admin-events-inline-label">
                    <span>Trophy award rule</span>
                    <select
                      id="admin-event-trophy-award-mode"
                      className={`form-select form-select-sm ${fieldErrors.trophy_award_mode ? 'is-invalid' : ''}`}
                      value={form.trophy_award_mode || 'all_finishers'}
                      onChange={(e) => {
                        dismissError('trophy_award_mode')
                        dismissError('trophy_top_n')
                        setForm((prev) => ({ ...prev, trophy_award_mode: e.target.value }))
                      }}
                    >
                      <option value="all_finishers">All who finish (100% progress)</option>
                      <option value="top_n">Top finishers only (leaderboard rank)</option>
                    </select>
                  </label>
                  {form.trophy_award_mode === 'top_n' && (
                    <label htmlFor="admin-event-trophy-top-n" className="admin-events-inline-label">
                      <span>Top N</span>
                      <input
                        id="admin-event-trophy-top-n"
                        type="number"
                        min={1}
                        max={100}
                        className={`form-control form-control-sm ${fieldErrors.trophy_top_n ? 'is-invalid' : ''}`}
                        value={form.trophy_top_n ?? 10}
                        onChange={(e) => {
                          dismissError('trophy_top_n')
                          setForm((prev) => ({ ...prev, trophy_top_n: e.target.value }))
                        }}
                      />
                    </label>
                  )}
                </div>
                {fieldErrors.trophy_top_n && (
                  <div className="admin-events-field-error mb-2">{fieldErrors.trophy_top_n}</div>
                )}
                <div className="admin-events-badge-list">
                  {(form.trophies || []).map((row, index) => (
                    <div key={`trophy-${row.image_url}-${index}`} className="admin-events-badge-row">
                      <div className="admin-events-badge-thumb admin-events-trophy-thumb">
                        {row.image_url ? (
                          <img src={resolveMediaUrl(row.image_url)} alt="" />
                        ) : (
                          <div className="admin-events-image-placeholder">No image</div>
                        )}
                      </div>
                      <div className="admin-events-badge-fields w-100">
                        <input
                          id={`admin-event-trophy-title-${index}`}
                          className={`form-control form-control-sm ${fieldErrors[`trophy_title_${index}`] ? 'is-invalid' : ''}`}
                          placeholder="Trophy label"
                          value={row.title}
                          onChange={(e) => updateTrophyTitle(index, e.target.value)}
                          aria-invalid={Boolean(fieldErrors[`trophy_title_${index}`])}
                          aria-describedby={fieldErrors[`trophy_title_${index}`] ? `admin-event-trophy-title-${index}-err` : undefined}
                        />
                        {fieldErrors[`trophy_title_${index}`] && (
                          <div
                            id={`admin-event-trophy-title-${index}-err`}
                            className="admin-events-field-error"
                          >
                            {fieldErrors[`trophy_title_${index}`]}
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm admin-events-btn-danger-outline"
                          onClick={() => removeTrophyRow(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="admin-events-upload-actions mt-2">
                  <label className="btn btn-sm btn-outline-brand mb-0">
                    {uploadingTrophyImage ? 'Uploading...' : 'Add trophy image'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      hidden
                      onChange={uploadTrophyImage}
                      disabled={uploadingTrophyImage || (form.trophies || []).length >= 12}
                    />
                  </label>
                  {(form.trophies || []).length >= 12 && (
                    <small className="text-muted">Maximum of 12 trophy images reached.</small>
                  )}
                </div>
              </label>
                </div>
              </div>
              <div className="admin-events-form-section">
                <h4 className="admin-events-form-section-title">Registration &amp; fees</h4>
                <div className="admin-events-form-section-grid">
              <label htmlFor="admin-event-fee-type">
                <span>Fee type</span>
                <select
                  id="admin-event-fee-type"
                  className={`form-select ${fieldErrors.fee_type ? 'is-invalid' : ''}`}
                  value={form.fee_type}
                  onChange={(event) => {
                    const feeType = event.target.value
                    dismissError('fee_type')
                    dismissError('fee')
                    setForm((prev) => ({ ...prev, fee_type: feeType, fee: feeType === 'free' ? '0' : prev.fee }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.fee_type)}
                  aria-describedby={fieldErrors.fee_type ? 'admin-event-fee-type-error' : undefined}
                >
                  <option value="free">Free Event</option>
                  <option value="paid">Paid Event</option>
                </select>
                {fieldErrors.fee_type && (
                  <div id="admin-event-fee-type-error" className="admin-events-field-error">
                    {fieldErrors.fee_type}
                  </div>
                )}
              </label>
              {isPaidEvent ? (
                <label htmlFor="admin-event-fee">
                  <span>Fee amount (PHP)</span>
                  <input
                    id="admin-event-fee"
                    className={`form-control ${fieldErrors.fee ? 'is-invalid' : ''}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g., 299"
                    value={form.fee}
                    onChange={(event) => {
                      dismissError('fee')
                      setForm((prev) => ({ ...prev, fee: event.target.value }))
                    }}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.fee)}
                    aria-describedby={fieldErrors.fee ? 'admin-event-fee-error' : undefined}
                  />
                  {fieldErrors.fee && (
                    <div id="admin-event-fee-error" className="admin-events-field-error">
                      {fieldErrors.fee}
                    </div>
                  )}
                </label>
              ) : (
                <label htmlFor="admin-event-fee-readonly">
                  <span>Fee amount (PHP)</span>
                  <input
                    id="admin-event-fee-readonly"
                    className="form-control"
                    value="0.00 (free event)"
                    disabled
                    readOnly
                  />
                </label>
              )}
              <label htmlFor="admin-event-status">
                <span>Publication status</span>
                <select
                  id="admin-event-status"
                  className={`form-select ${fieldErrors.status ? 'is-invalid' : ''}`}
                  value={form.status}
                  onChange={(event) => {
                    dismissError('status')
                    setForm((prev) => ({ ...prev, status: event.target.value }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.status)}
                  aria-describedby={fieldErrors.status ? 'admin-event-status-error' : undefined}
                >
                  <option value="draft">Draft (hidden from the app Events tab)</option>
                  <option value="published">Published (visible in the app Events tab)</option>
                </select>
                {fieldErrors.status && (
                  <div id="admin-event-status-error" className="admin-events-field-error">
                    {fieldErrors.status}
                  </div>
                )}
                <small className="text-muted d-block mt-1">Published events appear in the app Events tab.</small>
              </label>
                </div>
              </div>
              <div className="admin-events-form-section">
                <h4 className="admin-events-form-section-title">Schedule</h4>
                <div className="admin-events-form-section-grid">
              <label htmlFor="admin-event-reg-start">
                <span>Registration opens</span>
                <input
                  id="admin-event-reg-start"
                  className={`form-control ${fieldErrors.registration_starts_at ? 'is-invalid' : ''}`}
                  type="datetime-local"
                  value={form.registration_starts_at}
                  onChange={(event) => {
                    dismissError('registration_starts_at')
                    setForm((prev) => ({ ...prev, registration_starts_at: event.target.value }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.registration_starts_at)}
                  aria-describedby={fieldErrors.registration_starts_at ? 'admin-event-reg-start-error' : undefined}
                />
                {fieldErrors.registration_starts_at && (
                  <div id="admin-event-reg-start-error" className="admin-events-field-error">
                    {fieldErrors.registration_starts_at}
                  </div>
                )}
                <small className="text-muted d-block mt-1">When sign-up becomes available to the public.</small>
              </label>
              <label htmlFor="admin-event-reg-deadline">
                <span>Registration deadline</span>
                <input
                  id="admin-event-reg-deadline"
                  className={`form-control ${fieldErrors.registration_deadline ? 'is-invalid' : ''}`}
                  type="datetime-local"
                  value={form.registration_deadline}
                  onChange={(event) => {
                    dismissError('registration_deadline')
                    setForm((prev) => ({ ...prev, registration_deadline: event.target.value }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.registration_deadline)}
                  aria-describedby={fieldErrors.registration_deadline ? 'admin-event-reg-deadline-error' : undefined}
                />
                {fieldErrors.registration_deadline && (
                  <div id="admin-event-reg-deadline-error" className="admin-events-field-error">
                    {fieldErrors.registration_deadline}
                  </div>
                )}
                <small className="text-muted d-block mt-1">Must be on or after registration opens.</small>
              </label>
              <label htmlFor="admin-event-starts">
                <span>Event start</span>
                <input
                  id="admin-event-starts"
                  className={`form-control ${fieldErrors.starts_at ? 'is-invalid' : ''}`}
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) => {
                    dismissError('starts_at')
                    dismissError('ends_at')
                    setForm((prev) => ({ ...prev, starts_at: event.target.value }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.starts_at)}
                  aria-describedby={fieldErrors.starts_at ? 'admin-event-starts-error' : undefined}
                />
                {fieldErrors.starts_at && (
                  <div id="admin-event-starts-error" className="admin-events-field-error">
                    {fieldErrors.starts_at}
                  </div>
                )}
              </label>
              <label htmlFor="admin-event-ends">
                <span>Event end</span>
                <input
                  id="admin-event-ends"
                  className={`form-control ${fieldErrors.ends_at ? 'is-invalid' : ''}`}
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(event) => {
                    dismissError('ends_at')
                    setForm((prev) => ({ ...prev, ends_at: event.target.value }))
                  }}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.ends_at)}
                  aria-describedby={fieldErrors.ends_at ? 'admin-event-ends-error' : undefined}
                />
                {fieldErrors.ends_at && (
                  <div id="admin-event-ends-error" className="admin-events-field-error">
                    {fieldErrors.ends_at}
                  </div>
                )}
                <small className="text-muted d-block mt-1">Must be on or after the event start.</small>
              </label>
                </div>
              </div>
              </div>

              <div className="admin-events-modal-footer">
                <div className="admin-events-modal-actions">
                <button type="button" className="btn btn-outline-brand" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary-brand" disabled={saving}>
                  {saving ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
                </button>
              </div>
              </div>
            </form>
          </div>
        </div>,
        modalRoot
      )}

      {deleteTarget && modalRoot && createPortal(
        <div
          className={`admin-events-modal-overlay admin-events-modal-overlay--force-light ${isDeleteClosing ? 'is-closing' : ''}`}
          role="presentation"
          onClick={closeDeleteModal}
        >
          <div
            className={`admin-events-modal admin-events-modal-sm admin-events-modal--force-light ${isDeleteClosing ? 'is-closing' : ''}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="h6 mb-2">Delete Event</h3>
            <p className="text-muted mb-3">
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>?
            </p>
            <div className="admin-events-modal-actions">
              <button
                type="button"
                className="btn btn-outline-brand"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancel
              </button>
              <button type="button" className="btn admin-events-btn-danger-solid" onClick={remove} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>,
        modalRoot
      )}
    </AdminModuleLayout>
  )
}

export default AdminEvents

