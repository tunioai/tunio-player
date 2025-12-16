import React, { useEffect, useState } from "react"
import type { StreamConfig, Track } from "../types"

interface Props {
  track: Track | undefined
  streamConfig: StreamConfig | null
  onImageLoad: (image: HTMLImageElement, imageUrl: string, valid: boolean) => void
}

export const Cover: React.FC<Props> = ({ track, streamConfig, onImageLoad }) => {
  const [coverImage, setCoverImage] = useState<string | null>(null)

  useEffect(() => {
    if (track?.artwork || !streamConfig?.stream_name) return

    const fallbackUrl = `https://app.tunio.ai/api/d/image/stream-${streamConfig.stream_name}.webp`
    const image = new Image()
    image.crossOrigin = "anonymous"

    image.onload = () => {
      setCoverImage(fallbackUrl)
      onImageLoad(image, fallbackUrl, true)
    }

    image.onerror = () => {
      onImageLoad(image, fallbackUrl, false)
    }

    image.src = fallbackUrl

    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [track?.artwork, streamConfig?.stream_name, onImageLoad])

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement
    const isValid = img.naturalWidth !== 1 && img.naturalHeight !== 1

    if (isValid) {
      const imageUrl = `https://app.tunio.ai/api/d/catalog-cover/${track?.artwork}.jpg`
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
      {track?.artwork && (
        <img
          src={`https://app.tunio.ai/api/d/catalog-cover/${track?.artwork}.jpg`}
          alt="cover"
          crossOrigin="anonymous"
          onLoad={handleImageLoad}
          style={{ display: "none" }}
        />
      )}
    </div>
  )
}
