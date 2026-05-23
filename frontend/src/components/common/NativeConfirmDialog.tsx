import { useEffect, useId, useRef } from 'react'
import { Button, Group, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { getMapSectionButtonStyles, getMapSectionPalette } from '@/lib/mapSectionButtonStyles'

interface NativeConfirmDialogProps {
  opened: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export default function NativeConfirmDialog({
  opened,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  tone = 'default',
  onConfirm,
  onCancel,
}: NativeConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const messageId = useId()
  const confirmTone = tone === 'danger' ? 'danger' : 'upload'
  const accentPalette = getMapSectionPalette(confirmTone)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (opened) {
      if (!dialog.open) {
        dialog.showModal()
      }
      return
    }

    if (dialog.open) {
      dialog.close()
    }
  }, [opened])

  return (
    <dialog
      ref={dialogRef}
      className="native-confirm-dialog"
      data-tone={tone}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onCancel()
        }
      }}
    >
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon
            size="lg"
            radius="xl"
            style={{
              backgroundColor: accentPalette.softBackground,
              color: accentPalette.softText,
              border: `2px solid ${accentPalette.softBorder}`,
              boxShadow: accentPalette.softShadow,
            }}
          >
            <IconAlertTriangle size={18} aria-hidden />
          </ThemeIcon>
          <Stack gap={2}>
            <Text id={titleId} fw={800} size="lg" style={{ lineHeight: 1.2 }}>
              {title}
            </Text>
            <Text id={messageId} size="sm" c="dimmed">
              {message}
            </Text>
          </Stack>
        </Group>

        <Group justify="flex-end" mt="xs">
          <Button variant="default" styles={getMapSectionButtonStyles('map')} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="default" styles={getMapSectionButtonStyles(confirmTone, 'solid')} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </dialog>
  )
}
