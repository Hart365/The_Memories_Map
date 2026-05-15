import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import styles from './AuthPage.module.css'

export default function GuestAccessPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data } = await api.post('/auth/guest-login', {
        email,
        password,
        map_id: Number(mapId),
      })

      // Store guest token for subsequent requests
      sessionStorage.setItem('guest_token', data.access_token)
      sessionStorage.setItem('guest_map_id', String(mapId))

      navigate(`/shared-view/${mapId}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Access denied. Check your email and password.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card} role="main">
        <h1 className={styles.title}>Access Shared Map</h1>
        <p className={styles.subtitle}>
          Enter the email address and password you received in your invitation.
        </p>

        <form onSubmit={handleSubmit} noValidate aria-label="Guest access form">
          <div className="form-group">
            <label htmlFor="g-email" className="form-label">Email address</label>
            <input
              id="g-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              aria-required="true"
            />
          </div>
          <div className="form-group">
            <label htmlFor="g-password" className="form-label">Password</label>
            <input
              id="g-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              aria-required="true"
            />
          </div>

          {error && (
            <p className="form-error" role="alert" aria-live="assertive">{error}</p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Verifying…' : 'Access map'}
          </button>
        </form>
      </div>
    </main>
  )
}
