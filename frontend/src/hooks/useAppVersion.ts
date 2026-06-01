import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const FALLBACK_VERSION = typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__.trim() !== ''
  ? __APP_VERSION__
  : '0.0.0'

function normalizeVersion(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload.trim()
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>

    if (typeof record.version === 'string' && record.version.trim() !== '') {
      return record.version.trim()
    }

    if (record.data && typeof record.data === 'object') {
      const nested = record.data as Record<string, unknown>
      if (typeof nested.version === 'string' && nested.version.trim() !== '') {
        return nested.version.trim()
      }
    }
  }

  return null
}

export default function useAppVersion(): string {
  const { data } = useQuery<string>({
    queryKey: ['app-version'],
    queryFn: async () => {
      try {
        const response = await api.get('/public/version')
        return normalizeVersion(response.data) ?? FALLBACK_VERSION
      } catch {
        return FALLBACK_VERSION
      }
    },
    staleTime: 1000 * 60 * 10,
    retry: 0,
  })

  return data ?? FALLBACK_VERSION
}
