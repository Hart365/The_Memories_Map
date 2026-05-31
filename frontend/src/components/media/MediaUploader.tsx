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
const UPLOAD_BATCH_SIZE = 10

export default function MediaUploader({ mapId, onUploadComplete }: Props) {
  const isDark = useComputedColorScheme('light') === 'dark'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputId = 'media-uploader-input'
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

  const retryFile = (index: number) => {
    setFiles((prev) => prev.map((item, idx) => idx === index
      ? { ...item, status: 'pending', progress: 0, errorMessage: undefined }
      : item,
    ))
  }

  const retryAllFailed = () => {
    setFiles((prev) => prev.map((item) => item.status === 'error'
      ? { ...item, status: 'pending', progress: 0, errorMessage: undefined }
      : item,
    ))
  }

  const upload = async () => {
    const pendingIndices = files
      .map((item, index) => (item.status === 'pending' ? index : -1))
      .filter((index) => index >= 0)

    if (pendingIndices.length === 0) return

    setUploading(true)
    let successCount = 0
    let duplicateCount = 0
    let errorCount = 0

    for (let offset = 0; offset < pendingIndices.length; offset += UPLOAD_BATCH_SIZE) {
      const batchIndices = pendingIndices.slice(offset, offset + UPLOAD_BATCH_SIZE)
      const batchIndexSet = new Set(batchIndices)

      setFiles((prev) => prev.map((item, idx) => (
        batchIndexSet.has(idx)
          ? { ...item, status: 'uploading', progress: 10, errorMessage: undefined }
          : item
      )))

      try {
        const fd = new FormData()

        for (const index of batchIndices) {
          fd.append('files[]', files[index].file)
        }

        // Keep duplicate detection conservative for batch uploads to avoid false positives.
        fd.append('duplicate_options[filename]', '1')
        fd.append('duplicate_options[size]', '1')
        fd.append('duplicate_options[capture_date]', '0')
        fd.append('duplicate_options[gps]', '0')
        fd.append('duplicate_options[camera_make]', '0')
        fd.append('duplicate_options[camera_model]', '0')

        const response = await api.post('/maps/' + mapId + '/media', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            const pct = Math.round((e.loaded / (e.total ?? 1)) * 90) + 10
            setFiles((prev) => prev.map((item, idx) => (
              batchIndexSet.has(idx) ? { ...item, progress: pct } : item
            )))
          },
        })

        const duplicateNames = Array.isArray(response?.data?.duplicates)
          ? response.data.duplicates.map((value: unknown) => String(value))
          : []
        const createdNames = Array.isArray(response?.data?.data)
          ? response.data.data
            .map((entry: unknown) => {
              const item = entry as { original_name?: unknown }
              return typeof item.original_name === 'string' ? item.original_name : null
            })
            .filter((name: string | null): name is string => Boolean(name))
          : []

        const createdCount = Number(response?.data?.created_count ?? createdNames.length)
        const skippedCount = Number(response?.data?.skipped_count ?? duplicateNames.length)

        // If backend response totals do not match the requested batch, do not report false success.
        if (createdCount + skippedCount !== batchIndices.length) {
          throw new Error('Server did not confirm all files in this batch.')
        }

        const duplicateNameCounts = new Map<string, number>()
        const createdNameCounts = new Map<string, number>()

        for (const name of duplicateNames) {
          duplicateNameCounts.set(name, (duplicateNameCounts.get(name) ?? 0) + 1)
        }

        for (const name of createdNames) {
          createdNameCounts.set(name, (createdNameCounts.get(name) ?? 0) + 1)
        }

        let remainingUnassignedCreated = createdCount
        for (const count of createdNameCounts.values()) {
          remainingUnassignedCreated -= count
        }
        remainingUnassignedCreated = Math.max(remainingUnassignedCreated, 0)

        setFiles((prev) => prev.map((item, idx) => {
          if (!batchIndexSet.has(idx)) {
            return item
          }

          const duplicateCountForName = duplicateNameCounts.get(item.file.name) ?? 0
          const isDuplicate = duplicateCountForName > 0

          if (isDuplicate) {
            duplicateNameCounts.set(item.file.name, duplicateCountForName - 1)
            duplicateCount++
            return { ...item, status: 'duplicate', progress: 100, errorMessage: undefined }
          }

          const createdCountForName = createdNameCounts.get(item.file.name) ?? 0
          if (createdCountForName > 0) {
            createdNameCounts.set(item.file.name, createdCountForName - 1)
            successCount++
            return { ...item, status: 'success', progress: 100, errorMessage: undefined }
          }

          if (remainingUnassignedCreated > 0) {
            remainingUnassignedCreated--
            successCount++
            return { ...item, status: 'success', progress: 100, errorMessage: undefined }
          }

          errorCount++
          return {
            ...item,
            status: 'error',
            progress: 0,
            errorMessage: 'Upload could not be confirmed by server.',
          }

        }))
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

        setFiles((prev) => prev.map((item, idx) => {
          if (!batchIndexSet.has(idx)) {
            return item
          }

          if (status === 409) {
            duplicateCount++
            return {
              ...item,
              status: 'duplicate',
              progress: 100,
              errorMessage: undefined,
            }
          }

          errorCount++
          return {
            ...item,
            status: 'error',
            progress: 0,
            errorMessage,
          }
        }))

        if (status !== 409) {
          notifications.show({
            message: `Batch upload error: ${errorMessage}`,
            color: 'red',
          })
        }
      }
    }

    setUploading(false)
    notifications.show({
      message: `Upload queued: ${successCount} added, ${duplicateCount} duplicates, ${errorCount} failed. Background processing continues automatically.`,
      color: errorCount > 0 ? 'orange' : 'teal',
    })
    onUploadComplete?.()
  }

  const brand = isDark ? '#22d3e0' : '#005f63'

  return (
    <Stack gap="md">
      <Box
        component="label"
        htmlFor={fileInputId}
        style={{
          border: '2px dashed ' + (isDark ? 'rgba(34,211,224,0.4)' : 'rgba(0,95,99,0.3)'),
          borderRadius: 12,
          padding: '32px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDark ? 'rgba(34,211,224,0.04)' : 'rgba(0,95,99,0.03)',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
      >
        <IconUpload size={36} color={brand} aria-hidden style={{ margin: '0 auto 12px' }} />
        <Text fw={600} style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}>
          Drop files here or click to browse
        </Text>
        <Text size="xs" c="dimmed" mt={4}>JPG, PNG, GIF, WEBP, HEIC, MP4, MOV, AVI, MKV</Text>
        <input
          id={fileInputId}
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          style={{ display: 'none' }}
          aria-hidden="true"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            addFiles(e.target.files)
            e.currentTarget.value = ''
          }}
        />
      </Box>

      {files.length > 0 && (
        <Stack gap={6} style={{ maxHeight: 300, overflowY: 'auto' }}>
          {files.some((item) => item.status === 'error') && (
            <Group justify="space-between" py={4}>
              <Text size="xs" c="dimmed">Some files failed. Retry failed uploads without reselecting files.</Text>
              <Button size="xs" variant="default" styles={getMapSectionButtonStyles('upload', 'solid')} onClick={retryAllFailed}>
                Retry Failed
              </Button>
            </Group>
          )}
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
              {item.status === 'error' && (
                <Button size="xs" variant="default" styles={getMapSectionButtonStyles('upload', 'solid')} onClick={() => retryFile(i)}>
                  Retry
                </Button>
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
