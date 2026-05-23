import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Paper, Button, Text, Group, Stack, Switch, Badge, useComputedColorScheme,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconMap, IconMapPin, IconSearch, IconRefresh, IconCheck } from '@tabler/icons-react'
import api from '@/lib/api'
import { getMapSectionButtonStyles } from '@/lib/mapSectionButtonStyles'

interface MapControlsProps {
  mapId: string
  mediaCount: number
  mediaNeedingGeocodeCount: number
  showRoutes: boolean
  onToggleRoutes: (show: boolean) => void
  onRequestEnhancedRescan?: () => void
  enhancedRescanBusy?: boolean
}

export default function MapControls({
  mapId,
  mediaCount,
  mediaNeedingGeocodeCount,
  showRoutes,
  onToggleRoutes,
  onRequestEnhancedRescan,
  enhancedRescanBusy = false,
}: MapControlsProps) {
  const isDark = useComputedColorScheme('light') === 'dark'
  const qc = useQueryClient()
  const [scanning, setScanning] = useState(false)
  const brand = isDark ? '#22d3e0' : '#005f63'
  const surface = isDark ? '#1e2736' : '#f8fafc'
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'

  const bulkRescanMutation = useMutation({
    mutationFn: () => api.post('/maps/' + mapId + '/media/rescan-locations'),
    onMutate: () => setScanning(true),
    onSuccess: (res) => {
      const d = res.data
      setScanning(false)
      notifications.show({ message: 'Scan complete! Updated ' + d.updated + ', skipped ' + d.skipped + '.', color: 'teal' })
      qc.invalidateQueries({ queryKey: ['media', mapId] })
    },
    onError: () => {
      setScanning(false)
      notifications.show({ message: 'Scan failed. Please try again.', color: 'red' })
    },
  })

  return (
    <Stack gap="md" role="region" aria-label="Map controls">
      <Paper p="md" radius="md" style={{ backgroundColor: surface, border }}>
        <Group gap="sm" mb="sm">
          <IconMap size={18} color={brand} aria-hidden />
          <Text fw={700} size="sm" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Map Controls
          </Text>
        </Group>
        <Switch
          checked={showRoutes}
          onChange={(e) => onToggleRoutes(e.currentTarget.checked)}
          label="Show photo route"
          aria-label="Toggle route visualization connecting photos chronologically"
          color="teal"
        />
        <Text size="xs" c="dimmed" mt={4}>
          Connect photos chronologically to visualize your journey
        </Text>
      </Paper>

      <Paper p="md" radius="md" style={{ backgroundColor: surface, border }}>
        <Group gap="sm" mb="sm">
          <IconMapPin size={18} color={brand} aria-hidden />
          <Text fw={700} size="sm" style={{ color: isDark ? '#f0f4f8' : '#1a1f2e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Location Data
          </Text>
        </Group>
        <Group gap="sm" mb="md">
          <Badge color="green" variant="light" size="sm">{mediaCount - mediaNeedingGeocodeCount} with location</Badge>
          {mediaNeedingGeocodeCount > 0 && <Badge color="orange" variant="light" size="sm">{mediaNeedingGeocodeCount} need scan</Badge>}
        </Group>
        {mediaNeedingGeocodeCount > 0 ? (
          <Stack gap="xs">
            <Button size="sm" variant="default" styles={getMapSectionButtonStyles('map')} loading={scanning || bulkRescanMutation.isPending}
              disabled={enhancedRescanBusy} leftSection={<IconSearch size={14} aria-hidden />}
              onClick={() => bulkRescanMutation.mutate()}
              aria-label={'Scan ' + mediaNeedingGeocodeCount + ' files for GPS location data'}>
              Scan All ({mediaNeedingGeocodeCount})
            </Button>
            <Text size="xs" c="dimmed">Scans media with GPS coordinates to extract location names</Text>
          </Stack>
        ) : mediaCount > 0 ? (
          <Group gap="xs">
            <IconCheck size={16} color={brand} aria-hidden />
            <Text size="sm" c="dimmed">All media have location data</Text>
          </Group>
        ) : null}
        {mediaCount > 0 && (
          <Button size="sm" variant="default" styles={getMapSectionButtonStyles('gallery')} mt="sm" loading={enhancedRescanBusy}
            disabled={scanning} leftSection={<IconRefresh size={14} aria-hidden />}
            onClick={() => onRequestEnhancedRescan?.()}
            aria-label="Re-geocode all media with enhanced location detection">
            Rescan All (Enhanced)
          </Button>
        )}
      </Paper>
    </Stack>
  )
}
