import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MapViewPage from './MapViewPage'
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
        <MemoryRouter initialEntries={['/maps/42/consolidated']}>
          <Routes>
            <Route path="/maps/:mapId/consolidated" element={<MapViewPage />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('MapViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const pending = new Promise(() => {})
    vi.mocked(api.get).mockReturnValue(pending as never)
    vi.mocked(fetchAllMapMedia).mockReturnValue(pending as never)
  })

  it('navigates to timeline route from header controls', async () => {
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /^timeline$/i }))

    expect(navigateMock).toHaveBeenCalledWith('/maps/42/timeline')
  })
})