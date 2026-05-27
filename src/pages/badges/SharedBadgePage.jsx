import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../../utils/api'
import { notifyError } from '../../utils/notifications'
import { AppLoadingState } from '../../components/AppLoadingState.jsx'
import BadgeShareModal from '../../components/profile/BadgeShareModal.jsx'
import '../../components/profile/BadgeShareModal.css'
import './SharedBadgePage.css'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const resolveMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

export default function SharedBadgePage() {
  const { clientId, eventId, badgeKey } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      try {
        const encodedKey = encodeURIComponent(String(badgeKey || ''))
        const res = await apiRequest(
          `/v1/public/badges/${encodeURIComponent(String(clientId))}/${encodeURIComponent(String(eventId))}/${encodedKey}`,
          { method: 'GET' },
        )
        if (!mounted) return
        if (res?.data?.success && res.data.data) {
          setPayload(res.data.data)
        } else {
          setPayload(null)
          notifyError(res?.data?.message || 'This badge could not be verified.')
        }
      } catch {
        if (mounted) {
          setPayload(null)
          notifyError('Could not load shared badge.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [clientId, eventId, badgeKey])

  const badge = useMemo(() => payload?.badge || null, [payload])
  const owner = useMemo(() => payload?.owner || null, [payload])

  const handleCloseModal = () => {
    setModalOpen(false)
    if (owner?.id) {
      navigate(`/profile/${owner.id}`, { replace: true })
      return
    }
    navigate('/profile', { replace: true })
  }

  if (loading) {
    return (
      <div className="shared-badge-page">
        <AppLoadingState label="Loading verified badge…" />
      </div>
    )
  }

  if (!badge || !owner) {
    return (
      <div className="shared-badge-page">
        <div className="shared-badge-card shared-badge-card--empty">
          <h1>Badge not found</h1>
          <p>This achievement may not exist or has not been earned yet.</p>
          <Link to="/profile" className="shared-badge-link-btn">
            Back to profile
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="shared-badge-page">
      <div className="shared-badge-card">
        <div className="shared-badge-card-badge-wrap">
          {badge.image_url ? (
            <img
              className="shared-badge-card-img"
              src={resolveMediaUrl(badge.image_url)}
              alt={badge.title || 'Badge'}
            />
          ) : (
            <div className="shared-badge-card-img-fallback" aria-hidden />
          )}
        </div>
        <div className="shared-badge-card-verified">Verified achievement</div>
        <h1 className="shared-badge-card-title">{badge.title || 'Challenge Badge'}</h1>
        <p className="shared-badge-card-event">{badge.event_title || 'Fitness 365 Pro Challenge'}</p>
        <p className="shared-badge-card-owner">
          Earned by <strong>{owner.display_name}</strong>
        </p>
        <div className="shared-badge-card-actions">
          <button type="button" className="shared-badge-link-btn is-primary" onClick={() => setModalOpen(true)}>
            Share this badge
          </button>
          <Link to={`/profile/${owner.id}`} className="shared-badge-link-btn">
            View profile
          </Link>
        </div>
      </div>

      <BadgeShareModal
        open={modalOpen}
        onRequestClose={handleCloseModal}
        badge={badge}
        ownerName={owner.display_name}
        clientId={owner.id}
        resolveMediaUrl={resolveMediaUrl}
      />
    </div>
  )
}
