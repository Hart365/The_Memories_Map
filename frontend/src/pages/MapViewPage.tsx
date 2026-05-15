import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '@/lib/api'
import type { MemoriesMap, MediaFile, MapNote } from '@/types'
import MediaUploader from '@/components/media/MediaUploader'
import NoteEditor from '@/components/notes/NoteEditor'
import styles from './MapViewPage.module.css'

// Fix Leaflet default icon paths when bundled
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function FitBounds({ media }: { media: MediaFile[] }) {
  const map = useMap()
  useEffect(() => {
    const points = media.filter((m) => m.latitude && m.longitude)
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((m) => [m.latitude!, m.longitude!]))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [media, map])
  return null
}

export default function MapViewPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const [showUploader, setShowUploader] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  const { data: map } = useQuery<MemoriesMap>({
    queryKey: ['map', mapId],
    queryFn: () => api.get(`/maps/${mapId}`).then((r) => r.data),
  })

  const { data: media = [] } = useQuery<MediaFile[]>({
    queryKey: ['media', mapId],
    queryFn: () => api.get(`/maps/${mapId}/media`).then((r) => r.data.data),
  })

  const { data: notes = [] } = useQuery<MapNote[]>({
    queryKey: ['notes', mapId],
    queryFn: () => api.get(`/maps/${mapId}/notes`).then((r) => r.data),
  })

  const mediaWithLocation = media.filter((m) => m.latitude && m.longitude)

  return (
    <section aria-labelledby="map-heading">
      <div className={styles.topBar}>
        <h1 id="map-heading">{map?.name ?? 'Loading…'}</h1>
        <div className={styles.actions}>
          <Link to={`/maps/${mapId}/timeline`} className="btn btn-secondary">Timeline view</Link>
          <button type="button" className="btn btn-primary" onClick={() => setShowUploader(true)}>
            + Add media
          </button>
        </div>
      </div>

      {map?.description && <p className={styles.description}>{map.description}</p>}

      {/* Map */}
      <div className={styles.mapWrapper} ref={mapRef}>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ width: '100%', height: '100%' }}
          aria-label={`Interactive map for ${map?.name ?? 'this memory'}`}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {mediaWithLocation.length > 0 && <FitBounds media={mediaWithLocation} />}
          {mediaWithLocation.map((m) => (
            <Marker
              key={m.id}
              position={[m.latitude!, m.longitude!]}
              eventHandlers={{ click: () => setSelectedMedia(m) }}
            >
              <Popup>
                <div className={styles.popup}>
                  {m.thumbnail_name && (
                    <img
                      src={`/api/maps/${mapId}/media/${m.id}/thumb`}
                      alt={m.user_caption ?? m.original_name}
                      className={styles.popupThumb}
                      loading="lazy"
                    />
                  )}
                  <p className={styles.popupCaption}>{m.user_caption ?? m.original_name}</p>
                  {m.captured_at && (
                    <p className={styles.popupDate}>
                      {new Date(m.captured_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </p>
                  )}
                  <Link to={`/maps/${mapId}/media/${m.id}`} className="btn btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    View
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Media without location */}
      {media.filter((m) => !m.latitude || !m.longitude).length > 0 && (
        <section aria-labelledby="no-location-heading" className={styles.noLocationSection}>
          <h2 id="no-location-heading" className={styles.sectionTitle}>Media without location data</h2>
          <ul className={styles.thumbGrid} role="list">
            {media.filter((m) => !m.latitude || !m.longitude).map((m) => (
              <li key={m.id}>
                <Link to={`/maps/${mapId}/media/${m.id}`} aria-label={`View ${m.user_caption ?? m.original_name}`}>
                  {m.thumbnail_name
                    ? <img src={`/api/maps/${mapId}/media/${m.id}/thumb`} alt={m.user_caption ?? m.original_name} loading="lazy" className={styles.thumb} />
                    : <div className={styles.thumbPlaceholder} aria-hidden="true">{m.mime_type.startsWith('video/') ? '▶' : '🖼'}</div>
                  }
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Map-level notes */}
      {notes.filter((n) => n.note_type === 'map').map((note) => (
        <div key={note.id} className={`card ${styles.note}`} role="article" aria-label={note.title ?? 'Map note'}>
          {note.title && <h3 className={styles.noteTitle}>{note.title}</h3>}
          <p>{note.body}</p>
        </div>
      ))}

      <NoteEditor mapId={Number(mapId)} noteType="map" />

      {showUploader && (
        <MediaUploader mapId={Number(mapId)} onClose={() => setShowUploader(false)} />
      )}
    </section>
  )
}
