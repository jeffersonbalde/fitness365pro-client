import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApiRequest } from '../../utils/adminApi'
import { notifyError, notifySuccess } from '../../utils/notifications'
import AdminModuleLayout from './AdminModuleLayout'
import AdminCmsTabs from './AdminCmsTabs'
import './AdminEventParticipants.css'

const formatDt = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

const fmtKm = (v) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`
}

const prettyJson = (value) => {
  if (value == null || (typeof value === 'object' && Object.keys(value).length === 0)) return null
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'office', label: 'Office' },
  { value: 'bank_transfer', label: 'Bank transfer' },
]

const paymentMethodLabel = (method) => {
  if (!method || method === 'free') return null
  const found = PAYMENT_METHODS.find((m) => m.value === method)
  return found?.label || method
}

const getMemberLabel = (member) => {
  const profile = member?.profile
  if (profile?.display_name) return profile.display_name
  const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  if (full) return full
  return member?.email || 'Member'
}

const AdminEventParticipants = () => {
  const [eventsLoading, setEventsLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [regsLoading, setRegsLoading] = useState(false)
  const [eventSummary, setEventSummary] = useState(null)
  const [regs, setRegs] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })

  const [manualOpen, setManualOpen] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [memberSearchLoading, setMemberSearchLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountReceived, setAmountReceived] = useState('')
  const [receiptRef, setReceiptRef] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [ignoreWindow, setIgnoreWindow] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadEvents = async () => {
      setEventsLoading(true)
      try {
        const res = await adminApiRequest('/v1/admin/events?per_page=100', { method: 'GET' })
        const rows = res.data?.data?.data ?? []
        if (!cancelled) {
          setEvents(Array.isArray(rows) ? rows : [])
        }
      } catch (error) {
        if (!cancelled) {
          notifyError(error?.response?.data?.message || 'Could not load events.')
          setEvents([])
        }
      } finally {
        if (!cancelled) setEventsLoading(false)
      }
    }
    loadEvents()
    return () => {
      cancelled = true
    }
  }, [])

  const loadRegs = useCallback(
    async (page = 1) => {
      if (!eventId) {
        setEventSummary(null)
        setRegs([])
        setMeta({ current_page: 1, last_page: 1, total: 0 })
        return
      }
      setRegsLoading(true)
      try {
        const params = new URLSearchParams({ per_page: '25', page: String(page) })
        const res = await adminApiRequest(`/v1/admin/events/${eventId}/registrations?${params.toString()}`, {
          method: 'GET',
        })
        const payload = res.data?.data
        const paginator = payload?.registrations
        const rows = paginator?.data ?? []
        setEventSummary(payload?.event ?? null)
        setRegs(Array.isArray(rows) ? rows : [])
        setMeta({
          current_page: paginator?.current_page ?? 1,
          last_page: paginator?.last_page ?? 1,
          total: paginator?.total ?? rows.length,
        })
      } catch (error) {
        notifyError(error?.response?.data?.message || 'Could not load registrations.')
        setEventSummary(null)
        setRegs([])
      } finally {
        setRegsLoading(false)
      }
    },
    [eventId],
  )

  useEffect(() => {
    loadRegs(1)
  }, [loadRegs])

  const selectedEvent = useMemo(
    () => events.find((row) => String(row?.id) === String(eventId)) || null,
    [events, eventId],
  )

  const selectedEventLabel = selectedEvent?.title || eventSummary?.title || ''

  const isFreeEvent = useMemo(() => {
    if (eventSummary?.fee_type === 'free') return true
    if (selectedEvent?.fee_type === 'free') return true
    const fee = Number(eventSummary?.fee ?? selectedEvent?.fee ?? 0)
    return !Number.isFinite(fee) || fee <= 0
  }, [eventSummary, selectedEvent])

  const defaultEventFee = useMemo(() => {
    const fee = Number(eventSummary?.fee ?? selectedEvent?.fee ?? 0)
    return Number.isFinite(fee) && fee > 0 ? fee : ''
  }, [eventSummary, selectedEvent])

  useEffect(() => {
    if (manualOpen && defaultEventFee !== '' && amountReceived === '') {
      setAmountReceived(String(defaultEventFee))
    }
  }, [manualOpen, defaultEventFee, amountReceived])

  useEffect(() => {
    if (!manualOpen) return undefined
    const q = memberSearch.trim()
    if (q.length < 2) {
      setMemberResults([])
      return undefined
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setMemberSearchLoading(true)
      try {
        const params = new URLSearchParams({ search: q, per_page: '8', page: '1' })
        const res = await adminApiRequest(`/v1/admin/members?${params.toString()}`, { method: 'GET' })
        const rows = res.data?.data?.data ?? []
        if (!cancelled) setMemberResults(Array.isArray(rows) ? rows : [])
      } catch {
        if (!cancelled) setMemberResults([])
      } finally {
        if (!cancelled) setMemberSearchLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [memberSearch, manualOpen])

  const resetManualForm = () => {
    setMemberSearch('')
    setMemberResults([])
    setSelectedMember(null)
    setPaymentMethod('cash')
    setAmountReceived(defaultEventFee !== '' ? String(defaultEventFee) : '')
    setReceiptRef('')
    setAdminNote('')
    setIgnoreWindow(false)
  }

  const closeManualPanel = () => {
    setManualOpen(false)
    resetManualForm()
  }

  const openManualPanel = () => {
    if (!eventId) {
      notifyError('Select an event first.')
      return
    }
    resetManualForm()
    setManualOpen(true)
  }

  const submitManualRegistration = async (e) => {
    e.preventDefault()
    if (!eventId) {
      notifyError('Select an event first.')
      return
    }
    if (!selectedMember?.id) {
      notifyError('Select a member to register.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        client_id: selectedMember.id,
        ignore_registration_window: ignoreWindow,
        manual_payment_reference: receiptRef.trim() || undefined,
        admin_registration_note: adminNote.trim() || undefined,
      }

      if (!isFreeEvent) {
        payload.payment_method = paymentMethod
        if (amountReceived !== '') payload.amount_received = Number(amountReceived)
      }

      const res = await adminApiRequest(`/v1/admin/events/${eventId}/registrations/manual`, {
        method: 'POST',
        body: payload,
      })

      notifySuccess(res.data?.message || 'Member registered successfully.')
      closeManualPanel()
      loadRegs(1)
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Could not register member.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminModuleLayout
      title="Event participants"
      subtitle="View enrollments and register members manually for cash or office payments."
    >
      <AdminCmsTabs />

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-8">
              <label htmlFor="aepart-event" className="form-label small text-muted mb-1">
                Event
              </label>
              <select
                id="aepart-event"
                className="form-select"
                disabled={eventsLoading}
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value)
                  setManualOpen(false)
                  resetManualForm()
                }}
              >
                <option value="">{eventsLoading ? 'Loading events…' : 'Choose an event'}</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                    {ev.status ? ` (${ev.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                disabled={regsLoading || !eventId}
                onClick={() => loadRegs(1)}
              >
                Refresh
              </button>
            </div>
            <div className="col-6 col-md-2">
              <button type="button" className="btn btn-primary w-100" disabled={!eventId} onClick={openManualPanel}>
                Register member
              </button>
            </div>
          </div>
        </div>
      </div>

      {!eventId ? (
        <p className="text-muted small">Select an event to view participants or register a member manually.</p>
      ) : null}

      {eventId && manualOpen ? (
        <div className="card border-0 shadow-sm mb-3 aepart-manual-card">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
              <div>
                <h2 className="h6 mb-1">Manual registration (cash / office)</h2>
                <p className="small text-muted mb-0">
                  Register an existing member for <strong>{selectedEventLabel}</strong>. They will see this event in their
                  joined challenges immediately.
                </p>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeManualPanel}>
                Cancel
              </button>
            </div>

            <form className="row g-3" onSubmit={submitManualRegistration}>
              <div className="col-12">
                <label htmlFor="aepart-member-search" className="form-label small text-muted mb-1">
                  Member
                </label>
                {selectedMember ? (
                  <div className="aepart-selected-member">
                    <div>
                      <div className="fw-semibold">{getMemberLabel(selectedMember)}</div>
                      <div className="small text-muted">{selectedMember.email}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        setSelectedMember(null)
                        setMemberSearch('')
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      id="aepart-member-search"
                      type="search"
                      className="form-control"
                      placeholder="Search by name, email, or phone (min. 2 characters)"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      autoComplete="off"
                    />
                    {memberSearchLoading ? (
                      <p className="small text-muted mt-2 mb-0">Searching members…</p>
                    ) : null}
                    {!memberSearchLoading && memberSearch.trim().length >= 2 && memberResults.length === 0 ? (
                      <p className="small text-muted mt-2 mb-0">No members found.</p>
                    ) : null}
                    {memberResults.length > 0 ? (
                      <ul className="list-group mt-2 aepart-member-results">
                        {memberResults.map((member) => (
                          <li key={member.id} className="list-group-item list-group-item-action">
                            <button
                              type="button"
                              className="aepart-member-pick"
                              onClick={() => {
                                setSelectedMember(member)
                                setMemberSearch('')
                                setMemberResults([])
                              }}
                            >
                              <span className="fw-semibold">{getMemberLabel(member)}</span>
                              <span className="small text-muted">{member.email}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>

              {!isFreeEvent ? (
                <>
                  <div className="col-12">
                    <span className="form-label small text-muted d-block mb-1">Payment method</span>
                    <div className="d-flex flex-wrap gap-3">
                      {PAYMENT_METHODS.map((opt) => (
                        <label key={opt.value} className="aepart-payment-option">
                          <input
                            type="radio"
                            name="aepart-payment-method"
                            value={opt.value}
                            checked={paymentMethod === opt.value}
                            onChange={() => setPaymentMethod(opt.value)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <label htmlFor="aepart-amount" className="form-label small text-muted mb-1">
                      Amount received (₱)
                    </label>
                    <input
                      id="aepart-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-8">
                    <label htmlFor="aepart-receipt" className="form-label small text-muted mb-1">
                      Receipt / OR number (optional)
                    </label>
                    <input
                      id="aepart-receipt"
                      type="text"
                      className="form-control"
                      placeholder="e.g. OR-12345"
                      value={receiptRef}
                      onChange={(e) => setReceiptRef(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div className="col-12">
                  <p className="small text-muted mb-0">This is a free event — no payment details required.</p>
                </div>
              )}

              <div className="col-12">
                <label htmlFor="aepart-note" className="form-label small text-muted mb-1">
                  Internal note (optional)
                </label>
                <textarea
                  id="aepart-note"
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Paid at Pagadian office front desk"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>

              <div className="col-12">
                <div className="form-check">
                  <input
                    id="aepart-ignore-window"
                    className="form-check-input"
                    type="checkbox"
                    checked={ignoreWindow}
                    onChange={(e) => setIgnoreWindow(e.target.checked)}
                  />
                  <label htmlFor="aepart-ignore-window" className="form-check-label small">
                    Override registration window (register even if deadline passed or not yet open)
                  </label>
                </div>
              </div>

              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={closeManualPanel} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !selectedMember}>
                  {submitting ? 'Registering…' : 'Confirm registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {eventId && eventSummary ? (
        <div className="card border-0 shadow-sm mb-3 aepart-summary-card">
          <div className="card-body py-3">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
              <div>
                <h2 className="h6 mb-1">{selectedEventLabel || eventSummary.title}</h2>
                <div className="small text-muted">
                  Total participants (this event):{' '}
                  <span className="fw-semibold text-body">{regsLoading ? '…' : meta.total}</span>
                </div>
              </div>
              <span className={`badge rounded-pill aepart-status-badge aepart-status-badge--${String(eventSummary.status || 'draft')}`}>
                {eventSummary.status || '—'}
              </span>
            </div>
            <dl className="row small mb-0 aepart-dl gx-3 gy-1">
              <div className="col-12 col-sm-6 col-lg-4">
                <dt>Registration opens</dt>
                <dd>{formatDt(eventSummary.registration_starts_at)}</dd>
              </div>
              <div className="col-12 col-sm-6 col-lg-4">
                <dt>Registration deadline</dt>
                <dd>{formatDt(eventSummary.registration_deadline)}</dd>
              </div>
              <div className="col-12 col-sm-6 col-lg-4">
                <dt>Event window</dt>
                <dd>
                  {formatDt(eventSummary.starts_at)} — {formatDt(eventSummary.ends_at)}
                </dd>
              </div>
              <div className="col-12 col-sm-6 col-lg-4">
                <dt>Category / location</dt>
                <dd>
                  {(eventSummary.category || '—') + ' · ' + (eventSummary.location || '—')}
                </dd>
              </div>
              <div className="col-12 col-sm-6 col-lg-4">
                <dt>Registration fee</dt>
                <dd>
                  {eventSummary.fee_type === 'free' || !eventSummary.fee
                    ? 'Free'
                    : `₱${Number(eventSummary.fee).toLocaleString()}`}
                </dd>
              </div>
              <div className="col-12 col-sm-6 col-lg-4">
                <dt>Mileage goal (event)</dt>
                <dd>{eventSummary.mileage_challenge_km != null ? fmtKm(eventSummary.mileage_challenge_km) : '—'}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {eventId ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 aepart-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Registration</th>
                  <th>Payment</th>
                  <th>Progress</th>
                  <th>Registered</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {regsLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-muted">
                      Loading participants…
                    </td>
                  </tr>
                ) : regs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-muted">
                      No registrations for this event yet.
                    </td>
                  </tr>
                ) : (
                  regs.map((row) => {
                    const pJson = prettyJson(row.participant_details)
                    const dJson = prettyJson(row.delivery_details)
                    const manualLabel = paymentMethodLabel(row.payment_method)
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="fw-semibold">{row.client?.display_name || 'Member'}</div>
                          <div className="small text-muted text-break">{row.client?.email || ''}</div>
                          <div className="small text-muted">Client ID · {row.client?.id || '—'}</div>
                        </td>
                        <td>
                          <span className="text-capitalize">{row.registration_status || '—'}</span>
                          {manualLabel ? (
                            <div className="mt-1">
                              <span className="badge rounded-pill aepart-manual-badge">{manualLabel}</span>
                            </div>
                          ) : null}
                          {row.progress_submission_status ? (
                            <div className="small text-muted text-capitalize">Progress: {row.progress_submission_status}</div>
                          ) : null}
                        </td>
                        <td>
                          <span className="text-capitalize">{row.payment_status || '—'}</span>
                          {row.amount_snapshot != null ? (
                            <div className="small text-muted">₱{row.amount_snapshot}</div>
                          ) : null}
                          {row.manual_payment_reference ? (
                            <div className="small text-muted">Ref: {row.manual_payment_reference}</div>
                          ) : null}
                          {row.registered_by_admin?.name ? (
                            <div className="small text-muted">By: {row.registered_by_admin.name}</div>
                          ) : null}
                        </td>
                        <td className="small">
                          <div>
                            Logged: <strong>{fmtKm(row.progress_logged_km)}</strong>
                          </div>
                          <div className="text-muted">Goal: {fmtKm(row.progress_goal_km)}</div>
                          {row.progress_target_label ? (
                            <div className="text-muted">{row.progress_target_label}</div>
                          ) : null}
                        </td>
                        <td className="small text-muted text-nowrap">{formatDt(row.created_at)}</td>
                        <td>
                          {pJson || dJson || row.admin_registration_note ? (
                            <details className="aepart-details">
                              <summary className="small">View payload</summary>
                              {row.admin_registration_note ? (
                                <div className="small text-muted mt-2">Note: {row.admin_registration_note}</div>
                              ) : null}
                              {pJson ? (
                                <pre className="aepart-json small mb-0 mt-2" aria-label="Participant details JSON">
                                  {pJson}
                                </pre>
                              ) : null}
                              {dJson ? (
                                <pre className="aepart-json small mb-0 mt-2" aria-label="Delivery details JSON">
                                  {dJson}
                                </pre>
                              ) : null}
                              {row.delivery_fee_snapshot != null ? (
                                <div className="small text-muted mt-2">Delivery fee snapshot: ₱{row.delivery_fee_snapshot}</div>
                              ) : null}
                            </details>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {!regsLoading && meta.last_page > 1 ? (
            <div className="card-footer bg-light d-flex justify-content-between align-items-center py-2">
              <span className="small text-muted">
                Page {meta.current_page} of {meta.last_page} ({meta.total} participants)
              </span>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={meta.current_page <= 1}
                  onClick={() => loadRegs(meta.current_page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={meta.current_page >= meta.last_page}
                  onClick={() => loadRegs(meta.current_page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </AdminModuleLayout>
  )
}

export default AdminEventParticipants
