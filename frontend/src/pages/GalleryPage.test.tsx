import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GalleryPage from './GalleryPage'
import api from '@/lib/api'
import { fetchAllMapMedia } from '@/lib/fetchAllMapMedia'

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
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/fetchAllMapMedia', () => ({
  fetchAllMapMedia: vi.fn(),
}))

vi.mock('@/components/media/MediaUploader', () => ({
  default: () => null,
}))

vi.mock('@/components/media/BulkEditModal', () => ({
  default: () => null,
}))

vi.mock('@/components/common/NativeConfirmDialog', () => ({
  default: ({
    opened,
    title,
    message,
    confirmLabel,
    onConfirm,
    onCancel,
  }: {
    opened: boolean
    title: string
    message: string
    confirmLabel?: string
    onConfirm: () => void
    onCancel: () => void
  }) => (opened ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button type="button" onClick={onConfirm}>{confirmLabel ?? 'Confirm'}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  ) : null),
}))

vi.mock('@/components/media/VirtualizedMediaGrid', () => ({
  default: ({ items }: { items: Array<{ id: number; original_name: string }> }) => (
    <div aria-label="virtualized-grid-stub">{items.map((item) => item.original_name).join(', ')}</div>
  ),
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
        <MemoryRouter initialEntries={['/maps/42/gallery']}>
          <Routes>
            <Route path="/maps/:mapId/gallery" element={<GalleryPage />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('GalleryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 42,
        name: 'Road Trip',
      },
    } as never)

    vi.mocked(fetchAllMapMedia).mockResolvedValue([
      {
        id: 1,
        original_name: 'road-photo.jpg',
        user_caption: 'Road photo',
        location_name: 'Austin',
        location_city: 'Austin',
        mime_type: 'image/jpeg',
        captured_at: '2025-01-15T11:00:00Z',
        captured_at_local: null,
      },
      {
        id: 2,
        original_name: 'ocean-video.mp4',
        user_caption: 'Ocean clip',
        location_name: 'Miami',
        location_city: 'Miami',
        mime_type: 'video/mp4',
        captured_at: '2025-01-16T10:00:00Z',
        captured_at_local: null,
      },
    ] as never)

    vi.mocked(api.delete).mockResolvedValue({ data: {} } as never)
  })

  it('filters results by search query', async () => {
    renderPage()

    expect(await screen.findByLabelText('virtualized-grid-stub')).toBeTruthy()

    await userEvent.type(screen.getByLabelText(/search media/i), 'not-present')

    expect(await screen.findByText(/no media found matching "not-present"/i)).toBeTruthy()
  })

  it('navigates to timeline route from header controls', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /^timeline$/i }))

    expect(navigateMock).toHaveBeenCalledWith('/maps/42/timeline')
  })

  it('confirms and executes bulk delete for selected media', async () => {
    renderPage()

    await screen.findByLabelText('virtualized-grid-stub')

    await userEvent.click(screen.getByRole('button', { name: /select all/i }))
    await userEvent.click(screen.getByRole('button', { name: /bulk delete/i }))

    expect(await screen.findByRole('dialog', { name: /delete selected media/i })).toBeTruthy()
    expect(screen.getByText(/delete 2 selected items/i)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(api.delete).toHaveBeenCalledTimes(2)
    expect(api.delete).toHaveBeenCalledWith('/maps/42/media/1')
    expect(api.delete).toHaveBeenCalledWith('/maps/42/media/2')
  })
})