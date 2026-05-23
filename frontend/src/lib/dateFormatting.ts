import { format, parseISO } from 'date-fns'
import { useAuthStore } from '@/store/authStore'

export const DATE_FORMAT_OPTIONS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-05-23)' },
  { value: 'DD/MM/YY', label: 'DD/MM/YY (23/05/26)' },
  { value: 'MM/DD/YY', label: 'MM/DD/YY (05/23/26)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (23/05/2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (05/23/2026)' },
] as const

export type UserDateFormat = (typeof DATE_FORMAT_OPTIONS)[number]['value']

const DATE_FNS_PATTERN: Record<UserDateFormat, string> = {
  'YYYY-MM-DD': 'yyyy-MM-dd',
  'DD/MM/YY': 'dd/MM/yy',
  'MM/DD/YY': 'MM/dd/yy',
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy',
}

function resolveDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const parsedIso = parseISO(value)
  if (!Number.isNaN(parsedIso.getTime())) return parsedIso

  const parsedNative = new Date(value)
  return Number.isNaN(parsedNative.getTime()) ? null : parsedNative
}

function currentUserDateFormat(): UserDateFormat {
  const userFormat = useAuthStore.getState().user?.date_format as UserDateFormat | undefined
  return userFormat && DATE_FNS_PATTERN[userFormat] ? userFormat : 'YYYY-MM-DD'
}

export function formatUserDate(value: string | Date | null | undefined, fallback = 'Date unavailable'): string {
  const date = resolveDate(value)
  if (!date) return fallback

  return format(date, DATE_FNS_PATTERN[currentUserDateFormat()])
}

export function formatUserDateTime(value: string | Date | null | undefined, fallback = 'Date unavailable'): string {
  const date = resolveDate(value)
  if (!date) return fallback

  const datePattern = DATE_FNS_PATTERN[currentUserDateFormat()]
  return format(date, `${datePattern} HH:mm`)
}
