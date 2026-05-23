import { useMemo } from 'react'
import { Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import type { MediaFile } from '@/types'
import { formatUserDateTime } from '@/lib/dateFormatting'

interface RouteVisualizationProps {
  media: MediaFile[]
}

export default function RouteVisualization({ media }: RouteVisualizationProps) {
  // Sort media by captured date and filter those with location
  const routePoints = useMemo(() => {
    const withLocation = media.filter(
      (m) => m.latitude !== null && m.longitude !== null && m.captured_at
    )
    
    return withLocation.sort((a, b) => {
      const dateA = a.captured_at ? new Date(a.captured_at_local || a.captured_at).getTime() : 0
      const dateB = b.captured_at ? new Date(b.captured_at_local || b.captured_at).getTime() : 0
      return dateA - dateB
    })
  }, [media])

  if (routePoints.length < 2) {
    return null // Need at least 2 points to draw a route
  }

  const coordinates = routePoints.map((m) => [m.latitude!, m.longitude!] as [number, number])
  const startPoint = routePoints[0]
  const endPoint = routePoints[routePoints.length - 1]
  const intermediatePoints = routePoints.slice(1, -1)

  return (
    <>
      {/* Main route line */}
      <Polyline
        positions={coordinates}
        pathOptions={{
          color: '#0d7377',
          weight: 4,
          opacity: 0.8,
          dashArray: '10, 10',
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />

      {/* Start point (green) */}
      <CircleMarker
        center={[startPoint.latitude!, startPoint.longitude!]}
        radius={10}
        pathOptions={{
          fillColor: '#059669',
          color: '#ffffff',
          weight: 3,
          opacity: 1,
          fillOpacity: 1,
        }}
      >
        <Tooltip permanent direction="top" offset={[0, -10]}>
          <div style={{ textAlign: 'center', fontWeight: 600 }}>
            <div style={{ fontSize: '0.75rem', color: '#059669' }}>START</div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {formatUserDateTime(startPoint.captured_at_local || startPoint.captured_at)}
            </div>
            {startPoint.location_name && (
              <div style={{ fontSize: '0.8125rem', color: '#666', marginTop: '0.125rem' }}>
                {startPoint.location_name}
              </div>
            )}
          </div>
        </Tooltip>
      </CircleMarker>

      {/* Intermediate stops (orange) */}
      {intermediatePoints.map((point, index) => (
        <CircleMarker
          key={`stop-${point.id}`}
          center={[point.latitude!, point.longitude!]}
          radius={7}
          pathOptions={{
            fillColor: '#f59e0b',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          }}
        >
          <Tooltip direction="top" offset={[0, -7]}>
            <div style={{ textAlign: 'center', fontSize: '0.875rem' }}>
              <div style={{ fontWeight: 600, color: '#f59e0b' }}>Stop {index + 1}</div>
              <div style={{ marginTop: '0.25rem' }}>
                {formatUserDateTime(point.captured_at_local || point.captured_at)}
              </div>
              {point.location_name && (
                <div style={{ fontSize: '0.8125rem', color: '#666', marginTop: '0.125rem' }}>
                  {point.location_name}
                </div>
              )}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* End point (red) */}
      <CircleMarker
        center={[endPoint.latitude!, endPoint.longitude!]}
        radius={10}
        pathOptions={{
          fillColor: '#dc2626',
          color: '#ffffff',
          weight: 3,
          opacity: 1,
          fillOpacity: 1,
        }}
      >
        <Tooltip permanent direction="top" offset={[0, -10]}>
          <div style={{ textAlign: 'center', fontWeight: 600 }}>
            <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>END</div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {formatUserDateTime(endPoint.captured_at_local || endPoint.captured_at)}
            </div>
            {endPoint.location_name && (
              <div style={{ fontSize: '0.8125rem', color: '#666', marginTop: '0.125rem' }}>
                {endPoint.location_name}
              </div>
            )}
          </div>
        </Tooltip>
      </CircleMarker>

      {/* Arrow markers along the route to show direction */}
      {coordinates.slice(0, -1).map((coord, index) => {
        // Only show arrows every few points to avoid clutter
        if (index % Math.max(1, Math.floor(coordinates.length / 8)) === 0) {
          const nextCoord = coordinates[index + 1]
          const midLat = (coord[0] + nextCoord[0]) / 2
          const midLng = (coord[1] + nextCoord[1]) / 2
          
          return (
            <CircleMarker
              key={`arrow-${index}`}
              center={[midLat, midLng]}
              radius={4}
              pathOptions={{
                fillColor: '#14b8a6',
                color: '#ffffff',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.8,
              }}
            />
          )
        }
        return null
      })}
    </>
  )
}
