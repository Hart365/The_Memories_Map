import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import type { MemoriesMap } from '@/types'
import styles from './DashboardPage.module.css'

export default function DashboardPage() {
  const qc = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const { data: maps, isLoading, isError } = useQuery<MemoriesMap[]>({
    queryKey: ['maps'],
    queryFn: () => api.get('/maps').then((r) => r.data),
  })

  const createMap = useMutation({
    mutationFn: (payload: { name: string; description: string }) => api.post('/maps', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maps'] })
      setIsCreating(false)
      setNewName('')
      setNewDesc('')
      toast.success('Map created!')
    },
    onError: () => toast.error('Failed to create map.'),
  })

  const deleteMap = useMutation({
    mutationFn: (id: number) => api.delete(`/maps/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maps'] })
      toast.success('Map deleted.')
    },
    onError: () => toast.error('Failed to delete map.'),
  })

  return (
    <section aria-labelledby="dashboard-heading">
      <div className={styles.topBar}>
        <h1 id="dashboard-heading">My Memories Maps</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsCreating(true)}
          aria-expanded={isCreating}
          aria-controls="create-map-form"
        >
          + New Map
        </button>
      </div>

      {isCreating && (
        <div id="create-map-form" className={`card ${styles.createForm}`} role="region" aria-label="Create new map">
          <h2 className={styles.formTitle}>New Memories Map</h2>
          <form
            onSubmit={(e) => { e.preventDefault(); createMap.mutate({ name: newName, description: newDesc }) }}
            aria-label="Create map form"
          >
            <div className="form-group">
              <label htmlFor="map-name" className="form-label">Map name <span aria-hidden="true">*</span></label>
              <input
                id="map-name"
                type="text"
                className="form-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                aria-required="true"
                maxLength={255}
              />
            </div>
            <div className="form-group">
              <label htmlFor="map-desc" className="form-label">Description</label>
              <textarea
                id="map-desc"
                className="form-textarea"
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                maxLength={2000}
              />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className="btn btn-primary" disabled={!newName.trim() || createMap.isPending}>
                {createMap.isPending ? 'Creating…' : 'Create map'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading && <p aria-live="polite" aria-busy="true">Loading your maps…</p>}

      {isError && (
        <p className={styles.empty} role="alert">
          Could not load maps. Please refresh and try again.
        </p>
      )}

      {maps && maps.length === 0 && (
        <p className={styles.empty}>You have no Memories Maps yet. Create one to get started!</p>
      )}

      <ul className={styles.grid} role="list" aria-label="Your maps">
        {maps?.map((map) => (
          <li key={map.id} className={`card ${styles.mapCard}`}>
            <div className={styles.mapCardBody}>
              <h2 className={styles.mapName}>
                <Link to={`/maps/${map.id}`}>{map.name}</Link>
              </h2>
              {map.description && <p className={styles.mapDesc}>{map.description}</p>}
              <p className={styles.mapMeta}>
                <span>{map.media_files_count} {map.media_files_count === 1 ? 'file' : 'files'}</span>
                {map.color_theme && (
                  <span
                    className={styles.themeBadge}
                    style={{ background: map.color_theme.primary_color }}
                    aria-label={`Theme: ${map.color_theme.name}`}
                  >
                    {map.color_theme.name}
                  </span>
                )}
              </p>
            </div>
            <div className={styles.mapCardActions}>
              <Link to={`/maps/${map.id}`} className="btn btn-secondary" aria-label={`Open ${map.name}`}>Open</Link>
              <Link to={`/maps/${map.id}/timeline`} className="btn btn-secondary" aria-label={`Timeline for ${map.name}`}>Timeline</Link>
              <button
                type="button"
                className="btn btn-danger"
                aria-label={`Delete ${map.name}`}
                onClick={() => {
                  if (window.confirm(`Delete "${map.name}"? This cannot be undone.`)) {
                    deleteMap.mutate(map.id)
                  }
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
