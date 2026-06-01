import badgeGold from '../../assets/badges/badge-gold.svg'
import badgeSilver from '../../assets/badges/badge-silver.svg'
import badgeEmerald from '../../assets/badges/badge-emerald.svg'
import badgeMidnight from '../../assets/badges/badge-midnight.svg'

const BADGE_LIBRARY = {
  city_runner: {
    title: 'City Runner',
    imageUrl: badgeGold,
    description: 'Awarded to participants who complete city-course events.',
  },
  ten_k_finisher: {
    title: '10K Finisher',
    imageUrl: badgeGold,
    description: 'Complete an official 10K distance in the event window.',
  },
  weekend_warrior: {
    title: 'Weekend Warrior',
    imageUrl: badgeSilver,
    description: 'Awarded for active weekend challenge participation.',
  },
  consistency_builder: {
    title: 'Consistency Builder',
    imageUrl: badgeSilver,
    description: 'Given to users who consistently complete event activities.',
  },
  trail_starter: {
    title: 'Trail Starter',
    imageUrl: badgeEmerald,
    description: 'For participants who complete a beginner trail event.',
  },
  nature_miles: {
    title: 'Nature Miles',
    imageUrl: badgeEmerald,
    description: 'Recognizes trail and outdoor distance efforts.',
  },
  night_strider: {
    title: 'Night Strider',
    imageUrl: badgeMidnight,
    description: 'Awarded for completing official evening run events.',
  },
  pace_keeper: {
    title: 'Pace Keeper',
    imageUrl: badgeMidnight,
    description: 'Given to athletes who maintain target pace consistency.',
  },
}

/** Profile / CMS: keyed by slug from `admin_events.badges`. */
export const EVENT_BADGE_META = BADGE_LIBRARY

const EVENT_TEMPLATES = [
  {
    title: 'Atleta Manila City Run 10K',
    feePhp: 950,
    rewards: ['Finisher medal', 'Official race singlet', 'Digital certificate'],
    badges: ['ten_k_finisher', 'city_runner'],
    description:
      'Race through the city with a guided pace plan and hydration support stations.',
  },
  {
    title: 'Pinoy Fitness Weekend Warrior',
    feePhp: 650,
    rewards: ['Finisher medal', 'Event shirt', 'Recovery snack pack'],
    badges: ['weekend_warrior', 'consistency_builder'],
    description:
      'A weekend challenge for athletes building consistency with guided workouts and checkpoints.',
  },
  {
    title: 'Atleta Trail Starter 5K',
    feePhp: 550,
    rewards: ['Trail finisher token', 'Energy gel starter pack', 'Community shoutout'],
    badges: ['trail_starter', 'nature_miles'],
    description:
      'Beginner-friendly trail event focused on endurance, technique, and confidence.',
  },
  {
    title: 'Pinoy Fitness Night Run',
    feePhp: 750,
    rewards: ['Glow medal', 'Reflective wristband', 'Photo booth access'],
    badges: ['night_strider', 'pace_keeper'],
    description:
      'Evening run event with safety marshals, hydration booths, and post-run recovery zone.',
  },
]

const hashString = (value = '') => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const formatMoneyPhp = (value) => `PHP ${Number(value || 0).toLocaleString()}`

/** Kit / finisher pack delivery zones (mirrors server RegistrationDeliveryCatalog.builtin) */
export const FALLBACK_DELIVERY_AREAS = [
  { key: 'pickup', label: 'Pickup at venue (PHP 0)', fee_php: 0 },
  { key: 'metro_manila', label: 'Courier — Metro Manila', fee_php: 150 },
  { key: 'luzon', label: 'Courier — Luzon (outside NCR)', fee_php: 200 },
  { key: 'visayas_mindanao', label: 'Courier — Visayas / Mindanao', fee_php: 250 },
]

export const normalizeDeliveryAreas = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return FALLBACK_DELIVERY_AREAS
  }
  const rows = raw
    .map((row) => ({
      key: String(row?.key || '').trim().toLowerCase(),
      label: String(row?.label || row?.key || '').trim() || String(row?.key || ''),
      fee_php: Math.max(0, Number(row?.fee_php ?? 0)),
    }))
    .filter((r) => r.key !== '')
  return rows.length > 0 ? rows : FALLBACK_DELIVERY_AREAS
}

