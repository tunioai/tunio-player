"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { StreamConfig } from "../../types"

const DEFAULT_BASE_URL = "https://radio-cdn.website.yandexcloud.net/live-backgrounds"

export type VisualizerVideoBackgroundProps = {
  streamConfig: StreamConfig
  opacity?: number
}

const BUFFER_COUNT = 2 as const
const FADE_DURATION_MS = 600

const waitForCanPlay = (video: HTMLVideoElement) => {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve()
  }

  return new Promise<void>(resolve => {
    const handle = () => {
      video.removeEventListener("canplay", handle)
      resolve()
    }
    video.addEventListener("canplay", handle, { once: true })
  })
}

const pickNextIndex = (length: number, excludeIndex: number | null) => {
  if (length === 0) return null
  if (length === 1) return 0

  let next = Math.floor(Math.random() * length)
  if (excludeIndex != null) {
    while (next === excludeIndex) {
      next = Math.floor(Math.random() * length)
    }
  }

  return next
}

const VisualizerVideoBackground: React.FC<VisualizerVideoBackgroundProps> = ({ streamConfig, opacity = 0 }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const bufferRefs = useRef(Array.from({ length: BUFFER_COUNT }, () => React.createRef<HTMLVideoElement>()))
  const [activeBuffer, setActiveBuffer] = useState<0 | 1>(0)
  const switchingRef = useRef(false)
  const fadeTimeoutRef = useRef<number | null>(null)

  const playlist = useMemo(() => streamConfig.live_backgrounds.filter(Boolean), [streamConfig.live_backgrounds])
  const [currentIndex, setCurrentIndex] = useState<number | null>(
    playlist.length ? pickNextIndex(playlist.length, null) : null
  )

  // Reset playlist index when list changes
  useEffect(() => {
    if (!playlist.length) {
      setCurrentIndex(null)
      return
    }
    setCurrentIndex(prev => {
      if (prev != null && prev < playlist.length) return prev
      return pickNextIndex(playlist.length, null)
    })
  }, [playlist])

  const primeBuffer = useCallback(
    async (bufferIndex: 0 | 1, index: number | null) => {
      const ref = bufferRefs.current[bufferIndex]
      const video = ref?.current
      if (!video || index == null || !playlist[index]) return

      const source = `${DEFAULT_BASE_URL}/${playlist[index]}.mp4`
      if (video.src !== source) {
        video.src = source
        video.load()
      }

      await waitForCanPlay(video)
      video.pause()
      try {
        video.currentTime = 0
      } catch {
        video.load()
      }
    },
    [DEFAULT_BASE_URL, playlist]
  )

  const playBuffer = useCallback((bufferIndex: 0 | 1) => {
    const ref = bufferRefs.current[bufferIndex]
    const video = ref?.current
    if (!video) return

    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // ignore autoplay restrictions silently
      })
    }
  }, [])

  const stopBuffer = useCallback((bufferIndex: 0 | 1) => {
    const ref = bufferRefs.current[bufferIndex]
    const video = ref?.current
    if (!video) return
    video.pause()
  }, [])

  const transitionToIndex = useCallback(
    async (nextIndex: number | null) => {
      if (nextIndex == null || switchingRef.current) return
      const incomingBuffer = activeBuffer === 0 ? 1 : 0
      switchingRef.current = true

      await primeBuffer(incomingBuffer, nextIndex)

      setActiveBuffer(incomingBuffer)
      setCurrentIndex(nextIndex)

      const startPlayback = () => {
        playBuffer(incomingBuffer)
      }

      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(startPlayback)
      } else {
        startPlayback()
      }

      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current)
      }

      fadeTimeoutRef.current = window.setTimeout(() => {
        stopBuffer(activeBuffer)
        switchingRef.current = false
      }, FADE_DURATION_MS)
    },
    [activeBuffer, playBuffer, primeBuffer, stopBuffer]
  )

  useEffect(() => {
    if (currentIndex == null) return
    void primeBuffer(activeBuffer, currentIndex).then(() => {
      playBuffer(activeBuffer)
    })
  }, [activeBuffer, currentIndex, playBuffer, primeBuffer])

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    localVideoRef.current = bufferRefs.current[activeBuffer]?.current ?? null
  }, [activeBuffer, localVideoRef])

  useEffect(() => {
    return () => {
      localVideoRef.current = null
    }
  }, [localVideoRef])

  const handleCycle = useCallback(() => {
    if (playlist.length <= 1) {
      const ref = bufferRefs.current[activeBuffer]
      const video = ref?.current
      if (video) {
        video.currentTime = 0
        playBuffer(activeBuffer)
      }
      return
    }
    const nextIndex = pickNextIndex(playlist.length, currentIndex)
    void transitionToIndex(nextIndex)
  }, [activeBuffer, currentIndex, playBuffer, playlist.length, transitionToIndex])

  const handleVideoEvent = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const bufferIndex = Number(event.currentTarget.dataset.bufferIndex) as 0 | 1
      if (bufferIndex !== activeBuffer) return
      handleCycle()
    },
    [activeBuffer, handleCycle]
  )

  if (!playlist.length) {
    return null
  }

  return (
    <div className="tunio-visualizer-video-wrapper" aria-hidden="true">
      {[...Array(BUFFER_COUNT).keys()].map(index => (
        <video
          key={index}
          ref={element => {
            bufferRefs.current[index].current = element
          }}
          data-buffer-index={index}
          className={`tunio-visualizer-video tunio-visualizer-video-layer ${
            activeBuffer === index ? "tunio-visualizer-video-layer--visible" : ""
          }`}
          playsInline={true}
          muted={true}
          preload="auto"
          autoPlay={false}
          loop={false}
          tabIndex={-1}
          onEnded={handleVideoEvent}
          onError={handleVideoEvent}
        />
      ))}
      {opacity > 0 && (
        <div className="tunio-visualizer-video-overlay" style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }} />
      )}
    </div>
  )
}

export default VisualizerVideoBackground
