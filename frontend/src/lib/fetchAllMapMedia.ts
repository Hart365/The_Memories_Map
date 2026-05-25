import api from '@/lib/api'
import type { MediaFile } from '@/types'
import type { AxiosResponse } from 'axios'

interface MediaCursorPage {
  data: MediaFile[]
  meta?: {
    next_cursor?: string | null
  }
}

export async function fetchAllMapMedia(mapId: string): Promise<MediaFile[]> {
  const media: MediaFile[] = []
  let cursor: string | null = null

  do {
    const response: AxiosResponse<MediaCursorPage> = await api.get(`/maps/${mapId}/media`, {
      params: {
        per_page: 100,
        ...(cursor ? { cursor } : {}),
      },
    })

    media.push(...response.data.data)
    cursor = response.data.meta?.next_cursor ?? null
  } while (cursor)

  return media
}