const formatDate = (value) => {
  if (!value) return 'TBA'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'TBA'
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

const formatCategoryLabel = (value) => {
  if (!value) return 'General'
  const normalized = String(value).replace(/[_-]+/g, ' ')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

/** Public event page defaults when CMS omitted or legacy events have no bullets */
export const DEFAULT_EVENT_HOW_IT_WORKS_LINES = [
  'Register before the deadline to secure your slot.',
  'Complete the required distance within the event period.',
  'Upload or log your workout progress in-app to validate participation.',
  'Claim rewards and badges after event verification.',
]

export const DEFAULT_EVENT_PARTICIPANT_RULE_LINES = [
  'One account per participant only.',
  'Entries must be submitted before the registration deadline.',
  'Any misleading or duplicate submissions may be disqualified.',
]

const normalizeStoredBulletLines = (raw) => {
  if (!Array.isArray(raw)) return null
  const lines = raw.map((s) => String(s || '').trim()).filter(Boolean)
  return lines.length ? lines : null
}

/** Progress CTAs for enrolled challenge events (grid, details, profile). */
export const deriveChallengeProgressCtas = ({ challengeProgress, endsAtIso, nowMs = Date.now() }) => {
  const cp = challengeProgress && typeof challengeProgress === 'object' ? challengeProgress : {}
  const pctRaw = cp.percent != null ? Number(cp.percent) : null

  let goalKm = cp.goalKm != null ? Number(cp.goalKm) : null
  if (!Number.isFinite(goalKm) || goalKm <= 0) {
    const m = cp.mileageChallengeKm != null ? Number(cp.mileageChallengeKm) : null
    if (Number.isFinite(m) && m > 0) {
      goalKm = m
    }
  }

  const hasGoal = Number.isFinite(goalKm) && goalKm > 0
  const loggedKm = Number(cp.loggedKm ?? 0)
  const pendingReview = String(cp.submissionStatus || '') === 'pending_review'
  const pendingQueue =
    (Number(cp.pendingQueueKm ?? 0) > 0.0001) || (Number(cp.pendingSubmissionsCount ?? 0) > 0)

  let pctEff = pctRaw != null && Number.isFinite(pctRaw) ? pctRaw : null
  if (hasGoal && !(pctEff != null && Number.isFinite(pctEff))) {
    pctEff = Math.round(Math.min(100, (loggedKm / goalKm) * 100) * 10) / 10
  }

  let eventEnded = false
  if (endsAtIso) {
    const t = new Date(endsAtIso).getTime()
    if (Number.isFinite(t)) {
      eventEnded = nowMs > t
    }
  }

  const KM_DONE_EPS = 0.051
  const goalReachedNumeric = hasGoal && loggedKm + 1e-6 >= goalKm - KM_DONE_EPS
  const goalReachedPct = hasGoal && pctEff != null && pctEff >= 99.5
  const goalMet = goalReachedNumeric || goalReachedPct

  const hasTrail = loggedKm > 0.0001 || pendingQueue || pendingReview

  /** Prefer opening history when the goal is cleared or the event ended with activity logged. */
  const historyPrimary = goalMet || (eventEnded && hasTrail)

  const primary = historyPrimary
    ? {
        kind: 'history',
        label: 'View progress',
      }
    : {
        kind: 'log',
        label: 'Log workout',
      }

  const secondary = historyPrimary
    ? {
        kind: 'log',
        label: 'Log workout',
      }
    : {
        kind: 'history',
        label: 'View progress',
      }

  return { primary, secondary, goalMet, eventEnded, hasTrail, pendingReview }
}

/** Maps `/v1/workouts/stats` joined_challenge_events rows → deriveChallengeProgressCtas input. */
export const joinedChallengeStatsRowToProgress = (ev) => {
  if (!ev || typeof ev !== 'object') return {}
  return {
    loggedKm: Number(ev.progress_logged_km ?? 0),
    goalKm: ev.progress_goal_km != null ? Number(ev.progress_goal_km) : null,
    percent: ev.progress_percent != null ? Number(ev.progress_percent) : null,
    submissionStatus: ev.submission_status ? String(ev.submission_status) : 'none',
    pendingQueueKm: ev.pending_queue_km != null ? Number(ev.pending_queue_km) : 0,
    pendingSubmissionsCount:
      ev.pending_submissions_count != null ? Number(ev.pending_submissions_count) : 0,
    mileageChallengeKm: ev.mileage_challenge_km != null ? Number(ev.mileage_challenge_km) : null,
  }
}

/** True when challenge distance goal is satisfied — exclude from workout link pickers. */
export const isJoinedChallengeGoalCompleted = (ev, nowMs = Date.now()) => {
  const ctas = deriveChallengeProgressCtas({
    challengeProgress: joinedChallengeStatsRowToProgress(ev),
    endsAtIso: ev.ends_at ?? null,
    nowMs,
  })
  return Boolean(ctas.goalMet)
}

/** Mirrors server-side registration window checks for hero + CTA UI */
export const deriveRegistrationPhase = (registrationStartsIso, registrationDeadlineIso, nowMs = Date.now()) => {
  const now = nowMs
  const startMs = registrationStartsIso ? new Date(registrationStartsIso).getTime() : null
  const endMs = registrationDeadlineIso ? new Date(registrationDeadlineIso).getTime() : null

  const startOk = registrationStartsIso && Number.isFinite(startMs)
  const endOk = registrationDeadlineIso && Number.isFinite(endMs)

  if (startOk && now < startMs) {
    return {
      phase: 'not_started',
      heroLabel: 'Registration opens in',
      countdownTargetIso: registrationStartsIso,
      canRegister: false,
    }
  }
  if (endOk && now >= endMs) {
    return {
      phase: 'closed',
      heroLabel: 'Registration closed',
      countdownTargetIso: null,
      canRegister: false,
    }
  }
  if (endOk && now < endMs) {
    return {
      phase: 'open',
      heroLabel: 'Registration closes in',
      countdownTargetIso: registrationDeadlineIso,
      canRegister: true,
    }
  }

  return {
    phase: 'open',
    heroLabel: 'Registration open',
    countdownTargetIso: null,
    canRegister: true,
  }
}

export const formatCountdownTo = (isoDate, nowMs) => {
  if (!isoDate) return '—'
  const targetMs = new Date(isoDate).getTime()
  if (!Number.isFinite(targetMs)) return '—'

  const diffMs = targetMs - nowMs
  if (diffMs <= 0) return 'Now'

  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / (24 * 60 * 60))
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60))
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

