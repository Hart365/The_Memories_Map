import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import RegisterPage from './RegisterPage'
import api from '@/lib/api'

const navigateMock = vi.fn()
const setAuthMock = vi.fn()

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
    post: vi.fn(),
  },
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((selector: (state: { setAuth: typeof setAuthMock }) => unknown) => selector({ setAuth: setAuthMock })),
}))

function renderPage() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </MantineProvider>,
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers a user and redirects to dashboard', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { allow_new_user_registration: true },
    } as never)

    vi.mocked(api.post).mockResolvedValue({
      data: {
        token: 'register-token-1',
        user: {
          id: 4,
          name: 'Jane Smith',
          email: 'jane@example.com',
          default_timezone: 'Etc/UTC',
          date_format: 'YYYY-MM-DD',
        },
      },
    } as never)

    renderPage()

    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Smith')
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await userEvent.type(screen.getByLabelText(/^password/i), 'password-123')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'password-123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/register', {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password-123',
        password_confirmation: 'password-123',
      })
      expect(setAuthMock).toHaveBeenCalledWith('register-token-1', expect.objectContaining({ email: 'jane@example.com' }))
      expect(navigateMock).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows disabled registration notice when public setting is off', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { allow_new_user_registration: false },
    } as never)

    renderPage()

    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText(/new user registration is currently disabled/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /create account/i })).toBeNull()
  })
})