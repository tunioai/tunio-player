"use client"

import React from "react"

type VisualizerAmbientCanvasProps = {
  backdropRef: React.RefObject<HTMLDivElement | null>
  backdropUrl: string
}

const VisualizerAmbientCanvas: React.FC<VisualizerAmbientCanvasProps> = ({ backdropRef, backdropUrl }) => {
  return (
    <>
      <div
        ref={backdropRef}
        className="tunio-visualizer-backdrop tunio-visualizer-backdrop--ambient"
        style={{ backgroundImage: `url(${backdropUrl})` }}
      />
      <canvas className="tunio-visualizer-canvas" aria-hidden="true" />
    </>
  )
}

export default VisualizerAmbientCanvas
