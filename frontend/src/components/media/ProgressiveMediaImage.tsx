import type { ImgHTMLAttributes } from 'react'

/**
 * Lightweight image wrapper for media-heavy views.
 * Defaults to lazy loading and async decoding so large galleries do less work up front.
 */
export default function ProgressiveMediaImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} loading={props.loading ?? 'lazy'} decoding={props.decoding ?? 'async'} />
}