"use client"

import clsx from "clsx"
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Cover } from "./Cover"
import { getDominantColor } from "./helper"
import { PlayPauseButton } from "./buttons/PlayPause"
import { MuteButton } from "./buttons/Mute"
import type { TrackBackground, CurrentResponse, Track } from "./types"
import type { Props } from "./PlayerTypes"

import useNativeAudio from "./hooks/useNativeAudio"

const generateUniqueId = () => `player_${Math.random().toString(36).substr(2, 9)}`

const calculateBackgroundSize = (value: number, min: number, max: number) =>
  ((value - min) / (max - min)) * 100 + "% 100%"

const Player: React.FC<Props> = ({ name, opacity = 1, ambient = false, theme = "dark" }) => {
  const playerIdRef = useRef<string>(generateUniqueId())
  const playerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const titleContainerRef = useRef<HTMLDivElement>(null)
  const currentTrackUpdateInterval = useRef<NodeJS.Timeout | null>(null)
  const initialLoadingRef = useRef<boolean>(true)
  const previousNameRef = useRef<string | undefined>(undefined)
  const streamsDataRef = useRef<Array<string>>([])
  const checkOverflowTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [bgColor, setBgColor] = useState<TrackBackground | null>(null)
  const [currentTrack, setCurrentTrack] = useState<Track | undefined>(undefined)
  const [coverURL, setCoverURL] = useState<string | null>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [textScrollDistance, setTextScrollDistance] = useState(0)
  const [streamsData, setStreamsData] = useState<Array<string>>([])

  const streams = useMemo(() => streamsData, [streamsData])

  const { isPlaying, volume, isMuted, buffering, setVolume, toggleMute, play, stop } = useNativeAudio(streams)

  const volumeBarBackgroundSize = calculateBackgroundSize(volume, 0, 1)

  const checkOverflow = useCallback(() => {
    if (titleRef.current && titleContainerRef.current) {
      const textWidth = titleRef.current.scrollWidth
      const containerWidth = titleContainerRef.current.clientWidth
      const isTextOverflowing = textWidth > containerWidth

      if (isTextOverflowing) {
        const distance = textWidth - containerWidth
        setTextScrollDistance(distance)
      }

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

  const fetchCurrentTrack = useCallback(() => {
    if (!name) return

    const fetchData = async () => {
      try {
        const response = await fetch(`https://app.tunio.ai/api/radio/${name}/current`)
        const data: CurrentResponse = await response.json()

        if (data.success) {
          setCurrentTrack(data.track)

          if (data.streams?.length) {
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
        console.error("Error fetching current track", error)
      } finally {
        initialLoadingRef.current = false
      }
    }

    fetchData()
  }, [name, checkOverflow])

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
    if (previousNameRef.current === name) return

    previousNameRef.current = name

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
    setTextScrollDistance(0)
    setCurrentTrack(undefined)
    streamsDataRef.current = []
    setStreamsData([])

    if (!name) return

    initialLoadingRef.current = true
    fetchCurrentTrack()

    currentTrackUpdateInterval.current = setInterval(fetchCurrentTrack, 15_000)

    return () => {
      if (currentTrackUpdateInterval.current) {
        clearInterval(currentTrackUpdateInterval.current)
        currentTrackUpdateInterval.current = null
      }

      if (checkOverflowTimeoutRef.current) {
        clearTimeout(checkOverflowTimeoutRef.current)
        checkOverflowTimeoutRef.current = null
      }
    }
  }, [name, isPlaying, stop, fetchCurrentTrack])

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

  const scrollStyle = useMemo(
    () =>
      isOverflowing
        ? ({
            "--scroll-distance": `-${textScrollDistance}px`
          } as React.CSSProperties)
        : {},
    [isOverflowing, textScrollDistance]
  )

  return (
    <div
      ref={playerRef}
      className={clsx("tunio-player", { "tunio-theme-dark": theme === "dark", "tunio-theme-light": theme === "light" })}
    >
      {ambient && coverURL && <div className="tunio-ambient" style={{ backgroundImage: `url(${coverURL})` }} />}
      <div className="tunio-player-wrapper" style={backgroundStyle}>
        <Cover track={currentTrack} onImageLoad={onCoverImageLoad} />
        <div className="tunio-container">
          <div ref={titleContainerRef}>
            <div
              ref={titleRef}
              className={`tunio-title ${isOverflowing ? "tunio-scrolling" : ""}`}
              style={scrollStyle}
            >
              {currentTrack ? `${currentTrack?.artist || "Tunio"} - ${currentTrack?.title || "Untitled"}` : " "}
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
    </div>
  )
}

export default Player
