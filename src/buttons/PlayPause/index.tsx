import React from "react"
import clsx from "clsx"
import { PlayIcon } from "./PlayIcon"
import { StopIcon } from "./StopIcon"
import style from "./style.module.scss"

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
    <button className={clsx(style.playPauseButton, loading && style.disabled)} onClick={handleClick}>
      {loading ? <span className={style.spinner} /> : <>{action === "play" ? <PlayIcon /> : <StopIcon />}</>}
    </button>
  )
}
