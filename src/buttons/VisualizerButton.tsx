import React from "react"
import { Waves } from "lucide-react"

interface Props {
  onClick: () => void
}

export const VisualizerButton: React.FC<Props> = ({ onClick }) => {
  return (
    <button className="tunio-visualizer-button" onClick={onClick} title="Show visualizer">
      <Waves />
    </button>
  )
}
