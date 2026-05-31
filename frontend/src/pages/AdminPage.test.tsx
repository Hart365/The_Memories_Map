import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import AdminPage from './AdminPage'
import adminApi from '@/lib/adminApi'
import { notifications } from '@mantine/notifications'
import { useAdminStore } from '@/store/adminStore'

vi.mock('@/lib/adminApi', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}))

vi.mock('@/store/adminStore', () => ({
  useAdminStore: vi.fn(),
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
          <AdminPage />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('AdminPage', () => {
  const setAdminToken = vi.fn()
  const clearAdminToken = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAdminStore).mockReturnValue({
      adminToken: null,
      setAdminToken,
      clearAdminToken,
    })
  })

  it('logs in admin and stores token', async () => {
    vi.mocked(adminApi.post).mockResolvedValue({
      data: {
        admin_token: 'admin-token-123',
      },
    } as never)

    renderPage()

    const usernameInput = screen.getByLabelText(/admin username/i)
    const passwordInput = screen.getByLabelText(/admin password/i)

    await userEvent.clear(usernameInput)
    await userEvent.type(usernameInput, 'MemoriesAdmin')
    await userEvent.clear(passwordInput)
    await userEvent.type(passwordInput, 'StrongPassword123!')
    await userEvent.click(screen.getByRole('button', { name: /sign in as admin/i }))

    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith('/login', {
        username: 'MemoriesAdmin',
        password: 'StrongPassword123!',
      })
      expect(setAdminToken).toHaveBeenCalledWith('admin-token-123')
    })

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Admin login successful.',
      }),
    )
  })
})