import { useAuthStore } from '@/store/authStore'

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
