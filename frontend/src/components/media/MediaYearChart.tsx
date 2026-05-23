/**
 * MediaYearChart
 * Horizontal bar chart showing media count per year.
 * Colorful, vibrant, clickable, WCAG AAA compliant.
 */
import { Box, Group, Text, Tooltip, useComputedColorScheme } from '@mantine/core'
import type { MediaFile } from '@/types'
import { YEAR_BAR_COLORS } from '@/styles/mantine-theme'

interface MediaYearChartProps {
  media: MediaFile[]
  onYearClick?: (year: number) => void
  selectedYear?: number | null
  compact?: boolean
}

export function MediaYearChart({ media, onYearClick, selectedYear, compact = false }: MediaYearChartProps) {
  const isDark = useComputedColorScheme('light') === 'dark'

  // Count media per year
  const yearCounts = new Map<number, number>()
  for (const m of media) {
    const dateStr = m.captured_at_local || m.captured_at
    if (!dateStr) continue
    const year = new Date(dateStr).getFullYear()
    if (!Number.isNaN(year)) {
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
    }
  }

  const sortedYears = Array.from(yearCounts.entries()).sort((a, b) => a[0] - b[0])
  if (sortedYears.length === 0) return null

  const maxCount = Math.max(...sortedYears.map(([, c]) => c))

  return (
    <Box aria-label={`Media distribution by year: ${sortedYears.length} years`} role="group">
      {!compact && (
        <Text
          fw={700}
          size="sm"
          mb="sm"
          style={{ color: isDark ? '#f0f4f8' : '#1a1f2e' }}
        >
          Media by Year
        </Text>
      )}
      <Box style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 8 }}>
        {sortedYears.map(([year, count], i) => {
          const barWidth = Math.max(8, (count / maxCount) * 100)
          const color = YEAR_BAR_COLORS[i % YEAR_BAR_COLORS.length]
          const isSelected = selectedYear === year
          const yearStr = String(year)

          return (
            <Group
              key={yearStr}
              gap={compact ? 6 : 8}
              align="center"
              wrap="nowrap"
              style={{ minWidth: 0 }}
            >
              {/* Year label */}
              <Text
                size={compact ? 'xs' : 'sm'}
                fw={600}
                style={{
                  width: compact ? 34 : 38,
                  flexShrink: 0,
                  color: isDark ? '#a0b4c0' : '#4a5568',
                  textAlign: 'right',
                  userSelect: 'none',
                }}
                aria-hidden
              >
                {yearStr}
              </Text>

              {/* Bar */}
              <Tooltip label={`${year}: ${count} media item${count !== 1 ? 's' : ''}`} withArrow>
                <button
                  onClick={() => onYearClick?.(year)}
                  aria-label={`${year}: ${count} media. Click to filter.`}
                  aria-pressed={isSelected}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: onYearClick ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Box
                    style={{
                      width: `${barWidth}%`,
                      height: compact ? 24 : 32,
                      backgroundColor: color,
                      borderRadius: '0 6px 6px 0',
                      opacity: isSelected ? 1 : selectedYear != null ? 0.55 : 0.85,
                      outline: isSelected ? `3px solid ${isDark ? '#22d3e0' : '#005f63'}` : 'none',
                      outlineOffset: 2,
                      transition: 'opacity 0.15s ease, width 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 8,
                      minWidth: 8,
                    }}
                    role="presentation"
                  />
                  <Text
                    size="xs"
                    fw={700}
                    style={{
                      color: isDark ? '#f0f4f8' : '#1a1f2e',
                      minWidth: 20,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    {count}
                  </Text>
                </button>
              </Tooltip>
            </Group>
          )
        })}
      </Box>

      {/* Mini spectrum bar at bottom */}
      {!compact && sortedYears.length > 1 && (
        <Box
          mt="sm"
          style={{
            height: 6,
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
          }}
          aria-hidden
        >
          {sortedYears.map(([year], i) => (
            <Box
              key={year}
              style={{
                flex: 1,
                backgroundColor: YEAR_BAR_COLORS[i % YEAR_BAR_COLORS.length],
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}
