import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, parseISO, eachDayOfInterval, min, max } from 'date-fns'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '@/lib/api'
import type { MediaFile, MemoriesMap } from '@/types'
import styles from './TimelinePage.module.css'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function TimelinePage() {
  const { mapId } = useParams<{ mapId: string }>()
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const { data: map } = useQuery<MemoriesMap>({
    queryKey: ['map', mapId],
    queryFn: () => api.get(`/maps/${mapId}`).then((r) => r.data),
  })

  const { data: allMedia = [] } = useQuery<MediaFile[]>({
    queryKey: ['media', mapId],
    queryFn: () => api.get(`/maps/${mapId}/media`).then((r) => r.data.data),
  })

  // Group by date
  const grouped = allMedia.reduce<Record<string, MediaFile[]>>((acc, m) => {
    const day = m.captured_at ? format(parseISO(m.captured_at), 'yyyy-MM-dd') : 'unknown'
    if (!acc[day]) acc[day] = []
    acc[day].push(m)
    return acc
  }, {})

  const days = Object.keys(grouped).filter((d) => d !== 'unknown').sort()

  const dayMedia = selectedDay ? (grouped[selectedDay] ?? []) : []
  const dayMediaWithLocation = dayMedia.filter((m) => m.latitude && m.longitude)

  return (
    <section aria-labelledby="timeline-heading">
      <h1 id="timeline-heading">Timeline – {map?.name}</h1>

      <div className={styles.layout}>
        {/* Day list */}
        <nav aria-label="Timeline days" className={styles.dayList}>
          <h2 className={styles.navTitle}>Days</h2>
          {days.length === 0 && <p className={styles.empty}>No dated media yet.</p>}
          <ul role="list" className={styles.dayItems}>
            {days.map((day) => (
              <li key={day}>
                <button
                  type="button"
                  className={`${styles.dayBtn} ${selectedDay === day ? styles.dayBtnActive : ''}`}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  aria-pressed={selectedDay === day}
                  aria-label={`${format(parseISO(day), 'MMMM d, yyyy')} – ${grouped[day].length} items`}
                >
                  <span className={styles.dayDate}>{format(parseISO(day), 'MMM d, yyyy')}</span>
                  <span className={styles.dayCount}>{grouped[day].length}</span>
                </button>
              </li>
            ))}
            {grouped['unknown'] && (
              <li>
                <button
                  type="button"
                  className={`${styles.dayBtn} ${selectedDay === 'unknown' ? styles.dayBtnActive : ''}`}
                  onClick={() => setSelectedDay(selectedDay === 'unknown' ? null : 'unknown')}
                  aria-pressed={selectedDay === 'unknown'}
                >
                  <span className={styles.dayDate}>No date</span>
                  <span className={styles.dayCount}>{grouped['unknown'].length}</span>
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* Day detail */}
        <div className={styles.detail} aria-live="polite">
          {selectedDay ? (
            <>
              <h2 className={styles.detailTitle}>
                {selectedDay === 'unknown' ? 'Media without date' : format(parseISO(selectedDay), 'EEEE, MMMM d yyyy')}
              </h2>

              {dayMediaWithLocation.length > 0 && (
                <div className={styles.miniMap} aria-label={`Map for ${selectedDay}`}>
                  <MapContainer center={[dayMediaWithLocation[0].latitude!, dayMediaWithLocation[0].longitude!]} zoom={10} style={{ width: '100%', height: '100%' }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {dayMediaWithLocation.map((m) => (
                      <Marker key={m.id} position={[m.latitude!, m.longitude!]}>
                        <Popup>{m.user_caption ?? m.original_name}</Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              )}

              <ul className={styles.mediaGrid} role="list" aria-label="Media for this day">
                {dayMedia.map((m) => (
                  <li key={m.id} className={styles.mediaItem}>
                    {m.thumbnail_name
                      ? <img src={`/api/maps/${mapId}/media/${m.id}/thumb`} alt={m.user_caption ?? m.original_name} loading="lazy" className={styles.thumb} />
                      : <div className={styles.thumbPlaceholder} aria-hidden="true">{m.mime_type.startsWith('video/') ? '▶' : '🖼'}</div>
                    }
                    <p className={styles.mediaName}>{m.user_caption ?? m.original_name}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.selectPrompt}>Select a day from the list to see its media.</p>
          )}
        </div>
      </div>
    </section>
  )
}
