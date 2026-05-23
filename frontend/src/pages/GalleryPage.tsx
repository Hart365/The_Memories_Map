import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Container, Title, Text, Button, Paper, Group, Box,
  SimpleGrid, Badge, ActionIcon, Loader, Alert, Checkbox,
  Slider, Tooltip, TextInput, Modal, useComputedColorScheme,
  Select, Pagination, Menu,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconPhoto, IconMap, IconTimeline, IconSearch,
  IconSelectAll, IconX, IconEdit, IconAlertCircle,
  IconVideo, IconLocation, IconSortAscending, IconSortDescending,
  IconUpload, IconGrid3x3, IconLayoutGrid, IconClock, IconTrash,
  IconDotsVertical,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import api from '@/lib/api'
import { mediaThumbUrl } from '@/lib/mediaUrl'
import type { MemoriesMap, MediaFile } from '@/types'
import MediaUploader from '@/components/media/MediaUploader'
import BulkEditModal from '@/components/media/BulkEditModal'
import NativeConfirmDialog from '@/components/common/NativeConfirmDialog'
import { getMapSectionActionIconStyles, getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'
import { formatUserDate } from '@/lib/dateFormatting'

export default function GalleryPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDark = useComputedColorScheme('light') === 'dark'
  const qc = useQueryClient()

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')
  const [sortAsc, setSortAsc] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all')
  const [thumbSize, setThumbSize] = useState(120)
  const [mediaPerPage, setMediaPerPage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false)
  const [uploaderOpen, { open: openUploader, close: closeUploader }] = useDisclosure(false)
  const [bulkEditOpen, { open: openBulkEdit, close: closeBulkEdit }] = useDisclosure(false)

  const { data: map } = useQuery<MemoriesMap>({
    queryKey: ['map', mapId],
    queryFn: () => api.get(`/maps/${mapId}`).then((r) => r.data),
  })
  const { data: allMedia = [], isLoading, isError } = useQuery<MediaFile[]>({
    queryKey: ['media', mapId],
    queryFn: () => api.get(`/maps/${mapId}/media`).then((r) => r.data.data),
  })

  const filteredSorted = useMemo(() => {
    let list = allMedia
    if (filterType !== 'all') {
      list = list.filter((m) =>
        filterType === 'video' ? m.mime_type.startsWith('video/') : m.mime_type.startsWith('image/'),
      )
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (m) =>
          m.original_name.toLowerCase().includes(q) ||
          (m.user_caption ?? '').toLowerCase().includes(q) ||
          (m.location_name ?? '').toLowerCase().includes(q) ||
          (m.location_city ?? '').toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => {
      const at = a.captured_at ? new Date(a.captured_at).getTime() : 0
      const bt = b.captured_at ? new Date(b.captured_at).getTime() : 0
      return sortAsc ? at - bt : bt - at
    })
  }, [allMedia, filterType, searchQuery, sortAsc])

  const gridCols = thumbSize <= 88 ? 8 : thumbSize <= 108 ? 6 : thumbSize <= 132 ? 5 : 4
  const effectiveThumbHeight = Math.max(thumbSize, 96)
  const defaultPageSize = gridCols * 7
  const pageSize = mediaPerPage ? Number(mediaPerPage) : defaultPageSize
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize))
  const pagedMedia = useMemo(
    () => filteredSorted.slice((page - 1) * pageSize, page * pageSize),
    [filteredSorted, page, pageSize],
  )

  useEffect(() => {
    setPage(1)
  }, [searchQuery, sortAsc, filterType, thumbSize, mediaPerPage])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])
  const selectAll = () => setSelected(new Set(filteredSorted.map((m) => m.id)))
  const clearSelection = () => setSelected(new Set())

  const selectedMedia = useMemo(() =>
    allMedia.filter((m) => selected.has(m.id)),
    [allMedia, selected],
  )

  const handleBulkDelete = useCallback(async () => {
    if (selected.size === 0) return
    try {
      await Promise.all(Array.from(selected).map((id) => api.delete(`/maps/${mapId}/media/${id}`)))
      notifications.show({ message: 'Selected media deleted.', color: 'teal' })
      clearSelection()
      qc.invalidateQueries({ queryKey: ['media', mapId] })
    } catch {
      notifications.show({ message: 'Some media could not be deleted.', color: 'red' })
      qc.invalidateQueries({ queryKey: ['media', mapId] })
    }
  }, [mapId, qc, selected])

  const surface = isDark ? '#1a2028' : '#ffffff'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
  const brand = isDark ? '#22d3e0' : '#005f63'

  return (
    <Container size="xl" py="lg">
      {/* Header */}
      <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
        <Box>
          <Title order={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Gallery</Title>
          <Text c="dimmed" size="sm">
            {map?.name} • {filteredSorted.length} of {allMedia.length} items
          </Text>
        </Box>
        <Group gap="xs" visibleFrom="lg">
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('consolidated')} leftSection={<IconMap size={16} aria-hidden />}
            onClick={() => navigate(`/maps/${mapId}/consolidated`)}>Consolidated</Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('timeline')} leftSection={<IconTimeline size={16} aria-hidden />}
            onClick={() => navigate(`/maps/${mapId}/timeline`)}>Timeline</Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('map')} leftSection={<IconMap size={16} aria-hidden />}
            onClick={() => navigate(`/maps/${mapId}/map`)}>Map</Button>
          <Button variant="default" size="sm" styles={getMapSectionButtonStyles('gallery', 'solid')} leftSection={<IconPhoto size={16} aria-hidden />}
            aria-current="page">Gallery</Button>
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
                aria-label="Open gallery actions"
              >
                <IconDotsVertical size={18} aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconMap size={16} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/consolidated`)}>Consolidated</Menu.Item>
              <Menu.Item leftSection={<IconTimeline size={16} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/timeline`)}>Timeline</Menu.Item>
              <Menu.Item leftSection={<IconMap size={16} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/map`)}>Map</Menu.Item>
              <Menu.Item leftSection={<IconPhoto size={16} aria-hidden />} disabled>Gallery</Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconUpload size={16} aria-hidden />} onClick={openUploader}>Upload</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Box>
      </Group>

      {/* Toolbar */}
      <Paper p="sm" radius="md" mb="md" style={{ backgroundColor: surface, border }}>
        <Group gap="sm" wrap="wrap" align="flex-end">
          {/* Search */}
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
            aria-label="Search media"
          />

          {/* Type filter */}
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

          {/* Sort */}
          <Tooltip label={sortAsc ? 'Oldest first' : 'Newest first'} withArrow>
            <ActionIcon variant="light" color="teal" size="lg" onClick={() => setSortAsc((v) => !v)}
              aria-label={sortAsc ? 'Currently: oldest first. Click for newest first' : 'Currently: newest first. Click for oldest first'}>
              {sortAsc ? <IconSortAscending size={18} aria-hidden /> : <IconSortDescending size={18} aria-hidden />}
            </ActionIcon>
          </Tooltip>

          {/* Grid columns */}
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
              { value: '84', label: '84 per page' },
            ]}
            style={{ flex: '1 1 170px', minWidth: 140 }}
            aria-label="Media items per page"
            placeholder={`Auto (${defaultPageSize})`}
            clearable
          />
        </Group>

        {/* Selection toolbar */}
        {selected.size > 0 && (
          <Group gap="sm" mt="sm" wrap="wrap">
            <Badge variant="filled" color="teal" size="lg">{selected.size} selected</Badge>
            <Button size="xs" variant="light" color="teal"
              leftSection={<IconEdit size={14} aria-hidden />} onClick={openBulkEdit}>
              Bulk Edit
            </Button>
            <Button size="xs" variant="light" color="red"
              leftSection={<IconTrash size={14} aria-hidden />} onClick={() => setConfirmBulkDeleteOpen(true)}>
              Bulk Delete
            </Button>
            <Button size="xs" variant="subtle" color="gray" onClick={clearSelection}
              leftSection={<IconX size={14} aria-hidden />}>Clear</Button>
          </Group>
        )}

        {/* Select all / clear */}
        <Group gap="sm" mt="xs">
          <Button size="xs" variant="subtle" leftSection={<IconSelectAll size={14} aria-hidden />}
            onClick={selected.size === filteredSorted.length ? clearSelection : selectAll}>
            {selected.size === filteredSorted.length ? 'Deselect all' : 'Select all'}
          </Button>
        </Group>
      </Paper>

      {isLoading && <Box ta="center" py="xl"><Loader color="teal" aria-label="Loading gallery" /></Box>}
      {isError && <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" role="alert">
        Failed to load media.
      </Alert>}

      {!isLoading && filteredSorted.length === 0 && (
        <Paper p="xl" radius="lg" style={{ backgroundColor: surface, border, textAlign: 'center' }}>
          <IconPhoto size={48} color={brand} aria-hidden style={{ margin: '0 auto 16px' }} />
          <Text c="dimmed">No media found{searchQuery ? ` matching "${searchQuery}"` : ''}.</Text>
        </Paper>
      )}

      {/* Media grid */}
      {filteredSorted.length > 0 && (
        <SimpleGrid cols={gridCols} spacing={8}
          style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
          {pagedMedia.map((m) => {
            const isSelected = selected.has(m.id)
            const isVideo = m.mime_type.startsWith('video/')
            const when = m.captured_at_local || m.captured_at
            const place = m.location_name || m.location_city || 'Place unavailable'
            const title = m.user_caption || place
            return (
              <Paper key={m.id} radius="md" style={{
                position: 'relative', overflow: 'hidden', cursor: 'pointer',
                outline: isSelected ? `3px solid ${brand}` : 'none',
                outlineOffset: 2,
                backgroundColor: isDark ? '#2a3340' : '#f0f4f8',
              }}>
                {/* Checkbox overlay */}
                <Box style={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}>
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleSelect(m.id)}
                    aria-label={`Select ${m.original_name}`}
                    radius="sm"
                  />
                </Box>
                {/* Video badge */}
                {isVideo && (
                  <Badge style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}
                    color="violet" variant="filled" size="xs">
                    <IconVideo size={10} aria-hidden /> Video
                  </Badge>
                )}
                {/* Location badge */}
                {m.latitude !== null && (
                  <Box style={{ position: 'absolute', bottom: 6, left: 6, zIndex: 2 }}>
                    <IconLocation size={14} color="#fff" aria-label="Has location" />
                  </Box>
                )}
                {/* Thumbnail */}
                <div
                  onClick={() => navigate(`/maps/${mapId}/media/${m.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/maps/${mapId}/media/${m.id}`)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${m.original_name}`}
                  style={{ display: 'block' }}
                >
                  {m.thumbnail_name ? (
                    <img
                      src={mediaThumbUrl(mapId!, m.id)}
                      alt={m.user_caption ?? m.original_name}
                      style={{ width: '100%', height: effectiveThumbHeight, objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <Box style={{ width: '100%', height: effectiveThumbHeight, display: 'flex',
                      alignItems: 'center', justifyContent: 'center' }}>
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
      )}

      {filteredSorted.length > pageSize && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} color="teal" radius="md" />
        </Group>
      )}

      {/* Uploader modal */}
      <Modal opened={uploaderOpen} onClose={() => { closeUploader(); qc.invalidateQueries({ queryKey: ['media', mapId] }) }}
        title={<Text fw={700}>Upload Media</Text>} size="lg" radius="lg" centered
        closeOnEscape={false} closeOnClickOutside={false} keepMounted>
        <MediaUploader mapId={mapId!} onUploadComplete={() => { closeUploader(); qc.invalidateQueries({ queryKey: ['media', mapId] }) }} />
      </Modal>

      {/* Bulk edit modal */}
      <BulkEditModal
        opened={bulkEditOpen}
        onClose={closeBulkEdit}
        mapId={mapId!}
        selectedMedia={selectedMedia}
        onSaved={() => {
          closeBulkEdit()
          clearSelection()
          qc.invalidateQueries({ queryKey: ['media', mapId] })
        }}
      />

      <NativeConfirmDialog
        opened={confirmBulkDeleteOpen}
        title="Delete selected media?"
        message={`Delete ${selected.size} selected item${selected.size !== 1 ? 's' : ''}? This cannot be undone.`}
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
