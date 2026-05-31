import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GuestAccessPage from './GuestAccessPage'
import sharedApi from '@/lib/sharedApi'

vi.mock('@/lib/sharedApi', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
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
        <MemoryRouter initialEntries={['/shared/demo-token']}>
          <Routes>
            <Route path="/shared/:token" element={<GuestAccessPage />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('GuestAccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('hydrates email input from guest session storage', () => {
    sessionStorage.setItem('guest_email', 'invited@example.com')

    renderPage()

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement
    expect(emailInput.value).toBe('invited@example.com')
  })

  it('shows backend error when guest access request is denied', async () => {
    vi.mocked(sharedApi.post).mockRejectedValue({
      response: {
        data: {
          message: 'Access denied for this invite.',
        },
      },
    })

    renderPage()

    const emailInput = screen.getByLabelText(/email address/i)
    await userEvent.clear(emailInput)
    await userEvent.type(emailInput, 'invited@example.com')
    await userEvent.click(screen.getByRole('button', { name: /access map/i }))

    await waitFor(() => {
      expect(sharedApi.post).toHaveBeenCalledWith('/auth/guest-access/demo-token', {
        email: 'invited@example.com',
      })
    })

    const alert = await screen.findByRole('alert')
    expect(alert.textContent ?? '').toContain('Access denied for this invite.')
  })
})