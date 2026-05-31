import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mediaFileUrl, mediaThumbUrl, sharedMediaFileUrl, sharedMediaThumbUrl } from './mediaUrl'

let authToken: string | null = null

vi.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({ token: authToken }),
  },
}))

describe('mediaUrl helpers', () => {
  beforeEach(() => {
    sessionStorage.clear()
    authToken = null
  })

  it('builds owner media URLs without token when not authenticated', () => {
    expect(mediaThumbUrl(12, 99)).toBe('/api/maps/12/media/99/thumb-token')
    expect(mediaFileUrl('12', '99')).toBe('/api/maps/12/media/99/file-token')
  })

  it('builds owner media URLs with encoded auth token', () => {
    authToken = 'owner token/with spaces'

    expect(mediaThumbUrl(2, 3)).toBe('/api/maps/2/media/3/thumb-token?token=owner%20token%2Fwith%20spaces')
    expect(mediaFileUrl(2, 3)).toBe('/api/maps/2/media/3/file-token?token=owner%20token%2Fwith%20spaces')
  })

  it('builds shared media URLs with encoded guest token from session storage', () => {
    sessionStorage.setItem('guest_access_token', 'guest token/with spaces')

    expect(sharedMediaThumbUrl(7, 8)).toBe('/api/shared/maps/7/media/8/thumb?token=guest%20token%2Fwith%20spaces')
    expect(sharedMediaFileUrl(7, 8)).toBe('/api/shared/maps/7/media/8/file?token=guest%20token%2Fwith%20spaces')
  })

  it('builds shared media URLs without token when guest session is missing', () => {
    expect(sharedMediaThumbUrl(7, 8)).toBe('/api/shared/maps/7/media/8/thumb')
    expect(sharedMediaFileUrl(7, 8)).toBe('/api/shared/maps/7/media/8/file')
  })
})