const RUNNING_DISTANCE_LABELS = {
  '3k': '3K',
  '5k': '5K',
  '10k': '10K',
  '21k': 'Half marathon (21K)',
  '42k': 'Marathon (42K)',
  other: 'Custom distance',
}

const RUNNING_PACKAGE_LABELS = {
  medal: 'Finisher medal only',
  medal_shirt: 'Medal + event shirt',
  medal_shirt_kit: 'Medal + shirt + race kit',
  other: 'Custom package',
}

const encodeDistanceOptionValue = (d) => {
  if (!d || typeof d !== 'object') return ''
  if (d.key !== 'other') return String(d.key || '')
  return `other|${encodeURIComponent(String(d.label || ''))}`
}

const encodePackageOptionValue = (p) => {
  if (!p || typeof p !== 'object') return ''
  if (p.key !== 'other') return String(p.key || '')
  const inc = p.includesShirt ? '1' : '0'
  return `other|${encodeURIComponent(String(p.label || ''))}|${inc}`
}

const normalizeRunningDetailsRaw = (rd) => {
  if (!rd || typeof rd !== 'object') {
    return { distances: [], packages: [], shirt_sizes: [] }
  }
  if (Array.isArray(rd.distances) || Array.isArray(rd.packages)) {
    return {
      distances: Array.isArray(rd.distances) ? rd.distances : [],
      packages: Array.isArray(rd.packages) ? rd.packages : [],
      shirt_sizes: Array.isArray(rd.shirt_sizes) ? rd.shirt_sizes : [],
    }
  }
  const distances = []
  const dk = String(rd.distance || '').toLowerCase()
  if (dk === 'other' && rd.distance_custom) {
    distances.push({ key: 'other', label: String(rd.distance_custom) })
  } else if (['3k', '5k', '10k', '21k', '42k'].includes(dk)) {
    distances.push({ key: dk })
  }
  const packages = []
  const pk = String(rd.package || '').toLowerCase()
  if (pk === 'other' && rd.package_custom) {
    packages.push({
      key: 'other',
      label: String(rd.package_custom),
      includes_shirt: Boolean(rd.package_includes_shirt),
    })
  } else if (['medal', 'medal_shirt', 'medal_shirt_kit'].includes(pk)) {
    packages.push({ key: pk })
  }
  return {
    distances,
    packages,
    shirt_sizes: Array.isArray(rd.shirt_sizes) ? rd.shirt_sizes : [],
  }
}

