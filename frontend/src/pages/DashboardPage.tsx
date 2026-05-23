import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Container, Title, Text, Button, TextInput, Textarea, Paper, Group,
  Stack, Badge, ActionIcon, Modal, SimpleGrid, Box, ThemeIcon, Loader,
  Alert, Tooltip, useComputedColorScheme, Divider, Menu,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconMapPin, IconPlus, IconTrash, IconPhoto, IconMap, IconTimeline,
  IconAlertCircle, IconMapOff, IconShare2, IconCopy, IconRefresh, IconMailForward,
  IconDotsVertical,
} from '@tabler/icons-react'
import api from '@/lib/api'
import type { MapGuest, MemoriesMap } from '@/types'
import NativeConfirmDialog from '@/components/common/NativeConfirmDialog'
import { getMapSectionActionIconStyles, getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

export default function DashboardPage() {
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const isDark = useComputedColorScheme('light') === 'dark'
  const [mapPendingDelete, setMapPendingDelete] = useState<MemoriesMap | null>(null)
  const [mapPendingShare, setMapPendingShare] = useState<MemoriesMap | null>(null)
  const [guestPendingRevoke, setGuestPendingRevoke] = useState<MapGuest | null>(null)
  const [shareEmail, setShareEmail] = useState('')
  const [latestShareUrl, setLatestShareUrl] = useState('')
  const [busyGuestActionId, setBusyGuestActionId] = useState<number | null>(null)

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

  const shareMap = useMutation({
    mutationFn: (payload: { id: number; email: string }) => api.post(`/maps/${payload.id}/guests`, { email: payload.email }),
    onSuccess: (response) => {
      setLatestShareUrl(response.data.share_url ?? '')
      qc.invalidateQueries({ queryKey: ['map-guests', mapPendingShare?.id] })
      const mailFailed = Boolean(response?.data?.mail_failed)
      notifications.show({
        message: mailFailed
          ? 'Share link created. Email could not be sent, so copy the link manually.'
          : 'Secure share link created and invite sent.',
        color: mailFailed ? 'orange' : 'teal',
      })
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Failed to create share link.'
      notifications.show({ message, color: 'red' })
    },
  })

  const { data: guests = [] } = useQuery<MapGuest[]>({
    queryKey: ['map-guests', mapPendingShare?.id],
    enabled: Boolean(mapPendingShare),
    queryFn: () => api.get(`/maps/${mapPendingShare?.id}/guests`).then((r) => r.data),
  })

  const rotateGuestLink = async (guest: MapGuest) => {
    if (!mapPendingShare) return
    setBusyGuestActionId(guest.id)
    try {
      const response = await api.post(`/maps/${mapPendingShare.id}/guests/${guest.id}/rotate-link`)
      setLatestShareUrl(response.data.share_url ?? '')
      notifications.show({ message: 'Share link rotated.', color: 'teal' })
      qc.invalidateQueries({ queryKey: ['map-guests', mapPendingShare.id] })
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Failed to rotate share link.'
      notifications.show({ message, color: 'red' })
    } finally {
      setBusyGuestActionId(null)
    }
  }

  const resendGuestInvite = async (guest: MapGuest) => {
    if (!mapPendingShare) return
    setBusyGuestActionId(guest.id)
    try {
      const response = await api.post(`/maps/${mapPendingShare.id}/guests/${guest.id}/resend-invite`)
      setLatestShareUrl(response.data.share_url ?? '')
      notifications.show({ message: 'Invite resent with a new secure link.', color: 'teal' })
      qc.invalidateQueries({ queryKey: ['map-guests', mapPendingShare.id] })
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Failed to resend invite.'
      notifications.show({ message, color: 'red' })
    } finally {
      setBusyGuestActionId(null)
    }
  }

  const revokeGuestAccess = async () => {
    if (!mapPendingShare || !guestPendingRevoke) return
    setBusyGuestActionId(guestPendingRevoke.id)
    try {
      await api.delete(`/maps/${mapPendingShare.id}/guests/${guestPendingRevoke.id}`)
      notifications.show({ message: 'Guest access revoked.', color: 'orange' })
      qc.invalidateQueries({ queryKey: ['map-guests', mapPendingShare.id] })
      setGuestPendingRevoke(null)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Failed to revoke guest access.'
      notifications.show({ message, color: 'red' })
    } finally {
      setBusyGuestActionId(null)
    }
  }

  const handleDelete = (map: MemoriesMap) => {
    setMapPendingDelete(map)
  }

  const handleShare = (map: MemoriesMap) => {
    setMapPendingShare(map)
    setShareEmail('')
    setLatestShareUrl('')
  }

  const surface = isDark ? '#1a2028' : '#ffffff'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
  const brand = isDark ? '#22d3e0' : '#005f63'

  return (
    <Container size="xl" py="lg">
      <Group justify="space-between" mb="xl" wrap="wrap" gap="sm">
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
                <Group gap="xs" visibleFrom="lg">
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
                  <Tooltip label="Share read-only link" withArrow>
                    <ActionIcon variant="default" styles={getMapSectionActionIconStyles('consolidated')} radius="md" size="lg"
                      onClick={() => handleShare(map)} aria-label={`Share: ${map.name}`}>
                      <IconShare2 size={18} aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Box hiddenFrom="lg">
                  <Menu shadow="md" width={220}>
                    <Menu.Target>
                      <ActionIcon
                        variant="default"
                        styles={getMapSectionActionIconStyles('consolidated')}
                        radius="md"
                        size="lg"
                        aria-label={`Open actions for ${map.name}`}
                      >
                        <IconDotsVertical size={18} aria-hidden />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconMap size={16} aria-hidden />} onClick={() => navigate(`/maps/${map.id}/map`)}>
                        Map
                      </Menu.Item>
                      <Menu.Item leftSection={<IconPhoto size={16} aria-hidden />} onClick={() => navigate(`/maps/${map.id}/gallery`)}>
                        Gallery
                      </Menu.Item>
                      <Menu.Item leftSection={<IconTimeline size={16} aria-hidden />} onClick={() => navigate(`/maps/${map.id}/timeline`)}>
                        Timeline
                      </Menu.Item>
                      <Menu.Item leftSection={<IconShare2 size={16} aria-hidden />} onClick={() => handleShare(map)}>
                        Share
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item color="red" leftSection={<IconTrash size={16} aria-hidden />} onClick={() => handleDelete(map)}>
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Box>
                <Tooltip label="Delete" withArrow visibleFrom="lg">
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

      <Modal
        opened={mapPendingShare !== null}
        onClose={() => setMapPendingShare(null)}
        title={<Group gap="xs"><IconShare2 size={18} color={brand} aria-hidden /><Text fw={700} size="lg">Share Map</Text></Group>}
        radius="lg"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
            Create a secure, read-only link for <strong>{mapPendingShare?.name}</strong>. The guest must have both the link and the invited email address to open the map.
          </Text>
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Invite email address"
              placeholder="name@example.com"
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 220 }}
              autoComplete="email"
              required
            />
            <Button
              variant="default"
              styles={getMapSectionButtonStyles('upload', 'solid')}
              leftSection={<IconShare2 size={16} aria-hidden />}
              loading={shareMap.isPending}
              disabled={!mapPendingShare || shareEmail.trim().length === 0}
              onClick={() => mapPendingShare && shareMap.mutate({ id: mapPendingShare.id, email: shareEmail.trim() })}
            >
              Create share link
            </Button>
          </Group>

          {latestShareUrl && (
            <Paper p="md" radius="md" style={{ backgroundColor: surface, border }}>
              <Stack gap="xs">
                <Text fw={700} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>Latest secure link</Text>
                <Group wrap="wrap" align="flex-end">
                  <TextInput value={latestShareUrl} readOnly aria-label="Latest share link" style={{ flex: 1, minWidth: 220 }} />
                  <Button
                    variant="default"
                    styles={getMapSectionButtonStyles('consolidated')}
                    leftSection={<IconCopy size={16} aria-hidden />}
                    onClick={async () => {
                      await navigator.clipboard.writeText(latestShareUrl)
                      notifications.show({ message: 'Share link copied.', color: 'teal' })
                    }}
                  >
                    Copy link
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}

          <Divider label="Current invited guests" labelPosition="center" />

          {guests.length === 0 ? (
            <Text c="dimmed">No active share invitations for this map yet.</Text>
          ) : (
            <Stack gap="xs">
              {guests.map((guest) => (
                <Paper key={guest.id} p="sm" radius="md" style={{ backgroundColor: surface, border }}>
                  <Group justify="space-between" wrap="wrap" gap="xs">
                    <Box>
                      <Text fw={700} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>{guest.email}</Text>
                      <Text size="xs" c="dimmed">
                        Invited {new Date(guest.invited_at).toLocaleString()}
                        {guest.last_accessed_at ? ` • Opened ${new Date(guest.last_accessed_at).toLocaleString()}` : ' • Not opened yet'}
                      </Text>
                    </Box>
                    <Group gap="xs" wrap="wrap">
                      {guest.expires_at && (
                        <Badge variant="light" color="teal">
                          Expires {new Date(guest.expires_at).toLocaleDateString()}
                        </Badge>
                      )}
                      <Tooltip label="Rotate secure link" withArrow>
                        <ActionIcon
                          variant="default"
                          styles={getMapSectionActionIconStyles('map')}
                          aria-label={`Rotate link for ${guest.email}`}
                          loading={busyGuestActionId === guest.id}
                          onClick={() => rotateGuestLink(guest)}
                        >
                          <IconRefresh size={16} aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Resend invite email" withArrow>
                        <ActionIcon
                          variant="default"
                          styles={getMapSectionActionIconStyles('upload')}
                          aria-label={`Resend invite to ${guest.email}`}
                          loading={busyGuestActionId === guest.id}
                          onClick={() => resendGuestInvite(guest)}
                        >
                          <IconMailForward size={16} aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Revoke access" withArrow>
                        <ActionIcon
                          variant="default"
                          styles={getMapSectionActionIconStyles('danger')}
                          aria-label={`Revoke access for ${guest.email}`}
                          loading={busyGuestActionId === guest.id}
                          onClick={() => setGuestPendingRevoke(guest)}
                        >
                          <IconTrash size={16} aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Modal>

      <NativeConfirmDialog
        opened={guestPendingRevoke !== null}
        title="Revoke shared access?"
        message={guestPendingRevoke
          ? `Remove read-only access for ${guestPendingRevoke.email}? The current link will stop working immediately.`
          : 'Revoke this guest access?'}
        confirmLabel="Revoke"
        tone="danger"
        loading={guestPendingRevoke !== null && busyGuestActionId === guestPendingRevoke.id}
        onCancel={() => setGuestPendingRevoke(null)}
        onConfirm={revokeGuestAccess}
      />

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
