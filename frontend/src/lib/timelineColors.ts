import { YEAR_BAR_COLORS } from '@/styles/mantine-theme'

export function buildTimelineColorMap(values: number[]): Map<number, string> {
  return new Map(values.map((value, index) => [value, YEAR_BAR_COLORS[index % YEAR_BAR_COLORS.length]]))
}