import type { Track } from "./types"

export type PlaylistTrackMetadata = {
  title?: string
  artist?: string
  artwork?: string
  duration?: number
  startTs?: number
  endTs?: number
}

const parseNumber = (value: string) => {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const normalizeTagName = (value: string) => value.replace(/^#/, "").toUpperCase()

export const metadataFromTagList = (tagList: Array<string[]>): PlaylistTrackMetadata | null => {
  if (!tagList?.length) return null

  const metadata: PlaylistTrackMetadata = {}
  let hasData = false

  for (const entry of tagList) {
    const [rawName, rawValue = ""] = entry
    if (!rawName) continue

    const name = normalizeTagName(rawName)
    const value = rawValue.trim()

    switch (name) {
      case "X-TITLE":
        metadata.title = value
        hasData = true
        break
      case "X-ARTIST":
        metadata.artist = value
        hasData = true
        break
      case "X-ARTWORK":
        metadata.artwork = value
        hasData = true
        break
      case "X-DURATION":
        metadata.duration = parseNumber(value)
        hasData = true
        break
      case "X-START-TS":
        metadata.startTs = parseNumber(value)
        hasData = true
        break
      case "X-END-TS":
        metadata.endTs = parseNumber(value)
        hasData = true
        break
      default:
        break
    }
  }

  return hasData ? metadata : null
}

const metadataIdentity = (metadata: PlaylistTrackMetadata) =>
  `${metadata.startTs ?? ""}-${metadata.endTs ?? ""}-${metadata.title ?? ""}-${metadata.artist ?? ""}-${
    metadata.artwork ?? ""
  }`

export const dedupeMetadataEntries = (entries: PlaylistTrackMetadata[]): PlaylistTrackMetadata[] => {
  if (!entries.length) return entries
  const map = new Map<string, PlaylistTrackMetadata>()

  entries.forEach(entry => {
    const signature = metadataIdentity(entry)
    map.set(signature, entry)
  })

  return Array.from(map.values()).sort((a, b) => {
    const startA = typeof a.startTs === "number" ? a.startTs : 0
    const startB = typeof b.startTs === "number" ? b.startTs : 0
    return startA - startB
  })
}

export const getMetadataIdentity = (metadata: PlaylistTrackMetadata | null) => {
  if (!metadata) return null
  return metadataIdentity(metadata)
}

export const getActiveMetadataTrack = (tracks: PlaylistTrackMetadata[], serverTimeOffset: number) => {
  if (!tracks.length) return null
  const now = Date.now() - serverTimeOffset

  for (let index = tracks.length - 1; index >= 0; index -= 1) {
    const entry = tracks[index]
    const start = typeof entry.startTs === "number" ? entry.startTs * 1_000 : undefined
    const duration = typeof entry.duration === "number" ? entry.duration * 1_000 : undefined
    const end =
      typeof entry.endTs === "number"
        ? entry.endTs * 1_000
        : typeof start === "number" && duration
        ? start + duration
        : undefined

    if (typeof start === "number") {
      if (typeof end === "number") {
        if (now >= start && now <= end) {
          return entry
        }
        if (now > end && index === tracks.length - 1) {
          return entry
        }
      } else if (now >= start) {
        return entry
      }
    }
  }

  return tracks[tracks.length - 1]
}

export const buildTrackFromMetadata = (metadata: PlaylistTrackMetadata): Track => {
  let duration = typeof metadata.duration === "number" ? metadata.duration : 0
  if (!duration && typeof metadata.startTs === "number" && typeof metadata.endTs === "number") {
    duration = metadata.endTs - metadata.startTs
  }

  return {
    artist: metadata.artist || "Tunio",
    title: metadata.title || "Live stream",
    artwork: metadata.artwork || "",
    duration
  }
}