const GYM_PROGRAM_LABELS = {
  strength: 'Strength / weights',
  cardio: 'Cardio',
  hiit: 'HIIT',
  classes: 'Group classes',
  hybrid: 'Hybrid training',
  functional: 'Functional fitness',
  other: 'Custom program',
}

const GYM_PACKAGE_LABELS = {
  day_pass: 'Day pass',
  monthly_access: 'Monthly gym access',
  classes_bundle: 'Access + class bundle',
  premium_apparel: 'Premium membership (includes apparel)',
  full_kit: 'Full kit (apparel + extras)',
  other: 'Custom package',
}

const normalizeGymDetailsRaw = (gd) => {
  if (!gd || typeof gd !== 'object') {
    return { programs: [], packages: [], shirt_sizes: [] }
  }
  if (Array.isArray(gd.programs) || Array.isArray(gd.packages)) {
    return {
      programs: Array.isArray(gd.programs) ? gd.programs : [],
      packages: Array.isArray(gd.packages) ? gd.packages : [],
      shirt_sizes: Array.isArray(gd.shirt_sizes) ? gd.shirt_sizes : [],
    }
  }
  const programs = []
  const pk = String(gd.program || '').toLowerCase()
  if (pk === 'other' && gd.program_custom) {
    programs.push({ key: 'other', label: String(gd.program_custom) })
  } else if (['strength', 'cardio', 'hiit', 'classes', 'hybrid', 'functional'].includes(pk)) {
    programs.push({ key: pk })
  }
  const packages = []
  const pkg = String(gd.package || '').toLowerCase()
  if (pkg === 'other' && gd.package_custom) {
    packages.push({
      key: 'other',
      label: String(gd.package_custom),
      includes_shirt: Boolean(gd.package_includes_shirt),
    })
  } else if (['day_pass', 'monthly_access', 'classes_bundle', 'premium_apparel', 'full_kit'].includes(pkg)) {
    packages.push({ key: pkg })
  }
  return {
    programs,
    packages,
    shirt_sizes: Array.isArray(gd.shirt_sizes) ? gd.shirt_sizes : [],
  }
}

/**
 * @param {unknown} raw
 * @param {string} fallbackLabelPrefix
 * @returns {{ title: string, imageUrl: string }[]}
 */
export const parseEventRewardItems = (raw, fallbackLabelPrefix = 'Reward') => {
  if (!Array.isArray(raw) || raw.length === 0) return []

  return raw
    .map((b, idx) => {
      if (!b) return null
      const url = String(b.image_url || b.imageUrl || '').trim()
      if (!url) return null
      const rawTitle = String(b.title || b.label || '').trim()
      return {
        title: rawTitle || `${fallbackLabelPrefix} ${idx + 1}`,
        imageUrl: url,
      }
    })
    .filter(Boolean)
}

