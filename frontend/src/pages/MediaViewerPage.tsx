import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { mediaFileUrl } from '@/lib/mediaUrl'
import type { MediaFile } from '@/types'
import NoteEditor from '@/components/notes/NoteEditor'
import LocationEditor from '@/components/media/LocationEditor'
import styles from './MediaViewerPage.module.css'

export default function MediaViewerPage() {
  const { mapId, mediaId } = useParams<{ mapId: string; mediaId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [caption, setCaption] = useState('')

  const { data: media, isLoading } = useQuery<MediaFile>({
    queryKey: ['media-item', mapId, mediaId],
    queryFn: () => api.get(`/maps/${mapId}/media/${mediaId}`).then((r) => {
      setCaption(r.data.user_caption ?? '')
      return r.data
    }),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { user_caption: string }) => api.put(`/maps/${mapId}/media/${mediaId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-item', mapId, mediaId] })
      qc.invalidateQueries({ queryKey: ['media', mapId] })
      setEditing(false)
      toast.success('Caption updated.')
    },
    onError: () => toast.error('Failed to update caption.'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/maps/${mapId}/media/${mediaId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media', mapId] })
      navigate(`/maps/${mapId}`)
      toast.success('Media deleted.')
    },
    onError: () => toast.error('Failed to delete media.'),
  })

  if (isLoading) return <p aria-live="polite" aria-busy="true">Loading media…</p>
  if (!media) return <p>Media not found.</p>

  const isVideo = media.mime_type.startsWith('video/')

  return (
    <section aria-labelledby="media-heading">
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/dashboard">My Maps</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/maps/${mapId}`}>Map</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{media.user_caption ?? media.original_name}</span>
      </nav>

      <h1 id="media-heading" className={styles.title}>{media.user_caption ?? media.original_name}</h1>

      {/* Media viewer */}
      <div className={styles.viewer} aria-label={isVideo ? 'Video player' : 'Image viewer'}>
        {isVideo ? (
          <video
            controls
            className={styles.mediaEl}
            aria-label={media.user_caption ?? media.original_name}
          >
            <source src={mediaFileUrl(mapId!, mediaId!)} type={media.mime_type} />
            <p>Your browser does not support the video element. <a href={mediaFileUrl(mapId!, mediaId!)}>Download the video</a>.</p>
          </video>
        ) : (
          <img
            src={mediaFileUrl(mapId!, mediaId!)}
            alt={media.user_caption ?? media.original_name}
            className={styles.mediaEl}
          />
        )}
      </div>

      {/* Metadata */}
      <div className={styles.meta} aria-label="Media metadata">
        <dl className={styles.metaList}>
          <div>
            <dt>File name</dt>
            <dd>{media.original_name}</dd>
          </div>
          {media.captured_at && (
            <div>
              <dt>Captured</dt>
              <dd>{new Date(media.captured_at_local || media.captured_at).toLocaleString()}{media.captured_at_local && media.timezone && ` (${media.timezone})`}</dd>
            </div>
          )}
          {(media.latitude && media.longitude) && (
            <div>
              <dt>Location</dt>
              <dd>{media.latitude.toFixed(5)}, {media.longitude.toFixed(5)}</dd>
            </div>
          )}
          {media.camera_make && (
            <div>
              <dt>Camera</dt>
              <dd>{media.camera_make} {media.camera_model}</dd>
            </div>
          )}
          {(media.width && media.height) && (
            <div>
              <dt>Dimensions</dt>
              <dd>{media.width} × {media.height}</dd>
            </div>
          )}
          {media.duration_seconds && (
            <div>
              <dt>Duration</dt>
              <dd>{Math.round(media.duration_seconds)}s</dd>
            </div>
          )}
          {media.size_bytes && (
            <div>
              <dt>File size</dt>
              <dd>{(media.size_bytes / 1024 / 1024).toFixed(2)} MB</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Caption editor */}
      <div className={styles.captionSection}>
        {editing ? (
          <form
            onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ user_caption: caption }) }}
            aria-label="Edit caption form"
          >
            <div className="form-group">
              <label htmlFor="caption" className="form-label">Caption</label>
              <textarea
                id="caption"
                className="form-textarea"
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={2000}
                autoFocus
              />
            </div>
            <div className={styles.btnRow}>
              <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className={styles.captionRow}>
            <p className={styles.captionText}>{media.user_caption ?? <em>No caption</em>}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              Edit caption
            </button>
          </div>
        )}
      </div>

      {/* Location editor */}
      <LocationEditor mapId={mapId!} media={media} />

      {/* Media-level notes */}
      <NoteEditor mapId={Number(mapId)} mediaId={Number(mediaId)} noteType="media" />

      {/* Danger zone */}
      <div className={styles.dangerZone}>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm('Delete this media file? This cannot be undone.')) {
              deleteMutation.mutate()
            }
          }}
        >
          Delete media
        </button>
      </div>
    </section>
  )
}
