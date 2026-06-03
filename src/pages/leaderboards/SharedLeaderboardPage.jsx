import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../../utils/api'
import { notifyError } from '../../utils/notifications'
import { AppLoadingState } from '../../components/AppLoadingState.jsx'
import LeaderboardShareModal from '../../components/leaderboards/LeaderboardShareModal.jsx'
import '../../components/profile/BadgeShareModal.css'
import './SharedLeaderboardPage.css'

const API_BASE_URL = import.meta.env.VITE_LARAVEL_API || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const resolveMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

export default function SharedLeaderboardPage() {
  const { eventId, clientId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const category = searchParams.get('category') || 'all'

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (category && category !== 'all') {
          params.set('category', category)
        }
        const qs = params.toString() ? `?${params.toString()}` : ''
        const res = await apiRequest(
          `/v1/public/leaderboard/${encodeURIComponent(String(eventId))}/${encodeURIComponent(String(clientId))}${qs}`,
          { method: 'GET' },
        )
        if (!mounted) return
        if (res?.data?.success && res.data.data?.standing) {
          setPayload(res.data.data)
        } else {
          setPayload(null)
          notifyError(res?.data?.message || 'This leaderboard standing could not be verified.')
        }
      } catch {
        if (mounted) {
          setPayload(null)
          notifyError('Could not load shared leaderboard standing.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [eventId, clientId, category])

  const standing = payload?.standing

  return (
    <div className="shared-leaderboard-page">
      <div className="shared-leaderboard-shell">
        {loading ? (
          <AppLoadingState hint="Loading standing…" />
        ) : !standing ? (
          <div className="shared-leaderboard-empty">
            <h1>Standing not found</h1>
            <p>This ranking may not exist or the event is no longer active.</p>
            <Link to="/leaderboards" className="shared-leaderboard-link">
              Browse leaderboards
            </Link>
          </div>
        ) : (
          <>
            <div className="shared-leaderboard-badge">Verified leaderboard rank</div>
            <div className="shared-leaderboard-rank">#{standing.rank}</div>
            <h1>{standing.display_name}</h1>
            <p className="shared-leaderboard-event">{standing.event_title}</p>
            <p className="shared-leaderboard-stats">
              {Number(standing.progress?.logged_distance_km || 0).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{' '}
              km logged
              {standing.progress?.goal_completed
                ? ' · Goal completed'
                : standing.progress?.progress_percent != null
                  ? ` · ${standing.progress.progress_percent}% of goal`
                  : ''}
            </p>
            <div className="shared-leaderboard-actions">
              <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
                Share again
              </button>
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => navigate(`/leaderboards/${eventId}`)}
              >
                View full leaderboard
              </button>
            </div>
          </>
        )}
      </div>

      {standing && (
        <LeaderboardShareModal
          open={modalOpen}
          onRequestClose={() => setModalOpen(false)}
          eventTitle={standing.event_title}
          eventId={standing.event_id}
          clientId={standing.client_id}
          ownerName={standing.display_name}
          rank={standing.rank}
          progress={standing.progress}
          categoryLabel={standing.category_label}
          categoryFilter={standing.category_filter || category}
          eventImageUrl={standing.event_image_url}
          resolveMediaUrl={resolveMediaUrl}
        />
      )}
    </div>
  )
}
