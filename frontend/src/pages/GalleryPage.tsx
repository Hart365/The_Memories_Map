import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { mediaThumbUrl } from '@/lib/mediaUrl'
import type { MemoriesMap, MediaFile } from '@/types'
import BulkEditModal from '@/components/media/BulkEditModal'
import styles from './GalleryPage.module.css'

export default function GalleryPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showBulkEdit, setShowBulkEdit] = useState(false)

  const { data: map } = useQuery<MemoriesMap>({
    queryKey: ['map', mapId],
    queryFn: () => api.get(`/maps/${mapId}`).then((r) => r.data),
  })

  const { data: media = [] } = useQuery<MediaFile[]>({
    queryKey: ['media', mapId],
    queryFn: () => api.get(`/maps/${mapId}/media`).then((r) => r.data.data),
  })

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedIds(newSelection)
  }

  const toggleAll = () => {
    if (selectedIds.size === media.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(media.map(m => m.id)))
    }
  }

  const clearSelection = () => setSelectedIds(new Set())

  const selectedMedia = media.filter(m => selectedIds.has(m.id))

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/dashboard">My Maps</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/maps/${mapId}`}>{map?.title ?? 'Map'}</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Gallery</span>
      </nav>

      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.icon} aria-hidden="true">🖼️</span>
          Gallery
        </h1>

        <div className={styles.viewToggle}>
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/maps/${mapId}`)}
            aria-label="Switch to map view"
          >
            🗺️ Map View
          </button>
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/maps/${mapId}/timeline`)}
            aria-label="Switch to timeline view"
          >
            📅 Timeline
          </button>
        </div>
      </div>

      {media.length === 0 ? (
        <div className={styles.empty}>
          <p>No media files uploaded yet.</p>
          <Link to={`/maps/${mapId}`} className="btn btn-primary">
            Go to Map to Upload Files
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.selectionInfo}>
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={toggleAll}
                aria-label={selectedIds.size === media.length ? 'Deselect all' : 'Select all'}
              >
                {selectedIds.size === media.length ? '☐ Deselect All' : '☑ Select All'}
              </button>
              
              {selectedIds.size > 0 && (
                <>
                  <span className={styles.selectedCount}>
                    {selectedIds.size} selected
                  </span>
                  <button
                    type="button"
                    className="btn btn-accent"
                    onClick={() => setShowBulkEdit(true)}
                    aria-label={`Bulk edit ${selectedIds.size} files`}
                  >
                    ✏️ Bulk Edit Location
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={clearSelection}
                    aria-label="Clear selection"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            <div className={styles.stats}>
              {media.length} files total
            </div>
          </div>

          <div className={styles.grid} role="list">
            {media.map((item) => {
              const isSelected = selectedIds.has(item.id)
              const isVideo = item.mime_type.startsWith('video/')

              return (
                <div 
                  key={item.id} 
                  className={`${styles.gridItem} ${isSelected ? styles.selected : ''}`}
                  role="listitem"
                >
                  <div className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(item.id)}
                      aria-label={`Select ${item.original_name}`}
                    />
                  </div>

                  <Link 
                    to={`/maps/${mapId}/media/${item.id}`}
                    className={styles.imageLink}
                    aria-label={`View ${item.original_name}`}
                  >
                    <img
                      src={mediaThumbUrl(mapId!, String(item.id))}
                      alt={item.user_caption || item.original_name}
                      className={styles.thumbnail}
                      loading="lazy"
                    />
                    {isVideo && (
                      <span className={styles.videoIndicator} aria-label="Video">
                        ▶️
                      </span>
                    )}
                  </Link>

                  <div className={styles.itemInfo}>
                    <div className={styles.itemName} title={item.original_name}>
                      {item.user_caption || item.original_name}
                    </div>
                    {item.captured_at && (
                      <div className={styles.itemDate}>
                        {new Date(item.captured_at_local || item.captured_at).toLocaleDateString()}
                      </div>
                    )}
                    {item.location_name && (
                      <div className={styles.itemLocation} title={item.location_name}>
                        📍 {item.location_name}
                      </div>
                    )}
                    {!item.latitude && !item.longitude && (
                      <div className={styles.itemMissingLocation}>
                        ⚠️ No GPS data
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {showBulkEdit && (
        <BulkEditModal
          mapId={mapId!}
          media={selectedMedia}
          onClose={() => {
            setShowBulkEdit(false)
            clearSelection()
          }}
        />
      )}
    </div>
  )
}
