"use client"

import clsx from "clsx"
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Cover } from "./Cover"
import { getDominantColor, fetchPlayerConfig } from "./helper"
import WaterMark from "./WaterMark"
import { PlayPauseButton } from "./buttons/PlayPause"
import { MuteButton } from "./buttons/Mute"
import { VisualizerButton } from "./buttons/VisualizerButton"
import VisualizerOverlay from "./Vizualizer/VisualizerOverlay"
import type { TrackBackground, CurrentResponse, Track, Stream, StreamConfig } from "./types"
import type { Props } from "./PlayerTypes"

import useNativeAudio from "./hooks/useNativeAudio"

const generateUniqueId = () => `player_${Math.random().toString(36).substr(2, 9)}`

const calculateBackgroundSize = (value: number, min: number, max: number) =>
  ((value - min) / (max - min)) * 100 + "% 100%"

const Player: React.FC<Props> = ({
  id,
  opacity = 1,
  ambient = false,
  theme = "dark",
  visualizerOnly = false,
  liquid = false
}) => {
  const playerIdRef = useRef<string>(generateUniqueId())
  const playerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLSpanElement>(null)
  const titleContainerRef = useRef<HTMLDivElement>(null)
  const currentTrackUpdateInterval = useRef<NodeJS.Timeout | null>(null)
  const initialLoadingRef = useRef<boolean>(true)
  const previousIDRef = useRef<string | undefined>(undefined)
  const streamsDataRef = useRef<Array<string>>([])
  const checkOverflowTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [bgColor, setBgColor] = useState<TrackBackground | null>(null)
  const [currentTrack, setCurrentTrack] = useState<Track | undefined>(undefined)
  const [streamDetails, setStreamDetails] = useState<Stream | null>(null)
  const [streamConfig, setStreamConfig] = useState<StreamConfig | null>(null)
  const [coverURL, setCoverURL] = useState<string | null>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [streamsData, setStreamsData] = useState<Array<string>>([])
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(visualizerOnly)
  const fullscreenOwnerRef = useRef(false)

  const streams = useMemo(() => (visualizerOnly ? [] : streamsData), [streamsData, visualizerOnly])

  const { isPlaying, volume, isMuted, buffering, setVolume, toggleMute, play, stop, audioRef } = useNativeAudio(streams)

  const volumeBarBackgroundSize = calculateBackgroundSize(volume, 0, 1)

  const checkOverflow = useCallback(() => {
    if (titleRef.current && titleContainerRef.current) {
      const textWidth = titleRef.current.scrollWidth
      const containerWidth = titleContainerRef.current.clientWidth
      const isTextOverflowing = textWidth > containerWidth

      setIsOverflowing(isTextOverflowing)
    }
  }, [])

  const onCoverImageLoad = useCallback((image: HTMLImageElement, coverURL: string, valid: boolean) => {
    setCoverURL(coverURL)

    if (!valid) {
      setBgColor(null)
      return
    }

    setBgColor(getDominantColor(image))
  }, [])

  const fetchStreamConfig = useCallback(async () => {
    const data = await fetchPlayerConfig(id)
    setStreamConfig(data)
  }, [id])

  const fetchCurrentTrack = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    const fetchCurrentTrack = async () => {
      try {
        const response = await fetch(`https://api.tunio.ai/v1/stream/${id}/current`, {
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          keepalive: true,
          signal: abortControllerRef.current?.signal
        })
        const data: CurrentResponse = await response.json()

        if (data.success) {
          setCurrentTrack(data.track)
          setStreamDetails(data.stream)

          if (data.streams?.length && !streamsDataRef.current.length) {
            streamsDataRef.current = data.streams
            setStreamsData(data.streams)
          }

          if (checkOverflowTimeoutRef.current) {
            clearTimeout(checkOverflowTimeoutRef.current)
          }

          checkOverflowTimeoutRef.current = setTimeout(() => {
            checkOverflow()
            checkOverflowTimeoutRef.current = null
          }, 100)
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Error fetching current track", error)
        }
      } finally {
        initialLoadingRef.current = false
      }
    }

    fetchCurrentTrack()
  }, [id, checkOverflow])

  useEffect(() => {
    if (!id) return
    fetchStreamConfig()
  }, [id])

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value)
      setVolume(newVolume)
    },
    [setVolume]
  )

  const handlePlayToggle = useCallback(() => {
    if (isPlaying) {
      stop()
    } else {
      play()
      window.postMessage(
        {
          type: "PLAYER_STARTED",
          playerId: playerIdRef.current
        },
        "*"
      )
    }
  }, [isPlaying, play, stop])

  const enterFullscreen = useCallback(() => {
    const element = playerRef.current
    if (!element || fullscreenOwnerRef.current) return

    const request =
      element.requestFullscreen ||
      (element as typeof element & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen ||
      (element as typeof element & { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen

    if (!request) return

    const result = request.call(element)
    fullscreenOwnerRef.current = true

    if (result instanceof Promise) {
      result.catch(() => {
        fullscreenOwnerRef.current = false
      })
    }
  }, [])

  const exitFullscreen = useCallback(() => {
    if (!fullscreenOwnerRef.current) return

    const exit =
      document.exitFullscreen ||
      (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen ||
      (document as Document & { msExitFullscreen?: () => Promise<void> }).msExitFullscreen

    if (!exit) {
      fullscreenOwnerRef.current = false
      return
    }

    const result = exit.call(document)

    if (result instanceof Promise) {
      result.finally(() => {
        fullscreenOwnerRef.current = false
      })
    } else {
      fullscreenOwnerRef.current = false
    }
  }, [])

  const handleVisualizerOpen = useCallback(() => {
    setIsVisualizerOpen(true)
    if (!visualizerOnly) enterFullscreen()
  }, [enterFullscreen, visualizerOnly])

  const handleVisualizerClose = useCallback(() => {
    if (visualizerOnly) return
    setIsVisualizerOpen(false)
    exitFullscreen()
  }, [exitFullscreen, visualizerOnly])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const element = playerRef.current
      if (!element) return
      const isCurrentFullscreen = document.fullscreenElement === element
      if (!isCurrentFullscreen && fullscreenOwnerRef.current) {
        fullscreenOwnerRef.current = false
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (fullscreenOwnerRef.current) {
        exitFullscreen()
      }
    }
  }, [exitFullscreen])

  useEffect(() => {
    if (visualizerOnly) {
      setIsVisualizerOpen(true)
    }
  }, [visualizerOnly])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PLAYER_STARTED" && event.data?.playerId !== playerIdRef.current && isPlaying) {
        stop()
      }
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [isPlaying, stop])

  useEffect(() => {
    if (previousIDRef.current === id) return

    previousIDRef.current = id

    if (currentTrackUpdateInterval.current) {
      clearInterval(currentTrackUpdateInterval.current)
      currentTrackUpdateInterval.current = null
    }

    if (checkOverflowTimeoutRef.current) {
      clearTimeout(checkOverflowTimeoutRef.current)
      checkOverflowTimeoutRef.current = null
    }

    if (isPlaying) {
      stop()
    }

    setCoverURL(null)
    setBgColor(null)
    setIsOverflowing(false)
    setCurrentTrack(undefined)
    streamsDataRef.current = []
    setStreamsData([])
    setStreamConfig(null)

    if (!id) return

    initialLoadingRef.current = true
    fetchCurrentTrack()
    currentTrackUpdateInterval.current = setInterval(fetchCurrentTrack, 15_000)
  }, [id, isPlaying, stop, fetchCurrentTrack])

  useEffect(() => {
    window.addEventListener("resize", checkOverflow)
    return () => window.removeEventListener("resize", checkOverflow)
  }, [checkOverflow])

  useEffect(() => {
    checkOverflow()
  }, [currentTrack, checkOverflow])

  const backgroundStyle = useMemo(() => {
    if (!bgColor) return {}
    if (theme === "dark") return { backgroundColor: `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 0.2)` }

    return {}
  }, [bgColor, theme])

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.style.setProperty("--player-widget-opacity", opacity.toString())
    }
  }, [opacity])

  const titleText = currentTrack ? `${currentTrack?.artist || "Tunio"} - ${currentTrack?.title || "Untitled"}` : " "

  return (
    <div
      ref={playerRef}
      className={clsx("tunio-player", { "tunio-theme-dark": theme === "dark", "tunio-theme-light": theme === "light" })}
    >
      <div className={`tunio-player-body ${visualizerOnly && "tunio-player-body--hidden"}`}>
        {ambient && coverURL && !isVisualizerOpen && (
          <div className="tunio-ambient" style={{ backgroundImage: `url(${coverURL})` }} />
        )}
        <div
          className="tunio-player-wrapper"
          style={{
            ...backgroundStyle,
            ...(liquid ? { backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } : {})
          }}
        >
          <Cover track={currentTrack} streamConfig={streamConfig} onImageLoad={onCoverImageLoad} />
          {!isVisualizerOpen && (
            <div className="tunio-container">
              <div ref={titleContainerRef}>
                <div className={`tunio-title ${isOverflowing ? "tunio-scrolling" : ""}`}>
                  <div className="tunio-title-track">
                    <span ref={titleRef} className="tunio-title-text">
                      {titleText}
                    </span>
                    {isOverflowing && (
                      <span className="tunio-title-text" aria-hidden="true">
                        {titleText}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="tunio-actions">
                <PlayPauseButton
                  action={isPlaying ? "stop" : "play"}
                  onStop={handlePlayToggle}
                  onPlay={handlePlayToggle}
                  loading={buffering}
                />
                <MuteButton onClick={toggleMute} muted={isMuted} />
                <VisualizerButton onClick={handleVisualizerOpen} />
                <div className="tunio-native-range-wrapper">
                  <div className="tunio-native-range-container">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="tunio-native-range"
                      style={{ backgroundSize: volumeBarBackgroundSize }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          {streamConfig?.wetermark && (
            <div className="tunio-player-watermark">
              <WaterMark height={14} color={theme === "dark" ? "#fff" : "#000"} />
            </div>
          )}
        </div>
      </div>

      {isVisualizerOpen && streamDetails?.title && (
        <VisualizerOverlay
          trackBackground={bgColor}
          coverURL={coverURL}
          audioRef={audioRef}
          isOpen={isVisualizerOpen}
          onClose={handleVisualizerClose}
          track={currentTrack}
          stream={streamDetails}
          streamConfig={streamConfig}
        />
      )}
    </div>
  )
}

export default Player
