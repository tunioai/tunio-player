export interface Track {
  artist: string
  duration: number
  is_ai: boolean
  is_music: boolean
  title: string
  uuid: string
}

export interface TrackBackground {
  r: number
  g: number
  b: number
}

export interface Stream {
  title: string
}

export interface CurrentResponse {
  success: boolean
  streams: Array<string>
  track: Track
  stream: Stream
}
