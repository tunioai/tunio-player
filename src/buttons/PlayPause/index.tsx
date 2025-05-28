import React from "react"
import clsx from "clsx"
import { PlayIcon } from "./PlayIcon"
import { StopIcon } from "./StopIcon"

interface Props {
  action: "play" | "stop"
  onPlay: () => void
  onStop: () => void
  loading?: boolean
}

export const PlayPauseButton: React.FC<Props> = ({ action, onPlay, onStop, loading }) => {
  const handleClick = () => {
    if (action === "play") {
      onPlay()
    } else {
      onStop()
    }
  }

  return (
    <button className={clsx("tunio-play-pause-button", loading && "tunio-disabled")} onClick={handleClick}>
      {loading ? <span className="tunio-spinner" /> : <>{action === "play" ? <PlayIcon /> : <StopIcon />}</>}
    </button>
  )
}
