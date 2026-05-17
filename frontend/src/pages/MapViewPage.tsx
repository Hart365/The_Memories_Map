import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '@/lib/api'
import { mediaThumbUrl } from '@/lib/mediaUrl'
import type { MemoriesMap, MediaFile, MapNote } from '@/types'
import MediaUploader from '@/components/media/MediaUploader'
import NoteEditor from '@/components/notes/NoteEditor'
import MapLayers from '@/components/map/MapLayers'
import MapControls from '@/components/map/MapControls'
import RouteVisualization from '@/components/map/RouteVisualization'
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
  const [showRoutes, setShowRoutes] = useState(false)
  const [showControls, setShowControls] = useState(true)
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

  const mediaWithLocation = media.filter((m) => m.latitude !== null && m.longitude !== null)
  const mediaWithoutLocation = media.filter((m) => m.latitude === null || m.longitude === null)
  const mediaNeedingGeocode = media.filter((m) => 
    m.latitude !== null && 
    m.longitude !== null && 
    !m.location_name
  )

  return (
    <section aria-labelledby="map-heading">
      <div className={styles.topBar}>
        <h1 id="map-heading">{map?.name ?? 'Loading…'}</h1>
        <div className={styles.actions}>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => setShowControls(!showControls)}
            aria-label={showControls ? 'Hide map controls' : 'Show map controls'}
          >
            {showControls ? '⚙️ Hide Controls' : '⚙️ Show Controls'}
          </button>
          <Link to={`/maps/${mapId}/timeline`} className="btn btn-secondary">📅 Timeline</Link>
          <Link to={`/maps/${mapId}/gallery`} className="btn btn-secondary">🖼️ Gallery</Link>
          <button type="button" className="btn btn-primary" onClick={() => setShowUploader(true)}>
            + Add media
          </button>
        </div>
      </div>

      {map?.description && <p className={styles.description}>{map.description}</p>}

      <div className={`${styles.mainLayout} ${showControls ? styles.withSidebar : styles.fullWidth}`}>
        {/* Map Controls Sidebar */}
        {showControls && (
          <aside className={styles.sidebar} aria-label="Map controls panel">
            <MapControls
              mapId={mapId!}
              mediaCount={media.length}
              mediaNeedingGeocodeCount={mediaNeedingGeocode.length}
              showRoutes={showRoutes}
              onToggleRoutes={setShowRoutes}
            />
          </aside>
        )}

        {/* Map Container */}
        <div className={styles.mapContainer}>
          <div className={styles.mapWrapper} ref={mapRef}>
            <MapContainer
              center={[20, 0]}
              zoom={2}
              style={{ width: '100%', height: '100%' }}
              aria-label={`Interactive map for ${map?.name ?? 'this memory'}`}
            >
              <MapLayers />
              {mediaWithLocation.length > 0 && <FitBounds media={mediaWithLocation} />}
              
              {/* Route visualization */}
              {showRoutes && <RouteVisualization media={media} />}
              
              {/* Media markers */}
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
                          src={mediaThumbUrl(mapId!, m.id)}
                          alt={m.user_caption ?? m.original_name}
                          className={styles.popupThumb}
                          loading="lazy"
                        />
                      )}
                      <p className={styles.popupCaption}>{m.user_caption ?? m.original_name}</p>
                      {m.location_name && (
                        <p className={styles.popupLocation}>📍 {m.location_name}</p>
                      )}
                      {m.captured_at && (
                        <p className={styles.popupDate}>
                          {new Date(m.captured_at_local || m.captured_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
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

          {media.length > 0 && mediaWithLocation.length === 0 && (
            <p className={styles.hint} role="status">
              Uploaded media has no GPS coordinates yet, so map markers are not shown. You can still access files below.
            </p>
          )}
        </div>
      </div>

      {/* Media without location */}
      {mediaWithoutLocation.length > 0 && (
        <section aria-labelledby="no-location-heading" className={styles.noLocationSection}>
          <h2 id="no-location-heading" className={styles.sectionTitle}>Media without location data</h2>
          <ul className={styles.thumbGrid} role="list">
            {mediaWithoutLocation.map((m) => (
              <li key={m.id}>
                <Link to={`/maps/${mapId}/media/${m.id}`} aria-label={`View ${m.user_caption ?? m.original_name}`}>
                  {m.thumbnail_name
                    ? <img src={mediaThumbUrl(mapId!, m.id)} alt={m.user_caption ?? m.original_name} loading="lazy" className={styles.thumb} />
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
