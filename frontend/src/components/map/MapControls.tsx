import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import styles from './MapControls.module.css'

interface MapControlsProps {
  mapId: string
  mediaCount: number
  mediaNeedingGeocodeCount: number
  showRoutes: boolean
  onToggleRoutes: (show: boolean) => void
}

export default function MapControls({ 
  mapId, 
  mediaCount, 
  mediaNeedingGeocodeCount,
  showRoutes,
  onToggleRoutes 
}: MapControlsProps) {
  const qc = useQueryClient()
  const [scanning, setScanning] = useState(false)
  const [rescanning, setRescanning] = useState(false)

  const bulkRescanMutation = useMutation({
    mutationFn: () => api.post(`/maps/${mapId}/media/rescan-locations`),
    onMutate: () => {
      setScanning(true)
      toast.loading('Scanning media for location data...', { id: 'bulk-scan' })
    },
    onSuccess: (response) => {
      const data = response.data
      setScanning(false)
      toast.success(
        `Scan complete! Updated ${data.updated} files, skipped ${data.skipped}.`,
        { id: 'bulk-scan', duration: 5000 }
      )
      qc.invalidateQueries({ queryKey: ['media', mapId] })
    },
    onError: () => {
      setScanning(false)
      toast.error('Failed to scan locations. Please try again.', { id: 'bulk-scan' })
    },
  })

  const rescanAllMutation = useMutation({
    mutationFn: () => api.post(`/maps/${mapId}/media/rescan-locations`),
    onMutate: () => {
      setRescanning(true)
      toast.loading('Re-geocoding all media files with enhanced location detection...', { id: 'rescan-all' })
    },
    onSuccess: (response) => {
      const data = response.data
      setRescanning(false)
      toast.success(
        `Enhanced location scan complete! Updated ${data.updated} files.`,
        { id: 'rescan-all', duration: 5000 }
      )
      qc.invalidateQueries({ queryKey: ['media', mapId] })
    },
    onError: () => {
      setRescanning(false)
      toast.error('Failed to rescan locations. Please try again.', { id: 'rescan-all' })
    },
  })

  return (
    <div className={styles.controls} role="region" aria-label="Map controls">
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.icon} aria-hidden="true">🗺️</span>
          Map Controls
        </h3>
        
        {/* Route Toggle */}
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={showRoutes}
            onChange={(e) => onToggleRoutes(e.target.checked)}
            className={styles.checkbox}
            aria-describedby="route-description"
          />
          <span className={styles.toggleText}>Show photo route</span>
        </label>
        <p id="route-description" className={styles.description}>
          Connect photos chronologically to visualize your journey
        </p>
      </div>

      {/* Location Data Stats - Always visible */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.icon} aria-hidden="true">📍</span>
          Location Data
        </h3>
        
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{mediaCount - mediaNeedingGeocodeCount}</span>
            <span className={styles.statLabel}>with location</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{mediaNeedingGeocodeCount}</span>
            <span className={styles.statLabel}>need scanning</span>
          </div>
        </div>

        {mediaNeedingGeocodeCount > 0 ? (
          <>
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => bulkRescanMutation.mutate()}
              disabled={scanning || bulkRescanMutation.isPending || rescanning}
              aria-label={`Scan ${mediaNeedingGeocodeCount} files for GPS location data`}
            >
              {scanning ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Scanning...
                </>
              ) : (
                <>
                  <span aria-hidden="true">🔍</span>
                  Scan All ({mediaNeedingGeocodeCount})
                </>
              )}
            </button>
            
            <p className={styles.hint}>
              Scans media with GPS coordinates to extract location names, landmarks, and addresses
            </p>
          </>
        ) : (
          <p className={styles.hint}>
            {mediaCount > 0 
              ? '✓ All media files have location data or no GPS coordinates'
              : 'No media files uploaded yet'
            }
          </p>
        )}
        
        {/* Rescan All Button - Enhanced Location Detection */}
        {mediaCount > 0 && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => rescanAllMutation.mutate()}
              disabled={rescanning || rescanAllMutation.isPending || scanning}
              aria-label="Re-geocode all media files with enhanced location detection"
              style={{ marginTop: '1rem' }}
            >
              {rescanning ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Re-geocoding...
                </>
              ) : (
                <>
                  <span aria-hidden="true">🌍</span>
                  Rescan All for Enhanced Locations
                </>
              )}
            </button>
            
            <p className={styles.hint} style={{ marginTop: '0.5rem' }}>
              Re-geocode all files using improved POI detection (e.g., "Guggenheim Museum" instead of street addresses)
            </p>
          </>
        )}
      </div>

      {/* Info Section */}
      <div className={styles.infoSection}>
        <h4 className={styles.infoTitle}>About Location Data</h4>
        <ul className={styles.infoList}>
          <li>Photos with GPS are automatically geocoded on upload</li>
          <li>Location names prioritize POIs (museums, parks) over street addresses</li>
          <li>Bulk scan processes files with GPS but no location names</li>
          <li>Rescan All re-geocodes everything with enhanced detection</li>
          <li>All location data is cached for 30 days</li>
        </ul>
        
        <h4 className={styles.infoTitle} style={{ marginTop: '1rem' }}>Duplicate Detection</h4>
        <ul className={styles.infoList}>
          <li>Compares filename, date, size, GPS, and camera settings</li>
          <li>Only skips files with strong multi-factor matches</li>
          <li>Prevents false positives from same-named files</li>
        </ul>
      </div>
    </div>
  )
}
