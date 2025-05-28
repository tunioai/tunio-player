import React from "react"
import { VolumeX, Volume2 } from "lucide-react"

interface Props {
  muted: boolean
  onClick: () => void
}

export const MuteButton: React.FC<Props> = ({ muted, onClick }) => {
  return (
    <button className="tunio-mute-button" onClick={onClick}>
      {muted ? <VolumeX /> : <Volume2 />}
    </button>
  )
}
