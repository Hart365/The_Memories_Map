import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { format, getDate, getHours, getMonth, getYear, parseISO } from 'date-fns'
import { useParams } from 'react-router-dom'
import {
  Alert,
  ActionIcon,
  Box,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Pagination,
  Paper,
  Select,
  Slider,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  useComputedColorScheme,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconClock,
  IconGrid3x3,
  IconLayoutGrid,
  IconLock,
  IconMail,
  IconMap,
  IconMapPin,
  IconPhoto,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTimeline,
  IconX,
} from '@tabler/icons-react'
import sharedApi from '@/lib/sharedApi'
import { sharedMediaFileUrl, sharedMediaThumbUrl } from '@/lib/mediaUrl'
import type { SharedMapResponse, SharedMediaFile } from '@/types'
import MapLayers from '@/components/map/MapLayers'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'
import { buildTimelineColorMap } from '@/lib/timelineColors'
import { YEAR_BAR_COLORS } from '@/styles/mantine-theme'
import { formatUserDate } from '@/lib/dateFormatting'
import ProgressiveMediaImage from '@/components/media/ProgressiveMediaImage'

const guestSessionKeys = {
  accessToken: 'guest_access_token',
  mapId: 'guest_map_id',
  shareToken: 'guest_share_token',
  email: 'guest_email',
}

type DrillLevel = 'year' | 'month' | 'day' | 'hour'

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

