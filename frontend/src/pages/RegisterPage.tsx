import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import styles from './AuthPage.module.css'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)

    try {
      const { data } = await api.post('/auth/register', {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      })
      setAuth(data.token, data.user)
      navigate('/dashboard')
    } catch (err: unknown) {
      const apiErrors = (err as { response?: { data?: { errors?: Record<string, string[]> } } })
        ?.response?.data?.errors ?? {}
      setErrors(apiErrors)
    } finally {
      setLoading(false)
    }
  }

  const fieldError = (field: string) => errors[field]?.[0]

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>
          Passwords must be at least 12 characters with upper &amp; lower case, numbers, and symbols.
        </p>

        <form onSubmit={handleSubmit} noValidate aria-label="Registration form">
          <div className="form-group">
            <label htmlFor="name" className="form-label">Full name</label>
            <input
              id="name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              aria-required="true"
              aria-describedby={fieldError('name') ? 'name-error' : undefined}
            />
            {fieldError('name') && <p id="name-error" className="form-error" role="alert">{fieldError('name')}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              aria-required="true"
              aria-describedby={fieldError('email') ? 'email-error' : undefined}
            />
            {fieldError('email') && <p id="email-error" className="form-error" role="alert">{fieldError('email')}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              aria-required="true"
              aria-describedby="password-hint"
            />
            <p id="password-hint" className={styles.hint}>
              Min 12 characters · upper &amp; lower case · numbers · symbols
            </p>
            {fieldError('password') && <p className="form-error" role="alert">{fieldError('password')}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="password-confirm" className="form-label">Confirm password</label>
            <input
              id="password-confirm"
              type="password"
              className="form-input"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              autoComplete="new-password"
              required
              aria-required="true"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
