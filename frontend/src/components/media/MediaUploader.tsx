import { useRef, useState } from 'react'
import {
  Button, Text, Group, Stack, Box, Progress, Badge, ActionIcon,
  Tooltip, useComputedColorScheme,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconUpload, IconTrash, IconCheck, IconX, IconFile } from '@tabler/icons-react'
import api from '@/lib/api'
import NativeConfirmDialog from '@/components/common/NativeConfirmDialog'
import { getMapSectionActionIconStyles, getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

type FileStatus = 'pending' | 'uploading' | 'success' | 'duplicate' | 'error'

interface Props {
  mapId: string | number
  onUploadComplete?: () => void
}

interface FileItem {
  file: File
  status: FileStatus
  progress: number
  errorMessage?: string
}

const ACCEPTED = '.jpg,.jpeg,.png,.gif,.webp,.heic,.mp4,.mov,.avi,.mkv,.m4v'

export default function MediaUploader({ mapId, onUploadComplete }: Props) {
  const isDark = useComputedColorScheme('light') === 'dark'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [filePendingRemoval, setFilePendingRemoval] = useState<number | null>(null)

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const newItems: FileItem[] = Array.from(fileList).map((f) => ({
      file: f,
      status: 'pending',
      progress: 0,
    }))
    setFiles((prev) => [...prev, ...newItems])
  }

  const removeFile = (i: number) => {
    setFilePendingRemoval(i)
  }

  const upload = async () => {
    const pending = files.filter((f) => f.status === 'pending')
    if (pending.length === 0) return
    setUploading(true)
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== 'pending') continue
      setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading', progress: 10 } : f))
      try {
        const fd = new FormData()
        fd.append('files[]', files[i].file)
        const response = await api.post('/maps/' + mapId + '/media', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            const pct = Math.round((e.loaded / (e.total ?? 1)) * 90) + 10
            setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, progress: pct } : f))
          },
        })

        const skipped = Number(response?.data?.skipped_count ?? 0)
        const created = Number(response?.data?.created_count ?? 0)
        const nextStatus: FileStatus = skipped > 0 && created === 0 ? 'duplicate' : 'success'

        setFiles((prev) => prev.map((f, idx) => idx === i
          ? { ...f, status: nextStatus, progress: 100, errorMessage: undefined }
          : f,
        ))
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: {
            status?: number
            data?: {
              message?: string
              errors?: Record<string, string[]>
            }
          }
        }
        const status = axiosErr?.response?.status
        const responseMessage = axiosErr?.response?.data?.message
        const firstValidationError = Object.values(axiosErr?.response?.data?.errors ?? {})
          .find((messages) => Array.isArray(messages) && messages.length > 0)?.[0]
        const errorMessage = firstValidationError
          || responseMessage
          || (status ? `Upload failed (${status})` : 'Upload failed')

        setFiles((prev) => prev.map((f, idx) => idx === i
          ? {
            ...f,
            status: status === 409 ? 'duplicate' : 'error',
            progress: 0,
            errorMessage: status === 409 ? undefined : errorMessage,
          }
          : f,
        ))
      }
    }
    setUploading(false)
    notifications.show({ message: 'Upload complete!', color: 'teal' })
    onUploadComplete?.()
  }

  const brand = isDark ? '#22d3e0' : '#005f63'

  return (
    <Stack gap="md">
      <Box
        style={{
          border: '2px dashed ' + (isDark ? 'rgba(34,211,224,0.4)' : 'rgba(0,95,99,0.3)'),
          borderRadius: 12,
          padding: '32px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDark ? 'rgba(34,211,224,0.04)' : 'rgba(0,95,99,0.03)',
        }}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        tabIndex={0}
        role="button"
        aria-label="Click to select media files for upload"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
      >
        <IconUpload size={36} color={brand} aria-hidden style={{ margin: '0 auto 12px' }} />
        <Text fw={600} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
          Drop files here or click to browse
        </Text>
        <Text size="xs" c="dimmed" mt={4}>JPG, PNG, GIF, WEBP, HEIC, MP4, MOV, AVI, MKV</Text>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          style={{ display: 'none' }}
          aria-hidden="true"
          onChange={(e) => addFiles(e.target.files)}
        />
      </Box>

      {files.length > 0 && (
        <Stack gap={6} style={{ maxHeight: 300, overflowY: 'auto' }}>
          {files.map((item, i) => (
            <Group key={i} gap="sm" wrap="nowrap" style={{
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            }}>
              <IconFile size={18} color={brand} aria-hidden style={{ flexShrink: 0 }} />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" lineClamp={1} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
                  {item.file.name}
                </Text>
                {item.status === 'uploading' && (
                  <Progress value={item.progress} size="xs" color="teal" mt={4} aria-label={'Uploading ' + item.file.name} />
                )}
              </Box>
              {item.status === 'success' && <Badge color="teal" size="sm" leftSection={<IconCheck size={10} />}>Done</Badge>}
              {item.status === 'duplicate' && <Badge color="orange" size="sm">Duplicate</Badge>}
              {item.status === 'error' && <Badge color="red" size="sm" leftSection={<IconX size={10} />}>Error</Badge>}
              {item.status === 'pending' && (
                <Tooltip label="Remove" withArrow>
                  <ActionIcon variant="default" styles={getMapSectionActionIconStyles('danger')} size="sm" onClick={() => removeFile(i)}
                    aria-label={'Remove ' + item.file.name}>
                    <IconTrash size={14} aria-hidden />
                  </ActionIcon>
                </Tooltip>
              )}
              {item.status === 'error' && item.errorMessage && (
                <Text size="xs" c="red" title={item.errorMessage} style={{ maxWidth: 220 }} lineClamp={2}>
                  {item.errorMessage}
                </Text>
              )}
            </Group>
          ))}
        </Stack>
      )}

      <Group justify="flex-end">
        <Button
          variant="default"
          styles={getMapSectionButtonStyles('upload', 'solid')}
          loading={uploading}
          disabled={files.filter((f) => f.status === 'pending').length === 0}
          leftSection={<IconUpload size={16} aria-hidden />}
          onClick={upload}
        >
          Upload {files.filter((f) => f.status === 'pending').length > 0 ? '(' + files.filter((f) => f.status === 'pending').length + ')' : ''}
        </Button>
      </Group>

      <NativeConfirmDialog
        opened={filePendingRemoval !== null}
        title="Remove file from queue?"
        message={filePendingRemoval !== null
          ? `Remove "${files[filePendingRemoval]?.file.name ?? 'this file'}" from the upload queue?`
          : 'Remove this file from the upload queue?'}
        confirmLabel="Remove"
        tone="danger"
        onCancel={() => setFilePendingRemoval(null)}
        onConfirm={() => {
          if (filePendingRemoval === null) return
          setFiles((prev) => prev.filter((_, idx) => idx !== filePendingRemoval))
          setFilePendingRemoval(null)
        }}
      />
    </Stack>
  )
}
