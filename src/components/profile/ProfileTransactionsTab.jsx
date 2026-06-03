import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppModalTransition, { useAppModalDismiss } from '../AppModalTransition.jsx'
import { apiRequest } from '../../utils/api'
import { notifyError, notifySuccess } from '../../utils/notifications'
import { AppLoadingState } from '../AppLoadingState.jsx'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const resolveMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatShortDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatEventDates = (startsAt, endsAt) => {
  if (!startsAt) return null
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return null

  const startLabel = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  if (!endsAt) return startLabel

  const end = new Date(endsAt)
  if (Number.isNaN(end.getTime())) return startLabel

  const endLabel = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`
}

const formatAmount = (value, currency = 'PHP') => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const prefix = currency === 'PHP' ? '₱' : `${currency} `
  return `${prefix}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatStatusLabel = (value) => {
  if (!value) return 'Unknown'
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const statusClassName = (paymentStatus, registrationStatus) => {
  if (paymentStatus === 'paid' || paymentStatus === 'free') return 'is-paid'
  if (
    paymentStatus === 'pending'
    || paymentStatus === 'pending_checkout'
    || paymentStatus === 'unpaid'
    || registrationStatus === 'pending_payment'
    || registrationStatus === 'draft'
  ) return 'is-pending'
  if (paymentStatus === 'failed' || registrationStatus === 'cancelled') return 'is-failed'
  return 'is-neutral'
}

const needsPaymentCompletion = (registrationStatus, paymentStatus) => (
  registrationStatus === 'pending_payment'
  || paymentStatus === 'pending_checkout'
  || paymentStatus === 'pending'
  || paymentStatus === 'unpaid'
)

const resolveTotals = (tx) => {
  const registrationFee = tx.registration_fee ?? tx.amount
  const totalAmount = tx.total_amount ?? (
    registrationFee != null || tx.delivery_fee != null
      ? Number(registrationFee ?? 0) + Number(tx.delivery_fee ?? 0)
      : null
  )

  return {
    registrationFee,
    totalAmount,
    currency: tx.currency || 'PHP',
  }
}

const EventThumbnail = ({ imageUrl, title, className = '' }) => {
  const [failed, setFailed] = useState(false)
  const resolved = resolveMediaUrl(imageUrl)

  return (
    <span className={`profile-tx-thumb ${className}`.trim()}>
      {resolved && !failed ? (
        <img
          src={resolved}
          alt={title || 'Event'}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="profile-tx-thumb__fallback" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 16l4-6 4 3 4-7 4 10M4 20h16"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </span>
  )
}

const DetailRow = ({ label, value, mono = false }) => {
  if (value === null || value === undefined || value === '') return null

  return (
    <div className="profile-tx-detail-row">
      <span className="profile-tx-detail-row__label">{label}</span>
      <span className={`profile-tx-detail-row__value${mono ? ' is-mono' : ''}`}>{value}</span>
    </div>
  )
}

const TransactionDetailModal = ({ tx, onOpenEvent, onSyncPayment, syncingPayment }) => {
  const dismiss = useAppModalDismiss()
  const [heroFailed, setHeroFailed] = useState(false)
  const { registrationFee, totalAmount, currency } = resolveTotals(tx)
  const paymentPending = needsPaymentCompletion(tx.registration_status, tx.payment_status)
  const statusLabel = tx.payment_status
    ? formatStatusLabel(tx.payment_status)
    : formatStatusLabel(tx.registration_status)
  const statusClass = statusClassName(tx.payment_status, tx.registration_status)
  const eventDates = formatEventDates(tx.event?.starts_at, tx.event?.ends_at)
  const deliveryZone = tx.delivery_details?.area_label
    || (tx.delivery_details?.area_key ? formatStatusLabel(tx.delivery_details.area_key) : null)
  const description = tx.description || tx.event?.description
  const imageUrl = tx.event?.image_url
  const resolvedHero = resolveMediaUrl(imageUrl)

  const copyReference = async () => {
    if (!tx.paymaya_rrn) return

    try {
      await navigator.clipboard.writeText(tx.paymaya_rrn)
      notifySuccess('Reference copied.')
    } catch {
      notifyError('Could not copy reference.')
    }
  }

  return (
    <>
      <div className="profile-tx-modal__hero-wrap">
        {resolvedHero && !heroFailed ? (
          <img
            className="profile-tx-modal__hero"
            src={resolvedHero}
            alt={tx.event?.title || 'Event'}
            onError={() => setHeroFailed(true)}
          />
        ) : (
          <div className="profile-tx-modal__hero profile-tx-modal__hero--fallback">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M8 2v4M16 2v4M4 9h16M6 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
        <button type="button" className="profile-tx-modal__close" onClick={dismiss} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="profile-tx-modal__head">
        <div>
          <h3 className="profile-tx-modal__title">{tx.event?.title || 'Event registration'}</h3>
          {description && <p className="profile-tx-modal__desc">{description}</p>}
        </div>
        <span className={`profile-tx-card__status ${statusClass}`}>{statusLabel}</span>
      </div>

      <div className="profile-tx-modal__body">
        <div className="profile-tx-section">
          <h4 className="profile-tx-section__title">Payment summary</h4>
          <div className="profile-tx-receipt">
            {registrationFee != null && (
              <div className="profile-tx-receipt__row">
                <span>Registration fee</span>
                <span>{formatAmount(registrationFee, currency)}</span>
              </div>
            )}
            {tx.delivery_fee != null && (
              <div className="profile-tx-receipt__row">
                <span>Delivery fee</span>
                <span>{formatAmount(tx.delivery_fee, currency)}</span>
              </div>
            )}
            {totalAmount != null && (
              <div className="profile-tx-receipt__row profile-tx-receipt__row--total">
                <span>Total</span>
                <span>{formatAmount(totalAmount, currency)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="profile-tx-section">
          <h4 className="profile-tx-section__title">Details</h4>
          <div className="profile-tx-details">
            <DetailRow label="Transaction date" value={formatDateTime(tx.created_at)} />
            {tx.updated_at && tx.updated_at !== tx.created_at && (
              <DetailRow label="Last updated" value={formatDateTime(tx.updated_at)} />
            )}
            <DetailRow label="Event date" value={eventDates} />
            <DetailRow label="Location" value={tx.event?.location} />
            <DetailRow label="Delivery" value={deliveryZone} />
            <DetailRow label="Registration" value={formatStatusLabel(tx.registration_status)} />
            <DetailRow label="Payment" value={formatStatusLabel(tx.payment_status)} />
            {tx.paymaya_payment_status_snapshot && (
              <DetailRow
                label="Gateway"
                value={formatStatusLabel(tx.paymaya_payment_status_snapshot)}
              />
            )}
          </div>
        </div>

        {(tx.paymaya_rrn || tx.paymaya_checkout_id || tx.id) && (
          <div className="profile-tx-section">
            <h4 className="profile-tx-section__title">References</h4>
            <div className="profile-tx-details">
              {tx.paymaya_rrn && (
                <div className="profile-tx-detail-row">
                  <span className="profile-tx-detail-row__label">Payment reference</span>
                  <span className="profile-tx-detail-row__value is-mono profile-tx-ref">
                    <span className="profile-tx-ref__text" title={tx.paymaya_rrn}>{tx.paymaya_rrn}</span>
                    <button type="button" className="profile-tx-ref__copy" onClick={copyReference}>
                      Copy
                    </button>
                  </span>
                </div>
              )}
              <DetailRow label="Checkout ID" value={tx.paymaya_checkout_id} mono />
              <DetailRow label="Transaction ID" value={tx.id} mono />
            </div>
          </div>
        )}
      </div>

      {tx.event?.id && (
        <div className="profile-tx-modal__footer">
          {paymentPending ? (
            <button
              type="button"
              className="profile-tx-card__cta is-secondary"
              disabled={syncingPayment}
              onClick={() => onSyncPayment?.(tx)}
            >
              {syncingPayment ? 'Checking…' : 'Check payment status'}
            </button>
          ) : null}
          <button
            type="button"
            className={`profile-tx-card__cta${paymentPending ? ' is-primary' : ''}`}
            onClick={() => {
              dismiss()
              onOpenEvent(tx.event.id, tx.registration_status, tx.payment_status)
            }}
          >
            {paymentPending ? 'Complete payment' : 'View event'}
          </button>
        </div>
      )}
    </>
  )
}

const TransactionCard = ({ tx, onSelect }) => {
  const { totalAmount, currency } = resolveTotals(tx)
  const statusLabel = tx.payment_status
    ? formatStatusLabel(tx.payment_status)
    : formatStatusLabel(tx.registration_status)
  const statusClass = statusClassName(tx.payment_status, tx.registration_status)
  const categoryLabel = tx.event?.category ? formatStatusLabel(tx.event.category) : null
  const subtitleParts = [
    formatShortDate(tx.created_at),
    categoryLabel,
  ].filter(Boolean)

  return (
    <button type="button" className="profile-tx-card" onClick={() => onSelect(tx)}>
      <EventThumbnail imageUrl={tx.event?.image_url} title={tx.event?.title} />
      <span className="profile-tx-card__main">
        <span className="profile-tx-card__title">{tx.event?.title || 'Event registration'}</span>
        <span className="profile-tx-card__subtitle">{subtitleParts.join(' · ')}</span>
      </span>
      <span className="profile-tx-card__end">
        <span className="profile-tx-card__amount">{formatAmount(totalAmount, currency)}</span>
        <span className={`profile-tx-card__status ${statusClass}`}>{statusLabel}</span>
      </span>
    </button>
  )
}

const ProfileTransactionsTab = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [transactions, setTransactions] = useState([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedTx, setSelectedTx] = useState(null)
  const [syncingPayment, setSyncingPayment] = useState(false)

  const fetchTransactions = useCallback(async (targetPage = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        per_page: '15',
      })
      const response = await apiRequest(`/v1/profile/transactions?${params.toString()}`, { method: 'GET' })

      if (response.data?.success) {
        const rows = response.data?.data?.transactions || []
        const pagination = response.data?.data?.pagination || {}
        setTransactions((prev) => (append ? [...prev, ...rows] : rows))
        setPage(Number(pagination.page || targetPage))
        setLastPage(Number(pagination.last_page || 1))
        setTotal(Number(pagination.total || rows.length || 0))
        setLoadError('')
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to load transactions.'
      notifyError(message)
      setLoadError(message)
      if (!append) setTransactions([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  const syncPayment = useCallback(async (tx) => {
    const eventId = tx?.event?.id
    if (!eventId) return

    setSyncingPayment(true)
    try {
      const res = await apiRequest(`/v1/cms/events/${eventId}/registration/paymaya/sync`, {
        method: 'POST',
        body: {},
      })
      if (res.data?.success && res.data?.data?.paid) {
        notifySuccess(res.data.message || 'Payment confirmed!')
        setSelectedTx(null)
        await fetchTransactions(1, false)
        return
      }
      notifyError(res.data?.message || 'Payment is not completed yet.')
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Could not verify payment.')
    } finally {
      setSyncingPayment(false)
    }
  }, [fetchTransactions])

  useEffect(() => {
    fetchTransactions(1, false)
  }, [fetchTransactions])

  useEffect(() => {
    if (!selectedTx) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [selectedTx])

  const openEvent = (eventId, registrationStatus, paymentStatus) => {
    if (!eventId) return
    if (needsPaymentCompletion(registrationStatus, paymentStatus)) {
      navigate(`/challenges/${eventId}/register`)
      return
    }
    navigate(`/challenges/${eventId}`)
  }

  return (
    <>
      <div className="profile-tab-panel">
        <div className="profile-tab-panel-head">
          <h2 className="profile-section-title mb-1">Transactions</h2>
          <p className="profile-tab-panel-subtitle mb-0">
            Event registrations and payments
          </p>
        </div>

        {loading ? (
          <AppLoadingState compact hint="Loading transactions…" />
        ) : loadError && transactions.length === 0 ? (
          <div className="profile-tab-empty profile-tab-empty--error">
            <p className="mb-2">{loadError}</p>
            <button
              type="button"
              className="profile-tx-card__cta"
              onClick={() => fetchTransactions(1, false)}
            >
              Try again
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="profile-tab-empty">
            No transactions yet. Register for an event to see your payment history here.
          </div>
        ) : (
          <>
            <div className="profile-transactions-summary">
              {total} transaction{total === 1 ? '' : 's'}
            </div>
            <div className="profile-transactions-list">
              {transactions.map((tx) => (
                <TransactionCard
                  key={tx.id}
                  tx={tx}
                  onSelect={setSelectedTx}
                />
              ))}
            </div>
            {page < lastPage && (
              <div className="profile-tab-load-more-wrap">
                <button
                  type="button"
                  className="profile-tab-load-more"
                  disabled={loadingMore}
                  onClick={() => fetchTransactions(page + 1, true)}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AppModalTransition
        open={Boolean(selectedTx)}
        onRequestClose={() => setSelectedTx(null)}
        backdropClassName="profile-tx-modal-backdrop"
        panelClassName="profile-tx-modal"
      >
        {selectedTx && (
          <TransactionDetailModal
            tx={selectedTx}
            onOpenEvent={openEvent}
            onSyncPayment={syncPayment}
            syncingPayment={syncingPayment}
          />
        )}
      </AppModalTransition>
    </>
  )
}

export default ProfileTransactionsTab
