import React, { useState } from "react"
import type { StreamConfig, Track } from "../types"

interface Props {
  track: Track | undefined
  streamConfig: StreamConfig | null
  onImageLoad: (image: HTMLImageElement, imageUrl: string, valid: boolean) => void
}

export const Cover: React.FC<Props> = ({ track, streamConfig, onImageLoad }) => {
  const [coverImage, setCoverImage] = useState<string | null>(null)

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement
    const isValid = img.naturalWidth !== 1 && img.naturalHeight !== 1

    if (isValid) {
      const imageUrl = `https://app.tunio.ai/api/d/audio-image/${track?.uuid}.jpg`
      setCoverImage(imageUrl)
      onImageLoad(img, imageUrl, isValid)
      return
    }

    const imageUrl = `https://app.tunio.ai/api/d/image/stream-${streamConfig?.stream_name}.webp`
    setCoverImage(imageUrl)
    onImageLoad(img, imageUrl, isValid)
  }

  // TODO: add placeholder
  if (!streamConfig) {
    return <div className="tunio-cover" />
  }

  return (
    <div
      className="tunio-cover"
      style={{
        backgroundImage: `url(${coverImage})`
      }}
    >
      {track?.uuid && (
        <img
          src={`https://app.tunio.ai/api/d/audio-image/${track?.uuid}.jpg`}
          alt="cover"
          crossOrigin="anonymous"
          onLoad={handleImageLoad}
          style={{ display: "none" }}
        />
      )}
    </div>
  )
}
