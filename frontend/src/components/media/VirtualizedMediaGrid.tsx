import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

interface VirtualizedMediaGridProps<T> {
  items: T[]
  columns: number
  itemHeight: number
  height: number
  overscanRows?: number
  gap?: number
  keyExtractor: (item: T, index: number) => string | number
  renderItem: (item: T, index: number) => ReactNode
}

/**
 * Minimal fixed-height virtualized grid for media-heavy views.
 * It keeps DOM size bounded while preserving native scrolling and semantic markup inside each tile.
 */
export default function VirtualizedMediaGrid<T>({
  items,
  columns,
  itemHeight,
  height,
  overscanRows = 2,
  gap = 8,
  keyExtractor,
  renderItem,
}: VirtualizedMediaGridProps<T>) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(height)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateHeight = () => setViewportHeight(viewport.clientHeight)
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [height])

  const rowCount = Math.ceil(items.length / columns)
  const rowHeight = itemHeight + gap
  const visibleStartRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows)
  const visibleEndRow = Math.min(
    rowCount,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscanRows,
  )

  const visibleItems = useMemo(() => {
    const startIndex = visibleStartRow * columns
    const endIndex = Math.min(items.length, visibleEndRow * columns)
    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
    }))
  }, [columns, items, visibleEndRow, visibleStartRow])

  const topSpacer = visibleStartRow * rowHeight
  const bottomSpacer = Math.max(0, (rowCount - visibleEndRow) * rowHeight)

  return (
    <div
      ref={viewportRef}
      onScroll={(event) => setScrollTop((event.currentTarget as HTMLDivElement).scrollTop)}
      style={{ height, overflowY: 'auto', overflowX: 'hidden' }}
      aria-label="Virtualized media grid"
    >
      <div style={{ height: topSpacer }} aria-hidden />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap,
        }}
      >
        {visibleItems.map(({ item, index }) => (
          <div key={keyExtractor(item, index)} style={{ minHeight: itemHeight }}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
      <div style={{ height: bottomSpacer }} aria-hidden />
    </div>
  )
}