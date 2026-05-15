import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import type { ColorTheme, User, MapGuest, MemoriesMap } from '@/types'
import { useAuthStore } from '@/store/authStore'
import styles from './SettingsPage.module.css'

export default function SettingsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user: storeUser, setAuth, clearAuth } = useAuthStore()

  const [name, setName] = useState(storeUser?.name ?? '')
  const [email, setEmail] = useState(storeUser?.email ?? '')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const { data: themes } = useQuery<ColorTheme[]>({ queryKey: ['themes'], queryFn: () => api.get('/themes').then(r => r.data) })

  const updateProfile = useMutation({
    mutationFn: () => api.put('/profile', { name, email }),
    onSuccess: (res) => { setAuth(useAuthStore.getState().token!, res.data); toast.success('Profile updated.') },
    onError: () => toast.error('Failed to update profile.'),
  })

  const changePassword = useMutation({
    mutationFn: () => api.put('/profile/password', { current_password: currentPw, password: newPw, password_confirmation: newPwConfirm }),
    onSuccess: () => { clearAuth(); navigate('/login'); toast.success('Password changed. Please log in.') },
    onError: () => toast.error('Failed to change password.'),
  })

  const deleteAccount = useMutation({
    mutationFn: () => api.delete('/profile', { data: { password: deleteConfirm } }),
    onSuccess: () => { clearAuth(); navigate('/login'); toast.success('Account deleted.') },
    onError: () => toast.error('Failed to delete account.'),
  })

  return (
    <section aria-labelledby="settings-heading">
      <h1 id="settings-heading">Settings</h1>

      {/* Profile */}
      <section aria-labelledby="profile-heading" className={styles.section}>
        <h2 id="profile-heading">Profile</h2>
        <form onSubmit={(e) => { e.preventDefault(); updateProfile.mutate() }} aria-label="Update profile" className={styles.form}>
          <div className="form-group">
            <label htmlFor="s-name" className="form-label">Full name</label>
            <input id="s-name" type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="s-email" className="form-label">Email address</label>
            <input id="s-email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      {/* Password */}
      <section aria-labelledby="password-heading" className={styles.section}>
        <h2 id="password-heading">Change password</h2>
        <form onSubmit={(e) => { e.preventDefault(); changePassword.mutate() }} aria-label="Change password" className={styles.form}>
          <div className="form-group">
            <label htmlFor="s-cur-pw" className="form-label">Current password</label>
            <input id="s-cur-pw" type="password" className="form-input" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label htmlFor="s-new-pw" className="form-label">New password</label>
            <input id="s-new-pw" type="password" className="form-input" value={newPw} onChange={(e) => setNewPw(e.target.value)} required autoComplete="new-password" aria-describedby="pw-hint" />
            <p id="pw-hint" className={styles.hint}>Min 12 chars, upper &amp; lower, numbers &amp; symbols</p>
          </div>
          <div className="form-group">
            <label htmlFor="s-new-pw2" className="form-label">Confirm new password</label>
            <input id="s-new-pw2" type="password" className="form-input" value={newPwConfirm} onChange={(e) => setNewPwConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={changePassword.isPending}>
            {changePassword.isPending ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </section>

      {/* Theme preview */}
      {themes && themes.length > 0 && (
        <section aria-labelledby="themes-heading" className={styles.section}>
          <h2 id="themes-heading">Available themes</h2>
          <ul className={styles.themeList} role="list">
            {themes.map((t) => (
              <li key={t.id} className={styles.themeItem}>
                <div className={styles.themeSwatches} aria-hidden="true">
                  <div style={{ background: t.primary_color }} title={t.primary_color} />
                  <div style={{ background: t.secondary_color }} title={t.secondary_color} />
                  <div style={{ background: t.accent_color }} title={t.accent_color} />
                </div>
                <span className={styles.themeName}>{t.name}</span>
                {t.is_high_contrast && <span className={styles.hcBadge}>High contrast</span>}
              </li>
            ))}
          </ul>
          <p className={styles.themeNote}>Apply a theme to each map individually from the map view.</p>
        </section>
      )}

      {/* Danger zone */}
      <section aria-labelledby="danger-heading" className={`${styles.section} ${styles.danger}`}>
        <h2 id="danger-heading">Delete account</h2>
        <p>This will permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (window.confirm('Really delete your account?')) deleteAccount.mutate() }} aria-label="Delete account form" className={styles.form}>
          <div className="form-group">
            <label htmlFor="s-del-pw" className="form-label">Confirm your password to delete</label>
            <input id="s-del-pw" type="password" className="form-input" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-danger" disabled={!deleteConfirm || deleteAccount.isPending}>
            {deleteAccount.isPending ? 'Deleting…' : 'Delete my account'}
          </button>
        </form>
      </section>
    </section>
  )
}
