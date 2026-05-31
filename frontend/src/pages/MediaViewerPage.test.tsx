import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MediaViewerPage from './MediaViewerPage'
import api from '@/lib/api'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/components/notes/NoteEditor', () => ({
  default: () => <div aria-label="note-editor-stub" />,
}))

vi.mock('@/components/media/LocationEditor', () => ({
  default: () => <div aria-label="location-editor-stub" />,
}))

vi.mock('@/components/media/MediaUploader', () => ({
  default: () => null,
}))

vi.mock('@/components/common/NativeConfirmDialog', () => ({
  default: ({
    opened,
    title,
    confirmLabel,
    onConfirm,
    onCancel,
  }: {
    opened: boolean
    title: string
    confirmLabel?: string
    onConfirm: () => void
    onCancel: () => void
  }) => (opened ? (
    <div role="dialog" aria-label={title}>
      <button type="button" onClick={onConfirm}>{confirmLabel ?? 'Confirm'}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  ) : null),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <MemoryRouter initialEntries={['/maps/42/media/7']}>
          <Routes>
            <Route path="/maps/:mapId/media/:mediaId" element={<MediaViewerPage />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('MediaViewerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 7,
        map_id: 42,
        original_name: 'road-photo.jpg',
        stored_name: 'road-photo.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 2048,
        latitude: null,
        longitude: null,
        altitude: null,
        location_name: null,
        location_address: null,
        location_city: null,
        location_country: null,
        captured_at: '2025-01-16T12:00:00Z',
        timezone: 'UTC',
        timezone_offset: 0,
        captured_at_local: null,
        camera_make: null,
        camera_model: null,
        width: 1280,
        height: 720,
        duration_seconds: null,
        exif_json: null,
        user_caption: 'Road photo',
        user_tags: null,
        thumbnail_name: 'road-photo-thumb.jpg',
        processed_at: null,
      },
    } as never)

    vi.mocked(api.put).mockResolvedValue({ data: {} } as never)
    vi.mocked(api.delete).mockResolvedValue({ data: {} } as never)
  })

  it('edits and saves media caption', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /edit caption/i }))

    const captionInput = screen.getByLabelText(/^caption$/i)
    await userEvent.clear(captionInput)
    await userEvent.type(captionInput, 'Updated caption')
    await userEvent.click(screen.getByRole('button', { name: /save caption/i }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/maps/42/media/7', {
        user_caption: 'Updated caption',
      })
    })
  })

  it('deletes media and navigates back to gallery', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /delete media/i }))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/maps/42/media/7')
      expect(navigateMock).toHaveBeenCalledWith('/maps/42/gallery')
    })
  })
})