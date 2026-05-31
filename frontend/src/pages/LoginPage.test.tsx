import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'
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
        <LoginPage />
      </MemoryRouter>
    </MantineProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({
      data: { allow_new_user_registration: true },
    } as never)
  })

  it('signs in and redirects to dashboard', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        token: 'token-123',
        user: {
          id: 1,
          name: 'Mike',
          email: 'mike@example.com',
          default_timezone: 'Etc/UTC',
          date_format: 'YYYY-MM-DD',
        },
      },
    } as never)

    renderPage()

    await userEvent.type(screen.getByLabelText(/email address/i), 'mike@example.com')
    await userEvent.type(screen.getByLabelText(/^password \(required\)$/i), 'super-secret')
    await userEvent.click(screen.getByRole('button', { name: /sign in to memories map/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'mike@example.com',
        password: 'super-secret',
      })
      expect(setAuthMock).toHaveBeenCalledWith('token-123', expect.objectContaining({ email: 'mike@example.com' }))
      expect(navigateMock).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows backend error message when login fails', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: {
        data: {
          message: 'Invalid credentials.',
        },
      },
    })

    renderPage()

    await userEvent.type(screen.getByLabelText(/email address/i), 'mike@example.com')
    await userEvent.type(screen.getByLabelText(/^password \(required\)$/i), 'wrong-pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in to memories map/i }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(/invalid credentials\./i)).toBeTruthy()
  })
})