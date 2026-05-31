import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TimelinePage from './TimelinePage'
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
  default: () => null,
}))

vi.mock('@/components/media/VirtualizedMediaGrid', () => ({
  default: () => null,
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
        <MemoryRouter initialEntries={['/maps/42/timeline']}>
          <Routes>
            <Route path="/maps/:mapId/timeline" element={<TimelinePage />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('TimelinePage', () => {
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
        original_name: 'one.jpg',
        mime_type: 'image/jpeg',
        captured_at: '2025-01-15T11:00:00Z',
        captured_at_local: null,
      },
      {
        id: 2,
        original_name: 'two.jpg',
        mime_type: 'image/jpeg',
        captured_at: '2025-02-20T09:30:00Z',
        captured_at_local: null,
      },
    ] as never)
  })

  it('drills down from year to month overview', async () => {
    renderPage()

    expect(await screen.findByText(/years in this map/i)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /2025: 2 items/i }))

    expect(await screen.findByText(/months in selected year/i)).toBeTruthy()
  })

  it('navigates to map route from header controls', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /^map$/i }))

    expect(navigateMock).toHaveBeenCalledWith('/maps/42/map')
  })
})