function MapFit({ media, fitToken }: { media: SharedMediaFile[]; fitToken: string }) {
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

function getMediaDate(m: SharedMediaFile): Date | null {
  const s = m.captured_at_local || m.captured_at
  if (!s) return null
  try {
    return parseISO(s)
  } catch {
    return null
  }
}

function countUniqueLocations(items: SharedMediaFile[]): number {
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

function formatDayLabel(day: number, year: number | null, month: number | null): string {
  if (year === null || month === null) return String(day)
  return format(new Date(year, month, day), 'MMMM d')
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function clearGuestSession() {
  sessionStorage.removeItem(guestSessionKeys.accessToken)
  sessionStorage.removeItem(guestSessionKeys.mapId)
  sessionStorage.removeItem(guestSessionKeys.shareToken)
  sessionStorage.removeItem(guestSessionKeys.email)
}

export default function GuestAccessPage() {
  const { token } = useParams<{ token: string }>()
  const isDark = useComputedColorScheme('light') === 'dark'
  const storedEmail = sessionStorage.getItem(guestSessionKeys.email) ?? ''
  const [email, setEmail] = useState(storedEmail)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [timelineLevel, setTimelineLevel] = useState<DrillLevel>('year')
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [viewportBounds, setViewportBounds] = useState<L.LatLngBounds | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortAsc, setSortAsc] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all')
  const [thumbSize, setThumbSize] = useState(120)
  const [mediaPerPage, setMediaPerPage] = useState<string | null>(null)
  const [galleryPage, setGalleryPage] = useState(1)
  const [activeMediaId, setActiveMediaId] = useState<number | null>(null)

  const currentShareToken = sessionStorage.getItem(guestSessionKeys.shareToken)
  const currentGuestToken = sessionStorage.getItem(guestSessionKeys.accessToken)
  const currentMapId = sessionStorage.getItem(guestSessionKeys.mapId)
  const hasAccess = Boolean(token && currentShareToken === token && currentGuestToken && currentMapId)

  const { data, isLoading } = useQuery<SharedMapResponse>({
    queryKey: ['shared-map', token, currentMapId],
    enabled: hasAccess,
    queryFn: async () => {
      const response = await sharedApi.get(`/shared/maps/${currentMapId}`)
      return response.data
    },
    retry: 1,
  })

  const scopedMediaForState = (() => {
    if (!hasAccess || !data) return [] as SharedMediaFile[]
    const allMedia = data.media ?? []
    if (!viewportBounds) return allMedia

    const scopedGeoIds = new Set(
      allMedia
        .filter((m) => m.latitude !== null && m.longitude !== null)
        .filter((m) => viewportBounds.contains([m.latitude!, m.longitude!]))
        .map((m) => m.id),
    )

    return allMedia.filter((m) => scopedGeoIds.has(m.id))
  })()

  const availableYears = (() => {
    const years = new Set<number>()
    scopedMediaForState.forEach((m) => {
      const d = getMediaDate(m)
      if (d) years.add(getYear(d))
    })
    return Array.from(years).sort((a, b) => a - b)
  })()

  const availableMonths = (() => {
    if (selectedYear === null) return [] as number[]
    const months = new Set<number>()
    scopedMediaForState.forEach((m) => {
      const d = getMediaDate(m)
      if (d && getYear(d) === selectedYear) months.add(getMonth(d))
    })
    return Array.from(months).sort((a, b) => a - b)
  })()

  const availableDays = (() => {
    if (selectedYear === null || selectedMonth === null) return [] as number[]
    const days = new Set<number>()
    scopedMediaForState.forEach((m) => {
      const d = getMediaDate(m)
      if (d && getYear(d) === selectedYear && getMonth(d) === selectedMonth) days.add(getDate(d))
    })
    return Array.from(days).sort((a, b) => a - b)
  })()

  const availableHours = (() => {
    if (selectedYear === null || selectedMonth === null || selectedDay === null) return [] as number[]
    const hours = new Set<number>()
    scopedMediaForState.forEach((m) => {
      const d = getMediaDate(m)
      if (d && getYear(d) === selectedYear && getMonth(d) === selectedMonth && getDate(d) === selectedDay) {
        hours.add(getHours(d))
      }
    })
    return Array.from(hours).sort((a, b) => a - b)
  })()

  useEffect(() => {
    if (!hasAccess || !data) return

    if (availableYears.length === 0) {
      if (timelineLevel !== 'year') setTimelineLevel('year')
      if (selectedYear !== null) setSelectedYear(null)
      if (selectedMonth !== null) setSelectedMonth(null)
      if (selectedDay !== null) setSelectedDay(null)
      if (selectedHour !== null) setSelectedHour(null)
      return
    }

    if (selectedYear === null || !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
      setSelectedMonth(null)
      setSelectedDay(null)
      setSelectedHour(null)
      setTimelineLevel('month')
      return
    }

    if (selectedMonth !== null && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(null)
      setSelectedDay(null)
      setSelectedHour(null)
      if (timelineLevel === 'day' || timelineLevel === 'hour') setTimelineLevel('month')
      return
    }

    if (selectedDay !== null && !availableDays.includes(selectedDay)) {
      setSelectedDay(null)
      setSelectedHour(null)
      if (timelineLevel === 'hour') setTimelineLevel('day')
      return
    }

    if (selectedHour !== null && !availableHours.includes(selectedHour)) {
      setSelectedHour(null)
    }
  }, [
    availableDays,
    availableHours,
    availableMonths,
    availableYears,
    data,
    hasAccess,
    selectedDay,
    selectedHour,
    selectedMonth,
    selectedYear,
    timelineLevel,
  ])

  useEffect(() => {
    setGalleryPage(1)
  }, [
    filterType,
    mediaPerPage,
    searchQuery,
    selectedDay,
    selectedHour,
    selectedMonth,
    selectedYear,
    sortAsc,
    thumbSize,
    timelineLevel,
    viewportBounds,
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data } = await sharedApi.post(`/auth/guest-access/${token}`, {
        email,
      })

      sessionStorage.setItem(guestSessionKeys.accessToken, data.access_token)
      sessionStorage.setItem(guestSessionKeys.mapId, String(data.map_id))
      sessionStorage.setItem(guestSessionKeys.shareToken, String(token ?? ''))
      sessionStorage.setItem(guestSessionKeys.email, email.trim().toLowerCase())
      window.location.reload()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Access denied. Check the invited email address and secure link.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (hasAccess && data) {
    const allMedia = data.media ?? []
    const geoMedia = allMedia.filter((m) => m.latitude !== null && m.longitude !== null)

    const viewportMedia = viewportBounds
      ? geoMedia.filter((m) => viewportBounds.contains([m.latitude!, m.longitude!]))
      : geoMedia
    const viewportMediaIds = new Set(viewportMedia.map((m) => m.id))
    const mapScopedMedia = viewportBounds
      ? allMedia.filter((m) => viewportMediaIds.has(m.id))
      : allMedia

    const mediaWithDates = mapScopedMedia.filter((m) => getMediaDate(m) !== null)

    const yearBuckets = (() => {
      const buckets = new Map<number, SharedMediaFile[]>()
      mediaWithDates.forEach((m) => {
        const d = getMediaDate(m)
        if (!d) return
        const y = getYear(d)
        if (!buckets.has(y)) buckets.set(y, [])
        buckets.get(y)!.push(m)
      })
      return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
    })()

    const monthBuckets = (() => {
      if (selectedYear === null) return []
      const items = yearBuckets.find(([y]) => y === selectedYear)?.[1] ?? []
      const buckets = new Map<number, SharedMediaFile[]>()
      items.forEach((m) => {
        const d = getMediaDate(m)
        if (!d) return
        const mo = getMonth(d)
        if (!buckets.has(mo)) buckets.set(mo, [])
        buckets.get(mo)!.push(m)
      })
      return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
    })()

    const dayBuckets = (() => {
      if (selectedMonth === null) return []
      const items = monthBuckets.find(([mo]) => mo === selectedMonth)?.[1] ?? []
      const buckets = new Map<number, SharedMediaFile[]>()
      items.forEach((m) => {
        const d = getMediaDate(m)
        if (!d) return
        const day = getDate(d)
        if (!buckets.has(day)) buckets.set(day, [])
        buckets.get(day)!.push(m)
      })
      return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
    })()

    const hourBuckets = (() => {
      if (selectedDay === null) return []
      const items = dayBuckets.find(([day]) => day === selectedDay)?.[1] ?? []
      const buckets = new Map<number, SharedMediaFile[]>()
      items.forEach((m) => {
        const d = getMediaDate(m)
        if (!d) return
        const hour = getHours(d)
        if (!buckets.has(hour)) buckets.set(hour, [])
        buckets.get(hour)!.push(m)
      })
      return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
    })()

    const yearColorMap = buildTimelineColorMap(yearBuckets.map(([value]) => value))
    const monthColorMap = buildTimelineColorMap(monthBuckets.map(([value]) => value))
    const dayColorMap = buildTimelineColorMap(dayBuckets.map(([value]) => value))
    const hourColorMap = buildTimelineColorMap(hourBuckets.map(([value]) => value))

    const timelineItems = (() => {
      if (timelineLevel === 'year') {
        return yearBuckets.map(([value, items], index) => ({
          key: `year-${value}`,
          label: String(value),
          count: items.length,
          locationCount: countUniqueLocations(items),
          color: yearColorMap.get(value) ?? YEAR_BAR_COLORS[index % YEAR_BAR_COLORS.length],
          onClick: () => {
            setSelectedYear(value)
            setSelectedMonth(null)
            setSelectedDay(null)
            setSelectedHour(null)
            setTimelineLevel('month')
          },
        }))
      }

      if (timelineLevel === 'month') {
        return monthBuckets.map(([value, items], index) => ({
          key: `month-${value}`,
          label: MONTH_NAMES[value].slice(0, 3),
          count: items.length,
          locationCount: countUniqueLocations(items),
          color: monthColorMap.get(value) ?? YEAR_BAR_COLORS[index % YEAR_BAR_COLORS.length],
          onClick: () => {
            setSelectedMonth(value)
            setSelectedDay(null)
            setSelectedHour(null)
            setTimelineLevel('day')
          },
        }))
      }

      if (timelineLevel === 'day') {
        return dayBuckets.map(([value, items], index) => ({
          key: `day-${value}`,
          label: formatDayLabel(value, selectedYear, selectedMonth),
          count: items.length,
          locationCount: countUniqueLocations(items),
          color: dayColorMap.get(value) ?? YEAR_BAR_COLORS[index % YEAR_BAR_COLORS.length],
          onClick: () => {
            setSelectedDay(value)
            setSelectedHour(null)
            setTimelineLevel('hour')
          },
        }))
      }

      return hourBuckets.map(([value, items], index) => ({
        key: `hour-${value}`,
        label: `${value.toString().padStart(2, '0')}:00`,
        count: items.length,
        locationCount: countUniqueLocations(items),
        color: hourColorMap.get(value) ?? YEAR_BAR_COLORS[index % YEAR_BAR_COLORS.length],
        onClick: () => {
          setSelectedHour(value)
          if (items[0]) setActiveMediaId(items[0].id)
        },
      }))
    })()

    const filteredTimelineMedia = (() => {
      const dated = mediaWithDates
      if (timelineLevel === 'year') return dated
      if (timelineLevel === 'month' && selectedYear !== null) {
        return dated.filter((m) => {
          const d = getMediaDate(m)
          return d ? getYear(d) === selectedYear : false
        })
      }
      if (timelineLevel === 'day' && selectedYear !== null && selectedMonth !== null) {
        return dated.filter((m) => {
          const d = getMediaDate(m)
          return d ? getYear(d) === selectedYear && getMonth(d) === selectedMonth : false
        })
      }
      if (timelineLevel === 'hour' && selectedYear !== null && selectedMonth !== null && selectedDay !== null) {
        return dated.filter((m) => {
          const d = getMediaDate(m)
          return d
            ? getYear(d) === selectedYear && getMonth(d) === selectedMonth && getDate(d) === selectedDay
              && (selectedHour === null || getHours(d) === selectedHour)
            : false
        })
      }
      return dated
    })()

    const filteredTimelineIds = new Set(filteredTimelineMedia.map((m) => m.id))
    const filteredGeoMedia = geoMedia.filter((m) => filteredTimelineIds.has(m.id))

    const markerColorByMediaId = (() => {
      const colors = new Map<number, string>()
      const fallbackColor = isDark ? '#22d3e0' : '#005f63'

      filteredGeoMedia.forEach((media, index) => {
        const date = getMediaDate(media)
        if (!date) {
          colors.set(media.id, fallbackColor)
          return
        }
        if (timelineLevel === 'year') {
          colors.set(media.id, yearColorMap.get(getYear(date)) ?? YEAR_BAR_COLORS[index % YEAR_BAR_COLORS.length])
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
    })()

    const timelineFitToken = `${timelineLevel}:${selectedYear ?? 'all'}:${selectedMonth ?? 'all'}:${selectedDay ?? 'all'}:${selectedHour ?? 'all'}`

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

    const filteredSorted = (() => {
      let list = filteredTimelineMedia
      if (filterType !== 'all') {
        list = list.filter((m) =>
          filterType === 'video' ? m.mime_type.startsWith('video/') : m.mime_type.startsWith('image/'),
        )
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        list = list.filter((m) =>
          (m.original_name ?? '').toLowerCase().includes(q)
          || (m.user_caption ?? '').toLowerCase().includes(q)
          || (m.location_name ?? '').toLowerCase().includes(q)
          || (m.location_city ?? '').toLowerCase().includes(q),
        )
      }

      return [...list].sort((a, b) => {
        const at = a.captured_at ? new Date(a.captured_at).getTime() : 0
        const bt = b.captured_at ? new Date(b.captured_at).getTime() : 0
        return sortAsc ? at - bt : bt - at
      })
    })()

    const gridCols = thumbSize <= 88 ? 8 : thumbSize <= 108 ? 6 : thumbSize <= 132 ? 5 : 4
    const defaultPageSize = gridCols * 5
    const pageSize = mediaPerPage ? Number(mediaPerPage) : defaultPageSize
    const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize))
    const safeGalleryPage = Math.min(galleryPage, totalPages)
    const pagedMedia = filteredSorted.slice((safeGalleryPage - 1) * pageSize, safeGalleryPage * pageSize)

    const activeMedia = activeMediaId ? allMedia.find((m) => m.id === activeMediaId) ?? null : null

    const locationCount = countUniqueLocations(allMedia)
    const effectiveThumbHeight = Math.max(thumbSize, 96)
    const surface = isDark ? '#1a2028' : '#ffffff'
    const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
    const brand = isDark ? '#22d3e0' : '#005f63'

    return (
      <Container size="xl" py="lg" fluid>
        <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
          <Box>
            <Group gap="sm" wrap="wrap">
              <IconMap size={28} color={brand} aria-hidden />
              <Title order={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                {data.name}
              </Title>
              <Badge color="teal" variant="light">Read-only shared access</Badge>
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              {allMedia.length} media · {geoMedia.length} with location · verified for {email}
            </Text>
          </Box>
          <Group gap="xs" wrap="wrap">
            <Button variant="default" size="sm" styles={getMapSectionButtonStyles('timeline', 'solid')} leftSection={<IconTimeline size={16} aria-hidden />}>
              Timeline
            </Button>
            <Button variant="default" size="sm" styles={getMapSectionButtonStyles('map', 'solid')} leftSection={<IconMapPin size={16} aria-hidden />}>
              Map
            </Button>
            <Button variant="default" size="sm" styles={getMapSectionButtonStyles('gallery', 'solid')} leftSection={<IconPhoto size={16} aria-hidden />}>
              Gallery
            </Button>
            <Button variant="default" styles={getMapSectionButtonStyles('danger')} onClick={() => {
              clearGuestSession()
              window.location.reload()
            }}>
              Leave shared map
            </Button>
          </Group>
        </Group>

        <Box
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          }}
        >
          <Paper p="md" radius="md" style={{ backgroundColor: surface, border, gridColumn: 'span 2' }}>
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

          <Paper p="md" radius="md" style={{ backgroundColor: surface, border, gridColumn: 'span 2' }}>
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

          <Paper radius="lg" style={{ backgroundColor: surface, border, overflow: 'hidden', gridColumn: 'span 8', gridRow: 'span 2' }}>
            <Box style={{ height: 500 }}>
              <MapContainer
                center={[20, 0]}
                zoom={2}
                style={{ width: '100%', height: '100%' }}
                aria-label="Shared memory locations map"
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
                          <ProgressiveMediaImage
                            src={sharedMediaThumbUrl(data.id, m.id)}
                            alt={m.original_name}
                            style={{ width: '100%', borderRadius: 6, display: 'block' }}
                          />
                        )}
                        <Text fw={600} size="sm">{m.user_caption ?? m.original_name}</Text>
                        {m.location_name && <Text size="xs" c="dimmed">{m.location_name}</Text>}
                        <Button size="xs" color="teal" variant="light" onClick={() => setActiveMediaId(m.id)}>
                          View
                        </Button>
                      </Stack>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </Box>
          </Paper>

          <Paper p="md" radius="md" style={{ backgroundColor: surface, border, gridColumn: 'span 4', gridRow: 'span 2' }}>
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

                {timelineLevel !== 'year' && (
                  <Button size="xs" variant="subtle" color="teal" mt="sm" leftSection={<IconArrowLeft size={14} aria-hidden />} onClick={handleBack}>
                    Back
                  </Button>
                )}
              </Stack>
            )}
          </Paper>

          <Paper p="md" radius="md" style={{ backgroundColor: surface, border, gridColumn: 'span 8' }}>
            <Group justify="space-between" mb="sm" wrap="wrap">
              <Text fw={700} size="sm" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                Gallery
              </Text>
              <Text size="xs" c="dimmed">Filtered by timeline and current map viewport</Text>
            </Group>

            <Paper p="sm" radius="md" mb="sm" style={{ backgroundColor: isDark ? '#111827' : '#f8fafc', border }}>
              <Group gap="sm" wrap="wrap" align="flex-end">
                <TextInput
                  placeholder="Search media..."
                  leftSection={<IconSearch size={16} aria-hidden />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  rightSection={searchQuery ? (
                    <ActionIcon variant="subtle" size="sm" onClick={() => setSearchQuery('')} aria-label="Clear search">
                      <IconX size={14} aria-hidden />
                    </ActionIcon>
                  ) : null}
                  style={{ flex: '1 1 240px', minWidth: 0 }}
                  aria-label="Search shared media"
                />

                <Select
                  value={filterType}
                  onChange={(v) => setFilterType((v ?? 'all') as 'all' | 'photo' | 'video')}
                  data={[
                    { value: 'all', label: 'All types' },
                    { value: 'photo', label: 'Photos' },
                    { value: 'video', label: 'Videos' },
                  ]}
                  style={{ flex: '1 1 140px', minWidth: 120 }}
                  aria-label="Filter by media type"
                />

                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  leftSection={sortAsc ? <IconSortAscending size={14} aria-hidden /> : <IconSortDescending size={14} aria-hidden />}
                  onClick={() => setSortAsc((v) => !v)}
                >
                  {sortAsc ? 'Oldest first' : 'Newest first'}
                </Button>

                <Group gap="xs" style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <IconGrid3x3 size={16} color={brand} aria-hidden />
                  <Slider
                    value={thumbSize}
                    onChange={setThumbSize}
                    min={72}
                    max={160}
                    step={4}
                    style={{ flex: 1 }}
                    label={(v) => `${v}px`}
                    aria-label="Thumbnail size"
                  />
                  <IconLayoutGrid size={16} color={brand} aria-hidden />
                </Group>

                <Select
                  value={mediaPerPage}
                  onChange={setMediaPerPage}
                  data={[
                    { value: '', label: `Auto (${defaultPageSize})` },
                    { value: '24', label: '24 per page' },
                    { value: '35', label: '35 per page' },
                    { value: '42', label: '42 per page' },
                    { value: '56', label: '56 per page' },
                    { value: '70', label: '70 per page' },
                  ]}
                  style={{ flex: '1 1 170px', minWidth: 140 }}
                  aria-label="Media items per page"
                  placeholder={`Auto (${defaultPageSize})`}
                  clearable
                />
              </Group>
            </Paper>

            {filteredSorted.length === 0 ? (
              <Text c="dimmed" size="sm">No media matches the current map/timeline/filter combination.</Text>
            ) : (
              <>
                <SimpleGrid cols={gridCols} spacing={8} style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
                  {pagedMedia.map((m) => {
                    const place = m.location_name || m.location_city || 'Place unavailable'
                    const title = m.user_caption || m.original_name
                    const when = m.captured_at_local || m.captured_at

                    return (
                      <Paper key={m.id} radius="md" style={{ overflow: 'hidden', cursor: 'pointer', backgroundColor: isDark ? '#2a3340' : '#f0f4f8' }}>
                        <div
                          onClick={() => setActiveMediaId(m.id)}
                          onKeyDown={(e) => e.key === 'Enter' && setActiveMediaId(m.id)}
                          tabIndex={0}
                          role="button"
                          aria-label={`Open ${m.original_name}`}
                          style={{ display: 'block' }}
                        >
                          {m.thumbnail_name ? (
                            <ProgressiveMediaImage
                              src={sharedMediaThumbUrl(data.id, m.id)}
                              alt={title}
                              style={{ width: '100%', height: effectiveThumbHeight, objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <Box style={{ width: '100%', height: effectiveThumbHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <IconPhoto size={32} color={brand} aria-hidden />
                            </Box>
                          )}

                          <Box p="xs" style={{ backgroundColor: isDark ? '#1f2937' : '#ffffff' }}>
                            <Text size="sm" fw={600} lineClamp={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                              {title}
                            </Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>{place}</Text>
                            <Group gap={4} mt={2} wrap="nowrap">
                              <IconClock size={12} color={brand} aria-hidden />
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {formatUserDate(when)}
                              </Text>
                            </Group>
                          </Box>
                        </div>
                      </Paper>
                    )
                  })}
                </SimpleGrid>

                {filteredSorted.length > pageSize && (
                  <Group justify="center" mt="md">
                    <Pagination total={totalPages} value={safeGalleryPage} onChange={setGalleryPage} color="teal" radius="md" />
                  </Group>
                )}
              </>
            )}
          </Paper>
        </Box>

        <Modal
          opened={Boolean(activeMedia)}
          onClose={() => setActiveMediaId(null)}
          title={<Text fw={700}>{activeMedia?.user_caption ?? activeMedia?.original_name ?? 'Shared media'}</Text>}
          size="xl"
          centered
        >
          {activeMedia && (
            <Stack gap="md">
              <Paper p="sm" radius="md" style={{ backgroundColor: surface, border }}>
                {activeMedia.mime_type.startsWith('video/') ? (
                  <video controls style={{ width: '100%', borderRadius: 10 }}>
                    <source src={sharedMediaFileUrl(data.id, activeMedia.id)} type={activeMedia.mime_type} />
                  </video>
                ) : (
                  <ProgressiveMediaImage
                    src={sharedMediaFileUrl(data.id, activeMedia.id)}
                    alt={activeMedia.user_caption ?? activeMedia.original_name}
                    style={{ width: '100%', borderRadius: 10, display: 'block' }}
                  />
                )}
              </Paper>
              <Paper p="sm" radius="md" style={{ backgroundColor: surface, border }}>
                <Text size="sm"><Text component="span" fw={700}>File:</Text> {activeMedia.original_name}</Text>
                {activeMedia.captured_at && (
                  <Text size="sm"><Text component="span" fw={700}>Captured:</Text> {formatUserDate(activeMedia.captured_at_local || activeMedia.captured_at)}</Text>
                )}
                {(activeMedia.latitude !== null && activeMedia.longitude !== null) && (
                  <Text size="sm"><Text component="span" fw={700}>Coordinates:</Text> {activeMedia.latitude.toFixed(5)}, {activeMedia.longitude.toFixed(5)}</Text>
                )}
                {activeMedia.location_name && (
                  <Text size="sm"><Text component="span" fw={700}>Location:</Text> {activeMedia.location_name}</Text>
                )}
              </Paper>
            </Stack>
          )}
        </Modal>
      </Container>
    )
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: isDark
          ? 'linear-gradient(160deg, #0f1318 0%, #12252f 60%, #0b1a22 100%)'
          : 'linear-gradient(160deg, #eaf7f6 0%, #d9f0ef 50%, #cce8e6 100%)',
      }}
    >
      <Container size={520} w="100%" py="lg">
        <Paper p="xl" radius="lg" shadow="xl" style={{ backgroundColor: isDark ? '#1a2028' : '#ffffff' }}>
          <Stack gap="md">
            <Title order={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Access Shared Map</Title>
            <Text c="dimmed">
              Enter the invited email address to open this secure, read-only shared map. The link and the email address must match.
            </Text>

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" role="alert">
                {error}
              </Alert>
            )}

            {isLoading && hasAccess && (
              <Alert icon={<IconLock size={16} />} color="teal" variant="light" role="status">
                Opening shared map…
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate aria-label="Guest access form">
              <Stack gap="sm">
                <TextInput
                  id="g-email"
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  autoComplete="email"
                  required
                />
                <Button type="submit" variant="default" styles={getMapSectionButtonStyles('consolidated', 'solid')} fullWidth loading={loading} leftSection={<IconMail size={16} aria-hidden />}>
                  Access map
                </Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
