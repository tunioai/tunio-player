"use client"

import React from "react"
import type { TrackBackground } from "../types"
// import VisualizerAmbientLayers from "./VisualizerAmbientLayers"

type VisualizerAmbientCanvasProps = {
  backdropRef: React.RefObject<HTMLDivElement | null>
  backdropUrl: string
  trackBackground: TrackBackground | null
}

const VisualizerAmbientCanvas: React.FC<VisualizerAmbientCanvasProps> = ({
  backdropRef,
  backdropUrl,
  trackBackground
}) => {
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
