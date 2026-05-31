import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from './DashboardPage'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
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
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty-state content when user has no maps', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] } as never)

    renderPage()

    expect(await screen.findByText(/no maps yet/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /create your first map/i })).toBeTruthy()
  })

  it('submits share invite email for an existing map', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/maps') {
        return Promise.resolve({
          data: [
            {
              id: 3,
              name: 'Road Trip',
              description: 'Summer memories',
              media_files_count: 1,
            },
          ],
        } as never)
      }

      if (url === '/maps/3/guests') {
        return Promise.resolve({ data: [] } as never)
      }

      return Promise.resolve({ data: [] } as never)
    })
    vi.mocked(api.post).mockResolvedValue({ data: { share_url: 'https://example.test/shared/token-1' } } as never)

    renderPage()

    await userEvent.click(await screen.findByLabelText(/share: road trip/i))

    await userEvent.type(screen.getByLabelText(/invite email address/i), 'guest@example.com')
    await userEvent.click(screen.getByRole('button', { name: /create share link/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/maps/3/guests', {
        email: 'guest@example.com',
      })
    })
  })
})