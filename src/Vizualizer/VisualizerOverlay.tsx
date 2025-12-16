"use client"

import clsx from "clsx"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import WaterMark from "../WaterMark"
// import QRCode from "./QRCode"
import type { Track, Stream, TrackBackground, StreamConfig, CurrentResponse } from "../types"
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
  streamId?: string
}

type HostVisualizerPayload = {
  artist?: string
  title?: string
  station?: string
  isFailoverMode?: boolean
}

const EMBEDDED_TRACK_POLL_INTERVAL = 10_000

const VisualizerOverlay: React.FC<VisualizerOverlayProps> = ({
  isOpen,
  onClose,
  audioRef,
  trackBackground,
  track,
  streamConfig,
  stream,
  coverURL,
  streamId
}) => {
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const [hostPayload, setHostPayload] = useState<HostVisualizerPayload | null>(null)
  const [isFailoverMode, setIsFailoverMode] = useState(false)
  const [embeddedTrackOverride, setEmbeddedTrackOverride] = useState<Track | undefined>(undefined)
  const [embeddedStreamOverride, setEmbeddedStreamOverride] = useState<Stream | null>(null)
  const embeddedPollAbortRef = useRef<AbortController | null>(null)
  const embeddedPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastEmbeddedTrackSignatureRef = useRef<string | null>(null)

  const isEmbedded = useMemo(() => {
    if (typeof window === "undefined") return false
    const params = new URLSearchParams(window.location.search)
    return params.get("embedded") === "1"
  }, [])

  const isLiveBackground = useMemo(() => {
    if (typeof window === "undefined") return false
    const params = new URLSearchParams(window.location.search)
    return params.get("live") === "1"
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

  const handleEmbeddedDataUpdate = useCallback((data: CurrentResponse) => {
    if (!data?.success) return

    const signatureParts = [
      data.track?.title ?? "",
      data.track?.artist ?? "",
      data.stream?.track_started_at ? new Date(data.stream.track_started_at).getTime() : ""
    ]
    const signature = signatureParts.join("|")

    if (signature && lastEmbeddedTrackSignatureRef.current === signature) {
      return
    }
    lastEmbeddedTrackSignatureRef.current = signature

    if (data.track) {
      setEmbeddedTrackOverride(data.track)
    }

    if (data.stream) {
      setEmbeddedStreamOverride(data.stream)
    }
  }, [])

  const pollEmbeddedCurrentTrack = useCallback(async () => {
    if (!streamId) return

    if (embeddedPollAbortRef.current) {
      embeddedPollAbortRef.current.abort()
    }

    const controller = new AbortController()
    embeddedPollAbortRef.current = controller

    try {
      const response = await fetch(`https://api.tunio.ai/v1/stream/${streamId}/current`, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        cache: "no-store",
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch current track: ${response.status}`)
      }

      const data: CurrentResponse = await response.json()
      handleEmbeddedDataUpdate(data)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      console.warn("Unable to fetch embedded current track", error)
    } finally {
      embeddedPollAbortRef.current = null
    }
  }, [streamId, handleEmbeddedDataUpdate])

  useEffect(() => {
    if (!isEmbedded) return
    if (!streamId) return
    if (typeof window === "undefined") return

    pollEmbeddedCurrentTrack()
    embeddedPollIntervalRef.current = setInterval(pollEmbeddedCurrentTrack, EMBEDDED_TRACK_POLL_INTERVAL)

    return () => {
      if (embeddedPollIntervalRef.current) {
        window.clearInterval(embeddedPollIntervalRef.current)
        embeddedPollIntervalRef.current = null
      }
      if (embeddedPollAbortRef.current) {
        embeddedPollAbortRef.current.abort()
        embeddedPollAbortRef.current = null
      }
      lastEmbeddedTrackSignatureRef.current = null
      setEmbeddedTrackOverride(undefined)
      setEmbeddedStreamOverride(null)
    }
  }, [isEmbedded, streamId, pollEmbeddedCurrentTrack])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== "object") return
      if (data.type !== "tunio-visualizer-update" || typeof data.payload !== "object") return
      const payload = data.payload as HostVisualizerPayload
      setHostPayload(payload)
      setIsFailoverMode(Boolean(payload.isFailoverMode))
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

  const resolvedTrack = isEmbedded && embeddedTrackOverride ? embeddedTrackOverride : track
  const resolvedStreamDetails = isEmbedded && embeddedStreamOverride ? embeddedStreamOverride : stream

  const stationLabel =
    hostPayload?.station?.trim() || resolvedStreamDetails?.title || streamConfig?.stream_name || "Tunio Radio"
  const shouldUseHostMetadata = isFailoverMode && Boolean(hostPayload)
  const title =
    shouldUseHostMetadata && hostPayload?.title?.trim()
      ? hostPayload.title.trim()
      : resolvedTrack?.title || "Live stream"
  const artist =
    shouldUseHostMetadata && hostPayload?.artist?.trim() ? hostPayload.artist.trim() : resolvedTrack?.artist || "Tunio"
  const titleKey = `${stationLabel}-${title}`
  const normalizedStationLength = stationLabel.replace(/\s+/g, "").length
  const stationClassName =
    normalizedStationLength <= 10
      ? "tunio-visualizer-station tunio-visualizer-station-xl"
      : normalizedStationLength <= 22
      ? "tunio-visualizer-station tunio-visualizer-station-lg"
      : "tunio-visualizer-station"

  if (!streamConfig) return null

  const overlayClassName = clsx("tunio-visualizer-overlay", isEmbedded && "tunio-visualizer-overlay--ambient")

  return (
    <div className={overlayClassName} role="dialog" aria-modal={true} onClick={onCloseHandler}>
      {!isEmbedded ? (
        <>
          <VisualizerAudioCanvas
            isOpen={isOpen}
            trackBackground={trackBackground}
            audioRef={audioRef}
            backdropRef={backdropRef}
            streamConfig={streamConfig}
            backdropUrl={getBackdropUrl()}
            liveBackground={isLiveBackground}
          />
        </>
      ) : (
        <VisualizerAmbientCanvas
          backdropRef={backdropRef}
          trackBackground={trackBackground}
          backdropUrl={getBackdropUrl()}
          streamConfig={streamConfig}
          streamDetails={resolvedStreamDetails}
          isFailoverMode={isFailoverMode}
          liveBackground={isLiveBackground}
          stationLabel={stationLabel}
          trackTitle={title}
          trackArtist={artist}
          watermarkEnabled={Boolean(streamConfig.wetermark)}
        />
      )}

      {!isEmbedded && (
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
      )}

      {/* <QRCode name={name} /> */}
    </div>
  )
}

export default VisualizerOverlay
