import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApiRequest } from '../../utils/adminApi'
import { notifyError } from '../../utils/notifications'
import AppModalTransition from '../../components/AppModalTransition'
import AdminModuleLayout from './AdminModuleLayout'
import AdminCmsTabs from './AdminCmsTabs'
import './AdminMembers.css'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const resolveMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return ''
  const t = url.trim()
  if (!t) return ''
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  if (t.startsWith('/')) return `${API_ORIGIN}${t}`
  return `${API_ORIGIN}/${t}`
}

const formatDt = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

const prettyJson = (value) => {
  if (value == null || (typeof value === 'object' && Object.keys(value).length === 0)) return null
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const getDisplayName = (profile, email) => {
  if (profile?.display_name) return profile.display_name
  const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  if (full) return full
  return email || 'Member'
}

const getInitials = (profile, email) => {
  const name = getDisplayName(profile, email)
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (email || 'M').slice(0, 2).toUpperCase()
}

const formatLocation = (profile) => {
  if (!profile) return '—'
  const parts = [profile.city, profile.province, profile.country].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

const NICHE_OPTIONS = [
  { value: '', label: 'All niches' },
  { value: 'gym', label: 'Gym' },
  { value: 'running', label: 'Running' },
  { value: 'others', label: 'Others' },
]

const AdminMembers = () => {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [onboardingFilter, setOnboardingFilter] = useState('')
  const [nicheFilter, setNicheFilter] = useState('')
  const [detailMember, setDetailMember] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadMembers = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ per_page: '25', page: String(page) })
        if (search.trim()) params.set('search', search.trim())
        if (onboardingFilter) params.set('onboarding', onboardingFilter)
        if (nicheFilter) params.set('niche', nicheFilter)

        const res = await adminApiRequest(`/v1/admin/members?${params.toString()}`, { method: 'GET' })
        const paginator = res.data?.data
        const rows = paginator?.data ?? []
        setMembers(Array.isArray(rows) ? rows : [])
        setMeta({
          current_page: paginator?.current_page ?? 1,
          last_page: paginator?.last_page ?? 1,
          total: paginator?.total ?? rows.length,
        })
      } catch (error) {
        notifyError(error?.response?.data?.message || 'Could not load members.')
        setMembers([])
      } finally {
        setLoading(false)
      }
    },
    [search, onboardingFilter, nicheFilter],
  )

  useEffect(() => {
    loadMembers(1)
  }, [loadMembers])

  const openDetail = async (memberId) => {
    setDetailLoading(true)
    setDetailMember({ id: memberId, loading: true })
    try {
      const res = await adminApiRequest(`/v1/admin/members/${memberId}`, { method: 'GET' })
      const member = res.data?.data?.member
      if (!member) throw new Error('Member not found')
      setDetailMember(member)
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Could not load member details.')
      setDetailMember(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => setDetailMember(null)

  const summaryLabel = useMemo(() => {
    if (loading) return 'Loading member directory…'
    return `${meta.total.toLocaleString()} member${meta.total === 1 ? '' : 's'} registered in the system`
  }, [loading, meta.total])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const profile = detailMember?.profile
  const detailDisplayName = detailMember ? getDisplayName(profile, detailMember.email) : ''
  const avatarUrl = resolveMediaUrl(profile?.profile_picture_url)

  return (
    <AdminModuleLayout
      title="Member directory"
      subtitle="Browse all app members: account info, profile details, onboarding status, and event registrations."
    >
      <AdminCmsTabs />

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <p className="small text-muted mb-0">{summaryLabel}</p>
          </div>
          <form className="row g-3 align-items-end" onSubmit={handleSearchSubmit}>
            <div className="col-12 col-lg-4">
              <label htmlFor="amembers-search" className="form-label small text-muted mb-1">
                Search
              </label>
              <input
                id="amembers-search"
                type="search"
                className="form-control"
                placeholder="Name, email, city, or phone"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="col-6 col-lg-3">
              <label htmlFor="amembers-onboarding" className="form-label small text-muted mb-1">
                Onboarding
              </label>
              <select
                id="amembers-onboarding"
                className="form-select"
                value={onboardingFilter}
                onChange={(e) => setOnboardingFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </div>
            <div className="col-6 col-lg-3">
              <label htmlFor="amembers-niche" className="form-label small text-muted mb-1">
                Primary niche
              </label>
              <select
                id="amembers-niche"
                className="form-select"
                value={nicheFilter}
                onChange={(e) => setNicheFilter(e.target.value)}
              >
                {NICHE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-lg-2">
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                Apply
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 aemembers-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Location</th>
                <th>Profile</th>
                <th>Onboarding</th>
                <th>Activity</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">
                    Loading members…
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">
                    No members match your filters.
                  </td>
                </tr>
              ) : (
                members.map((row) => {
                  const rowProfile = row.profile
                  const name = getDisplayName(rowProfile, row.email)
                  const rowAvatar = resolveMediaUrl(rowProfile?.profile_picture_url)
                  const onboardingDone = rowProfile?.onboarding_completed
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {rowAvatar ? (
                            <img src={rowAvatar} alt="" className="aemembers-avatar" />
                          ) : (
                            <span className="aemembers-avatar aemembers-avatar--placeholder">
                              {getInitials(rowProfile, row.email)}
                            </span>
                          )}
                          <div>
                            <div className="fw-semibold">{name}</div>
                            <div className="small text-muted text-break">{row.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="small">{formatLocation(rowProfile)}</td>
                      <td className="small">
                        <div className="text-capitalize">{rowProfile?.primary_niche || '—'}</div>
                        <div className="text-muted text-capitalize">{rowProfile?.experience_level || '—'}</div>
                        {row.goals?.length ? (
                          <div className="text-muted">{row.goals.map((g) => g.name).join(', ')}</div>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill aemembers-badge--${onboardingDone ? 'completed' : 'incomplete'}`}
                        >
                          {onboardingDone ? 'Completed' : 'Incomplete'}
                        </span>
                        {row.email_verified_at ? (
                          <div className="mt-1">
                            <span className="badge rounded-pill aemembers-badge--verified">Email verified</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="small">
                        <div>{row.event_registrations_count ?? 0} event registration(s)</div>
                        <div className="text-muted">{row.workout_logs_count ?? 0} workout log(s)</div>
                        <div className="text-muted">
                          {row.followers_count ?? 0} followers · {row.following_count ?? 0} following
                        </div>
                      </td>
                      <td className="small text-muted text-nowrap">{formatDt(row.created_at)}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary aemembers-row-action"
                          onClick={() => openDetail(row.id)}
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && meta.last_page > 1 ? (
          <div className="card-footer bg-light d-flex justify-content-between align-items-center py-2">
            <span className="small text-muted">
              Page {meta.current_page} of {meta.last_page} ({meta.total} members)
            </span>
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={meta.current_page <= 1}
                onClick={() => loadMembers(meta.current_page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={meta.current_page >= meta.last_page}
                onClick={() => loadMembers(meta.current_page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <AppModalTransition
        open={Boolean(detailMember)}
        onRequestClose={closeDetail}
        backdropClassName="admin-mt-backdrop"
        panelClassName="admin-mt-panel admin-mt-panel--detail"
      >
        {(dismissDetail) =>
          detailMember ? (
            <>
              <div className="admin-mt-head">
                <h2 className="admin-mt-title mb-0">
                  {detailLoading ? 'Loading member…' : detailDisplayName}
                </h2>
                <button type="button" className="admin-mt-close" onClick={() => dismissDetail()} aria-label="Close">
                  ×
                </button>
              </div>
              <div className="admin-mt-body aemembers-detail-body">
                {detailLoading ? (
                  <p className="text-muted mb-0">Fetching full profile and registration history…</p>
                ) : !detailMember.loading ? (
                  <>
                    <div className="d-flex flex-wrap align-items-start gap-3 mb-4">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="aemembers-avatar" style={{ width: 64, height: 64 }} />
                      ) : (
                        <span
                          className="aemembers-avatar aemembers-avatar--placeholder"
                          style={{ width: 64, height: 64, fontSize: '1.1rem' }}
                        >
                          {getInitials(profile, detailMember.email)}
                        </span>
                      )}
                      <div className="flex-grow-1">
                        <div className="fw-semibold fs-5">{detailDisplayName}</div>
                        <div className="text-muted">{detailMember.email}</div>
                        <div className="small text-muted mt-1">Member ID · {detailMember.id}</div>
                        <div className="d-flex flex-wrap gap-2 mt-2">
                          <span className="aemembers-stat-pill">{detailMember.followers_count ?? 0} followers</span>
                          <span className="aemembers-stat-pill">{detailMember.following_count ?? 0} following</span>
                          <span className="aemembers-stat-pill">{detailMember.workout_logs_count ?? 0} workouts</span>
                          <span className="aemembers-stat-pill">{detailMember.badges_count ?? 0} badges</span>
                          <span className="aemembers-stat-pill">
                            {detailMember.community_memberships_count ?? 0} communities
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="row g-4">
                      <div className="col-12 col-lg-6">
                        <h3 className="aemembers-section-title">Account & registration</h3>
                        <dl className="row small aemembers-dl gx-3 gy-1 mb-0">
                          <div className="col-12">
                            <dt>Email</dt>
                            <dd>{detailMember.email}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Email verified</dt>
                            <dd>{detailMember.email_verified_at ? formatDt(detailMember.email_verified_at) : 'Not verified'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Account created</dt>
                            <dd>{formatDt(detailMember.created_at)}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Last updated</dt>
                            <dd>{formatDt(detailMember.updated_at)}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Onboarding</dt>
                            <dd>
                              {profile?.onboarding_completed ? 'Completed' : 'Incomplete'}
                              {profile?.onboarding_step != null ? ` (step ${profile.onboarding_step})` : ''}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="col-12 col-lg-6">
                        <h3 className="aemembers-section-title">Personal profile</h3>
                        <dl className="row small aemembers-dl gx-3 gy-1 mb-0">
                          <div className="col-6">
                            <dt>First name</dt>
                            <dd>{profile?.first_name || '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Last name</dt>
                            <dd>{profile?.last_name || '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Date of birth</dt>
                            <dd>{formatDate(profile?.date_of_birth)}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Gender</dt>
                            <dd className="text-capitalize">{profile?.gender || '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Phone</dt>
                            <dd>{profile?.phone || '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Timezone</dt>
                            <dd>{profile?.timezone || '—'}</dd>
                          </div>
                          <div className="col-12">
                            <dt>Bio</dt>
                            <dd>{profile?.bio || '—'}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="col-12 col-lg-6">
                        <h3 className="aemembers-section-title">Location & address</h3>
                        <dl className="row small aemembers-dl gx-3 gy-1 mb-0">
                          <div className="col-12">
                            <dt>City / province / country</dt>
                            <dd>{formatLocation(profile)}</dd>
                          </div>
                          <div className="col-12">
                            <dt>Street address</dt>
                            <dd>{profile?.street_address || '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Barangay</dt>
                            <dd>{profile?.barangay || '—'}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="col-12 col-lg-6">
                        <h3 className="aemembers-section-title">Fitness profile</h3>
                        <dl className="row small aemembers-dl gx-3 gy-1 mb-0">
                          <div className="col-6">
                            <dt>Primary niche</dt>
                            <dd className="text-capitalize">{profile?.primary_niche || '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Experience level</dt>
                            <dd className="text-capitalize">{profile?.experience_level || '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Activity level</dt>
                            <dd className="text-capitalize">{profile?.activity_level || '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Height</dt>
                            <dd>{profile?.height_cm != null ? `${profile.height_cm} cm` : '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Current weight</dt>
                            <dd>{profile?.current_weight_kg != null ? `${profile.current_weight_kg} kg` : '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>Target weight</dt>
                            <dd>{profile?.target_weight_kg != null ? `${profile.target_weight_kg} kg` : '—'}</dd>
                          </div>
                          <div className="col-6">
                            <dt>BMI</dt>
                            <dd>
                              {profile?.bmi != null ? `${profile.bmi}${profile?.bmi_category ? ` (${profile.bmi_category})` : ''}` : '—'}
                            </dd>
                          </div>
                          <div className="col-12">
                            <dt>Goals</dt>
                            <dd>
                              {detailMember.goals?.length
                                ? detailMember.goals.map((g) => g.name).join(', ')
                                : '—'}
                            </dd>
                          </div>
                          <div className="col-12">
                            <dt>Secondary niches</dt>
                            <dd>
                              {Array.isArray(profile?.secondary_niches) && profile.secondary_niches.length
                                ? profile.secondary_niches.join(', ')
                                : '—'}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="col-12">
                        <h3 className="aemembers-section-title">
                          Event registrations ({detailMember.event_registrations?.length ?? 0})
                        </h3>
                        {!detailMember.event_registrations?.length ? (
                          <p className="small text-muted mb-0">No event registrations on record.</p>
                        ) : (
                          <div className="table-responsive border rounded">
                            <table className="table table-sm align-middle mb-0 aemembers-reg-table">
                              <thead>
                                <tr>
                                  <th>Event</th>
                                  <th>Registration</th>
                                  <th>Payment</th>
                                  <th>Progress</th>
                                  <th>Registered</th>
                                  <th>Payload</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailMember.event_registrations.map((reg) => {
                                  const pJson = prettyJson(reg.participant_details)
                                  const dJson = prettyJson(reg.delivery_details)
                                  return (
                                    <tr key={reg.id}>
                                      <td className="small">
                                        <div className="fw-semibold">{reg.event?.title || 'Event'}</div>
                                        <div className="text-muted text-capitalize">{reg.event?.status || '—'}</div>
                                        {reg.event?.category ? (
                                          <div className="text-muted">{reg.event.category}</div>
                                        ) : null}
                                      </td>
                                      <td className="small text-capitalize">{reg.registration_status || '—'}</td>
                                      <td className="small">
                                        <span className="text-capitalize">{reg.payment_status || '—'}</span>
                                        {reg.amount_snapshot != null ? (
                                          <div className="text-muted">₱{reg.amount_snapshot}</div>
                                        ) : null}
                                      </td>
                                      <td className="small">
                                        <div>
                                          Logged:{' '}
                                          {reg.progress_logged_km != null
                                            ? `${Number(reg.progress_logged_km).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`
                                            : '—'}
                                        </div>
                                        <div className="text-muted text-capitalize">
                                          {reg.progress_submission_status || '—'}
                                        </div>
                                      </td>
                                      <td className="small text-muted text-nowrap">{formatDt(reg.created_at)}</td>
                                      <td>
                                        {pJson || dJson ? (
                                          <details className="aemembers-details">
                                            <summary>View</summary>
                                            {pJson ? (
                                              <pre className="aemembers-json mb-0 mt-2">{pJson}</pre>
                                            ) : null}
                                            {dJson ? (
                                              <pre className="aemembers-json mb-0 mt-2">{dJson}</pre>
                                            ) : null}
                                          </details>
                                        ) : (
                                          <span className="text-muted small">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="admin-mt-foot admin-mt-foot--single">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => dismissDetail()}>
                  Close
                </button>
              </div>
            </>
          ) : null
        }
      </AppModalTransition>
    </AdminModuleLayout>
  )
}

export default AdminMembers
