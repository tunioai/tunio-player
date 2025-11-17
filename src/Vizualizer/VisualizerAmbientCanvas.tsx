"use client"

import React from "react"
// import VisualizerAmbientLayers from "./VisualizerAmbientLayers"

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
      >
        {/* <VisualizerAmbientLayers /> */}
      </div>
    </>
  )
}

export default VisualizerAmbientCanvas
