export interface Track {
  artist: string
  duration: number
  title: string
  artwork: string
}

export interface StreamConfig {
  wetermark: boolean
  stream_name: string
  live_backgrounds: Array<string>
}

export interface TrackBackground {
  r: number
  g: number
  b: number
}

export interface Stream {
  title: string
  current_time: Date
  track_finishing_at: Date | null
  track_started_at: Date | null
}

export interface CurrentResponse {
  success: boolean
  streams: Array<string>
  track: Track
  stream: Stream
}
