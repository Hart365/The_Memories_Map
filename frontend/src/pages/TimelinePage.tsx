import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, useMemo } from 'react'
import { format, parseISO, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns'
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '@/lib/api'
import { mediaThumbUrl } from '@/lib/mediaUrl'
import type { MediaFile, MemoriesMap } from '@/types'
import MapLayers from '@/components/map/MapLayers'
import styles from './TimelinePage.module.css'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

type ZoomLevel = 'day' | 'hour' | 'minute'

interface TimelineEntry {
  date: Date
  dateKey: string
  media: MediaFile[]
}

// Component to fit map bounds to filtered media
function FitBounds({ media }: { media: MediaFile[] }) {
  const map = useMap()
  useEffect(() => {
    const points = media.filter((m) => m.latitude && m.longitude)
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((m) => [m.latitude!, m.longitude!]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    }
  }, [media, map])
  return null
}

export default function TimelinePage() {
  const { mapId } = useParams<{ mapId: string }>()
  const navigate = useNavigate()
  const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null)
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day')

  const { data: map } = useQuery<MemoriesMap>({
    queryKey: ['map', mapId],
    queryFn: () => api.get(`/maps/${mapId}`).then((r) => r.data),
  })

  const { data: allMedia = [] } = useQuery<MediaFile[]>({
    queryKey: ['media', mapId],
    queryFn: () => api.get(`/maps/${mapId}/media`).then((r) => r.data.data),
  })

  // Filter media with dates
  const mediaWithDates = useMemo(() => 
    allMedia.filter((m) => m.captured_at),
    [allMedia]
  )

  // Group media by time bucket based on zoom level
  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    if (mediaWithDates.length === 0) return []

    const grouped = new Map<string, MediaFile[]>()

    mediaWithDates.forEach((m) => {
      // Use local time if available, otherwise fall back to UTC
      const dateStr = m.captured_at_local || m.captured_at!
      const date = parseISO(dateStr)
      let key: string

      switch (zoomLevel) {
        case 'minute':
          key = format(date, 'yyyy-MM-dd HH:mm')
          break
        case 'hour':
          key = format(date, 'yyyy-MM-dd HH:00')
          break
        case 'day':
        default:
          key = format(date, 'yyyy-MM-dd')
          break
      }

      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(m)
    })

    return Array.from(grouped.entries())
      .map(([dateKey, media]) => ({
        dateKey,
        date: parseISO(dateKey),
        media,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [mediaWithDates, zoomLevel])

  // Format date label based on zoom level
  const formatDateLabel = (entry: TimelineEntry): string => {
    switch (zoomLevel) {
      case 'minute':
        return format(entry.date, 'MMM d, yyyy h:mm a')
      case 'hour':
        return format(entry.date, 'MMM d, yyyy h:00 a')
      case 'day':
      default:
        return format(entry.date, 'MMMM d, yyyy')
    }
  }

  const selectedMedia = selectedEntry?.media ?? []
  const mediaWithLocation = selectedMedia.filter((m) => m.latitude !== null && m.longitude !== null)

  // Calculate timeline statistics
  const totalMediaCount = mediaWithDates.length
  const timeSpan = useMemo(() => {
    if (mediaWithDates.length < 2) return null
    const dates = mediaWithDates.map((m) => parseISO(m.captured_at!))
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())))
    const latest = new Date(Math.max(...dates.map(d => d.getTime())))
    const days = differenceInDays(latest, earliest)
    return { earliest, latest, days }
  }, [mediaWithDates])

  return (
    <section aria-labelledby="timeline-heading" className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 id="timeline-heading" className={styles.title}>
            <span className={styles.icon} aria-hidden="true">📅</span>
            Timeline – {map?.name}
          </h1>
          {timeSpan && (
            <p className={styles.subtitle}>
              {totalMediaCount} memories spanning {timeSpan.days} days 
              ({format(timeSpan.earliest, 'MMM yyyy')} – {format(timeSpan.latest, 'MMM yyyy')})
            </p>
          )}
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/maps/${mapId}`)}
            aria-label="Back to map view"
          >
            🗺️ Map View
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/maps/${mapId}/gallery`)}
            aria-label="Gallery view"
          >
            🖼️ Gallery
          </button>

          {mediaWithDates.length > 0 && (
            <div className={styles.zoomControls} role="group" aria-label="Timeline zoom level">
              <button
                type="button"
                className={`${styles.zoomBtn} ${zoomLevel === 'day' ? styles.zoomBtnActive : ''}`}
                onClick={() => setZoomLevel('day')}
                aria-pressed={zoomLevel === 'day'}
              >
                Days
              </button>
              <button
                type="button"
                className={`${styles.zoomBtn} ${zoomLevel === 'hour' ? styles.zoomBtnActive : ''}`}
                onClick={() => setZoomLevel('hour')}
                aria-pressed={zoomLevel === 'hour'}
              >
                Hours
              </button>
              <button
                type="button"
                className={`${styles.zoomBtn} ${zoomLevel === 'minute' ? styles.zoomBtnActive : ''}`}
                onClick={() => setZoomLevel('minute')}
                aria-pressed={zoomLevel === 'minute'}
              >
                Minutes
              </button>
            </div>
          )}
        </div>
      </div>

      {mediaWithDates.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyIcon} aria-hidden="true">📸</p>
          <h2 className={styles.emptyTitle}>No timeline data yet</h2>
          <p className={styles.emptyText}>
            Upload media with date information to see it appear on the timeline.
          </p>
        </div>
      ) : (
        <div className={styles.layout}>
          {/* Vertical Timeline */}
          <nav aria-label="Timeline entries" className={styles.timeline}>
            <div className={styles.timelineLine} aria-hidden="true" />
            <ul role="list" className={styles.timelineList}>
              {timelineEntries.map((entry) => (
                <li key={entry.dateKey} className={styles.timelineItem}>
                  <button
                    type="button"
                    className={`${styles.timelineBtn} ${selectedEntry?.dateKey === entry.dateKey ? styles.timelineBtnActive : ''}`}
                    onClick={() => setSelectedEntry(entry.dateKey === selectedEntry?.dateKey ? null : entry)}
                    aria-pressed={selectedEntry?.dateKey === entry.dateKey}
                    aria-label={`${formatDateLabel(entry)} – ${entry.media.length} ${entry.media.length === 1 ? 'item' : 'items'}`}
                  >
                    <div className={styles.timelineDot} aria-hidden="true">
                      <span className={styles.dotInner}>{entry.media.length}</span>
                    </div>
                    <div className={styles.timelineContent}>
                      <span className={styles.timelineDate}>{formatDateLabel(entry)}</span>
                      <span className={styles.timelineCount}>
                        {entry.media.length} {entry.media.length === 1 ? 'memory' : 'memories'}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Detail View */}
          <div className={styles.detail} aria-live="polite">
            {selectedEntry ? (
              <>
                <h2 className={styles.detailTitle}>{formatDateLabel(selectedEntry)}</h2>

                {/* Map */}
                {mediaWithLocation.length > 0 && (
                  <div className={styles.mapContainer} aria-label={`Map showing ${mediaWithLocation.length} locations`}>
                    <MapContainer 
                      center={[mediaWithLocation[0].latitude!, mediaWithLocation[0].longitude!]} 
                      zoom={10} 
                      style={{ width: '100%', height: '100%' }}
                    >
                      <MapLayers />
                      <FitBounds media={mediaWithLocation} />
                      {mediaWithLocation.map((m) => (
                        <Marker key={m.id} position={[m.latitude!, m.longitude!]}>
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
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                )}

                {/* Media Grid */}
                <div className={styles.mediaSection}>
                  <h3 className={styles.mediaSectionTitle}>
                    Media ({selectedMedia.length})
                  </h3>
                  <ul className={styles.mediaGrid} role="list">
                    {selectedMedia.map((m) => (
                      <li key={m.id} className={styles.mediaCard}>
                        <a href={`/maps/${mapId}/media/${m.id}`} className={styles.mediaLink}>
                          {m.thumbnail_name ? (
                            <img
                              src={mediaThumbUrl(mapId!, m.id)}
                              alt={m.user_caption ?? m.original_name}
                              loading="lazy"
                              className={styles.mediaThumb}
                            />
                          ) : (
                            <div className={styles.mediaPlaceholder} aria-hidden="true">
                              {m.mime_type.startsWith('video/') ? '▶' : '🖼'}
                            </div>
                          )}
                          <div className={styles.mediaInfo}>
                            <p className={styles.mediaName}>{m.user_caption ?? m.original_name}</p>
                            {m.captured_at && (
                              <p className={styles.mediaTime}>
                                {format(parseISO(m.captured_at_local || m.captured_at), 'h:mm a')}
                              </p>
                            )}
                            {m.location_name && (
                              <p className={styles.mediaLocation}>📍 {m.location_name}</p>
                            )}
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className={styles.selectPrompt}>
                <p className={styles.promptIcon} aria-hidden="true">👈</p>
                <h2 className={styles.promptTitle}>Select a timeline entry</h2>
                <p className={styles.promptText}>
                  Choose a date from the timeline to view media and see locations on the map.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
