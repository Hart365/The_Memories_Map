import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Grid,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  useComputedColorScheme,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconMapPin, IconRefresh, IconSearch, IconEdit } from '@tabler/icons-react'
import api from '@/lib/api'
import type { MediaFile } from '@/types'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

interface LocationEditorProps {
  mapId: string
  media: MediaFile
}

type GeocodeResult = {
  location_name?: string
  location_address?: string
  location_city?: string
  location_country?: string
  latitude?: number | null
  longitude?: number | null
}

export default function LocationEditor({ mapId, media }: LocationEditorProps) {
  const qc = useQueryClient()
  const isDark = useComputedColorScheme('light') === 'dark'
  const [editing, setEditing] = useState(false)
  const [locationName, setLocationName] = useState(media.location_name ?? '')
  const [locationAddress, setLocationAddress] = useState(media.location_address ?? '')
  const [locationCity, setLocationCity] = useState(media.location_city ?? '')
  const [locationCountry, setLocationCountry] = useState(media.location_country ?? '')
  const [latitude, setLatitude] = useState(media.latitude?.toString() ?? '')
  const [longitude, setLongitude] = useState(media.longitude?.toString() ?? '')
  const [searching, setSearching] = useState(false)

  const surface = isDark ? '#1a2028' : '#ffffff'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'

  useEffect(() => {
    setLocationName(media.location_name ?? '')
    setLocationAddress(media.location_address ?? '')
    setLocationCity(media.location_city ?? '')
    setLocationCountry(media.location_country ?? '')
    setLatitude(media.latitude?.toString() ?? '')
    setLongitude(media.longitude?.toString() ?? '')
  }, [media])

  const resetForm = () => {
    setLocationName(media.location_name ?? '')
    setLocationAddress(media.location_address ?? '')
    setLocationCity(media.location_city ?? '')
    setLocationCountry(media.location_country ?? '')
    setLatitude(media.latitude?.toString() ?? '')
    setLongitude(media.longitude?.toString() ?? '')
  }

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
      await qc.refetchQueries({ queryKey: ['media-item', mapId, String(media.id)] })
      await qc.refetchQueries({ queryKey: ['media', mapId] })
      setEditing(false)
      notifications.show({ message: 'Location updated successfully.', color: 'teal' })
    },
    onError: () => notifications.show({ message: 'Failed to update location.', color: 'red' }),
  })

  const rescanMutation = useMutation({
    mutationFn: () => api.post(`/maps/${mapId}/media/${media.id}/rescan-location`),
    onSuccess: async (response) => {
      const data = response.data as { updated?: boolean }
      if (data.updated) {
        await qc.refetchQueries({ queryKey: ['media-item', mapId, String(media.id)] })
        await qc.refetchQueries({ queryKey: ['media', mapId] })
        notifications.show({ message: 'Location data extracted from GPS coordinates.', color: 'teal' })
      } else {
        notifications.show({ message: 'No GPS data found in this file.', color: 'orange' })
      }
    },
    onError: () => notifications.show({ message: 'Failed to rescan location.', color: 'red' }),
  })

  const parseCoordinates = () => {
    const lat = Number.parseFloat(latitude.trim())
    const lon = Number.parseFloat(longitude.trim())
    const hasBoth = latitude.trim() !== '' && longitude.trim() !== ''
    const isValid = hasBoth
      && !Number.isNaN(lat)
      && !Number.isNaN(lon)
      && (lat !== 0 || lon !== 0)
      && lat >= -90
      && lat <= 90
      && lon >= -180
      && lon <= 180

    return { lat, lon, hasBoth, isValid }
  }

  const handleGeocodingSearch = async () => {
    setSearching(true)

    try {
      const { lat, lon, isValid } = parseCoordinates()
      const hasTextFields =
        locationName.trim()
        || locationAddress.trim()
        || locationCity.trim()
        || locationCountry.trim()

      if (!isValid && !hasTextFields) {
        notifications.show({ message: 'Please enter location details or valid coordinates to search.', color: 'orange' })
        return
      }

      if (isValid) {
        const response = await api.get('/geocode', { params: { lat, lon } })
        const data = response.data as GeocodeResult

        if (!locationName.trim() && data.location_name) setLocationName(data.location_name)
        if (!locationAddress.trim() && data.location_address) setLocationAddress(data.location_address)
        if (!locationCity.trim() && data.location_city) setLocationCity(data.location_city)
        if (!locationCountry.trim() && data.location_country) setLocationCountry(data.location_country)

        notifications.show({ message: 'Location details filled from coordinates.', color: 'teal' })
        return
      }

      const parts = [locationName, locationAddress, locationCity, locationCountry]
        .map((p) => p.trim())
        .filter(Boolean)
      const response = await api.get('/geocode', { params: { query: parts.join(', ') } })
      const data = response.data as GeocodeResult

      let fieldsUpdated = 0
      if (!locationName.trim() && data.location_name) {
        setLocationName(data.location_name)
        fieldsUpdated += 1
      }
      if (!locationAddress.trim() && data.location_address) {
        setLocationAddress(data.location_address)
        fieldsUpdated += 1
      }
      if (!locationCity.trim() && data.location_city) {
        setLocationCity(data.location_city)
        fieldsUpdated += 1
      }
      if (!locationCountry.trim() && data.location_country) {
        setLocationCountry(data.location_country)
        fieldsUpdated += 1
      }
      if (typeof data.latitude === 'number') {
        setLatitude(data.latitude.toString())
        fieldsUpdated += 1
      }
      if (typeof data.longitude === 'number') {
        setLongitude(data.longitude.toString())
        fieldsUpdated += 1
      }

      notifications.show({
        message: fieldsUpdated > 0
          ? `Found location and auto-filled ${fieldsUpdated} field(s).`
          : 'Location found, but your fields were already filled.',
        color: fieldsUpdated > 0 ? 'teal' : 'blue',
      })
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number; data?: { error?: string } }
      }

      if (axiosError.response?.status === 404) {
        notifications.show({ message: 'No location found. Try fewer words or check spelling.', color: 'red', autoClose: 6000 })
      } else if (axiosError.response?.data?.error) {
        notifications.show({ message: `Search failed: ${axiosError.response.data.error}`, color: 'red' })
      } else {
        notifications.show({ message: 'Search failed. Check your internet connection.', color: 'red' })
      }
    } finally {
      setSearching(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const payload: {
      location_name: string
      location_address: string
      location_city: string
      location_country: string
      latitude?: number | null
      longitude?: number | null
    } = {
      location_name: locationName,
      location_address: locationAddress,
      location_city: locationCity,
      location_country: locationCountry,
    }

    if (latitude.trim() === '' && longitude.trim() === '') {
      payload.latitude = null
      payload.longitude = null
    } else {
      const lat = Number.parseFloat(latitude)
      const lon = Number.parseFloat(longitude)
      if (!Number.isNaN(lat) && lat >= -90 && lat <= 90) payload.latitude = lat
      if (!Number.isNaN(lon) && lon >= -180 && lon <= 180) payload.longitude = lon
    }

    updateMutation.mutate(payload)
  }

  const hasLocationData = media.location_name || media.location_address || media.location_city || media.location_country
  const hasGPS = media.latitude !== null && media.longitude !== null

  return (
    <Paper p="md" radius="md" mt="md" style={{ backgroundColor: surface, border }}>
      <Group justify="space-between" align="flex-start" mb="sm">
        <Group gap="xs" align="center">
          <IconMapPin size={18} aria-hidden />
          <Text fw={700} size="sm" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
            Location Information
          </Text>
          {hasGPS && <Badge variant="light" color="green">GPS present</Badge>}
        </Group>
        {!editing && hasGPS && (
          <Button
            size="xs"
            variant="default"
            styles={getMapSectionButtonStyles('gallery')}
            leftSection={<IconRefresh size={14} aria-hidden />}
            onClick={() => rescanMutation.mutate()}
            loading={rescanMutation.isPending}
            aria-label="Rescan GPS data to extract location"
          >
            Rescan GPS
          </Button>
        )}
      </Group>

      {editing ? (
        <form onSubmit={handleSubmit} aria-label="Edit location information">
          <Stack gap="sm">
            <TextInput
              label="Place name"
              value={locationName}
              onChange={(e) => setLocationName(e.currentTarget.value)}
              maxLength={255}
              placeholder="e.g., Eiffel Tower"
            />
            <TextInput
              label="Street address"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.currentTarget.value)}
              maxLength={255}
              placeholder="e.g., 5 Avenue Anatole France"
            />
            <Grid gap="sm">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="City"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.currentTarget.value)}
                  maxLength={255}
                  placeholder="e.g., Paris"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Country"
                  value={locationCountry}
                  onChange={(e) => setLocationCountry(e.currentTarget.value)}
                  maxLength={255}
                  placeholder="e.g., France"
                />
              </Grid.Col>
            </Grid>
            <Grid gap="sm">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Latitude"
                  description="-90 to 90; leave blank to clear"
                  value={latitude}
                  onChange={(e) => setLatitude(e.currentTarget.value)}
                  placeholder="e.g., 48.858370"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Longitude"
                  description="-180 to 180; leave blank to clear"
                  value={longitude}
                  onChange={(e) => setLongitude(e.currentTarget.value)}
                  placeholder="e.g., 2.294481"
                />
              </Grid.Col>
            </Grid>

            <Group justify="space-between" align="center" wrap="wrap">
              <Button
                type="button"
                variant="default"
                styles={getMapSectionButtonStyles('map')}
                leftSection={<IconSearch size={14} aria-hidden />}
                onClick={handleGeocodingSearch}
                loading={searching}
                disabled={updateMutation.isPending}
                aria-label="Search and auto-fill empty location fields"
              >
                Search and Auto-Fill
              </Button>
              <Text size="xs" c="dimmed">
                Use either coordinates or text fields to auto-complete missing data.
              </Text>
            </Group>

            <Group justify="flex-end">
              <Button
                type="button"
                variant="default"
                styles={getMapSectionButtonStyles('gallery')}
                onClick={() => {
                  setEditing(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" styles={getMapSectionButtonStyles('upload', 'solid')} loading={updateMutation.isPending}>
                Save changes
              </Button>
            </Group>
          </Stack>
        </form>
      ) : (
        <Stack gap="sm">
          {hasLocationData || hasGPS ? (
            <Stack gap={4}>
              {media.location_name && <Text size="sm"><Text component="span" fw={700}>Place:</Text> {media.location_name}</Text>}
              {media.location_address && <Text size="sm"><Text component="span" fw={700}>Address:</Text> {media.location_address}</Text>}
              {media.location_city && <Text size="sm"><Text component="span" fw={700}>City:</Text> {media.location_city}</Text>}
              {media.location_country && <Text size="sm"><Text component="span" fw={700}>Country:</Text> {media.location_country}</Text>}
              {hasGPS && (
                <Text size="sm">
                  <Text component="span" fw={700}>Coordinates:</Text> {media.latitude!.toFixed(6)}, {media.longitude!.toFixed(6)}
                  {media.altitude ? ` (${Math.round(media.altitude)}m elevation)` : ''}
                </Text>
              )}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No location information is available yet.
            </Text>
          )}
          <Group justify="flex-end">
            <Button
              type="button"
              size="xs"
              variant="default"
              styles={getMapSectionButtonStyles('consolidated')}
              leftSection={<IconEdit size={14} aria-hidden />}
              onClick={() => setEditing(true)}
              aria-label="Edit location information"
            >
              Edit Location
            </Button>
          </Group>
        </Stack>
      )}
    </Paper>
  )
}
