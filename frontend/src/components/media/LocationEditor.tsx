import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import type { MediaFile } from '@/types'
import styles from './LocationEditor.module.css'

interface LocationEditorProps {
  mapId: string
  media: MediaFile
}

export default function LocationEditor({ mapId, media }: LocationEditorProps) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [locationName, setLocationName] = useState(media.location_name ?? '')
  const [locationAddress, setLocationAddress] = useState(media.location_address ?? '')
  const [locationCity, setLocationCity] = useState(media.location_city ?? '')
  const [locationCountry, setLocationCountry] = useState(media.location_country ?? '')
  const [latitude, setLatitude] = useState(media.latitude?.toString() ?? '')
  const [longitude, setLongitude] = useState(media.longitude?.toString() ?? '')
  const [searching, setSearching] = useState(false)

  // Sync local state when media prop changes (after refetch)
  useEffect(() => {
    setLocationName(media.location_name ?? '')
    setLocationAddress(media.location_address ?? '')
    setLocationCity(media.location_city ?? '')
    setLocationCountry(media.location_country ?? '')
    setLatitude(media.latitude?.toString() ?? '')
    setLongitude(media.longitude?.toString() ?? '')
  }, [media])

  const updateMutation = useMutation({
    mutationFn: (payload: { 
      location_name: string
      location_address: string
      location_city: string
      location_country: string
      latitude?: number | null
      longitude?: number | null
    }) => api.put(`/maps/${mapId}/media/${media.id}`, payload),
    onSuccess: async () => {
      // Invalidate and refetch to ensure fresh data
      await qc.refetchQueries({ queryKey: ['media-item', mapId, String(media.id)] })
      await qc.refetchQueries({ queryKey: ['media', mapId] })
      setEditing(false)
      toast.success('Location updated successfully. Map marker will update.')
    },
    onError: () => toast.error('Failed to update location.'),
  })

  const rescanMutation = useMutation({
    mutationFn: () => api.post(`/maps/${mapId}/media/${media.id}/rescan-location`),
    onSuccess: async (response) => {
      const data = response.data
      if (data.updated) {
        await qc.refetchQueries({ queryKey: ['media-item', mapId, String(media.id)] })
        await qc.refetchQueries({ queryKey: ['media', mapId] })
        toast.success('Location data extracted from GPS coordinates.')
      } else {
        toast.error('No GPS data found in this file.')
      }
    },
    onError: () => toast.error('Failed to rescan location.'),
  })

  const handleGeocodingSearch = async () => {
    setSearching(true)
    
    try {
      // Check which fields are filled (exclude 0 values for coordinates)
      const lat = parseFloat(latitude.trim())
      const lon = parseFloat(longitude.trim())
      const hasValidCoordinates = 
        latitude.trim() && 
        longitude.trim() && 
        !isNaN(lat) && 
        !isNaN(lon) && 
        (lat !== 0 || lon !== 0) && // Exclude 0,0 coordinates
        lat >= -90 && lat <= 90 && 
        lon >= -180 && lon <= 180
      
      const hasTextFields = locationName.trim() || locationAddress.trim() || locationCity.trim() || locationCountry.trim()
      
      if (!hasValidCoordinates && !hasTextFields) {
        toast.error('Please enter some location information to search')
        setSearching(false)
        return
      }
      
      let searchParams: any = {}
      let response: any
      
      // If valid coordinates are filled, do reverse geocoding to get text fields
      if (hasValidCoordinates) {
        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          searchParams = { lat, lon }
          response = await api.get('/geocode', { params: searchParams })
          const data = response.data
          
          // Only fill empty text fields
          if (!locationName.trim() && data.location_name) setLocationName(data.location_name)
          if (!locationAddress.trim() && data.location_address) setLocationAddress(data.location_address)
          if (!locationCity.trim() && data.location_city) setLocationCity(data.location_city)
          if (!locationCountry.trim() && data.location_country) setLocationCountry(data.location_country)
          
          toast.success('Location details filled from coordinates!')
          setSearching(false)
          return
        } else {
          toast.error('Invalid coordinates. Latitude: -90 to 90, Longitude: -180 to 180')
          setSearching(false)
          return
        }
      }
      
      // If text fields are filled, do forward geocoding
      if (hasTextFields) {
        const parts = []
        if (locationName.trim()) parts.push(locationName.trim())
        if (locationAddress.trim()) parts.push(locationAddress.trim())
        if (locationCity.trim()) parts.push(locationCity.trim())
        if (locationCountry.trim()) parts.push(locationCountry.trim())
        
        const queryString = parts.join(', ')
        console.log('Geocoding search query:', queryString)
        
        searchParams = { query: queryString }
        response = await api.get('/geocode', { params: searchParams })
        const data = response.data
        
        console.log('Geocoding search result:', data)
        
        // Fill any empty fields with search results
        let fieldsUpdated = 0
        if (!locationName.trim() && data.location_name) {
          setLocationName(data.location_name)
          fieldsUpdated++
        }
        if (!locationAddress.trim() && data.location_address) {
          setLocationAddress(data.location_address)
          fieldsUpdated++
        }
        if (!locationCity.trim() && data.location_city) {
          setLocationCity(data.location_city)
          fieldsUpdated++
        }
        if (!locationCountry.trim() && data.location_country) {
          setLocationCountry(data.location_country)
          fieldsUpdated++
        }
        // Always update coordinates if we get valid ones from geocoding
        if (data.latitude !== undefined && data.latitude !== null) {
          setLatitude(data.latitude.toString())
          fieldsUpdated++
        }
        if (data.longitude !== undefined && data.longitude !== null) {
          setLongitude(data.longitude.toString())
          fieldsUpdated++
        }
        
        if (fieldsUpdated > 0) {
          toast.success(`Found location! Auto-filled ${fieldsUpdated} field(s).`)
        } else {
          toast('Location found, but all fields already filled.', { icon: 'ℹ️' })
        }
        
        setSearching(false)
        return
      }
    } catch (error: any) {
      console.error('Geocoding error:', error)
      if (error.response?.status === 404) {
        toast.error('No location found. Try: 1) Check spelling 2) Use fewer words 3) Try just city + country', { duration: 6000 })
      } else if (error.response?.data?.error) {
        toast.error(`Search failed: ${error.response.data.error}`)
      } else {
        toast.error('Search failed. Check your internet connection and try again.')
      }
    } finally {
      setSearching(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const payload: any = {
      location_name: locationName,
      location_address: locationAddress,
      location_city: locationCity,
      location_country: locationCountry,
    }
    
    // Only include coordinates if they're valid numbers or explicitly cleared
    if (latitude.trim() === '' && longitude.trim() === '') {
      payload.latitude = null
      payload.longitude = null
    } else {
      const lat = parseFloat(latitude)
      const lon = parseFloat(longitude)
      if (!isNaN(lat) && lat >= -90 && lat <= 90) {
        payload.latitude = lat
      }
      if (!isNaN(lon) && lon >= -180 && lon <= 180) {
        payload.longitude = lon
      }
    }
    
    updateMutation.mutate(payload)
  }

  const hasLocationData = media.location_name || media.location_address || media.location_city || media.location_country
  const hasGPS = media.latitude !== null && media.longitude !== null

  return (
    <section className={styles.locationSection} aria-labelledby="location-heading">
      <div className={styles.header}>
        <h2 id="location-heading" className={styles.heading}>
          <span className={styles.icon} aria-hidden="true">📍</span>
          Location Information
        </h2>
        {hasGPS && !editing && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => rescanMutation.mutate()}
            disabled={rescanMutation.isPending}
            aria-label="Rescan GPS data to extract location"
          >
            {rescanMutation.isPending ? '⟳ Scanning…' : '⟳ Rescan GPS'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className={styles.form} aria-label="Edit location information">
          <div className="form-group">
            <label htmlFor="location-name" className="form-label">
              Place Name
            </label>
            <input
              id="location-name"
              type="text"
              className="form-input"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              maxLength={255}
              placeholder="e.g., Eiffel Tower, Central Park"
            />
          </div>

          <div className="form-group">
            <label htmlFor="location-address" className="form-label">
              Street Address
            </label>
            <input
              id="location-address"
              type="text"
              className="form-input"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              maxLength={255}
              placeholder="e.g., 5 Avenue Anatole France"
            />
          </div>

          <div className={styles.row}>
            <div className="form-group">
              <label htmlFor="location-city" className="form-label">
                City
              </label>
              <input
                id="location-city"
                type="text"
                className="form-input"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                maxLength={255}
                placeholder="e.g., Paris"
              />
            </div>

            <div className="form-group">
              <label htmlFor="location-country" className="form-label">
                Country
              </label>
              <input
                id="location-country"
                type="text"
                className="form-input"
                value={locationCountry}
                onChange={(e) => setLocationCountry(e.target.value)}
                maxLength={255}
                placeholder="e.g., France"
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className="form-group">
              <label htmlFor="latitude" className="form-label">
                Latitude
              </label>
              <input
                id="latitude"
                type="text"
                className="form-input"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g., 48.858370"
              />
              <small className="form-hint">-90 to 90 (leave empty to clear)</small>
            </div>

            <div className="form-group">
              <label htmlFor="longitude" className="form-label">
                Longitude
              </label>
              <input
                id="longitude"
                type="text"
                className="form-input"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g., 2.294481"
              />
              <small className="form-hint">-180 to 180 (leave empty to clear)</small>
            </div>
          </div>

          <div className={styles.searchSection}>
            <button
              type="button"
              className="btn btn-accent"
              onClick={handleGeocodingSearch}
              disabled={searching || updateMutation.isPending}
              aria-label="Search and auto-fill empty location fields"
            >
              {searching ? '🔍 Searching…' : '🔍 Search & Auto-Fill'}
            </button>
            <p className={styles.searchHint}>
              <strong>Smart search:</strong> Fill in any field(s) and click to auto-complete the rest. Works with any combination!
            </p>
          </div>

          <div className={styles.actions}>
            <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setEditing(false)
                setLocationName(media.location_name ?? '')
                setLocationAddress(media.location_address ?? '')
                setLocationCity(media.location_city ?? '')
                setLocationCountry(media.location_country ?? '')
                setLatitude(media.latitude?.toString() ?? '')
                setLongitude(media.longitude?.toString() ?? '')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.display}>
          {hasLocationData ? (
            <dl className={styles.locationList}>
              {media.location_name && (
                <div className={styles.locationItem}>
                  <dt className={styles.locationLabel}>Place</dt>
                  <dd className={styles.locationValue}>{media.location_name}</dd>
                </div>
              )}
              {media.location_address && (
                <div className={styles.locationItem}>
                  <dt className={styles.locationLabel}>Address</dt>
                  <dd className={styles.locationValue}>{media.location_address}</dd>
                </div>
              )}
              {media.location_city && (
                <div className={styles.locationItem}>
                  <dt className={styles.locationLabel}>City</dt>
                  <dd className={styles.locationValue}>{media.location_city}</dd>
                </div>
              )}
              {media.location_country && (
                <div className={styles.locationItem}>
                  <dt className={styles.locationLabel}>Country</dt>
                  <dd className={styles.locationValue}>{media.location_country}</dd>
                </div>
              )}
              {hasGPS && (
                <div className={styles.locationItem}>
                  <dt className={styles.locationLabel}>Coordinates</dt>
                  <dd className={styles.locationValue}>
                    {media.latitude!.toFixed(6)}, {media.longitude!.toFixed(6)}
                    {media.altitude && ` (${Math.round(media.altitude)}m elevation)`}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyText}>
                {hasGPS
                  ? 'GPS coordinates detected. Click "Rescan GPS" to extract location details, or edit manually.'
                  : 'No location information available. Add details manually if you know where this was captured.'}
              </p>
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setEditing(true)}
            aria-label="Edit location information"
          >
            ✎ Edit Location
          </button>
        </div>
      )}
    </section>
  )
}
