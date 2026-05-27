import React, { useCallback, useEffect, useState } from 'react'
import { adminApiRequest } from '../../utils/adminApi'
import { notifyError, notifySuccess } from '../../utils/notifications'
import AppModalTransition from '../../components/AppModalTransition'
import AdminModuleLayout from './AdminModuleLayout'
import AdminCmsTabs from './AdminCmsTabs'
import './AdminEventProgress.css'

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

const formatKm = (v) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })} km`
}

const formatDurationPieces = (minutes, seconds) => {
  if (minutes == null && (seconds == null || Number(seconds) === 0)) return '—'
  const m = Number(minutes || 0)
  const s = Number(seconds ?? 0)
  if (!Number.isFinite(m) || !Number.isFinite(s)) return '—'
  const total = Math.round(m * 60 + s)
  if (total <= 0 && m <= 0) return '—'
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return mm > 0 ? `${mm} min ${String(ss).padStart(2, '0')} s` : `${ss} s`
}

const fmtIsoLocal = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

const AdminEventProgress = () => {
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [rejecting, setRejecting] = useState(null)
  const [rejectNote, setRejectNote] = useState('')
  const [detailRow, setDetailRow] = useState(null)

  const load = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: statusFilter, per_page: '25', page: String(page) })
      const res = await adminApiRequest(`/v1/admin/event-progress-submissions?${params.toString()}`, {
        method: 'GET',
      })
      const paginator = res.data?.data
      const rows = paginator?.data || []
      setItems(rows)
      setMeta({
        current_page: paginator?.current_page ?? 1,
        last_page: paginator?.last_page ?? 1,
        total: paginator?.total ?? rows.length,
      })
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Could not load progress queue.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load(1)
  }, [load])

  const approve = async (id) => {
    if (!id || busyId) return
    setBusyId(id)
    try {
      await adminApiRequest(`/v1/admin/event-progress-submissions/${id}/approve`, { method: 'POST', body: {} })
      notifySuccess('Progress approved and applied to the member’s challenge.')
      await load(meta.current_page)
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Approve failed.')
    } finally {
      setBusyId(null)
    }
  }

  const openReject = (row) => {
    setDetailRow(null)
    setRejectNote('')
    setRejecting(row)
  }

  const dismissReject = () => {
    setRejecting(null)
    setRejectNote('')
  }

  const confirmReject = async (dismissModal) => {
    if (!rejecting?.id || busyId) return
    const note = rejectNote.trim()
    if (note.length < 3) {
      notifyError('Enter a rejection reason (at least 3 characters).')
      return
    }
    setBusyId(rejecting.id)
    try {
      await adminApiRequest(`/v1/admin/event-progress-submissions/${rejecting.id}/reject`, {
        method: 'POST',
        body: { note },
      })
      notifySuccess('Submission rejected.')
      dismissModal?.()
      await load(meta.current_page)
    } catch (error) {
      const msg =
        error?.response?.data?.errors?.note?.[0] ||
        error?.response?.data?.message ||
        'Reject failed.'
      notifyError(msg)
    } finally {
      setBusyId(null)
    }
  }

  const rejectNoteValid = rejectNote.trim().length >= 3

  return (
    <AdminModuleLayout
      title="Event progress review"
      subtitle="Approve or reject member challenge mileage before it updates enrolled progress."
    >
      <AdminCmsTabs />

      <div className="aep-toolbar card border-0 shadow-sm mb-3">
        <div className="card-body py-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <label htmlFor="aep-status" className="small text-muted mb-0">
              Status
            </label>
            <select
              id="aep-status"
              className="form-select form-select-sm aep-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => load(1)} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm aep-table-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 aep-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Event</th>
                <th>Source</th>
                <th>Δ Distance</th>
                <th>Pace</th>
                <th>Workout</th>
                <th>Submitted</th>
                <th style={{ minWidth: 260 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-5 text-muted">
                    Loading queue…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-5 text-muted">
                    No submissions in this view.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="aep-member-name">{row.client?.display_name || 'Member'}</div>
                      <div className="aep-member-email small text-muted">{row.client?.email || ''}</div>
                    </td>
                    <td>
                      <span className="aep-event-title">{row.event?.title || '—'}</span>
                    </td>
                    <td>
                      <span className={`aep-badge aep-badge--${row.source === 'manual' ? 'manual' : 'workout'}`}>
                        {row.source === 'manual' ? 'Manual' : 'Workout'}
                      </span>
                    </td>
                    <td className="fw-semibold text-nowrap">{formatKm(row.distance_delta_km)}</td>
                    <td className="small text-muted text-nowrap">
                      {row.pace_min_per_km != null ? `${Number(row.pace_min_per_km).toFixed(2)} min/km` : '—'}
                    </td>
                    <td className="small">
                      {row.workout ? (
                        <>
                          <div>{row.workout.workout_type}</div>
                          <div className="text-muted">
                            {row.workout.workout_date} · {formatKm(row.workout.distance_km)}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="small text-muted text-nowrap">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setDetailRow(row)}>
                          Details
                        </button>
                        {row.status === 'pending' ? (
                          <>
                            <button type="button" className="btn btn-sm btn-primary" disabled={busyId === row.id} onClick={() => approve(row.id)}>
                              {busyId === row.id ? 'Working…' : 'Approve'}
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => openReject(row)} disabled={Boolean(busyId)}>
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className={`badge aep-status-badge aep-status-badge--${row.status}`}>{row.status}</span>
                        )}
                      </div>
                      {row.review_note && row.status === 'rejected' ? (
                        <div className="small text-danger mt-1">{row.review_note}</div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && meta.last_page > 1 ? (
          <div className="card-footer bg-light d-flex justify-content-between align-items-center py-2">
            <span className="small text-muted">
              Page {meta.current_page} of {meta.last_page} ({meta.total} total)
            </span>
            <div className="btn-group btn-group-sm">
              <button type="button" className="btn btn-outline-secondary" disabled={meta.current_page <= 1} onClick={() => load(meta.current_page - 1)}>
                Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={meta.current_page >= meta.last_page}
                onClick={() => load(meta.current_page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <AppModalTransition
        open={Boolean(detailRow)}
        onRequestClose={() => setDetailRow(null)}
        backdropClassName="admin-mt-backdrop"
        panelClassName="admin-mt-panel admin-mt-panel--detail"
      >
        {(dismissDetail) =>
          detailRow ? (
            <>
              <div className="admin-mt-head">
                <h2 id="aep-detail-title" className="admin-mt-title mb-0">
                  Submission details
                </h2>
                <button type="button" className="admin-mt-close" onClick={() => dismissDetail()} aria-label="Close">
                  ×
                </button>
              </div>
              <div className="admin-mt-body aep-detail-body">
                <div className="aep-detail-section">
                  <h3 className="aep-detail-h">Queue item</h3>
                  <dl className="aep-detail-dl mb-0">
                    <dt>Submission ID</dt>
                    <dd className="text-break">{detailRow.id}</dd>
                    <dt>Workout link ID</dt>
                    <dd className="text-break">{detailRow.workout_log_id || '—'}</dd>
                    <dt>Status</dt>
                    <dd className="text-capitalize">{detailRow.status}</dd>
                    <dt>Source</dt>
                    <dd className="text-capitalize">{detailRow.source === 'manual' ? 'Manual (event form)' : 'Workout log'}</dd>
                    <dt>Mileage applied on approval</dt>
                    <dd>{formatKm(detailRow.distance_delta_km)}</dd>
                    <dt>Pace (submitted)</dt>
                    <dd>{detailRow.pace_min_per_km != null ? `${Number(detailRow.pace_min_per_km).toFixed(2)} min/km` : '—'}</dd>
                    <dt>Queued at</dt>
                    <dd>{fmtIsoLocal(detailRow.created_at)}</dd>
                    <dt>Updated</dt>
                    <dd>{fmtIsoLocal(detailRow.updated_at)}</dd>
                    {detailRow.reviewed_at ? (
                      <>
                        <dt>Reviewed at</dt>
                        <dd>{fmtIsoLocal(detailRow.reviewed_at)}</dd>
                      </>
                    ) : null}
                    {detailRow.review_note ? (
                      <>
                        <dt>Review note</dt>
                        <dd className="text-danger">{detailRow.review_note}</dd>
                      </>
                    ) : null}
                  </dl>
                </div>

                <div className="aep-detail-section">
                  <h3 className="aep-detail-h">Member</h3>
                  <dl className="aep-detail-dl mb-0">
                    <dt>Name</dt>
                    <dd>{detailRow.client?.display_name || 'Member'}</dd>
                    <dt>Email</dt>
                    <dd className="text-break">{detailRow.client?.email || '—'}</dd>
                    <dt>Client ID</dt>
                    <dd className="text-break">{detailRow.client?.id || '—'}</dd>
                  </dl>
                </div>

                <div className="aep-detail-section">
                  <h3 className="aep-detail-h">Event</h3>
                  <dl className="aep-detail-dl mb-0">
                    <dt>Title</dt>
                    <dd>{detailRow.event?.title || '—'}</dd>
                    <dt>Event ID</dt>
                    <dd className="text-break">{detailRow.event?.id || '—'}</dd>
                  </dl>
                </div>

                {detailRow.workout ? (
                  <div className="aep-detail-section">
                    <h3 className="aep-detail-h">Linked workout</h3>
                    <dl className="aep-detail-dl mb-0">
                      <dt>Workout ID</dt>
                      <dd className="text-break">{detailRow.workout.id}</dd>
                      <dt>Type / entry</dt>
                      <dd>
                        <span>{detailRow.workout.workout_type}</span>
                        <span className="text-muted"> · </span>
                        <span>{detailRow.workout.entry_type || '—'}</span>
                      </dd>
                      <dt>Date</dt>
                      <dd>{detailRow.workout.workout_date || '—'}</dd>
                      <dt>Distance</dt>
                      <dd>{formatKm(detailRow.workout.distance_km)}</dd>
                      <dt>Duration</dt>
                      <dd>{formatDurationPieces(detailRow.workout.duration_minutes, detailRow.workout.duration_seconds)}</dd>
                      <dt>Pace</dt>
                      <dd>
                        {detailRow.workout.pace_min_per_km != null ? `${Number(detailRow.workout.pace_min_per_km).toFixed(2)} min/km` : '—'}
                      </dd>
                      <dt>Approved km snapshot</dt>
                      <dd>
                        {detailRow.workout.challenge_progress_approved_km != null
                          ? formatKm(detailRow.workout.challenge_progress_approved_km)
                          : '—'}
                      </dd>
                      <dt>Caption</dt>
                      <dd>{detailRow.workout.caption || '—'}</dd>
                      <dt>Location</dt>
                      <dd>{detailRow.workout.location || '—'}</dd>
                      <dt>Notes</dt>
                      <dd>{detailRow.workout.notes || '—'}</dd>
                    </dl>

                    <div className="aep-detail-attachments-head">
                      <h4 className="aep-detail-subh mb-2">Attachments</h4>
                      {Array.isArray(detailRow.workout.workout_images) && detailRow.workout.workout_images.length > 0 ? (
                        <p className="small text-muted mb-2">
                          Images use the workout’s uploaded files. Scroll to view; open in a new tab for fullscreen.
                        </p>
                      ) : (
                        <p className="small text-muted mb-0">No images attached to this workout.</p>
                      )}
                    </div>
                    {Array.isArray(detailRow.workout.workout_images) && detailRow.workout.workout_images.length > 0 ? (
                      <div className="aep-detail-images">
                        {detailRow.workout.workout_images.map((src, idx) => {
                          const resolved = resolveMediaUrl(src)
                          return (
                            <figure key={`${detailRow.id}-att-${idx}`} className="aep-detail-figure">
                              {resolved ? (
                                <>
                                  <img
                                    className="aep-detail-attachment"
                                    src={resolved}
                                    alt={`Workout attachment ${idx + 1}`}
                                    loading="lazy"
                                  />
                                  <figcaption className="aep-detail-figcaption">
                                    <a href={resolved} target="_blank" rel="noopener noreferrer" className="small">
                                      Open full size (new tab)
                                    </a>
                                  </figcaption>
                                </>
                              ) : (
                                <p className="small text-muted">Invalid attachment URL.</p>
                              )}
                            </figure>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : detailRow.source === 'manual' ? (
                  <div className="aep-detail-section">
                    <p className="small text-muted mb-0">
                      This mileage was logged manually from the event flow. There is no linked workout row or attachments.
                    </p>
                  </div>
                ) : (
                  <div className="aep-detail-section">
                    <p className="small text-muted mb-0">No workout record linked to this submission.</p>
                  </div>
                )}
              </div>
              <div className="admin-mt-foot admin-mt-foot--single">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => dismissDetail()}>
                  Close
                </button>
              </div>
            </>
          ) : null
        }
      </AppModalTransition>

      <AppModalTransition open={Boolean(rejecting)} onRequestClose={dismissReject} backdropClassName="admin-mt-backdrop" panelClassName="admin-mt-panel">
        {(dismiss) =>
          rejecting ? (
            <>
              <div className="admin-mt-head">
                <h2 id="aep-reject-title" className="admin-mt-title mb-0">
                  Reject submission
                </h2>
                <button type="button" className="admin-mt-close" onClick={() => dismiss()} aria-label="Close">
                  ×
                </button>
              </div>
              <div className="admin-mt-body">
                <p className="small text-muted mb-2">
                  A rejection reason is required and is stored with the submission for audit. Member mileage stays unchanged until a submission is approved.
                </p>
                <label className="form-label small fw-semibold" htmlFor="aep-reject-note">
                  Reason
                </label>
                <textarea
                  id="aep-reject-note"
                  className="form-control"
                  rows={3}
                  required
                  minLength={3}
                  maxLength={600}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Briefly explain why this progress is rejected (min. 3 characters)"
                />
                <div className="form-text">{rejectNote.trim().length} / 600</div>
              </div>
              <div className="admin-mt-foot">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => dismiss()} disabled={busyId === rejecting.id}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  disabled={busyId === rejecting.id || !rejectNoteValid}
                  onClick={() => confirmReject(dismiss)}
                >
                  {busyId === rejecting.id ? 'Working…' : 'Reject submission'}
                </button>
              </div>
            </>
          ) : null
        }
      </AppModalTransition>
    </AdminModuleLayout>
  )
}

export default AdminEventProgress
