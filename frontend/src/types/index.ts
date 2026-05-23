export interface User {
  id: number
  name: string
  email: string
  created_at: string
}

export interface ColorTheme {
  id: number
  name: string
  slug: string
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  text_color: string
  map_tile_style: string
  is_high_contrast: boolean
}

export interface MemoriesMap {
  id: number
  user_id: number
  name: string
  description: string | null
  color_theme_id: number | null
  color_theme: ColorTheme | null
  media_files_count: number
  created_at: string
  updated_at: string
}

export interface MediaFile {
  id: number
  map_id: number
  original_name: string
  stored_name: string
  mime_type: string
  size_bytes: number
  latitude: number | null
  longitude: number | null
  altitude: number | null
  location_name: string | null
  location_address: string | null
  location_city: string | null
  location_country: string | null
  captured_at: string | null
  timezone: string | null
  timezone_offset: number | null
  captured_at_local: string | null
  camera_make: string | null
  camera_model: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  exif_json: Record<string, unknown> | null
  user_caption: string | null
  user_tags: string[] | null
  thumbnail_name: string | null
  processed_at: string | null
}

export interface MapNote {
  id: number
  map_id: number
  media_id: number | null
  note_type: 'map' | 'day' | 'location' | 'media'
  day_date: string | null
  latitude: number | null
  longitude: number | null
  title: string | null
  body: string
  created_at: string
  updated_at: string
}

export interface MapGuest {
  id: number
  email: string
  invited_at: string
  expires_at: string | null
  last_accessed_at: string | null
  share_url?: string
}

export interface SharedMediaFile {
  id: number
  map_id: number
  original_name: string
  size_bytes: number | null
  latitude: number | null
  longitude: number | null
  location_name: string | null
  location_city: string | null
  captured_at: string | null
  captured_at_local: string | null
  timezone: string | null
  thumbnail_name: string | null
  user_caption: string | null
  mime_type: string
  width: number | null
  height: number | null
  duration_seconds: number | null
}

export interface SharedMapResponse {
  id: number
  name: string
  description: string | null
  color_theme: ColorTheme | null
  media: SharedMediaFile[]
  notes: MapNote[]
}

export interface PaginatedResponse<T> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}
