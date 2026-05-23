import { useAuthStore } from '@/store/authStore'

function getGuestToken(): string | null {
  return sessionStorage.getItem('guest_access_token')
}

export function mediaThumbUrl(mapId: string | number, mediaId: string | number): string {
  const token = useAuthStore.getState().token
  const base = `/api/maps/${mapId}/media/${mediaId}/thumb-token`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}

export function mediaFileUrl(mapId: string | number, mediaId: string | number): string {
  const token = useAuthStore.getState().token
  const base = `/api/maps/${mapId}/media/${mediaId}/file-token`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}

export function sharedMediaThumbUrl(mapId: string | number, mediaId: string | number): string {
  const token = getGuestToken()
  const base = `/api/shared/maps/${mapId}/media/${mediaId}/thumb`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}

export function sharedMediaFileUrl(mapId: string | number, mediaId: string | number): string {
  const token = getGuestToken()
  const base = `/api/shared/maps/${mapId}/media/${mediaId}/file`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
