import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

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

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
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
          <SettingsPage />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('SettingsPage', () => {
  const setAuth = vi.fn()
  const clearAuth = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')

    vi.mocked(useAuthStore).mockReturnValue({
      token: 'token-1',
      user: {
        id: 1,
        name: 'Mike',
        email: 'mike@example.com',
        default_timezone: 'Etc/UTC',
        date_format: 'YYYY-MM-DD',
      },
      setAuth,
      clearAuth,
    })

    vi.mocked(useAuthStore).getState = vi.fn(() => ({
      token: 'token-1',
    })) as never

    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [
          {
            value: 'Etc/UTC',
            label: 'UTC',
            location: 'UTC',
            utc_offset: '+00:00',
          },
        ],
      },
    } as never)
  })

  it('submits profile updates with edited name', async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: {
        id: 1,
        name: 'Michael',
        email: 'mike@example.com',
        default_timezone: 'Etc/UTC',
        date_format: 'YYYY-MM-DD',
      },
    } as never)

    renderPage()

    const nameInput = await screen.findByLabelText(/full name/i)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Michael')
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/profile', expect.objectContaining({
        name: 'Michael',
        email: 'mike@example.com',
      }))
    })
  })

  it('changes password then clears auth and redirects to login', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} } as never)

    renderPage()

    await userEvent.type(screen.getByLabelText(/current password/i), 'old-pass-123')
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'new-pass-1234')
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-pass-1234')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/profile/password', {
        current_password: 'old-pass-123',
        password: 'new-pass-1234',
        password_confirmation: 'new-pass-1234',
      })
      expect(clearAuth).toHaveBeenCalled()
      expect(navigateMock).toHaveBeenCalledWith('/login')
    })
  })
})