export const buildRunningChoices = (community) => {
  if (community?.category !== 'running') return null
  const raw = normalizeRunningDetailsRaw(community?.running_details)
  if (raw.distances.length === 0) return null

  const distancesOffered = raw.distances
    .map((d, idx) => {
      if (!d || typeof d !== 'object') return null
      const k = String(d.key || '').toLowerCase()
      if (k === 'other' && d.label) {
        const label = String(d.label)
        return {
          key: 'other',
          label,
          optionValue: encodeDistanceOptionValue({ key: 'other', label }),
          optionKey: `d-other-${idx}`,
        }
      }
      if (RUNNING_DISTANCE_LABELS[k]) {
        return {
          key: k,
          label: RUNNING_DISTANCE_LABELS[k],
          optionValue: encodeDistanceOptionValue({ key: k }),
          optionKey: `d-${k}`,
        }
      }
      return null
    })
    .filter(Boolean)

  const packagesOffered = raw.packages
    .map((p, idx) => {
      if (!p || typeof p !== 'object') return null
      const k = String(p.key || '').toLowerCase()
      if (k === 'other' && p.label) {
        const label = String(p.label)
        const includesShirt = Boolean(p.includes_shirt)
        return {
          key: 'other',
          label,
          includesShirt,
          optionValue: encodePackageOptionValue({ key: 'other', label, includesShirt }),
          optionKey: `p-other-${idx}-${includesShirt ? '1' : '0'}`,
        }
      }
      if (RUNNING_PACKAGE_LABELS[k]) {
        const includesShirt = k === 'medal_shirt' || k === 'medal_shirt_kit'
        return {
          key: k,
          label: RUNNING_PACKAGE_LABELS[k],
          includesShirt,
          optionValue: encodePackageOptionValue({ key: k, includesShirt }),
          optionKey: `p-${k}`,
        }
      }
      return null
    })
    .filter(Boolean)

  const shirtSizesOffered = raw.shirt_sizes.map((s) => String(s).toUpperCase()).filter(Boolean)
  const needsShirtSize = packagesOffered.some((p) => p.includesShirt)

  return {
    distancesOffered,
    packagesOffered,
    shirtSizesOffered,
    needsShirtSize,
    offeredSummaryLine: [
      distancesOffered.map((d) => d.label).join(' · '),
      packagesOffered.length > 0 ? packagesOffered.map((p) => p.label).join(' · ') : '',
    ]
      .filter(Boolean)
      .join(' — '),
  }
}

const formatRunningSummary = (community) => {
  const c = buildRunningChoices(community)
  if (!c?.offeredSummaryLine) return null
  return c.offeredSummaryLine
}

export const buildGymChoices = (community) => {
  if (community?.category !== 'gym') return null
  const raw = normalizeGymDetailsRaw(community?.gym_details)
  if (raw.programs.length === 0) return null

  const programsOffered = raw.programs
    .map((row, idx) => {
      if (!row || typeof row !== 'object') return null
      const k = String(row.key || '').toLowerCase()
      if (k === 'other' && row.label) {
        const label = String(row.label)
        return {
          key: 'other',
          label,
          optionValue: encodeDistanceOptionValue({ key: 'other', label }),
          optionKey: `g-prog-other-${idx}`,
        }
      }
      if (GYM_PROGRAM_LABELS[k]) {
        return {
          key: k,
          label: GYM_PROGRAM_LABELS[k],
          optionValue: encodeDistanceOptionValue({ key: k }),
          optionKey: `g-prog-${k}`,
        }
      }
      return null
    })
    .filter(Boolean)

  const packagesOffered = raw.packages
    .map((p, idx) => {
      if (!p || typeof p !== 'object') return null
      const k = String(p.key || '').toLowerCase()
      if (k === 'other' && p.label) {
        const label = String(p.label)
        const includesShirt = Boolean(p.includes_shirt)
        return {
          key: 'other',
          label,
          includesShirt,
          optionValue: encodePackageOptionValue({ key: 'other', label, includesShirt }),
          optionKey: `g-pkg-other-${idx}-${includesShirt ? '1' : '0'}`,
        }
      }
      if (GYM_PACKAGE_LABELS[k]) {
        const includesShirt = k === 'premium_apparel' || k === 'full_kit'
        return {
          key: k,
          label: GYM_PACKAGE_LABELS[k],
          includesShirt,
          optionValue: encodePackageOptionValue({ key: k, includesShirt }),
          optionKey: `g-pkg-${k}`,
        }
      }
      return null
    })
    .filter(Boolean)

  const shirtSizesOffered = raw.shirt_sizes.map((s) => String(s).toUpperCase()).filter(Boolean)
  const needsShirtSize = packagesOffered.some((p) => p.includesShirt)

  return {
    programsOffered,
    packagesOffered,
    shirtSizesOffered,
    needsShirtSize,
    offeredSummaryLine: [
      programsOffered.map((d) => d.label).join(' · '),
      packagesOffered.length > 0 ? packagesOffered.map((p) => p.label).join(' · ') : '',
    ]
      .filter(Boolean)
      .join(' — '),
  }
}

const formatGymSummary = (community) => {
  const c = buildGymChoices(community)
  if (!c?.offeredSummaryLine) return null
  return c.offeredSummaryLine
}

