"use client"

import React from "react"
import type { TrackBackground, StreamConfig } from "../types"
import VisualizerVideoBackground from "./modules/VisualizerVideoBackground"
// import VisualizerAmbientLayers from "./VisualizerAmbientLayers"

type VisualizerAmbientCanvasProps = {
  streamConfig: StreamConfig
  backdropRef: React.RefObject<HTMLDivElement | null>
  backdropUrl: string
  trackBackground: TrackBackground | null
  liveBackground?: boolean
}

const VisualizerAmbientCanvas: React.FC<VisualizerAmbientCanvasProps> = ({
  streamConfig,
  backdropRef,
  backdropUrl,
  trackBackground,
  liveBackground
}) => {
  if (liveBackground) return <VisualizerVideoBackground streamConfig={streamConfig} opacity={0.4} />

  return (
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
  )
}

export default VisualizerAmbientCanvas
