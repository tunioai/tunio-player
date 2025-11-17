import React from "react"

const AMBIENT_LAYER_NAMES = ["primary", "secondary", "soft"] as const

const VisualizerAmbientLayers: React.FC = () => {
  return (
    <div className="tunio-visualizer-ambient-layers" aria-hidden="true">
      {AMBIENT_LAYER_NAMES.map(layer => (
        <div key={layer} className={`tunio-visualizer-ambient-layer tunio-visualizer-ambient-layer--${layer}`} />
      ))}
    </div>
  )
}

export default VisualizerAmbientLayers
