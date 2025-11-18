"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import WaterMark from "../WaterMark"
// import QRCode from "./QRCode"
import type { Track, Stream, TrackBackground, StreamConfig } from "../types"
import VisualizerAudioCanvas from "./VisualizerAudioCanvas"
import VisualizerAmbientCanvas from "./VisualizerAmbientCanvas"

type VisualizerOverlayProps = {
  isOpen: boolean
  onClose: () => void
  trackBackground: TrackBackground | null
  audioRef: React.MutableRefObject<HTMLAudioElement | null>
  stream: Stream | null
  streamConfig: StreamConfig | null
  track?: Track
  coverURL: string | null
}

type HostVisualizerPayload = {
  artist?: string
  title?: string
  station?: string
}

const VisualizerOverlay: React.FC<VisualizerOverlayProps> = ({
  isOpen,
  onClose,
  audioRef,
  trackBackground,
  track,
  streamConfig,
  stream,
  coverURL
}) => {
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

  const getBackdropUrl = () => {
    return coverURL || `https://cp.tunio.ai/api/d/image/stream-${streamConfig?.stream_name}.web`
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

  const stationLabel = hostPayload?.station?.trim() || stream?.title || streamConfig?.stream_name || "Tunio Radio"
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

  return (
    <div className="tunio-visualizer-overlay" role="dialog" aria-modal={true} onClick={onCloseHandler}>
      {!isEmbedded ? (
        <>
          <VisualizerAudioCanvas
            isOpen={isOpen}
            trackBackground={trackBackground}
            audioRef={audioRef}
            backdropRef={backdropRef}
            backdropUrl={getBackdropUrl()}
          />
        </>
      ) : (
        <VisualizerAmbientCanvas
          backdropRef={backdropRef}
          trackBackground={trackBackground}
          backdropUrl={getBackdropUrl()}
        />
      )}

      <div className="tunio-visualizer-info">
        {streamConfig?.wetermark && (
          <div className="tunio-visualizer-watermark">
            <WaterMark height={30} color="#fff" />
          </div>
        )}
        <div className={stationClassName} onClick={exitFullscreen}>
          {stationLabel}
        </div>
        <div key={titleKey} className="tunio-visualizer-title tunio-visualizer-text-change">
          {title}
        </div>

        <div className="tunio-visualizer-artist tunio-visualizer-text-change" key={artist}>
          {artist}
        </div>
      </div>

      {/* <QRCode name={name} /> */}
    </div>
  )
}

export default VisualizerOverlay
