import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { format, getDate, getHours, getMonth, getYear, parseISO } from 'date-fns'
import 'leaflet/dist/leaflet.css'
import {
  Container, Title, Text, Button, Paper, Group, Box, Stack,
  SimpleGrid, Loader, Modal, useComputedColorScheme, Badge, Slider, Checkbox, Select, Menu, ActionIcon,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconPhoto, IconTimeline, IconUpload, IconLayoutDashboard, IconMapPin, IconMap, IconClock,
  IconArrowLeft, IconEdit, IconTrash, IconSelectAll,
  IconDotsVertical,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import api from '@/lib/api'
import { mediaThumbUrl } from '@/lib/mediaUrl'
import type { MemoriesMap, MediaFile } from '@/types'
import MapLayers from '@/components/map/MapLayers'
import MediaUploader from '@/components/media/MediaUploader'
import BulkEditModal from '@/components/media/BulkEditModal'
import NativeConfirmDialog from '@/components/common/NativeConfirmDialog'
import { getMapSectionActionIconStyles, getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'
import { buildTimelineColorMap } from '@/lib/timelineColors'
import { YEAR_BAR_COLORS } from '@/styles/mantine-theme'

const markerIconCache = new Map<string, L.DivIcon>()

function getTimelineMarkerIcon(color: string): L.DivIcon {
  const cached = markerIconCache.get(color)
  if (cached) return cached

  const icon = L.divIcon({
    className: '',
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -36],
    html: `
      <svg width="28" height="42" viewBox="0 0 28 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M14 1C7.096 1 1.5 6.596 1.5 13.5C1.5 23.125 14 41 14 41C14 41 26.5 23.125 26.5 13.5C26.5 6.596 20.904 1 14 1Z" fill="${color}" stroke="#1A1F2E" stroke-width="2"/>
        <circle cx="14" cy="13.5" r="5.25" fill="#FFFFFF" fill-opacity="0.96"/>
        <circle cx="14" cy="13.5" r="2.5" fill="#1A1F2E" fill-opacity="0.82"/>
      </svg>
    `,
  })

  markerIconCache.set(color, icon)
  return icon
}

function MapFit({ media, fitToken }: { media: MediaFile[]; fitToken: string }) {
  const map = useMap()
  const lastFitTokenRef = useRef<string>('')

  useEffect(() => {
    if (fitToken === lastFitTokenRef.current) return

    const points = media.filter((m) => m.latitude !== null && m.longitude !== null)
    if (points.length === 0) return

    const bounds = L.latLngBounds(points.map((m) => [m.latitude!, m.longitude!] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    lastFitTokenRef.current = fitToken
  }, [fitToken, map, media])

  return null
}

type DrillLevel = 'year' | 'month' | 'day' | 'hour'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function getMediaDate(m: MediaFile): Date | null {
  const s = m.captured_at_local || m.captured_at
  if (!s) return null
  try { return parseISO(s) } catch { return null }
}

function formatDayLabel(day: number, year: number | null, month: number | null): string {
  if (year === null || month === null) return String(day)
  return format(new Date(year, month, day), 'MMMM d')
}

function countUniqueLocations(items: MediaFile[]): number {
  const unique = new Set<string>()
  items.forEach((m) => {
    if (m.location_name) {
      unique.add(`name:${m.location_name.toLowerCase()}`)
      return
    }
    if (m.latitude !== null && m.longitude !== null) {
      unique.add(`coords:${m.latitude.toFixed(3)},${m.longitude.toFixed(3)}`)
    }
  })
  return unique.size
}

function MapViewportTracker({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  const map = useMap()
  useEffect(() => {
    onBoundsChange(map.getBounds())
  }, [map, onBoundsChange])
  useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  })
  return null
}

export default function MapViewPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isDark = useComputedColorScheme('light') === 'dark'
  const isTabletOrSmaller = useMediaQuery('(max-width: 75em)')
  const [uploaderOpen, { open: openUploader, close: closeUploader }] = useDisclosure(false)
  const [bulkEditOpen, { open: openBulkEdit, close: closeBulkEdit }] = useDisclosure(false)
  const [timelineLevel, setTimelineLevel] = useState<DrillLevel>('year')
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [galleryPage, setGalleryPage] = useState(1)
  const [thumbSize, setThumbSize] = useState(120)
  const [mediaPerPage, setMediaPerPage] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false)
  const [viewportBounds, setViewportBounds] = useState<L.LatLngBounds | null>(null)
  const cachedMaps = qc.getQueryData<MemoriesMap[]>(['maps'])
  const placeholderMap = cachedMaps?.find((item) => item.id === Number(mapId))

  const { data: map } = useQuery<MemoriesMap>({
    queryKey: ['map', mapId],
    queryFn: () => api.get(`/maps/${mapId}`).then((r) => r.data),
    placeholderData: placeholderMap,
  })
  const { data: allMedia = [], isLoading } = useQuery<MediaFile[]>({
    queryKey: ['media', mapId],
    queryFn: () => api.get(`/maps/${mapId}/media`).then((r) => r.data.data),
  })

  const geoMedia = useMemo(() => allMedia.filter((m) => m.latitude !== null && m.longitude !== null), [allMedia])
  const viewportMedia = useMemo(() => {
    if (!viewportBounds) return geoMedia
    return geoMedia.filter((m) => viewportBounds.contains([m.latitude!, m.longitude!]))
  }, [geoMedia, viewportBounds])
  const viewportMediaIds = useMemo(() => new Set(viewportMedia.map((m) => m.id)), [viewportMedia])
  const mapScopedMedia = useMemo(
    () => (viewportBounds ? allMedia.filter((m) => viewportMediaIds.has(m.id)) : allMedia),
    [allMedia, viewportBounds, viewportMediaIds],
  )
  const locationCount = useMemo(() => {
    const unique = new Set<string>()
    allMedia.forEach((m) => {
      if (m.location_name) {
        unique.add(`name:${m.location_name.toLowerCase()}`)
        return
      }
      if (m.latitude !== null && m.longitude !== null) {
        unique.add(`coords:${m.latitude.toFixed(3)},${m.longitude.toFixed(3)}`)
      }
    })
    return unique.size
  }, [allMedia])

  const mediaWithDates = useMemo(() => mapScopedMedia.filter((m) => getMediaDate(m) !== null), [mapScopedMedia])

  const yearBuckets = useMemo(() => {
    const buckets = new Map<number, MediaFile[]>()
    mediaWithDates.forEach((m) => {
      const d = getMediaDate(m)
      if (!d) return
      const y = getYear(d)
      if (!buckets.has(y)) buckets.set(y, [])
      buckets.get(y)!.push(m)
    })
    return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
  }, [mediaWithDates])

  const monthBuckets = useMemo(() => {
    if (selectedYear === null) return []
    const items = yearBuckets.find(([y]) => y === selectedYear)?.[1] ?? []
    const buckets = new Map<number, MediaFile[]>()
    items.forEach((m) => {
      const d = getMediaDate(m)
      if (!d) return
      const mo = getMonth(d)
      if (!buckets.has(mo)) buckets.set(mo, [])
      buckets.get(mo)!.push(m)
    })
    return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
  }, [selectedYear, yearBuckets])

  const dayBuckets = useMemo(() => {
    if (selectedMonth === null) return []
    const items = monthBuckets.find(([mo]) => mo === selectedMonth)?.[1] ?? []
    const buckets = new Map<number, MediaFile[]>()
    items.forEach((m) => {
      const d = getMediaDate(m)
      if (!d) return
      const day = getDate(d)
      if (!buckets.has(day)) buckets.set(day, [])
      buckets.get(day)!.push(m)
    })
    return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
  }, [monthBuckets, selectedMonth])

  const hourBuckets = useMemo(() => {
    if (selectedDay === null) return []
    const items = dayBuckets.find(([day]) => day === selectedDay)?.[1] ?? []
    const buckets = new Map<number, MediaFile[]>()
    items.forEach((m) => {
      const d = getMediaDate(m)
      if (!d) return
      const hour = getHours(d)
      if (!buckets.has(hour)) buckets.set(hour, [])
      buckets.get(hour)!.push(m)
    })
    return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
  }, [dayBuckets, selectedDay])

  useEffect(() => {
    if (yearBuckets.length === 0) return
    if (selectedYear === null || !yearBuckets.some(([y]) => y === selectedYear)) {
      const defaultYear = yearBuckets.find(([, items]) => items.length > 1)?.[0] ?? yearBuckets[0][0]
      setSelectedYear(defaultYear)
      setSelectedMonth(null)
      setSelectedDay(null)
      setSelectedHour(null)
      setTimelineLevel('month')
    }
  }, [selectedYear, yearBuckets])

  useEffect(() => {
    const monthIsValid = selectedMonth !== null && monthBuckets.some(([month]) => month === selectedMonth)

    if (selectedMonth !== null && !monthIsValid) {
      setSelectedMonth(null)
      setSelectedDay(null)
      setSelectedHour(null)
    }

    if ((timelineLevel === 'day' || timelineLevel === 'hour') && !monthIsValid) {
      setTimelineLevel('month')
    }
  }, [monthBuckets, selectedMonth, timelineLevel])

  useEffect(() => {
    const dayIsValid = selectedDay !== null && dayBuckets.some(([day]) => day === selectedDay)

    if (selectedDay !== null && !dayIsValid) {
      setSelectedDay(null)
      setSelectedHour(null)
    }

    if (timelineLevel === 'hour' && !dayIsValid) {
      setTimelineLevel('day')
    }
  }, [dayBuckets, selectedDay, timelineLevel])

  useEffect(() => {
    if (selectedHour === null) return
    if (!hourBuckets.some(([hour]) => hour === selectedHour)) {
      setSelectedHour(null)
    }
  }, [hourBuckets, selectedHour])

  const timelineItems = useMemo(() => {
    if (timelineLevel === 'year') {
      return yearBuckets.map(([value, items], idx) => ({
        key: `year-${value}`,
        label: String(value),
        count: items.length,
        locationCount: countUniqueLocations(items),
        color: YEAR_BAR_COLORS[idx % YEAR_BAR_COLORS.length],
        onClick: () => {
          setSelectedYear(value)
          setSelectedMonth(null)
          setSelectedDay(null)
          setSelectedHour(null)
          setTimelineLevel('month')
          setGalleryPage(1)
        },
      }))
    }
    if (timelineLevel === 'month') {
      return monthBuckets.map(([value, items], idx) => ({
        key: `month-${value}`,
        label: MONTH_NAMES[value],
        count: items.length,
        locationCount: countUniqueLocations(items),
        color: YEAR_BAR_COLORS[idx % YEAR_BAR_COLORS.length],
        onClick: () => {
          setSelectedMonth(value)
          setSelectedDay(null)
          setSelectedHour(null)
          setTimelineLevel('day')
          setGalleryPage(1)
        },
      }))
    }
    if (timelineLevel === 'day') {
      return dayBuckets.map(([value, items], idx) => ({
        key: `day-${value}`,
        label: formatDayLabel(value, selectedYear, selectedMonth),
        count: items.length,
        locationCount: countUniqueLocations(items),
        color: YEAR_BAR_COLORS[idx % YEAR_BAR_COLORS.length],
        onClick: () => {
          setSelectedDay(value)
          setSelectedHour(null)
          setTimelineLevel('hour')
          setGalleryPage(1)
        },
      }))
    }
    return hourBuckets.map(([value, items], idx) => ({
      key: `hour-${value}`,
      label: `${String(value).padStart(2, '0')}:00`,
      count: items.length,
      locationCount: countUniqueLocations(items),
      color: YEAR_BAR_COLORS[idx % YEAR_BAR_COLORS.length],
      onClick: () => {
        setSelectedHour(value)
        setGalleryPage(1)
      },
    }))
  }, [dayBuckets, hourBuckets, monthBuckets, selectedMonth, selectedYear, timelineLevel, yearBuckets])

  const timelineMedia = useMemo(() => {
    // At top-level, show all media in scope (including items without timestamps).
    if (timelineLevel === 'year') return mapScopedMedia
    if (timelineLevel === 'month') return monthBuckets.flatMap(([, items]) => items)
    if (timelineLevel === 'day') return dayBuckets.flatMap(([, items]) => items)
    if (selectedHour !== null) return hourBuckets.find(([h]) => h === selectedHour)?.[1] ?? []
    return hourBuckets.flatMap(([, items]) => items)
  }, [dayBuckets, hourBuckets, mapScopedMedia, monthBuckets, selectedHour, timelineLevel])

  const recentMedia = useMemo(() => {
    return [...timelineMedia].sort((a, b) => {
      const at = a.captured_at ? new Date(a.captured_at).getTime() : 0
      const bt = b.captured_at ? new Date(b.captured_at).getTime() : 0
      return at - bt
    })
  }, [timelineMedia])

  const galleryCols = thumbSize <= 88 ? 6 : thumbSize <= 108 ? 5 : thumbSize <= 132 ? 4 : 3
  const defaultGalleryPerPage = galleryCols * 4
  const galleryPerPage = mediaPerPage ? Number(mediaPerPage) : defaultGalleryPerPage
  const effectiveThumbHeight = Math.max(thumbSize, 96)
  const galleryPageCount = Math.max(1, Math.ceil(recentMedia.length / galleryPerPage))
  const pagedGallery = recentMedia.slice((galleryPage - 1) * galleryPerPage, galleryPage * galleryPerPage)

  useEffect(() => {
    setGalleryPage(1)
  }, [mediaPerPage, thumbSize])

  useEffect(() => {
    if (galleryPage > galleryPageCount) {
      setGalleryPage(galleryPageCount)
    }
  }, [galleryPage, galleryPageCount])

  const selectedMedia = useMemo(() => recentMedia.filter((m) => selectedIds.has(m.id)), [recentMedia, selectedIds])
  const filteredGeoMedia = useMemo(
    () => timelineMedia.filter((m) => m.latitude !== null && m.longitude !== null),
    [timelineMedia],
  )
  const yearColorMap = useMemo(() => buildTimelineColorMap(yearBuckets.map(([value]) => value)), [yearBuckets])
  const monthColorMap = useMemo(() => buildTimelineColorMap(monthBuckets.map(([value]) => value)), [monthBuckets])
  const dayColorMap = useMemo(() => buildTimelineColorMap(dayBuckets.map(([value]) => value)), [dayBuckets])
  const hourColorMap = useMemo(() => buildTimelineColorMap(hourBuckets.map(([value]) => value)), [hourBuckets])
  const markerColorByMediaId = useMemo(() => {
    const fallbackColor = '#005f63'
    const colors = new Map<number, string>()

    filteredGeoMedia.forEach((media) => {
      const date = getMediaDate(media)
      if (!date) {
        colors.set(media.id, fallbackColor)
        return
      }

      if (timelineLevel === 'year') {
        colors.set(media.id, yearColorMap.get(getYear(date)) ?? fallbackColor)
        return
      }

      if (timelineLevel === 'month') {
        colors.set(media.id, monthColorMap.get(getMonth(date)) ?? fallbackColor)
        return
      }

      if (timelineLevel === 'day') {
        colors.set(media.id, dayColorMap.get(getDate(date)) ?? fallbackColor)
        return
      }

      colors.set(media.id, hourColorMap.get(getHours(date)) ?? fallbackColor)
    })

    return colors
  }, [dayColorMap, filteredGeoMedia, hourColorMap, monthColorMap, timelineLevel, yearColorMap])
  const timelineFitToken = useMemo(
    () => `${timelineLevel}:${selectedYear ?? 'all'}:${selectedMonth ?? 'all'}:${selectedDay ?? 'all'}:${selectedHour ?? 'all'}`,
    [selectedDay, selectedHour, selectedMonth, selectedYear, timelineLevel],
  )

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBack = () => {
    if (timelineLevel === 'month') {
      setTimelineLevel('year')
      return
    }
    if (timelineLevel === 'day') {
      setTimelineLevel('month')
      setSelectedMonth(null)
      return
    }
    if (timelineLevel === 'hour') {
      setTimelineLevel('day')
      setSelectedDay(null)
      setSelectedHour(null)
    }
  }

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.delete(`/maps/${mapId}/media/${id}`)))
      notifications.show({ message: 'Selected media deleted.', color: 'teal' })
      setSelectedIds(new Set())
      qc.invalidateQueries({ queryKey: ['media', mapId] })
    } catch {
      notifications.show({ message: 'Some media could not be deleted.', color: 'red' })
      qc.invalidateQueries({ queryKey: ['media', mapId] })
    }
  }, [mapId, qc, selectedIds])

  const surface = isDark ? '#1a2028' : '#ffffff'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
  const brand = isDark ? '#22d3e0' : '#005f63'

  return (
    <Container size="xl" py="lg" fluid>
      {/* Header */}
      <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
        <Box>
          <Group gap="sm">
            <IconLayoutDashboard size={28} color={brand} aria-hidden />
            <Title order={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
              {map?.name ?? 'Loading...'}
            </Title>
          </Group>
          <Text c="dimmed" size="sm" mt={4}>
            {allMedia.length} media · {geoMedia.length} with location
          </Text>
        </Box>
        <Group gap="xs" visibleFrom="lg">
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('consolidated', 'solid')}
            leftSection={<IconMap size={16} aria-hidden />} aria-current="page">
            Consolidated
          </Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('timeline')}
            leftSection={<IconTimeline size={16} aria-hidden />}
            onClick={() => navigate(`/maps/${mapId}/timeline`)}>
            Timeline
          </Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('map')}
            leftSection={<IconMap size={16} aria-hidden />}
            onClick={() => navigate(`/maps/${mapId}/map`)}>
            Map
          </Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('gallery')}
            leftSection={<IconPhoto size={16} aria-hidden />}
            onClick={() => navigate(`/maps/${mapId}/gallery`)}>
            Gallery
          </Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('upload', 'solid')}
            leftSection={<IconUpload size={16} aria-hidden />} onClick={openUploader}>
            Upload
          </Button>
        </Group>
        <Box hiddenFrom="lg">
          <Menu shadow="md" width={220}>
            <Menu.Target>
              <ActionIcon
                variant="default"
                styles={getMapSectionActionIconStyles('consolidated')}
                size="lg"
                radius="md"
                aria-label="Open consolidated actions"
              >
                <IconDotsVertical size={18} aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconMap size={16} aria-hidden />} disabled>Consolidated</Menu.Item>
              <Menu.Item leftSection={<IconTimeline size={16} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/timeline`)}>Timeline</Menu.Item>
              <Menu.Item leftSection={<IconMap size={16} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/map`)}>Map</Menu.Item>
              <Menu.Item leftSection={<IconPhoto size={16} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/gallery`)}>Gallery</Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconUpload size={16} aria-hidden />} onClick={openUploader}>Upload</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Box>
      </Group>

      {isLoading && <Box ta="center" py="xl"><Loader color="teal" size="lg" aria-label="Loading map" /></Box>}

      {!isLoading && (
        <Box
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          }}
        >
          <Paper p="md" radius="md" style={{ backgroundColor: surface, border, gridColumn: isTabletOrSmaller ? 'span 6' : 'span 2' }}>
            <Group gap="xs">
              <IconPhoto size={20} color={brand} aria-hidden />
              <Box>
                <Text fw={800} size="xl" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e', lineHeight: 1 }}>
                  {allMedia.length}
                </Text>
                <Text size="xs" c="dimmed">Media count</Text>
              </Box>
            </Group>
          </Paper>

          <Paper p="md" radius="md" style={{ backgroundColor: surface, border, gridColumn: isTabletOrSmaller ? 'span 6' : 'span 2' }}>
            <Group gap="xs">
              <IconMapPin size={20} color={brand} aria-hidden />
              <Box>
                <Text fw={800} size="xl" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e', lineHeight: 1 }}>
                  {locationCount}
                </Text>
                <Text size="xs" c="dimmed">Location count</Text>
              </Box>
            </Group>
          </Paper>

          <Paper radius="lg" style={{ backgroundColor: surface, border, overflow: 'hidden', gridColumn: isTabletOrSmaller ? 'span 12' : 'span 8', gridRow: isTabletOrSmaller ? 'span 1' : 'span 2' }}>
            <Box style={{ height: 500 }}>
              <MapContainer
                center={[20, 0]}
                zoom={2}
                style={{ width: '100%', height: '100%' }}
                aria-label="Memory locations map"
              >
                <MapLayers />
                {filteredGeoMedia.length > 0 && <MapFit media={filteredGeoMedia} fitToken={timelineFitToken} />}
                <MapViewportTracker onBoundsChange={setViewportBounds} />
                {filteredGeoMedia.map((m) => (
                  <Marker
                    key={m.id}
                    position={[m.latitude!, m.longitude!]}
                    icon={getTimelineMarkerIcon(markerColorByMediaId.get(m.id) ?? '#005f63')}
                  >
                    <Popup>
                      <Stack gap={6} style={{ minWidth: 160 }}>
                        {m.thumbnail_name && (
                          <img src={mediaThumbUrl(mapId!, m.id)}
                            alt={m.original_name}
                            style={{ width: '100%', borderRadius: 6, display: 'block' }} />
                        )}
                        <Text fw={600} size="sm">{m.original_name}</Text>
                        {m.location_name && <Text size="xs" c="dimmed">{m.location_name}</Text>}
                        <Button size="xs" color="teal" variant="light"
                          onClick={() => navigate(`/maps/${mapId}/media/${m.id}`)}>
                          View
                        </Button>
                      </Stack>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </Box>
          </Paper>

          <Paper p="md" radius="md" style={{ backgroundColor: surface, border, gridColumn: isTabletOrSmaller ? 'span 12' : 'span 4', gridRow: isTabletOrSmaller ? 'span 1' : 'span 2' }}>
            <Text fw={800} size="xl" mb="md" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
              Memories Timeline
            </Text>
            {timelineItems.length === 0 ? (
              <Text size="sm" c="dimmed">No timeline data in current viewport.</Text>
            ) : (
              <Stack gap="lg">
                <Box>
                  <Box style={{ position: 'relative', paddingLeft: 56 }}>
                    <Box
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 20,
                        top: 8,
                        bottom: 8,
                        width: 8,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                      }}
                    />
                    <Stack gap="md">
                      {timelineItems.slice(0, 10).map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={item.onClick}
                          style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', position: 'relative' }}
                          aria-label={`${item.label}: ${item.count} media items, ${item.locationCount} locations`}
                        >
                          <Box
                            aria-hidden
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 999,
                              backgroundColor: item.color,
                              border: `5px solid ${isDark ? '#1a2028' : '#ffffff'}`,
                              boxShadow: `0 0 0 5px ${item.color}`,
                              position: 'absolute',
                              left: -43,
                              top: 6,
                            }}
                          />
                          <Text size="xl" fw={800} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                            {item.label}
                          </Text>
                          <Group gap="md">
                            <Text size="lg" style={{ color: isDark ? '#dbeaf2' : '#1a1f2e' }}>{item.count} Media items</Text>
                            <Text size="lg" style={{ color: isDark ? '#dbeaf2' : '#1a1f2e' }}>{item.locationCount} Locations</Text>
                          </Group>
                        </button>
                      ))}
                    </Stack>
                  </Box>
                </Box>

                <Box>
                  <Stack gap={8}>
                    {timelineItems.map((item) => {
                      const maxCount = Math.max(1, ...timelineItems.map((i) => i.count))
                      const widthPct = Math.max(10, (item.count / maxCount) * 100)
                      return (
                        <button
                          key={`bar-${item.key}`}
                          type="button"
                          onClick={item.onClick}
                          style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                          aria-label={`${item.label}: ${item.count} media items`}
                        >
                          <Box
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '120px minmax(0, 1fr) auto',
                              gap: 10,
                              alignItems: 'center',
                            }}
                          >
                            <Text size="lg" fw={700} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>{item.label}</Text>
                            <Box style={{ width: `${widthPct}%`, minWidth: 18, height: 32, borderRadius: 10, backgroundColor: item.color }} aria-hidden />
                            <Text size="lg" fw={700} style={{ color: isDark ? '#dbeaf2' : '#1a1f2e', whiteSpace: 'nowrap' }}>
                              {item.count}
                            </Text>
                          </Box>
                        </button>
                      )
                    })}
                  </Stack>
                </Box>
              </Stack>
            )}
            {timelineLevel !== 'year' && (
              <Button size="xs" variant="subtle" color="teal" mt="sm" leftSection={<IconArrowLeft size={14} aria-hidden />} onClick={handleBack}>
                Back
              </Button>
            )}
          </Paper>

          <Paper p="md" radius="md" style={{ backgroundColor: surface, border, gridColumn: isTabletOrSmaller ? 'span 12' : 'span 8' }}>
            <Group justify="space-between" mb="sm" wrap="wrap">
              <Text fw={700} size="sm" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                Gallery
              </Text>
              <Button size="xs" variant="subtle" color="teal"
                onClick={() => navigate(`/maps/${mapId}/gallery${selectedYear ? `?year=${selectedYear}` : ''}`)}>
                View all
              </Button>
            </Group>

            <Paper p="sm" radius="md" mb="sm" style={{ backgroundColor: isDark ? '#111827' : '#f8fafc', border }}>
              <Group justify="space-between" gap="sm" wrap="wrap" align="center">
                <Group gap="xs" style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <Text size="xs" fw={700}>Thumbnail size</Text>
                  <Slider
                    min={72}
                    max={160}
                    step={4}
                    value={thumbSize}
                    onChange={setThumbSize}
                    style={{ flex: 1 }}
                    label={(v) => `${v}px`}
                    aria-label="Consolidated gallery thumbnail size"
                  />
                </Group>
                <Select
                  value={mediaPerPage}
                  onChange={setMediaPerPage}
                  data={[
                    { value: '', label: `Auto (${defaultGalleryPerPage})` },
                    { value: '12', label: '12 per page' },
                    { value: '16', label: '16 per page' },
                    { value: '24', label: '24 per page' },
                    { value: '32', label: '32 per page' },
                    { value: '48', label: '48 per page' },
                  ]}
                  style={{ flex: '1 1 170px', minWidth: 140 }}
                  aria-label="Media items per page in consolidated view"
                  placeholder={`Auto (${defaultGalleryPerPage})`}
                  clearable
                />
                <Group gap="xs" wrap="wrap">
                  <Button size="xs" variant="subtle" leftSection={<IconSelectAll size={14} aria-hidden />} onClick={() => setSelectedIds(new Set(pagedGallery.map((m) => m.id)))}>
                    Select visible
                  </Button>
                  <Button size="xs" variant="subtle" color="gray" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    leftSection={<IconEdit size={14} aria-hidden />}
                    disabled={selectedIds.size === 0}
                    onClick={openBulkEdit}
                  >
                    Batch edit ({selectedIds.size})
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={14} aria-hidden />}
                    disabled={selectedIds.size === 0}
                    onClick={() => setConfirmBulkDeleteOpen(true)}
                  >
                    Batch delete
                  </Button>
                </Group>
              </Group>
              {viewportBounds && (
                <Text mt={6} size="xs" c="dimmed">
                  Showing media represented in current map viewport ({recentMedia.length} items).
                </Text>
              )}
            </Paper>

            {pagedGallery.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" py="md">No media found.</Text>
            ) : (
              <SimpleGrid cols={{ base: 2, sm: 3, lg: galleryCols }} spacing="sm">
                {pagedGallery.map((m) => {
                  const when = m.captured_at_local || m.captured_at
                  const place = m.location_name || m.location_city || 'Place unavailable'
                  return (
                    <Paper
                      key={m.id}
                      radius="md"
                      p="xs"
                      style={{ backgroundColor: isDark ? '#1f2937' : '#f8fafc', border, cursor: 'pointer', position: 'relative', outline: selectedIds.has(m.id) ? `2px solid ${brand}` : 'none' }}
                    >
                      <Box style={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}>
                        <Checkbox
                          checked={selectedIds.has(m.id)}
                          onChange={() => toggleSelect(m.id)}
                          aria-label={`Select ${m.original_name}`}
                          radius="sm"
                        />
                      </Box>
                      <Box
                        onClick={() => navigate(`/maps/${mapId}/media/${m.id}`)}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/maps/${mapId}/media/${m.id}`)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open ${m.original_name}`}
                      >
                      {m.thumbnail_name ? (
                        <img
                          src={mediaThumbUrl(mapId!, m.id)}
                          alt={m.user_caption ?? m.original_name}
                          style={{ width: '100%', height: effectiveThumbHeight, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                        />
                      ) : (
                        <Box style={{ width: '100%', height: effectiveThumbHeight, borderRadius: 8, backgroundColor: isDark ? '#2a3340' : '#e5edf3', display: 'grid', placeItems: 'center' }}>
                          <IconPhoto size={22} color={brand} aria-hidden />
                        </Box>
                      )}
                      <Stack gap={2} mt={6}>
                        <Text size="sm" fw={600} lineClamp={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                          {m.user_caption || place}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>{place}</Text>
                        <Group gap={4}>
                          <IconClock size={12} color={brand} aria-hidden />
                          <Text size="xs" c="dimmed">{when ? new Date(when).toLocaleString() : 'Date unavailable'}</Text>
                        </Group>
                      </Stack>
                      </Box>
                    </Paper>
                  )
                })}
              </SimpleGrid>
            )}

            {galleryPageCount > 1 && (
              <Group justify="center" mt="sm">
                <Button size="xs" variant="light" color="teal" disabled={galleryPage === 1} onClick={() => setGalleryPage((p) => Math.max(1, p - 1))}>Prev</Button>
                <Badge variant="light" color="teal">Page {galleryPage} / {galleryPageCount}</Badge>
                <Button size="xs" variant="light" color="teal" disabled={galleryPage === galleryPageCount} onClick={() => setGalleryPage((p) => Math.min(galleryPageCount, p + 1))}>Next</Button>
              </Group>
            )}
          </Paper>
        </Box>
      )}

      {/* Upload modal */}
      <Modal opened={uploaderOpen}
        onClose={() => { closeUploader(); qc.invalidateQueries({ queryKey: ['media', mapId] }) }}
        title={<Text fw={700}>Upload Media</Text>} size="lg" radius="lg" centered
        closeOnEscape={false} closeOnClickOutside={false} keepMounted>
        <MediaUploader mapId={mapId!}
          onUploadComplete={() => { closeUploader(); qc.invalidateQueries({ queryKey: ['media', mapId] }) }} />
      </Modal>

      <BulkEditModal
        opened={bulkEditOpen}
        onClose={closeBulkEdit}
        mapId={mapId!}
        selectedMedia={selectedMedia}
        onSaved={() => {
          closeBulkEdit()
          setSelectedIds(new Set())
          qc.invalidateQueries({ queryKey: ['media', mapId] })
        }}
      />

      <NativeConfirmDialog
        opened={confirmBulkDeleteOpen}
        title="Delete selected media?"
        message={`Delete ${selectedIds.size} selected item${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setConfirmBulkDeleteOpen(false)}
        onConfirm={() => {
          setConfirmBulkDeleteOpen(false)
          void handleBulkDelete()
        }}
      />
    </Container>
  )
}
