import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Container, Title, Text, Button, TextInput, Textarea, Paper, Group,
  Stack, Badge, ActionIcon, Modal, SimpleGrid, Box, ThemeIcon, Loader,
  Alert, Tooltip, useComputedColorScheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconMapPin, IconPlus, IconTrash, IconPhoto, IconMap, IconTimeline,
  IconAlertCircle, IconMapOff,
} from '@tabler/icons-react'
import api from '@/lib/api'
import type { MemoriesMap } from '@/types'
import NativeConfirmDialog from '@/components/common/NativeConfirmDialog'
import { getMapSectionActionIconStyles, getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

export default function DashboardPage() {
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const isDark = useComputedColorScheme('light') === 'dark'
  const [mapPendingDelete, setMapPendingDelete] = useState<MemoriesMap | null>(null)

  const form = useForm({
    initialValues: { name: '', description: '' },
    validate: { name: (v) => (v.trim().length < 1 ? 'Name is required' : null) },
  })

  const { data: maps, isLoading, isError } = useQuery<MemoriesMap[]>({
    queryKey: ['maps'],
    queryFn: () => api.get('/maps').then((r) => r.data),
  })

  const createMap = useMutation({
    mutationFn: (payload: { name: string; description: string }) => api.post('/maps', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maps'] })
      closeCreate(); form.reset()
      notifications.show({ message: 'Map created!', color: 'teal' })
    },
    onError: () => notifications.show({ message: 'Failed to create map.', color: 'red' }),
  })

  const deleteMap = useMutation({
    mutationFn: (id: number) => api.delete(`/maps/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maps'] })
      notifications.show({ message: 'Map deleted.', color: 'orange' })
    },
    onError: () => notifications.show({ message: 'Failed to delete map.', color: 'red' }),
  })

  const handleDelete = (map: MemoriesMap) => {
    setMapPendingDelete(map)
  }

  const surface = isDark ? '#1a2028' : '#ffffff'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
  const brand = isDark ? '#22d3e0' : '#005f63'

  return (
    <Container size="xl" py="lg">
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>My Memories Maps</Title>
          <Text c="dimmed" mt={4}>{maps ? `${maps.length} map${maps.length !== 1 ? 's' : ''}` : ''}</Text>
        </Box>
        <Button variant="default" styles={getMapSectionButtonStyles('upload', 'solid')} leftSection={<IconPlus size={18} aria-hidden />} size="md" radius="md"
          onClick={openCreate} aria-label="Create new map">New Map</Button>
      </Group>

      {isLoading && <Box ta="center" py="xl"><Loader color="teal" size="lg" aria-label="Loading maps" /></Box>}
      {isError && <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" role="alert">
        Failed to load maps. Please refresh.
      </Alert>}

      {!isLoading && maps && maps.length === 0 && (
        <Paper p="xl" radius="lg" style={{ backgroundColor: surface, border, textAlign: 'center' }}>
          <ThemeIcon size={64} radius="xl" color="teal" variant="light" mx="auto" mb="lg">
            <IconMapOff size={36} aria-hidden />
          </ThemeIcon>
          <Title order={3} mb="sm" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>No maps yet</Title>
          <Text c="dimmed" mb="lg">Create your first memories map to start pinning your adventures.</Text>
          <Button variant="default" styles={getMapSectionButtonStyles('upload', 'solid')} leftSection={<IconPlus size={18} aria-hidden />} onClick={openCreate}>
            Create your first map
          </Button>
        </Paper>
      )}

      {maps && maps.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {maps.map((map) => (
            <Paper key={map.id} shadow="sm" p="lg" radius="lg"
              style={{ backgroundColor: surface, border, display: 'flex', flexDirection: 'column' }}>
              <Group gap="sm" mb="sm">
                <ThemeIcon size={44} radius="md" color="teal" variant="light">
                  <IconMapPin size={24} aria-hidden />
                </ThemeIcon>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={700} size="md" component={Link} to={`/maps/${map.id}`}
                    style={{ color: isDark ? '#22d3e0' : '#005f63', textDecoration: 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {map.name}
                  </Text>
                  {map.description && <Text size="xs" c="dimmed" lineClamp={1}>{map.description}</Text>}
                </Box>
              </Group>
              <Badge size="sm" variant="light" color="teal" mb="lg">
                {map.media_files_count ?? 0} media
              </Badge>
              <Group gap="xs" mt="auto" justify="space-between">
                <Group gap="xs">
                  <Tooltip label="Map" withArrow>
                    <ActionIcon variant="default" styles={getMapSectionActionIconStyles('map')} radius="md" size="lg"
                      onClick={() => navigate(`/maps/${map.id}/map`)} aria-label={`Map: ${map.name}`}>
                      <IconMap size={18} aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Gallery" withArrow>
                    <ActionIcon variant="default" styles={getMapSectionActionIconStyles('gallery')} radius="md" size="lg"
                      onClick={() => navigate(`/maps/${map.id}/gallery`)} aria-label={`Gallery: ${map.name}`}>
                      <IconPhoto size={18} aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Timeline" withArrow>
                    <ActionIcon variant="default" styles={getMapSectionActionIconStyles('timeline')} radius="md" size="lg"
                      onClick={() => navigate(`/maps/${map.id}/timeline`)} aria-label={`Timeline: ${map.name}`}>
                      <IconTimeline size={18} aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Tooltip label="Delete" withArrow>
                  <ActionIcon variant="default" styles={getMapSectionActionIconStyles('danger')} radius="md" size="lg"
                    onClick={() => handleDelete(map)} aria-label={`Delete: ${map.name}`}>
                    <IconTrash size={18} aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={createOpen} onClose={closeCreate} title={<Group gap="xs"><IconMapPin size={18} color={brand} aria-hidden /><Text fw={700} size="lg">Create New Map</Text></Group>}
        radius="lg" centered>
        <form onSubmit={form.onSubmit((v) => createMap.mutate(v))} noValidate>
          <Stack gap="md">
            <TextInput label="Map name" placeholder="e.g., European Adventure 2024" required
              {...form.getInputProps('name')} />
            <Textarea label="Description" placeholder="Optional" autosize minRows={2} maxRows={5}
              {...form.getInputProps('description')} />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" styles={getMapSectionButtonStyles('map')} onClick={closeCreate}>Cancel</Button>
              <Button type="submit" variant="default" styles={getMapSectionButtonStyles('upload', 'solid')} loading={createMap.isPending}
                leftSection={<IconPlus size={16} aria-hidden />}>Create Map</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <NativeConfirmDialog
        opened={mapPendingDelete !== null}
        title="Delete map?"
        message={mapPendingDelete
          ? `Delete "${mapPendingDelete.name}"? This cannot be undone.`
          : 'Delete this map?'}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMap.isPending}
        onCancel={() => setMapPendingDelete(null)}
        onConfirm={() => {
          if (!mapPendingDelete) return
          deleteMap.mutate(mapPendingDelete.id)
          setMapPendingDelete(null)
        }}
      />
    </Container>
  )
}
