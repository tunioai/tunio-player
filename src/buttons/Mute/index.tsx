import React from "react"
import { VolumeX, Volume2 } from "lucide-react"
import style from "./style.module.scss"

interface Props {
  muted: boolean
  onClick: () => void
}

export const MuteButton: React.FC<Props> = ({ muted, onClick }) => {
  return (
    <div className={style.muteButton} onClick={onClick}>
      {muted ? <VolumeX /> : <Volume2 />}
    </div>
  )
}
