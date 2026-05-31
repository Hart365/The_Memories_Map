import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import MediaUploader from './MediaUploader'
import api from '@/lib/api'
import { notifications } from '@mantine/notifications'

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}))

vi.mock('@/components/common/NativeConfirmDialog', () => ({
  default: () => null,
}))

describe('MediaUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends duplicate options as 1/0 values in FormData', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: [{ original_name: 'photo-1.jpg' }],
        duplicates: [],
        created_count: 1,
        skipped_count: 0,
      },
    } as never)

    const onUploadComplete = vi.fn()
    const { container } = render(
      <MantineProvider>
        <MediaUploader mapId={42} onUploadComplete={onUploadComplete} />
      </MantineProvider>,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(input).not.toBeNull()
    if (!input) {
      throw new Error('Expected file input to exist')
    }

    const file = new File(['image-bytes'], 'photo-1.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    const uploadButton = screen.getByRole('button', { name: /upload \(1\)/i })
    await userEvent.click(uploadButton)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1)
    })

    const [url, body, config] = vi.mocked(api.post).mock.calls[0]

    expect(url).toBe('/maps/42/media')
    expect(config?.headers?.['Content-Type']).toBe('multipart/form-data')

    expect(body).toBeInstanceOf(FormData)
    const formData = body as FormData

    expect(formData.get('duplicate_options[filename]')).toBe('1')
    expect(formData.get('duplicate_options[size]')).toBe('1')
    expect(formData.get('duplicate_options[capture_date]')).toBe('0')
    expect(formData.get('duplicate_options[gps]')).toBe('0')
    expect(formData.get('duplicate_options[camera_make]')).toBe('0')
    expect(formData.get('duplicate_options[camera_model]')).toBe('0')

    const uploadedFiles = formData.getAll('files[]')
    expect(uploadedFiles).toHaveLength(1)
    expect((uploadedFiles[0] as File).name).toBe('photo-1.jpg')

    expect(onUploadComplete).toHaveBeenCalledTimes(1)
  })

  it('surfaces backend validation errors from failed upload responses', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: {
        status: 422,
        data: {
          errors: {
            'duplicate_options.filename': ['The duplicate options.filename field must be true or false.'],
          },
        },
      },
    })

    const { container } = render(
      <MantineProvider>
        <MediaUploader mapId={7} />
      </MantineProvider>,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(input).not.toBeNull()
    if (!input) {
      throw new Error('Expected file input to exist')
    }

    const file = new File(['image-bytes'], 'photo-2.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    const uploadButton = screen.getByRole('button', { name: /upload \(1\)/i })
    await userEvent.click(uploadButton)

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalled()
    })

    const calls = vi.mocked(notifications.show).mock.calls
    const hasValidationMessage = calls.some(([args]) =>
      typeof args?.message === 'string' && args.message.includes('must be true or false'),
    )

    expect(hasValidationMessage).toBe(true)
  })
})
