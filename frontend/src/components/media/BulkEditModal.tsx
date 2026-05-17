import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import FocusTrap from 'focus-trap-react'
import { createPortal } from 'react-dom'
import api from '@/lib/api'
import type { MediaFile } from '@/types'
import styles from './BulkEditModal.module.css'

interface Props {
  mapId: string
  media: MediaFile[]
  onClose: () => void
}

export default function BulkEditModal({ mapId, media, onClose }: Props) {
  const qc = useQueryClient()
  const [locationName, setLocationName] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationCountry, setLocationCountry] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [searching, setSearching] = useState(false)

  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [addNote, setAddNote] = useState(false)

  const [updating, setUpdating] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleGeocodingSearch = async () => {
    setSearching(true)
    
    try {
      // Build query from available fields
      const queryParts = [
        locationName.trim(),
        locationAddress.trim(),
        locationCity.trim(),
        locationCountry.trim()
      ].filter(Boolean)

      if (queryParts.length === 0) {
        toast.error('Please enter at least one location field to search')
        setSearching(false)
        return
      }

      const query = queryParts.join(', ')
      
      // Check if we have valid coordinates for reverse geocoding
      const lat = parseFloat(latitude.trim())
      const lon = parseFloat(longitude.trim())
      const hasValidCoordinates = 
        latitude.trim() && 
        longitude.trim() && 
        !isNaN(lat) && 
        !isNaN(lon) && 
        (lat !== 0 || lon !== 0) && 
        lat >= -90 && lat <= 90 && 
        lon >= -180 && lon <= 180

      let response
      if (hasValidCoordinates) {
        // Reverse geocoding: coordinates → address
        response = await api.get(`/geocode?lat=${lat}&lon=${lon}`)
      } else {
        // Forward geocoding: text → coordinates
        response = await api.get(`/geocode`, { params: { query } })
      }

      const data = response.data
      let fieldsUpdated = 0

      // Update fields that are empty
      if (data.location_name && !locationName.trim()) {
        setLocationName(data.location_name)
        fieldsUpdated++
      }
      if (data.location_address && !locationAddress.trim()) {
        setLocationAddress(data.location_address)
        fieldsUpdated++
      }
      if (data.location_city && !locationCity.trim()) {
        setLocationCity(data.location_city)
        fieldsUpdated++
      }
      if (data.location_country && !locationCountry.trim()) {
        setLocationCountry(data.location_country)
        fieldsUpdated++
      }
      
      // Always update coordinates when valid coords returned
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (media.length === 0) {
      toast.error('No media files selected')
      return
    }

    // Validate that at least something is being updated
    const hasLocationData = locationName.trim() || locationAddress.trim() || 
                           locationCity.trim() || locationCountry.trim() || 
                           (latitude && longitude)
    const hasNoteData = addNote && noteBody.trim()
    
    if (!hasLocationData && !hasNoteData) {
      toast.error('Please enter location data or a note to apply')
      return
    }

    // Validate coordinates if provided
    if (latitude && longitude) {
      const lat = parseFloat(latitude)
      const lon = parseFloat(longitude)
      if (isNaN(lat) || lat < -90 || lat > 90) {
        toast.error('Latitude must be between -90 and 90')
        return
      }
      if (isNaN(lon) || lon < -180 || lon > 180) {
        toast.error('Longitude must be between -180 and 180')
        return
      }
    }

    setUpdating(true)
    setProgress(0)
    
    const payload: any = {}
    
    // Only include fields that have values
    if (locationName.trim()) payload.location_name = locationName.trim()
    if (locationAddress.trim()) payload.location_address = locationAddress.trim()
    if (locationCity.trim()) payload.location_city = locationCity.trim()
    if (locationCountry.trim()) payload.location_country = locationCountry.trim()
    
    if (latitude && longitude) {
      payload.latitude = parseFloat(latitude)
      payload.longitude = parseFloat(longitude)
    }

    let succeeded = 0
    let failed = 0
    let notesCreated = 0

    try {
      for (let i = 0; i < media.length; i++) {
        const item = media[i]
        
        // Update location data
        if (hasLocationData) {
          // Skip if not overwriting and item already has location data
          if (!overwrite && (item.location_name || item.latitude)) {
            // Still create note if requested, don't skip entirely
          } else {
            try {
              await api.put(`/maps/${mapId}/media/${item.id}`, payload)
              succeeded++
            } catch (err) {
              console.error(`Failed to update media ${item.id}:`, err)
              failed++
            }
          }
        }

        // Create note for this media file if requested
        if (hasNoteData) {
          try {
            await api.post(`/maps/${mapId}/notes`, {
              note_type: 'media',
              media_id: item.id,
              title: noteTitle.trim() || null,
              body: noteBody.trim(),
            })
            notesCreated++
          } catch (err) {
            console.error(`Failed to create note for media ${item.id}:`, err)
          }
        }

        setProgress(Math.round(((i + 1) / media.length) * 100))
      }

      // Refresh queries
      await qc.refetchQueries({ queryKey: ['media', mapId] })
      if (hasNoteData) {
        await qc.refetchQueries({ queryKey: ['notes', mapId] })
      }
      
      const messages = []
      if (hasLocationData && succeeded > 0) {
        messages.push(`Updated location for ${succeeded} file${succeeded !== 1 ? 's' : ''}`)
      }
      if (notesCreated > 0) {
        messages.push(`Created ${notesCreated} note${notesCreated !== 1 ? 's' : ''}`)
      }
      if (failed > 0) {
        messages.push(`${failed} failed`)
      }
      
      if (messages.length > 0) {
        if (failed === 0) {
          toast.success(messages.join(', '))
        } else {
          toast.error(messages.join(', '))
        }
      }
      
      onClose()
    } catch (err) {
      toast.error('Bulk update failed')
    } finally {
      setUpdating(false)
      setProgress(0)
    }
  }

  const filesWithLocation = media.filter(m => m.location_name || m.latitude).length
  const filesWithoutLocation = media.length - filesWithLocation

  return createPortal(
    <FocusTrap>
      <div
        className={styles.backdrop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-edit-title"
        onKeyDown={(e) => { if (e.key === 'Escape' && !updating) onClose() }}
      >
        <div className={styles.panel}>
          <div className={styles.header}>
            <h2 id="bulk-edit-title" className={styles.title}>
              <span className={styles.icon} aria-hidden="true">✏️</span>
              Bulk Edit
            </h2>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close bulk edit"
              disabled={updating}
            >
              ✕
            </button>
          </div>

          <div className={styles.info}>
            <p>
              Editing {media.length} file{media.length !== 1 ? 's' : ''}
            </p>
            {filesWithLocation > 0 && (
              <p className={styles.warning}>
                ⚠️ {filesWithLocation} file{filesWithLocation !== 1 ? 's have' : ' has'} existing location data
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="form-group">
              <label htmlFor="bulk-location-name" className="form-label">
                Place Name
              </label>
              <input
                id="bulk-location-name"
                type="text"
                className="form-input"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                maxLength={255}
                placeholder="e.g., Eiffel Tower, Central Park"
                disabled={updating}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bulk-location-address" className="form-label">
                Street Address
              </label>
              <input
                id="bulk-location-address"
                type="text"
                className="form-input"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                maxLength={255}
                placeholder="e.g., 5 Avenue Anatole France"
                disabled={updating}
              />
            </div>

            <div className={styles.row}>
              <div className="form-group">
                <label htmlFor="bulk-location-city" className="form-label">
                  City
                </label>
                <input
                  id="bulk-location-city"
                  type="text"
                  className="form-input"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  maxLength={255}
                  placeholder="e.g., Paris"
                  disabled={updating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="bulk-location-country" className="form-label">
                  Country
                </label>
                <input
                  id="bulk-location-country"
                  type="text"
                  className="form-input"
                  value={locationCountry}
                  onChange={(e) => setLocationCountry(e.target.value)}
                  maxLength={255}
                  placeholder="e.g., France"
                  disabled={updating}
                />
              </div>
            </div>

            <div className={styles.searchSection}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleGeocodingSearch}
                disabled={searching || updating}
                aria-label="Search for location coordinates"
              >
                {searching ? '🔍 Searching…' : '🔍 Search Location'}
              </button>
              <small className="form-hint">
                Fill in location details above, then click to auto-complete coordinates
              </small>
            </div>

            <div className={styles.row}>
              <div className="form-group">
                <label htmlFor="bulk-latitude" className="form-label">
                  Latitude
                </label>
                <input
                  id="bulk-latitude"
                  type="text"
                  className="form-input"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g., 48.858370"
                  disabled={updating}
                />
                <small className="form-hint">-90 to 90</small>
              </div>

              <div className="form-group">
                <label htmlFor="bulk-longitude" className="form-label">
                  Longitude
                </label>
                <input
                  id="bulk-longitude"
                  type="text"
                  className="form-input"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g., 2.294481"
                  disabled={updating}
                />
                <small className="form-hint">-180 to 180</small>
              </div>
            </div>

            <div className="form-group">
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  disabled={updating}
                />
                <span>Overwrite existing location data</span>
              </label>
              <small className="form-hint">
                {overwrite 
                  ? `Will update all ${media.length} selected files`
                  : `Will only update ${filesWithoutLocation} files without location data`
                }
              </small>
            </div>

            <div className={styles.divider} />

            <div className={styles.noteSection}>
              <div className="form-group">
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={addNote}
                    onChange={(e) => setAddNote(e.target.checked)}
                    disabled={updating}
                  />
                  <span>Add note to all selected files</span>
                </label>
              </div>

              {addNote && (
                <>
                  <div className="form-group">
                    <label htmlFor="bulk-note-title" className="form-label">
                      Note Title <span className={styles.optional}>(optional)</span>
                    </label>
                    <input
                      id="bulk-note-title"
                      type="text"
                      className="form-input"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      maxLength={255}
                      placeholder="Enter a title for the note"
                      disabled={updating}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="bulk-note-body" className="form-label">
                      Note <span aria-hidden="true">*</span>
                    </label>
                    <textarea
                      id="bulk-note-body"
                      className="form-textarea"
                      rows={4}
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      required={addNote}
                      aria-required={addNote}
                      maxLength={5000}
                      placeholder="Enter the note content"
                      disabled={updating}
                    />
                    <small className="form-hint">
                      {noteBody.length} / 5000 characters
                    </small>
                  </div>
                </>
              )}
            </div>

            {updating && (
              <div className={styles.progressWrapper}>
                <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                <span className={styles.progressText}>{progress}%</span>
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={updating}
              >
                {updating ? `Updating... ${progress}%` : 'Apply to All Selected'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={updating}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </FocusTrap>,
    document.body
  )
}
