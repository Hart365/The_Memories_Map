import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDisclosure } from '@mantine/hooks'
import {
  Badge,
  Breadcrumbs,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
  useComputedColorScheme,
  Modal,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconEdit,
  IconMap,
  IconPhoto,
  IconTimeline,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import api from '@/lib/api'
import { mediaFileUrl } from '@/lib/mediaUrl'
import type { MediaFile } from '@/types'
import NoteEditor from '@/components/notes/NoteEditor'
import LocationEditor from '@/components/media/LocationEditor'
import MediaUploader from '@/components/media/MediaUploader'
import NativeConfirmDialog from '@/components/common/NativeConfirmDialog'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

export default function MediaViewerPage() {
  const { mapId, mediaId } = useParams<{ mapId: string; mediaId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isDark = useComputedColorScheme('light') === 'dark'
  const [editing, setEditing] = useState(false)
  const [caption, setCaption] = useState('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [uploaderOpen, { open: openUploader, close: closeUploader }] = useDisclosure(false)

  const surface = isDark ? '#1a2028' : '#ffffff'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'

  const { data: media, isLoading } = useQuery<MediaFile>({
    queryKey: ['media-item', mapId, mediaId],
    queryFn: () => api.get(`/maps/${mapId}/media/${mediaId}`).then((r) => {
      setCaption(r.data.user_caption ?? '')
      return r.data
    }),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { user_caption: string }) => api.put(`/maps/${mapId}/media/${mediaId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-item', mapId, mediaId] })
      qc.invalidateQueries({ queryKey: ['media', mapId] })
      setEditing(false)
      notifications.show({ message: 'Caption updated.', color: 'teal' })
    },
    onError: () => notifications.show({ message: 'Failed to update caption.', color: 'red' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/maps/${mapId}/media/${mediaId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media', mapId] })
      navigate(`/maps/${mapId}/gallery`)
      notifications.show({ message: 'Media deleted.', color: 'teal' })
    },
    onError: () => notifications.show({ message: 'Failed to delete media.', color: 'red' }),
  })

  if (isLoading) {
    return (
      <Container size="lg" py="lg">
        <Text aria-live="polite" aria-busy="true">Loading media...</Text>
      </Container>
    )
  }

  if (!media) {
    return (
      <Container size="lg" py="lg">
        <Text>Media not found.</Text>
      </Container>
    )
  }

  const isVideo = media.mime_type.startsWith('video/')

  return (
    <Container size="xl" py="lg">
      <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
        <Breadcrumbs>
          <Link to="/dashboard">My Maps</Link>
          <Link to={`/maps/${mapId}`}>Consolidated</Link>
          <Text>{media.user_caption ?? media.original_name}</Text>
        </Breadcrumbs>
        <Group gap="xs">
          <Button variant="default" size="xs" styles={getMapSectionButtonStyles('consolidated')} leftSection={<IconMap size={14} aria-hidden />} onClick={() => navigate(`/maps/${mapId}`)}>
            Consolidated
          </Button>
          <Button variant="default" size="xs" styles={getMapSectionButtonStyles('timeline')} leftSection={<IconTimeline size={14} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/timeline`)}>
            Timeline
          </Button>
          <Button variant="default" size="xs" styles={getMapSectionButtonStyles('map')} leftSection={<IconMap size={14} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/map`)}>
            Map
          </Button>
          <Button variant="default" size="xs" styles={getMapSectionButtonStyles('gallery')} leftSection={<IconPhoto size={14} aria-hidden />} onClick={() => navigate(`/maps/${mapId}/gallery`)}>
            Gallery
          </Button>
          <Button variant="default" size="xs" styles={getMapSectionButtonStyles('upload', 'solid')} leftSection={<IconUpload size={14} aria-hidden />} onClick={openUploader}>
            Upload
          </Button>
        </Group>
      </Group>

      <Title order={1} mb="md" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
        {media.user_caption ?? media.original_name}
      </Title>

      <Paper p="md" radius="md" mb="md" style={{ backgroundColor: surface, border }}>
        {isVideo ? (
          <video controls style={{ width: '100%', borderRadius: 10 }} aria-label={media.user_caption ?? media.original_name}>
            <source src={mediaFileUrl(mapId!, mediaId!)} type={media.mime_type} />
            <track
              kind="captions"
              srcLang="en"
              label="English captions"
              src="data:text/vtt;charset=utf-8,WEBVTT%0A%0ANOTE%20Captions%20not%20yet%20available."
            />
          </video>
        ) : (
          <img
            src={mediaFileUrl(mapId!, mediaId!)}
            alt={media.user_caption ?? media.original_name}
            style={{ width: '100%', borderRadius: 10, display: 'block' }}
          />
        )}
      </Paper>

      <Stack gap="md">
        <Paper p="md" radius="md" style={{ backgroundColor: surface, border }}>
          <Group justify="space-between" align="center" mb="xs">
            <Text fw={700}>Details</Text>
            <Badge variant="light" color="teal">{isVideo ? 'Video' : 'Image'}</Badge>
          </Group>
          <Stack gap={4}>
            <Text size="sm"><Text component="span" fw={700}>File:</Text> {media.original_name}</Text>
            {media.captured_at && (
              <Text size="sm">
                <Text component="span" fw={700}>Captured:</Text>{' '}
                {new Date(media.captured_at_local || media.captured_at).toLocaleString()}
                {media.captured_at_local && media.timezone ? ` (${media.timezone})` : ''}
              </Text>
            )}
            {(media.latitude !== null && media.longitude !== null) && (
              <Text size="sm"><Text component="span" fw={700}>Coordinates:</Text> {media.latitude.toFixed(5)}, {media.longitude.toFixed(5)}</Text>
            )}
            {media.camera_make && (
              <Text size="sm"><Text component="span" fw={700}>Camera:</Text> {media.camera_make} {media.camera_model}</Text>
            )}
            {(media.width && media.height) && (
              <Text size="sm"><Text component="span" fw={700}>Dimensions:</Text> {media.width} x {media.height}</Text>
            )}
            {media.duration_seconds && (
              <Text size="sm"><Text component="span" fw={700}>Duration:</Text> {Math.round(media.duration_seconds)}s</Text>
            )}
            {media.size_bytes && (
              <Text size="sm"><Text component="span" fw={700}>Size:</Text> {(media.size_bytes / 1024 / 1024).toFixed(2)} MB</Text>
            )}
          </Stack>
        </Paper>

        <Paper p="md" radius="md" style={{ backgroundColor: surface, border }}>
          <Group justify="space-between" align="center" mb="sm">
            <Text fw={700}>Caption</Text>
            {!editing && (
              <Button size="xs" variant="light" color="teal" leftSection={<IconEdit size={14} aria-hidden />} onClick={() => setEditing(true)}>
                Edit caption
              </Button>
            )}
          </Group>
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ user_caption: caption }) }} aria-label="Edit caption form">
              <Stack gap="sm">
                <Textarea
                  label="Caption"
                  value={caption}
                  onChange={(e) => setCaption(e.currentTarget.value)}
                  rows={3}
                  maxLength={2000}
                />
                <Group justify="flex-end">
                  <Button type="button" variant="subtle" color="gray" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button type="submit" color="teal" leftSection={<IconDeviceFloppy size={14} aria-hidden />} loading={updateMutation.isPending}>
                    Save caption
                  </Button>
                </Group>
              </Stack>
            </form>
          ) : (
            <Text size="sm" c={media.user_caption ? undefined : 'dimmed'}>
              {media.user_caption || 'No caption yet.'}
            </Text>
          )}
        </Paper>

        <LocationEditor mapId={mapId!} media={media} />

        <Paper p="md" radius="md" style={{ backgroundColor: surface, border }}>
          <NoteEditor mapId={Number(mapId)} mediaId={Number(mediaId)} noteType="media" />
        </Paper>

        <Paper p="md" radius="md" style={{ backgroundColor: surface, border: '1px solid rgba(220,38,38,0.35)' }}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs">
              <IconAlertTriangle size={18} color="#dc2626" aria-hidden />
              <Text fw={700} c="red">Danger zone</Text>
            </Group>
            <Button
              color="red"
              leftSection={<IconTrash size={14} aria-hidden />}
              loading={deleteMutation.isPending}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete media
            </Button>
          </Group>
        </Paper>
      </Stack>

      <Modal
        opened={uploaderOpen}
        onClose={() => {
          closeUploader()
          qc.invalidateQueries({ queryKey: ['media', mapId] })
          qc.invalidateQueries({ queryKey: ['media-item', mapId, mediaId] })
        }}
        title={<Text fw={700}>Upload Media</Text>}
        size="lg"
        radius="lg"
        centered
      >
        <MediaUploader
          mapId={mapId!}
          onUploadComplete={() => {
            closeUploader()
            qc.invalidateQueries({ queryKey: ['media', mapId] })
            qc.invalidateQueries({ queryKey: ['media-item', mapId, mediaId] })
          }}
        />
      </Modal>

      <NativeConfirmDialog
        opened={confirmDeleteOpen}
        title="Delete media file?"
        message="This media item will be permanently removed. This action cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false)
          deleteMutation.mutate()
        }}
      />
    </Container>
  )
}
