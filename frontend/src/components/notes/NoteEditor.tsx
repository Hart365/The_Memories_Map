import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import {
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  useComputedColorScheme,
} from '@mantine/core'
import api from '@/lib/api'
import type { MapNote } from '@/types'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

interface Props {
  mapId: number
  mediaId?: number
  noteType: MapNote['note_type']
}

export default function NoteEditor({ mapId, mediaId, noteType }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const isDark = useComputedColorScheme('light') === 'dark'

  const surface = isDark ? '#1a2028' : '#ffffff'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/maps/${mapId}/notes`, {
        note_type: noteType,
        media_id: mediaId ?? null,
        title: title || null,
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', String(mapId)] })
      setOpen(false)
      setTitle('')
      setBody('')
      notifications.show({ message: 'Note saved.', color: 'teal' })
    },
    onError: () => notifications.show({ message: 'Failed to save note.', color: 'red' }),
  })

  if (!open) {
    return (
      <Button
        type="button"
        variant="default"
        styles={getMapSectionButtonStyles('gallery')}
        size="sm"
        onClick={() => setOpen(true)}
        aria-expanded="false"
        aria-controls="note-editor-form"
      >
        Add note
      </Button>
    )
  }

  return (
    <Paper
      id="note-editor-form"
      p="md"
      radius="md"
      role="region"
      aria-label="Note editor"
      style={{ backgroundColor: surface, border }}
    >
      <Text fw={700} size="sm" mb="sm" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
        Add a note
      </Text>
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
        aria-label="Note form"
      >
        <Stack gap="sm">
          <TextInput
            id="note-title"
            label="Title"
            description="Optional"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
          />
          <Textarea
            id="note-body"
            label="Note"
            required
            aria-required="true"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
          />
          <Text size="xs" c="dimmed" aria-live="polite" aria-atomic="true">
            {body.length} / 5000
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button type="button" variant="default" styles={getMapSectionButtonStyles('map')} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="default" styles={getMapSectionButtonStyles('upload', 'solid')} disabled={!body.trim()} loading={mutation.isPending}>
              Save note
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  )
}
