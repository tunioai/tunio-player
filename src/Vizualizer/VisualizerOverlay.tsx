"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import WaterMark from "../WaterMark"
// import QRCode from "./QRCode"
import type { Track, Stream } from "../types"
import VisualizerAudioCanvas from "./VisualizerAudioCanvas"
import VisualizerAmbientCanvas from "./VisualizerAmbientCanvas"

type VisualizerOverlayProps = {
  isOpen: boolean
  onClose: () => void
  audioRef: React.MutableRefObject<HTMLAudioElement | null>
  stream: Stream | null
  name: string
  track?: Track
}

type HostVisualizerPayload = {
  artist?: string
  title?: string
  station?: string
}

const VisualizerOverlay: React.FC<VisualizerOverlayProps> = ({ isOpen, onClose, audioRef, track, name, stream }) => {
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const [hostPayload, setHostPayload] = useState<HostVisualizerPayload | null>(null)

  const isEmbedded = useMemo(() => {
    if (typeof window === "undefined") return false
    const params = new URLSearchParams(window.location.search)
    return params.get("embedded") === "1"
  }, [])

  const exitFullscreen = useCallback((event?: Event | React.SyntheticEvent) => {
    event?.preventDefault()
    event?.stopPropagation()

    if (typeof document === "undefined") return

    const isFullscreenActive =
      document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ||
      (document as Document & { msFullscreenElement?: Element | null }).msFullscreenElement

    if (!isFullscreenActive) return

    const exit =
      document.exitFullscreen ||
      (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen ||
      (document as Document & { msExitFullscreen?: () => Promise<void> }).msExitFullscreen

    if (!exit) return

    try {
      const result = exit.call(document)
      if (result instanceof Promise) result.catch(() => undefined)
    } catch (err) {
      console.warn("Unable to exit fullscreen", err)
    }
  }, [])

  const onCloseHandler = () => {
    if (isEmbedded) return
    onClose()
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== "object") return
      if (data.type !== "tunio-visualizer-update" || typeof data.payload !== "object") return
      const payload = data.payload as HostVisualizerPayload
      setHostPayload(payload)
    }

    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  useEffect(() => {
    if (isEmbedded) return
    if (!isOpen) return

    exitFullscreen()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [exitFullscreen, isOpen, onClose])

  if (!isOpen) return null

  const stationLabel = hostPayload?.station?.trim() || stream?.title || name || "Tunio Radio"
  const title = hostPayload?.title?.trim() || track?.title || "Live stream"
  const artist = hostPayload?.artist?.trim() || track?.artist || "Tunio"
  const titleKey = `${stationLabel}-${title}`
  const normalizedStationLength = stationLabel.replace(/\s+/g, "").length
  const stationClassName =
    normalizedStationLength <= 10
      ? "tunio-visualizer-station tunio-visualizer-station-xl"
      : normalizedStationLength <= 22
      ? "tunio-visualizer-station tunio-visualizer-station-lg"
      : "tunio-visualizer-station"

  const backdropUrl = track?.is_music
    ? `https://app.tunio.ai/api/d/audio-image/${track.uuid}.jpg`
    : `https://app.tunio.ai/api/d/image/stream-${name}.webp`

  return (
    <div className="tunio-visualizer-overlay" role="dialog" aria-modal={true} onClick={onCloseHandler}>
      {!isEmbedded ? (
        <>
          <VisualizerAudioCanvas
            isOpen={isOpen}
            audioRef={audioRef}
            backdropRef={backdropRef}
            backdropUrl={backdropUrl}
          />
          <div className="tunio-visualizer-planet" />
        </>
      ) : (
        <VisualizerAmbientCanvas isOpen={isOpen} backdropRef={backdropRef} backdropUrl={backdropUrl} />
      )}

      <div className="tunio-visualizer-info">
        <div className="tunio-visualizer-watermark" onClick={exitFullscreen}>
          <WaterMark height={30} color="#fff" />
        </div>
        <div className={stationClassName}>{stationLabel}</div>
        <div key={titleKey} className="tunio-visualizer-title tunio-visualizer-text-change">
          {title}
        </div>

        <div className="tunio-visualizer-artist tunio-visualizer-text-change">{artist}</div>
      </div>

      {/* <QRCode name={name} /> */}
    </div>
  )
}

export default VisualizerOverlay