export const toEvent = (community) => {
  if (community?.source === 'admin_event' || (community?.title && community?.starts_at)) {
    const title = community?.title || 'Fitness Event'
    const description = community?.description || 'Join this fitness event and stay active.'
    const startsAt = community?.starts_at || null
    const endsAt = community?.ends_at || null
    const registrationOpensIso = community?.registration_starts_at || null
    const registrationClosesIso = community?.registration_deadline || null
    const registrationDeadlineForDisplay = registrationClosesIso || startsAt || null
    const feeValue = Number(community?.fee || 0)
    const category = community?.category || 'other'
    const locationType = community?.location_type || 'online'
    const venue = community?.venue || ''
    const feeType = community?.fee_type || (feeValue > 0 ? 'paid' : 'free')
    const locationLabel = locationType === 'onsite'
      ? (venue || community?.location || 'Onsite Event')
      : (community?.location || (locationType === 'global' ? 'Global Event' : 'Online Event'))

    let badgeItems = parseEventRewardItems(community.badges, 'Badge')
    const trophyItems = parseEventRewardItems(community.trophies, 'Trophy')

    if (!Array.isArray(community.badges)) {
      const fallbackHash = hashString(community?.id || title)
      const badgeGroups = Object.keys(BADGE_LIBRARY)
      badgeItems = [
        BADGE_LIBRARY[badgeGroups[fallbackHash % badgeGroups.length]],
        BADGE_LIBRARY[badgeGroups[(fallbackHash + 3) % badgeGroups.length]],
      ].filter(Boolean)
    }

    const participantPreviewItems = (Array.isArray(community.participants_preview)
      ? community.participants_preview
      : [])
      .map((row) => ({
        clientId: String(row.client_id || '').trim(),
        displayName: String(row.display_name || 'Member').trim() || 'Member',
        initials: String(row.initials || '?').trim().slice(0, 3) || '?',
        pictureUrl: String(row.profile_picture_url || '').trim(),
        registeredAtIso: row.registered_at || null,
      }))
      .filter((row) => row.clientId !== '')

    const participantsTruncated = Boolean(community.participants_truncated)

    return {
      id: community.id,
      name: title,
      description,
      imageUrl: community?.image_url || '',
      location: locationLabel,
      category,
      categoryLabel: formatCategoryLabel(category),
      joinersCount: Number(community?.participants_count || 0),
      registrationOpensIso,
      registrationClosesIso,
      registrationDeadlineIso: registrationDeadlineForDisplay,
      registrationDeadlineLabel: formatDate(registrationDeadlineForDisplay),
      registrationStartsLabel: registrationOpensIso ? formatDate(registrationOpensIso) : 'Open now',
      eventDateLabel: formatDate(startsAt),
      timelineStartLabel: formatDate(startsAt),
      timelineEndLabel: formatDate(endsAt),
      timelineLabel: `${formatDate(startsAt)} - ${formatDate(endsAt)}`,
      feePhp: feeValue,
      feeLabel: feeType === 'free' ? 'Free' : formatMoneyPhp(feeValue),
      rewards: ['Digital certificate', 'Event recognition'],
      badgeItems,
      trophyItems,
      runningChoices: buildRunningChoices(community),
      runningSummary: formatRunningSummary(community),
      gymChoices: buildGymChoices(community),
      gymSummary: formatGymSummary(community),
      deliveryAreas: normalizeDeliveryAreas(community?.delivery_areas),
      isJoined: false,
      isRegistered: Boolean(
        community?.viewer_registration?.confirmed
          ?? community?.viewer_registration?.registered,
      ),
      registrationPendingPayment:
        !Boolean(
          community?.viewer_registration?.confirmed
            ?? community?.viewer_registration?.registered,
        )
        && (community?.viewer_registration?.registration_status === 'pending_payment'
          || community?.viewer_registration?.payment_status === 'pending_checkout'),
      howItWorksLines:
        normalizeStoredBulletLines(community?.how_it_works) ?? DEFAULT_EVENT_HOW_IT_WORKS_LINES,
      participantRulesLines:
        normalizeStoredBulletLines(community?.participant_rules)
        ?? DEFAULT_EVENT_PARTICIPANT_RULE_LINES,
      participantPreviewItems,
      participantsTruncated,
      startsAtIso: startsAt || null,
      endsAtIso: endsAt || null,
      challengeProgress: (() => {
        const cp = community?.viewer_registration?.challenge_progress
        if (!cp || typeof cp !== 'object') return null
        return {
          loggedKm: Number(cp.logged_distance_km ?? 0),
          goalKm: cp.goal_distance_km != null ? Number(cp.goal_distance_km) : null,
          percent: cp.progress_percent != null ? Number(cp.progress_percent) : null,
          targetLabel: cp.target_label ? String(cp.target_label) : null,
          paceMinPerKm: cp.pace_min_per_km != null ? Number(cp.pace_min_per_km) : null,
          submissionStatus: cp.submission_status ? String(cp.submission_status) : 'none',
          pendingQueueKm: cp.pending_queue_km != null ? Number(cp.pending_queue_km) : 0,
          pendingSubmissionsCount:
            cp.pending_submissions_count != null ? Number(cp.pending_submissions_count) : 0,
          mileageChallengeKm:
            cp.mileage_challenge_km != null ? Number(cp.mileage_challenge_km) : null,
        }
      })(),
    }
  }

  const hash = hashString(community?.id || community?.name || 'event')
  const template = EVENT_TEMPLATES[hash % EVENT_TEMPLATES.length]
  const joinedCount = Number(community?.members_count || 0)
  const registrationDaysLeft = (hash % 21) + 5
  const startDaysAhead = registrationDaysLeft + (hash % 14) + 4
  const baseDate = community?.created_at ? new Date(community.created_at) : new Date('2026-01-01T00:00:00Z')
  const safeBaseDate = Number.isNaN(baseDate.getTime()) ? new Date('2026-01-01T00:00:00Z') : baseDate

  const registrationDeadline = new Date(safeBaseDate)
  registrationDeadline.setDate(registrationDeadline.getDate() + registrationDaysLeft)
  registrationDeadline.setHours(23, 59, 59, 0)

  const eventDate = new Date(safeBaseDate)
  eventDate.setDate(eventDate.getDate() + startDaysAhead)
  eventDate.setHours(6, 0, 0, 0)

  const timelineStart = new Date(safeBaseDate)
  timelineStart.setMonth(timelineStart.getMonth(), 1)
  timelineStart.setHours(0, 0, 0, 0)

  const timelineEnd = new Date(timelineStart)
  timelineEnd.setMonth(timelineEnd.getMonth() + 2, 30)
  timelineEnd.setHours(23, 59, 59, 0)

  const badgeItems = (template.badges || [])
    .map((badgeKey) => BADGE_LIBRARY[badgeKey])
    .filter(Boolean)

  return {
    id: community.id,
    // Use event-focused labels even if legacy community names exist in DB.
    name: template.title,
    description: template.description,
    imageUrl: community.cover_image_url || '',
    location: [community.city, community.province].filter(Boolean).join(', ') || 'Online Event',
    category: community?.primary_niche || 'other',
    categoryLabel: formatCategoryLabel(community?.primary_niche || 'other'),
    joinersCount: joinedCount,
    registrationOpensIso: null,
    registrationClosesIso: registrationDeadline.toISOString(),
    registrationDeadlineIso: registrationDeadline.toISOString(),
    registrationDeadlineLabel: formatDate(registrationDeadline),
    registrationStartsLabel: 'Open now',
    eventDateLabel: formatDate(eventDate),
    timelineStartLabel: formatDate(timelineStart),
    timelineEndLabel: formatDate(timelineEnd),
    timelineLabel: `${formatDate(timelineStart)} - ${formatDate(timelineEnd)}`,
    feePhp: template.feePhp,
    feeLabel: formatMoneyPhp(template.feePhp),
    rewards: template.rewards,
    badgeItems,
    trophyItems: [],
    runningChoices: null,
    runningSummary: null,
    gymChoices: null,
    gymSummary: null,
    isJoined: community?.viewer_membership?.status === 'active',
    isRegistered: false,
    registrationPendingPayment: false,
    howItWorksLines: DEFAULT_EVENT_HOW_IT_WORKS_LINES,
    participantRulesLines: DEFAULT_EVENT_PARTICIPANT_RULE_LINES,
    participantPreviewItems: [],
    participantsTruncated: false,
    startsAtIso: timelineStart.toISOString(),
    endsAtIso: timelineEnd.toISOString(),
    challengeProgress: null,
  }
}

