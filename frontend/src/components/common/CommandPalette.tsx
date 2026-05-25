import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Modal,
  TextInput,
  Stack,
  Group,
  Text,
  UnstyledButton,
  Divider,
  Badge,
  ScrollArea,
  Loader,
} from '@mantine/core'
import {
  IconSearch,
  IconMap,
  IconPhoto,
  IconTimeline,
  IconLayoutDashboard,
  IconSettings,
  IconUpload,
} from '@tabler/icons-react'
import api from '@/lib/api'
import type { MemoriesMap } from '@/types'
import { useComputedColorScheme } from '@mantine/core'

interface CommandPaletteProps {
  opened: boolean
  onClose: () => void
  currentMapId?: string | null
}

interface PaletteItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  onActivate: () => void
  group: string
}

export default function CommandPalette({ opened, onClose, currentMapId }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const computedColorScheme = useComputedColorScheme('light')
  const isDark = computedColorScheme === 'dark'
  const [activeIndex, setActiveIndex] = useState(0)

  const surface = isDark ? '#0f1f2a' : '#ffffff'
  const itemActive = isDark ? 'rgba(34,211,224,0.18)' : '#e0f5f6'
  const textPrimary = isDark ? '#f0f4f8' : '#1a1f2e'
  const textMuted = isDark ? '#94a3b8' : '#4a5568'

  const { data: mapsData, isLoading } = useQuery<{ data: MemoriesMap[] }>({
    queryKey: ['maps-palette'],
    queryFn: () => api.get('/maps').then((r) => r.data),
    staleTime: 30_000,
    enabled: opened,
  })

  const maps = mapsData?.data ?? []

  const goAndClose = (path: string) => {
    navigate(path)
    onClose()
  }

  const staticItems: PaletteItem[] = [
    {
      id: 'nav-dashboard',
      label: 'My Maps',
      description: 'Go to the dashboard',
      icon: <IconLayoutDashboard size={18} aria-hidden />,
      onActivate: () => goAndClose('/dashboard'),
      group: 'Navigation',
    },
    {
      id: 'nav-settings',
      label: 'Settings',
      description: 'Edit your profile and preferences',
      icon: <IconSettings size={18} aria-hidden />,
      onActivate: () => goAndClose('/settings'),
      group: 'Navigation',
    },
  ]

  const mapItems: PaletteItem[] = maps.map((m) => ({
    id: `map-${m.id}`,
    label: m.name,
    description: `${m.media_files_count ?? 0} media`,
    icon: <IconMap size={18} aria-hidden />,
    onActivate: () => goAndClose(`/maps/${m.id}`),
    group: 'Maps',
  }))

  const currentMapItems: PaletteItem[] = currentMapId
    ? [
        {
          id: 'map-gallery',
          label: 'Gallery',
          description: 'Browse all media in this map',
          icon: <IconPhoto size={18} aria-hidden />,
          onActivate: () => goAndClose(`/maps/${currentMapId}/gallery`),
          group: 'Current Map',
        },
        {
          id: 'map-timeline',
          label: 'Timeline',
          description: 'Year → Month → Day drill-down',
          icon: <IconTimeline size={18} aria-hidden />,
          onActivate: () => goAndClose(`/maps/${currentMapId}/timeline`),
          group: 'Current Map',
        },
        {
          id: 'map-search',
          label: query.trim() ? `Search: "${query.trim()}"` : 'Search media in this map',
          description: 'Filter by caption, location, or filename',
          icon: <IconSearch size={18} aria-hidden />,
          onActivate: () => {
            if (query.trim()) {
              goAndClose(`/maps/${currentMapId}/gallery?q=${encodeURIComponent(query.trim())}`)
            } else {
              goAndClose(`/maps/${currentMapId}/gallery`)
            }
          },
          group: 'Current Map',
        },
        {
          id: 'map-upload',
          label: 'Upload media',
          description: 'Add photos or videos to this map',
          icon: <IconUpload size={18} aria-hidden />,
          onActivate: () => goAndClose(`/maps/${currentMapId}#upload`),
          group: 'Current Map',
        },
      ]
    : []

  const allItems = [...currentMapItems, ...staticItems, ...mapItems]

  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase()),
      )
    : allItems

  // Group filtered items
  const groups = filtered.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  // Flat index for keyboard nav
  const flat = filtered

  useEffect(() => {
    setActiveIndex(0)
    setQuery('')
  }, [opened])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      flat[activeIndex]?.onActivate()
    }
  }

  // Keep active item visible
  const activeItemRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      size="lg"
      radius="lg"
      padding={0}
      styles={{
        content: { background: surface, border: isDark ? '1px solid rgba(34,211,224,0.2)' : '1px solid rgba(0,0,0,0.1)', overflow: 'hidden' },
        overlay: { backdropFilter: 'blur(4px)' },
      }}
      aria-label="Command palette"
    >
      <TextInput
        ref={inputRef}
        autoFocus
        placeholder="Search maps, navigate, or type a command…"
        leftSection={<IconSearch size={18} aria-hidden />}
        rightSection={isLoading ? <Loader size="xs" color="teal" /> : undefined}
        value={query}
        onChange={(e) => { setQuery(e.currentTarget.value); setActiveIndex(0) }}
        onKeyDown={handleKeyDown}
        aria-label="Command palette search"
        aria-autocomplete="list"
        aria-controls="command-palette-list"
        aria-activedescendant={flat[activeIndex] ? `cp-item-${flat[activeIndex].id}` : undefined}
        radius={0}
        size="lg"
        styles={{
          input: {
            border: 'none',
            borderBottom: isDark ? '1px solid rgba(34,211,224,0.18)' : '1px solid rgba(0,0,0,0.08)',
            background: 'transparent',
            color: textPrimary,
            fontSize: '1rem',
            padding: '16px 20px 16px 48px',
          },
          section: { paddingLeft: 16 },
        }}
      />

      <ScrollArea h={380} id="command-palette-list" role="listbox" aria-label="Commands">
        <Stack gap={0} pb="sm">
          {flat.length === 0 && (
            <Text
              size="sm"
              style={{ color: textMuted, textAlign: 'center', padding: '32px 0' }}
              role="status"
            >
              No results for &ldquo;{query}&rdquo;
            </Text>
          )}
          {Object.entries(groups).map(([groupName, items], gi) => (
            <div key={groupName}>
              {gi > 0 && <Divider my={4} mx="md" />}
              <Text
                size="xs"
                fw={600}
                px="md"
                pt="sm"
                pb={4}
                style={{ color: textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                aria-hidden
              >
                {groupName}
              </Text>
              {items.map((item) => {
                const flatIdx = flat.indexOf(item)
                const isItemActive = flatIdx === activeIndex
                return (
                  <UnstyledButton
                    key={item.id}
                    id={`cp-item-${item.id}`}
                    ref={isItemActive ? (activeItemRef as React.RefObject<HTMLButtonElement>) : undefined}
                    role="option"
                    aria-selected={isItemActive}
                    onClick={item.onActivate}
                    onMouseEnter={() => setActiveIndex(flatIdx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 16px',
                      borderRadius: 6,
                      margin: '2px 8px',
                      width: 'calc(100% - 16px)',
                      background: isItemActive ? itemActive : 'transparent',
                      color: textPrimary,
                      transition: 'background 120ms',
                    }}
                  >
                    <span style={{ color: isDark ? '#22d3e0' : '#005f63', flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>{item.label}</Text>
                      {item.description && (
                        <Text size="xs" style={{ color: textMuted }} truncate>{item.description}</Text>
                      )}
                    </span>
                    {item.group === 'Maps' && (
                      <Badge size="xs" variant="light" color="teal" aria-hidden>map</Badge>
                    )}
                  </UnstyledButton>
                )
              })}
            </div>
          ))}
        </Stack>
      </ScrollArea>

      <Group justify="space-between" px="md" py="xs" style={{ borderTop: isDark ? '1px solid rgba(34,211,224,0.1)' : '1px solid rgba(0,0,0,0.06)' }}>
        <Group gap="md">
          <Text size="xs" style={{ color: textMuted }}>
            <kbd style={{ fontFamily: 'inherit', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 3 }}>↑↓</kbd>
            {' '}navigate
          </Text>
          <Text size="xs" style={{ color: textMuted }}>
            <kbd style={{ fontFamily: 'inherit', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 3 }}>↵</kbd>
            {' '}open
          </Text>
          <Text size="xs" style={{ color: textMuted }}>
            <kbd style={{ fontFamily: 'inherit', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 3 }}>Esc</kbd>
            {' '}close
          </Text>
        </Group>
        <Text size="xs" style={{ color: textMuted }}>
          <kbd style={{ fontFamily: 'inherit', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 3 }}>Ctrl K</kbd>
        </Text>
      </Group>
    </Modal>
  )
}
