"use client"

import React from "react"
import WaterMark from "../WaterMark"
import type { TrackBackground, StreamConfig, Stream } from "../types"
import VisualizerVideoBackground from "./modules/VisualizerVideoBackground"

type VisualizerAmbientCanvasProps = {
  streamConfig: StreamConfig
  streamDetails: Stream | null
  backdropRef: React.RefObject<HTMLDivElement | null>
  backdropUrl: string
  trackBackground: TrackBackground | null
  liveBackground?: boolean
  stationLabel: string
  trackTitle: string
  trackArtist: string
  watermarkEnabled?: boolean
  isFailoverMode: boolean
}

const VisualizerAmbientCanvas: React.FC<VisualizerAmbientCanvasProps> = ({
  streamConfig,
  streamDetails,
  backdropRef,
  backdropUrl,
  trackBackground,
  liveBackground,
  stationLabel,
  trackTitle,
  trackArtist,
  watermarkEnabled,
  isFailoverMode
}) => {
  const [progress, setProgress] = React.useState(0)
  const animationFrameRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const cancelAnimation = () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }

    if (isFailoverMode || !streamDetails || !streamDetails.track_started_at || !streamDetails.track_finishing_at) {
      cancelAnimation()
      setProgress(0)
      return cancelAnimation
    }

    const trackStart = new Date(streamDetails.track_started_at).getTime()
    const trackEnd = new Date(streamDetails.track_finishing_at).getTime()
    const serverNow = new Date(streamDetails.current_time ?? Date.now()).getTime()

    const duration = trackEnd - trackStart
    if (!Number.isFinite(duration) || duration <= 0 || Number.isNaN(trackStart)) {
      cancelAnimation()
      setProgress(0)
      return cancelAnimation
    }

    const clientOffset = Date.now() - serverNow

    const updateProgress = () => {
      const now = Date.now() - clientOffset
      const ratio = (now - trackStart) / duration
      const clamped = Math.min(Math.max(ratio, 0), 1)
      setProgress(clamped)

      if (clamped < 1) {
        animationFrameRef.current = window.requestAnimationFrame(updateProgress)
      } else {
        animationFrameRef.current = null
      }
    }

    updateProgress()

    return cancelAnimation
  }, [isFailoverMode, streamDetails])

  const canShowLiveProgress =
    !isFailoverMode && Boolean(streamDetails?.track_started_at && streamDetails?.track_finishing_at)
  const normalizedProgress = Math.min(Math.max(progress, 0), 1)
  const progressFillStyle = canShowLiveProgress
    ? { width: `${(normalizedProgress * 100).toFixed(2)}%`, animation: "none", transform: "none" }
    : undefined

  return (
    <div className="tunio-visualizer-ambient">
      {liveBackground ? (
        <VisualizerVideoBackground streamConfig={streamConfig} opacity={0.6} />
      ) : (
        <div
          ref={backdropRef}
          className="tunio-visualizer-backdrop tunio-visualizer-backdrop--ambient"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        >
          {trackBackground && (
            <div
              className="tunio-visualizer-backdrop--ambient-overlay"
              style={{
                backgroundColor: `rgba(${trackBackground.r}, ${trackBackground.g}, ${trackBackground.b}, 0.3)`
              }}
            />
          )}
        </div>
      )}

      <div className="tunio-visualizer-ambient-blur" aria-hidden="true" />
      <div className="tunio-visualizer-ambient-gradient" aria-hidden="true" />

      <section className="tunio-visualizer-ambient-card" aria-live="polite" aria-atomic="true">
        {watermarkEnabled && (
          <div className="tunio-visualizer-ambient-card__brand">
            <WaterMark height={20} color="#cdd5ff" />
          </div>
        )}
        <div className="tunio-visualizer-ambient-card__meta">
          <span className="tunio-visualizer-ambient-card__badge">{stationLabel}</span>
          <span className="tunio-visualizer-ambient-card__tagline">TUNIO.AI</span>
        </div>

        <div className="tunio-visualizer-ambient-card__content">
          <h1 className="tunio-visualizer-ambient-card__title">{trackTitle}</h1>
          <p className="tunio-visualizer-ambient-card__artist">{trackArtist}</p>
        </div>
        <div className="tunio-visualizer-ambient-card__progress" aria-hidden="true">
          <span className="tunio-visualizer-ambient-card__progress-fill" style={progressFillStyle} />
        </div>
      </section>
    </div>
  )
}

export default VisualizerAmbientCanvas
