import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, getYear, getMonth, getDate, getHours } from 'date-fns'
import {
  Container, Title, Text, Group, Stack, Box, Paper, Badge, Button,
  Loader, useComputedColorScheme, SimpleGrid, Modal, Slider, Checkbox,
  Menu, ActionIcon,
} from '@mantine/core'
import {
  IconArrowLeft, IconMap, IconPhoto,
  IconClock, IconChevronRight, IconUpload, IconEdit, IconTrash, IconSelectAll,
  IconDotsVertical,
} from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import api from '@/lib/api'
import { mediaThumbUrl } from '@/lib/mediaUrl'
import type { MediaFile, MemoriesMap } from '@/types'
import { YEAR_BAR_COLORS } from '@/styles/mantine-theme'
import MediaUploader from '@/components/media/MediaUploader'
import BulkEditModal from '@/components/media/BulkEditModal'
import NativeConfirmDialog from '@/components/common/NativeConfirmDialog'
import { getMapSectionActionIconStyles, getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'
import { buildTimelineColorMap } from '@/lib/timelineColors'
import { formatUserDate, formatUserDateTime } from '@/lib/dateFormatting'
import ProgressiveMediaImage from '@/components/media/ProgressiveMediaImage'
import VirtualizedMediaGrid from '@/components/media/VirtualizedMediaGrid'
import { fetchAllMapMedia } from '@/lib/fetchAllMapMedia'

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

function parseParamInt(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function formatDayLabel(day: number, year: number | null, month: number | null, pattern = 'MMM d'): string {
  if (year === null || month === null) return String(day)
  return format(new Date(year, month, day), pattern)
}

export default function TimelinePage() {
  const { mapId } = useParams<{ mapId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const isDark = useComputedColorScheme('light') === 'dark'
  const [uploaderOpen, { open: openUploader, close: closeUploader }] = useDisclosure(false)

  const initialYearVal = parseParamInt(searchParams.get('year'))
  const initialMonthVal = parseParamInt(searchParams.get('month'))
  const initialDayVal = parseParamInt(searchParams.get('day'))

  const [level, setLevel] = useState<DrillLevel>(
    initialDayVal !== null ? 'hour' : initialMonthVal !== null ? 'day' : initialYearVal !== null ? 'month' : 'year',
  )
  const [selectedYear, setSelectedYear] = useState<number | null>(initialYearVal)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(initialMonthVal) // 0-based
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDayVal)
  const [thumbSize, setThumbSize] = useState(120)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false)
  const [bulkEditOpen, { open: openBulkEdit, close: closeBulkEdit }] = useDisclosure(false)

  const { data: map } = useQuery<MemoriesMap>({
    queryKey: ['map', mapId],
    queryFn: () => api.get(`/maps/${mapId}`).then((r) => r.data),
  })

  const { data: allMedia = [], isLoading } = useQuery<MediaFile[]>({
    queryKey: ['media', mapId],
    queryFn: () => fetchAllMapMedia(mapId!),
  })

  const mediaWithDates = useMemo(() =>
    allMedia.filter((m) => getMediaDate(m) !== null),
    [allMedia],
  )

  // Build year buckets
  const yearBuckets = useMemo(() => {
    const map_ = new Map<number, MediaFile[]>()
    for (const m of mediaWithDates) {
      const d = getMediaDate(m)!
      const y = getYear(d)
      if (!map_.has(y)) map_.set(y, [])
      map_.get(y)!.push(m)
    }
    return Array.from(map_.entries()).sort((a, b) => a[0] - b[0])
  }, [mediaWithDates])

  // Build month buckets for selected year
  const monthBuckets = useMemo(() => {
    if (selectedYear === null) return []
    const yearMedia = yearBuckets.find(([y]) => y === selectedYear)?.[1] ?? []
    const map_ = new Map<number, MediaFile[]>()
    for (const m of yearMedia) {
      const d = getMediaDate(m)!
      const mo = getMonth(d)
      if (!map_.has(mo)) map_.set(mo, [])
      map_.get(mo)!.push(m)
    }
    return Array.from(map_.entries()).sort((a, b) => a[0] - b[0])
  }, [yearBuckets, selectedYear])

  // Build day buckets
  const dayBuckets = useMemo(() => {
    if (selectedYear === null || selectedMonth === null) return []
    const monthMedia = monthBuckets.find(([mo]) => mo === selectedMonth)?.[1] ?? []
    const map_ = new Map<number, MediaFile[]>()
    for (const m of monthMedia) {
      const d = getMediaDate(m)!
      const day = getDate(d)
      if (!map_.has(day)) map_.set(day, [])
      map_.get(day)!.push(m)
    }
    return Array.from(map_.entries()).sort((a, b) => a[0] - b[0])
  }, [monthBuckets, selectedYear, selectedMonth])

  // Build hour buckets
  const hourBuckets = useMemo(() => {
    if (selectedYear === null || selectedMonth === null || selectedDay === null) return []
    const dayMedia = dayBuckets.find(([d]) => d === selectedDay)?.[1] ?? []
    const map_ = new Map<number, MediaFile[]>()
    for (const m of dayMedia) {
      const d = getMediaDate(m)!
      const hr = getHours(d)
      if (!map_.has(hr)) map_.set(hr, [])
      map_.get(hr)!.push(m)
    }
    return Array.from(map_.entries()).sort((a, b) => a[0] - b[0])
  }, [dayBuckets, selectedYear, selectedMonth, selectedDay])

  const surface = isDark ? '#1a2028' : '#ffffff'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
  const brand = isDark ? '#22d3e0' : '#005f63'
  const effectiveThumbHeight = Math.max(thumbSize, 96)
  const hourGridCols = thumbSize <= 88 ? 6 : thumbSize <= 108 ? 5 : thumbSize <= 132 ? 4 : 3

  const maxYearCount = Math.max(1, ...yearBuckets.map(([,m]) => m.length))
  const yearColorMap = useMemo(() => buildTimelineColorMap(yearBuckets.map(([value]) => value)), [yearBuckets])
  const monthColorMap = useMemo(() => buildTimelineColorMap(monthBuckets.map(([value]) => value)), [monthBuckets])
  const dayColorMap = useMemo(() => buildTimelineColorMap(dayBuckets.map(([value]) => value)), [dayBuckets])
  const hourColorMap = useMemo(() => buildTimelineColorMap(hourBuckets.map(([value]) => value)), [hourBuckets])

  const handleDrillYear = (year: number) => {
    setSelectedYear(year)
    setSelectedMonth(null)
    setSelectedDay(null)
    setLevel('month')
  }
  const handleDrillMonth = (month: number) => {
    setSelectedMonth(month)
    setSelectedDay(null)
    setLevel('day')
  }
  const handleDrillDay = (day: number) => {
    setSelectedDay(day)
    setLevel('hour')
  }
  const handleBack = () => {
    if (level === 'month') { setLevel('year'); setSelectedYear(null) }
    else if (level === 'day') { setLevel('month'); setSelectedMonth(null) }
    else if (level === 'hour') { setLevel('day'); setSelectedDay(null) }
  }

  const breadcrumb = [
    { label: 'All Years', active: level === 'year' },
    selectedYear !== null ? { label: String(selectedYear), active: level === 'month' } : null,
    selectedMonth !== null ? { label: MONTH_NAMES[selectedMonth], active: level === 'day' } : null,
    selectedDay !== null ? { label: formatDayLabel(selectedDay, selectedYear, selectedMonth, 'MMM d, yyyy'), active: level === 'hour' } : null,
  ].filter(Boolean) as { label: string; active: boolean }[]

  const overviewItems = useMemo(() => {
    if (level === 'year') {
      return yearBuckets.map(([value, items], index) => ({
        key: `year-${value}`,
        label: String(value),
        count: items.length,
        color: yearColorMap.get(value) ?? YEAR_BAR_COLORS[index % YEAR_BAR_COLORS.length],
        onClick: () => {
          setSelectedYear(value)
          setSelectedMonth(null)
          setSelectedDay(null)
          setLevel('month')
        },
      }))
    }

    if (level === 'month') {
      return monthBuckets.map(([value, items], index) => ({
        key: `month-${value}`,
        label: MONTH_NAMES[value].slice(0, 3),
        count: items.length,
        color: monthColorMap.get(value) ?? YEAR_BAR_COLORS[index % YEAR_BAR_COLORS.length],
        onClick: () => {
          setSelectedMonth(value)
          setSelectedDay(null)
          setLevel('day')
        },
      }))
    }

    if (level === 'day') {
      return dayBuckets.map(([value, items], index) => ({
        key: `day-${value}`,
        label: formatDayLabel(value, selectedYear, selectedMonth),
        count: items.length,
        color: dayColorMap.get(value) ?? YEAR_BAR_COLORS[index % YEAR_BAR_COLORS.length],
        onClick: () => {
          setSelectedDay(value)
          setLevel('hour')
        },
      }))
    }

    return hourBuckets.map(([value, items], index) => ({
      key: `hour-${value}`,
      label: `${value.toString().padStart(2, '0')}:00`,
      count: items.length,
      color: hourColorMap.get(value) ?? YEAR_BAR_COLORS[index % YEAR_BAR_COLORS.length],
      onClick: () => {
        if (items[0]) navigate(`/maps/${mapId}/media/${items[0].id}`)
      },
    }))
  }, [dayBuckets, dayColorMap, hourBuckets, hourColorMap, level, mapId, monthBuckets, monthColorMap, navigate, selectedMonth, selectedYear, yearBuckets, yearColorMap])

  const maxOverviewCount = Math.max(1, ...overviewItems.map((item) => item.count))
  const overviewLabel = level === 'year'
    ? 'Years in this map'
    : level === 'month'
      ? 'Months in selected year'
      : level === 'day'
        ? 'Days in selected month'
        : 'Hours in selected day'

  const visibleHourMedia = useMemo(
    () => (level === 'hour' ? hourBuckets.flatMap(([, items]) => items) : []),
    [hourBuckets, level],
  )

  const selectedMedia = useMemo(
    () => visibleHourMedia.filter((m) => selectedIds.has(m.id)),
    [selectedIds, visibleHourMedia],
  )

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(visibleHourMedia.map((m) => m.id)))
  }, [visibleHourMedia])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

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

  return (
    <Container size="xl" py="lg">
      {/* Header */}
      <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
        <Box>
          <Title order={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
            Timeline
          </Title>
          <Text c="dimmed" size="sm">
            {map?.name} • {mediaWithDates.length} items with dates
          </Text>
        </Box>
        <Group gap="xs" visibleFrom="lg">
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('consolidated')} leftSection={<IconMap size={16} aria-hidden />}
            onClick={() => navigate(`/maps/${mapId}/consolidated`)}>Consolidated</Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('timeline', 'solid')} leftSection={<IconClock size={16} aria-hidden />}
            aria-current="page">Timeline</Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('map')} leftSection={<IconMap size={16} aria-hidden />}
            onClick={() => navigate(`/maps/${mapId}/map`)}>Map</Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('gallery')} leftSection={<IconPhoto size={16} aria-hidden />}
            onClick={() => navigate(`/maps/${mapId}/gallery`)}>Gallery</Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('upload', 'solid')} leftSection={<IconUpload size={16} aria-hidden />}
            onClick={openUploader}>Upload</Button>
        </Group>
        <Box hiddenFrom="lg">
          <Menu shadow="md" width={220}>
            <Menu.Target>
              <ActionIcon
                variant="default"
                styles={getMapSectionActionIconStyles('consolidated')}
                size="lg"
                radius="md"
                aria-label="Open timeline actions"
              >
                <IconDotsVertical size={18} aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconMap size={16} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/consolidated`)}>Consolidated</Menu.Item>
              <Menu.Item leftSection={<IconClock size={16} aria-hidden />} disabled>Timeline</Menu.Item>
              <Menu.Item leftSection={<IconMap size={16} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/map`)}>Map</Menu.Item>
              <Menu.Item leftSection={<IconPhoto size={16} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/gallery`)}>Gallery</Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconUpload size={16} aria-hidden />} onClick={openUploader}>Upload</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Box>
      </Group>

      {isLoading && (
        <Box ta="center" py="xl"><Loader color="teal" size="lg" aria-label="Loading timeline" /></Box>
      )}

      {!isLoading && mediaWithDates.length === 0 && (
        <Paper p="xl" radius="lg" style={{ backgroundColor: surface, border, textAlign: 'center' }}>
          <Text c="dimmed" size="lg">No dated media found. Upload photos with timestamps to populate the timeline.</Text>
        </Paper>
      )}

      {!isLoading && mediaWithDates.length > 0 && (
        <Stack gap="lg">
          <Paper p="md" radius="md" style={{ backgroundColor: surface, border }} aria-label="Interactive media overview">
            <Text fw={700} size="sm" mb="xs" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
              Media Overview
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              {overviewLabel}. Click a bar to drill down or open media at the hour level.
            </Text>
            <Stack gap={6}>
              {overviewItems.map((item) => {
                const widthPct = Math.max(8, (item.count / maxOverviewCount) * 100)
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                    aria-label={`${item.label}: ${item.count} item${item.count !== 1 ? 's' : ''}`}
                  >
                    <Group gap="xs" align="center" wrap="nowrap">
                      <Text size="xs" fw={700} style={{ width: 58, flexShrink: 0 }}>{item.label}</Text>
                      <Box
                        style={{
                          width: `${widthPct}%`,
                          minWidth: 12,
                          height: 26,
                          borderRadius: 6,
                          backgroundColor: item.color,
                          opacity: 0.92,
                        }}
                        aria-hidden
                      />
                      <Badge size="sm" color="teal" variant="light">{item.count}</Badge>
                    </Group>
                  </button>
                )
              })}
            </Stack>
          </Paper>

          <Paper p="md" radius="md" style={{ backgroundColor: surface, border }} aria-label="Vertical timeline markers">
            <Text fw={700} size="sm" mb="sm" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
              Timeline Vertical
            </Text>
            <Stack gap="xs">
              {(level === 'year' ? yearBuckets : level === 'month' ? monthBuckets : level === 'day' ? dayBuckets : hourBuckets)
                .slice(0, 14)
                .map(([value, items], idx) => (
                  <Group key={`${level}-${value}`} gap="xs" wrap="nowrap">
                    <Box
                      aria-hidden
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        backgroundColor: level === 'year'
                          ? (yearColorMap.get(value) ?? YEAR_BAR_COLORS[idx % YEAR_BAR_COLORS.length])
                          : level === 'month'
                            ? (monthColorMap.get(value) ?? YEAR_BAR_COLORS[idx % YEAR_BAR_COLORS.length])
                            : level === 'day'
                              ? (dayColorMap.get(value) ?? YEAR_BAR_COLORS[idx % YEAR_BAR_COLORS.length])
                              : (hourColorMap.get(value) ?? YEAR_BAR_COLORS[idx % YEAR_BAR_COLORS.length]),
                        boxShadow: `0 0 0 3px ${isDark ? 'rgba(34,211,224,0.18)' : 'rgba(0,95,99,0.14)'}`,
                      }}
                    />
                    <Text size="sm" fw={600} style={{ color: isDark ? '#dbeaf2' : '#1a1f2e' }}>
                      {level === 'year' ? String(value)
                        : level === 'month' ? MONTH_NAMES[value].slice(0, 3)
                          : level === 'day' ? formatDayLabel(value, selectedYear, selectedMonth)
                            : `${String(value).padStart(2, '0')}:00`}
                    </Text>
                    <Badge variant="light" color="teal">{items.length}</Badge>
                  </Group>
                ))}
            </Stack>
          </Paper>

          {/* Breadcrumb / drill-down nav */}
          <Paper p="sm" radius="md" style={{ backgroundColor: surface, border }}>
            <Group gap="xs" wrap="wrap" align="center">
              {level !== 'year' && (
                <Button variant="subtle" color="teal" size="xs" leftSection={<IconArrowLeft size={14} aria-hidden />}
                  onClick={handleBack} aria-label="Go back one level">Back</Button>
              )}
              {breadcrumb.map((crumb, i) => (
                <Group key={crumb.label} gap="xs">
                  {i > 0 && <IconChevronRight size={14} color="#aaa" aria-hidden />}
                  <Badge
                    variant={crumb.active ? 'filled' : 'light'}
                    color="teal"
                    size="lg"
                    style={{ cursor: 'default' }}
                  >
                    {crumb.label}
                  </Badge>
                </Group>
              ))}
            </Group>
          </Paper>

          {/* ── YEAR LEVEL ─────────────────────────────────────────────────── */}
          {level === 'year' && (
            <Box>
              <Text fw={700} size="lg" mb="md" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                Select a Year
              </Text>
              <Stack gap="sm">
                {yearBuckets.map(([year, media_], i) => {
                  const barPct = Math.max(8, (media_.length / maxYearCount) * 100)
                  const color = yearColorMap.get(year) ?? YEAR_BAR_COLORS[i % YEAR_BAR_COLORS.length]
                  return (
                    <Paper key={year} shadow="xs" radius="md"
                      style={{ backgroundColor: surface, border, overflow: 'hidden', cursor: 'pointer' }}
                      onClick={() => handleDrillYear(year)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDrillYear(year)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${year}: ${media_.length} media. Press Enter to explore.`}
                    >
                      <Group gap={0} wrap="nowrap" style={{ height: 56 }}>
                        {/* Colored bar */}
                        <Box style={{ width: `${barPct}%`, minWidth: 8, height: '100%',
                          backgroundColor: color, flexShrink: 0, transition: 'width 0.3s' }} aria-hidden />
                        {/* Label */}
                        <Group px="md" justify="space-between" style={{ flex: 1, minWidth: 0 }}>
                          <Text fw={700} size="lg" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                            {year}
                          </Text>
                          <Group gap="xs">
                            <Badge variant="light" color="teal">{media_.length} items</Badge>
                            <IconChevronRight size={18} color={brand} aria-hidden />
                          </Group>
                        </Group>
                      </Group>
                    </Paper>
                  )
                })}
              </Stack>
            </Box>
          )}

          {/* ── MONTH LEVEL ───────────────────────────────────────────────── */}
          {level === 'month' && selectedYear !== null && (
            <Box>
              <Text fw={700} size="lg" mb="md" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                {selectedYear} — Select a Month
              </Text>
              <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="sm">
                {monthBuckets.map(([month, media_]) => {
                  const color = monthColorMap.get(month) ?? YEAR_BAR_COLORS[month % YEAR_BAR_COLORS.length]
                  return (
                    <Paper key={month} shadow="xs" radius="lg" p="md" style={{ backgroundColor: surface, border,
                      cursor: 'pointer', textAlign: 'center', borderLeft: `4px solid ${color}` }}
                      onClick={() => handleDrillMonth(month)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDrillMonth(month)}
                      tabIndex={0} role="button"
                      aria-label={`${MONTH_NAMES[month]}: ${media_.length} items`}
                    >
                      <Text fw={700} size="md" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                        {MONTH_NAMES[month].slice(0, 3)}
                      </Text>
                      <Badge mt={4} variant="light" color="teal" size="sm">{media_.length}</Badge>
                    </Paper>
                  )
                })}
              </SimpleGrid>
            </Box>
          )}

          {/* ── DAY LEVEL ─────────────────────────────────────────────────── */}
          {level === 'day' && selectedYear !== null && selectedMonth !== null && (
            <Box>
              <Text fw={700} size="lg" mb="md" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                {MONTH_NAMES[selectedMonth]} {selectedYear} — Select a Day
              </Text>
              <SimpleGrid cols={{ base: 3, sm: 5, md: 7 }} spacing="sm">
                {dayBuckets.map(([day, media_]) => {
                  const color = dayColorMap.get(day) ?? YEAR_BAR_COLORS[day % YEAR_BAR_COLORS.length]
                  return (
                    <Paper key={day} shadow="xs" radius="md" p="sm" style={{ backgroundColor: surface, border,
                      cursor: 'pointer', textAlign: 'center', borderTop: `3px solid ${color}` }}
                      onClick={() => handleDrillDay(day)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDrillDay(day)}
                      tabIndex={0} role="button"
                      aria-label={`${formatDayLabel(day, selectedYear, selectedMonth, 'MMMM d, yyyy')}: ${media_.length} items`}
                    >
                      <Text fw={700} size="sm" c="dimmed" style={{ lineHeight: 1.1 }}>
                        {formatDayLabel(day, selectedYear, selectedMonth, 'EEE')}
                      </Text>
                      <Text fw={700} size="md" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e', lineHeight: 1.2 }}>
                        {formatDayLabel(day, selectedYear, selectedMonth, 'MMM d')}
                      </Text>
                      <Badge mt={4} variant="light" color="teal" size="xs">{media_.length}</Badge>
                    </Paper>
                  )
                })}
              </SimpleGrid>
            </Box>
          )}

          {/* ── HOUR LEVEL ────────────────────────────────────────────────── */}
          {level === 'hour' && selectedDay !== null && (
            <Box>
              <Text fw={700} size="lg" mb="md" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                {MONTH_NAMES[selectedMonth!]} {selectedDay}, {selectedYear} — Hours
              </Text>
              <Paper p="sm" radius="md" mb="md" style={{ backgroundColor: surface, border }}>
                <Group justify="space-between" gap="sm" wrap="wrap" align="center">
                  <Group gap="xs" style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <Text size="xs" fw={700}>Thumbnail size</Text>
                    <Slider
                      min={72}
                      max={160}
                      step={4}
                      value={thumbSize}
                      onChange={setThumbSize}
                      style={{ flex: 1 }}
                      label={(v) => `${v}px`}
                      aria-label="Timeline thumbnail size"
                    />
                  </Group>
                  <Group gap="xs" wrap="wrap">
                    <Button size="xs" variant="subtle" leftSection={<IconSelectAll size={14} aria-hidden />} onClick={selectAllVisible}>
                      Select all visible
                    </Button>
                    <Button size="xs" variant="subtle" color="gray" onClick={clearSelection}>Clear</Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="teal"
                      disabled={selectedIds.size === 0}
                      leftSection={<IconEdit size={14} aria-hidden />}
                      onClick={openBulkEdit}
                    >
                      Batch edit ({selectedIds.size})
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      disabled={selectedIds.size === 0}
                      leftSection={<IconTrash size={14} aria-hidden />}
                      onClick={() => setConfirmBulkDeleteOpen(true)}
                    >
                      Batch delete
                    </Button>
                  </Group>
                </Group>
              </Paper>
              <Stack gap="lg">
                {hourBuckets.map(([hour, media_]) => (
                  <Box key={hour}>
                    <Group gap="sm" mb="sm">
                      <IconClock size={20} color={brand} aria-hidden />
                      <Text fw={700} size="md" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                        {hour.toString().padStart(2, '0')}:00 – {(hour + 1).toString().padStart(2, '0')}:00
                      </Text>
                      <Badge variant="light" color="teal">{media_.length} item{media_.length !== 1 ? 's' : ''}</Badge>
                    </Group>
                    <VirtualizedMediaGrid
                      items={media_}
                      columns={hourGridCols}
                      itemHeight={effectiveThumbHeight + 90}
                      height={520}
                      keyExtractor={(m) => m.id}
                      renderItem={(m) => (
                        <Paper key={m.id} radius="md" style={{ overflow: 'hidden', cursor: 'pointer', backgroundColor: surface, border, position: 'relative' }}>
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
                            aria-label={`${m.original_name}. Captured ${formatUserDateTime(m.captured_at_local || m.captured_at, '')}`}
                          >
                            {m.thumbnail_name ? (
                              <ProgressiveMediaImage src={mediaThumbUrl(mapId!, m.id)}
                                alt={m.original_name}
                                style={{ width: '100%', height: effectiveThumbHeight, objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <Box style={{ width: '100%', height: effectiveThumbHeight, backgroundColor: isDark ? '#2a3340' : '#f0f4f8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <IconPhoto size={32} color={brand} aria-hidden />
                              </Box>
                            )}
                            <Box p="xs">
                              <Text size="xs" fw={600} lineClamp={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                                {m.user_caption || m.location_name || m.location_city || 'Place unavailable'}
                              </Text>
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {m.location_name || m.location_city || 'Place unavailable'}
                              </Text>
                              {m.captured_at && (
                                <Text size="xs" c="dimmed">
                                  {formatUserDate(m.captured_at_local || m.captured_at)}
                                </Text>
                              )}
                            </Box>
                          </Box>
                        </Paper>
                      )}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}

      <Modal
        opened={uploaderOpen}
        onClose={() => {
          closeUploader()
          qc.invalidateQueries({ queryKey: ['media', mapId] })
        }}
        title={<Text fw={700}>Upload Media</Text>}
        size="lg"
        radius="lg"
        centered
        closeOnEscape={false}
        closeOnClickOutside={false}
        keepMounted
      >
        <MediaUploader
          mapId={mapId!}
          onUploadComplete={() => {
            closeUploader()
            qc.invalidateQueries({ queryKey: ['media', mapId] })
          }}
        />
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
