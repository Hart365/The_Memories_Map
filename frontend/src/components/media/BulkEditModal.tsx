import { useEffect, useState } from 'react'
import {
  Modal, Button, TextInput, Group, Stack, Text,
  Checkbox, Progress, Divider, Textarea, useComputedColorScheme,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconMapPin, IconSearch, IconEdit } from '@tabler/icons-react'
import api from '@/lib/api'
import type { MapNote, MediaFile } from '@/types'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

interface Props {
  opened: boolean
  onClose: () => void
  mapId: string
  selectedMedia: MediaFile[]
  onSaved: () => void
}

export default function BulkEditModal({ opened, onClose, mapId, selectedMedia, onSaved }: Props) {
  const isDark = useComputedColorScheme('light') === 'dark'
  const [locationName, setLocationName] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationCountry, setLocationCountry] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [caption, setCaption] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [captionOnlyWhereEmpty, setCaptionOnlyWhereEmpty] = useState(false)
  const [skipIdenticalNotes, setSkipIdenticalNotes] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)

  const brand = isDark ? '#22d3e0' : '#005f63'

  const resetForm = () => {
    setLocationName('')
    setLocationAddress('')
    setLocationCity('')
    setLocationCountry('')
    setLatitude('')
    setLongitude('')
    setCaption('')
    setNoteBody('')
    setCaptionOnlyWhereEmpty(false)
    setSkipIdenticalNotes(false)
    setOverwrite(false)
    setSearching(false)
    setSaving(false)
    setProgress(0)
  }

  const handleClose = () => {
    if (saving) return
    resetForm()
    onClose()
  }

  useEffect(() => {
    if (!opened) {
      resetForm()
    }
  }, [opened])

  const handleGeoSearch = async () => {
    const parts = [locationName, locationAddress, locationCity, locationCountry].filter(Boolean).join(', ')
    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)
    const hasCoords = latitude && longitude && !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
    if (!parts && !hasCoords) {
      notifications.show({ message: 'Enter a location name or coordinates to search.', color: 'orange' })
      return
    }
    setSearching(true)
    try {
      const res = hasCoords
        ? await api.get('/geocode', { params: { lat, lon } })
        : await api.get('/geocode', { params: { query: parts } })
      const d = res.data
      if (d.location_name && !locationName) setLocationName(d.location_name)
      if (d.location_address && !locationAddress) setLocationAddress(d.location_address)
      if (d.location_city && !locationCity) setLocationCity(d.location_city)
      if (d.location_country && !locationCountry) setLocationCountry(d.location_country)
      if (d.latitude != null) setLatitude(String(d.latitude))
      if (d.longitude != null) setLongitude(String(d.longitude))
      notifications.show({ message: 'Location found and auto-filled!', color: 'teal' })
    } catch {
      notifications.show({ message: 'Location not found. Try different search terms.', color: 'red' })
    } finally {
      setSearching(false)
    }
  }

  const handleSave = async () => {
    const hasLocation = locationName || locationAddress || locationCity || locationCountry || (latitude && longitude)
    const hasCaption = caption.trim().length > 0
    const hasNote = noteBody.trim().length > 0

    if (!hasLocation && !hasCaption && !hasNote) {
      notifications.show({ message: 'Enter location, caption, or note to apply.', color: 'orange' })
      return
    }

    setSaving(true)
    setProgress(0)
    const normalizedNoteBody = noteBody.trim()
    const payload: Record<string, string | number> = {}
    if (locationName) payload.location_name = locationName
    if (locationAddress) payload.location_address = locationAddress
    if (locationCity) payload.location_city = locationCity
    if (locationCountry) payload.location_country = locationCountry
    if (latitude && longitude) {
      payload.latitude = parseFloat(latitude)
      payload.longitude = parseFloat(longitude)
    }
    if (hasCaption) payload.user_caption = caption.trim()

    const existingNoteBodiesByMediaId = new Map<number, Set<string>>()
    if (hasNote && skipIdenticalNotes) {
      try {
        const res = await api.get<MapNote[]>('/maps/' + mapId + '/notes')
        const allNotes = Array.isArray(res.data) ? res.data : []
        for (const note of allNotes) {
          if (note.note_type !== 'media' || note.media_id == null) continue
          const trimmedBody = note.body?.trim()
          if (!trimmedBody) continue

          const existingBodies = existingNoteBodiesByMediaId.get(note.media_id) ?? new Set<string>()
          existingBodies.add(trimmedBody)
          existingNoteBodiesByMediaId.set(note.media_id, existingBodies)
        }
      } catch {
        notifications.show({
          message: 'Could not verify existing notes. Disable duplicate-note safeguard or try again.',
          color: 'red',
        })
        setSaving(false)
        return
      }
    }

    let done = 0
    const totalSteps = selectedMedia.length * (hasNote ? 2 : 1)

    for (const m of selectedMedia) {
      const shouldSkipLocation = hasLocation && !overwrite && (m.location_name || m.latitude)
      const mediaPayload: Record<string, string | number> = { ...payload }

      if (shouldSkipLocation) {
        delete mediaPayload.location_name
        delete mediaPayload.location_address
        delete mediaPayload.location_city
        delete mediaPayload.location_country
        delete mediaPayload.latitude
        delete mediaPayload.longitude
      }

      if (hasCaption && captionOnlyWhereEmpty && m.user_caption?.trim()) {
        delete mediaPayload.user_caption
      }

      try {
        if (Object.keys(mediaPayload).length > 0) {
          await api.put('/maps/' + mapId + '/media/' + m.id, mediaPayload)
        }
      } catch {
        // Continue attempting updates for other selected media.
      }
      done++
      setProgress(Math.round((done / totalSteps) * 100))

      if (hasNote) {
        try {
          const shouldSkipNote = skipIdenticalNotes
            && (existingNoteBodiesByMediaId.get(m.id)?.has(normalizedNoteBody) ?? false)

          if (!shouldSkipNote) {
            await api.post('/maps/' + mapId + '/notes', {
              note_type: 'media',
              media_id: m.id,
              body: normalizedNoteBody,
            })
          }
        } catch {
          // Continue attempting notes for other selected media.
        }
        done++
        setProgress(Math.round((done / totalSteps) * 100))
      }
    }

    setSaving(false)
    notifications.show({ message: 'Bulk edits applied to selected media.', color: 'teal' })
    resetForm()
    onSaved()
  }

  return (
    <Modal opened={opened} onClose={handleClose}
      title={<Group gap="xs"><IconEdit size={18} color={brand} aria-hidden /><Text fw={700}>Bulk Edit Media</Text></Group>}
      size="lg" radius="lg" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">{selectedMedia.length} item{selectedMedia.length !== 1 ? 's' : ''} selected</Text>
        <Divider label="Location" labelPosition="left" />
        <Group gap="sm" grow>
          <TextInput label="Place name" value={locationName} onChange={(e) => setLocationName(e.currentTarget.value)} aria-label="Location name" />
          <TextInput label="City" value={locationCity} onChange={(e) => setLocationCity(e.currentTarget.value)} aria-label="City" />
        </Group>
        <TextInput label="Street address" value={locationAddress} onChange={(e) => setLocationAddress(e.currentTarget.value)} aria-label="Street address" />
        <TextInput label="Country" value={locationCountry} onChange={(e) => setLocationCountry(e.currentTarget.value)} aria-label="Country" />
        <Group gap="sm" grow>
          <TextInput label="Latitude" value={latitude} onChange={(e) => setLatitude(e.currentTarget.value)} placeholder="-90 to 90" aria-label="Latitude" />
          <TextInput label="Longitude" value={longitude} onChange={(e) => setLongitude(e.currentTarget.value)} placeholder="-180 to 180" aria-label="Longitude" />
        </Group>
        <Button variant="default" styles={getMapSectionButtonStyles('map')} leftSection={<IconSearch size={14} aria-hidden />}
          loading={searching} onClick={handleGeoSearch} size="sm">
          Search location
        </Button>
        <Checkbox checked={overwrite} onChange={(e) => setOverwrite(e.currentTarget.checked)}
          label="Overwrite existing location data" aria-label="Overwrite existing location data" />

        <Divider label="Caption" labelPosition="left" />
        <TextInput
          label="Caption to apply to selected media"
          value={caption}
          onChange={(e) => setCaption(e.currentTarget.value)}
          maxLength={2000}
          aria-label="Caption to apply to selected media"
        />
        <Checkbox
          checked={captionOnlyWhereEmpty}
          onChange={(e) => setCaptionOnlyWhereEmpty(e.currentTarget.checked)}
          label="Apply caption only where empty"
          aria-label="Apply caption only where empty"
        />

        <Divider label="Notes" labelPosition="left" />
        <Textarea
          label="Add note to all selected images"
          description="Creates one media note per selected item."
          value={noteBody}
          onChange={(e) => setNoteBody(e.currentTarget.value)}
          maxLength={5000}
          minRows={3}
          autosize
          aria-label="Note to add to all selected images"
        />
        <Checkbox
          checked={skipIdenticalNotes}
          onChange={(e) => setSkipIdenticalNotes(e.currentTarget.checked)}
          label="Skip note if an identical note already exists"
          aria-label="Skip note if an identical note already exists"
        />

        {saving && <Progress value={progress} color="teal" size="sm" aria-label="Saving progress" />}
        <Group justify="flex-end" mt="xs">
          <Button variant="default" styles={getMapSectionButtonStyles('gallery')} onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="default" styles={getMapSectionButtonStyles('upload', 'solid')} loading={saving} leftSection={<IconMapPin size={16} aria-hidden />} onClick={handleSave}>
            Apply to {selectedMedia.length} item{selectedMedia.length !== 1 ? 's' : ''}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
