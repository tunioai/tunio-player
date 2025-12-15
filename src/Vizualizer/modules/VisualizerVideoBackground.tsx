"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { StreamConfig } from "../../types"

const DEFAULT_BASE_URL = "https://cdn.tunio.ai/wallpapers_short_backgrounds"

export type VisualizerVideoBackgroundProps = {
  streamConfig: StreamConfig
  opacity?: number
}

const BUFFER_COUNT = 2 as const
const FADE_DURATION_MS = 600
const CROSSFADE_LEAD_MS = 900
const PLAYBACK_GUARD_INTERVAL_MS = 2000

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

const createShuffledQueue = (length: number) => {
  const indices = Array.from({ length }, (_, index) => index)
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices
}

const VisualizerVideoBackground: React.FC<VisualizerVideoBackgroundProps> = ({ streamConfig, opacity = 0 }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const bufferRefs = useRef(Array.from({ length: BUFFER_COUNT }, () => React.createRef<HTMLVideoElement>()))
  const [activeBuffer, setActiveBuffer] = useState<0 | 1>(0)
  const switchingRef = useRef(false)
  const fadeTimeoutRef = useRef<number | null>(null)
  const playbackGuardIntervalRef = useRef<number | null>(null)
  const playQueueRef = useRef<number[]>([])
  const playbackNudgeTimeoutsRef = useRef<number[]>([])
  const lastEnforceRef = useRef(0)

  const playlist = useMemo(() => streamConfig.live_backgrounds.filter(Boolean), [streamConfig.live_backgrounds])
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!playlist.length) {
      playQueueRef.current = []
      setCurrentIndex(null)
      return
    }

    const nextQueue = createShuffledQueue(playlist.length)
    const initialIndex = nextQueue.shift() ?? null
    playQueueRef.current = nextQueue
    setCurrentIndex(initialIndex)
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
        // ignore
      }
    },
    [playlist]
  )

  const playBuffer = useCallback(async (bufferIndex: 0 | 1) => {
    const ref = bufferRefs.current[bufferIndex]
    const video = ref?.current
    if (!video || video.ended) return

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForCanPlay(video)
    }

    if (!video.paused) return

    try {
      await video.play()
    } catch (err) {
      console.warn("Play failed:", err)
    }
  }, [])

  const stopBuffer = useCallback((bufferIndex: 0 | 1) => {
    const ref = bufferRefs.current[bufferIndex]
    const video = ref?.current
    if (!video) return
    video.pause()
  }, [])

  const resumeBufferPlayback = useCallback(
    (bufferIndex: 0 | 1) => {
      if (bufferIndex !== activeBuffer) return
      const video = bufferRefs.current[bufferIndex]?.current
      if (!video || video.ended || switchingRef.current) return
      if (!video.paused) return
      if (!video.muted) {
        video.muted = true
      }
      playBuffer(bufferIndex)
    },
    [activeBuffer, playBuffer]
  )

  const clearPlaybackNudges = useCallback(() => {
    if (typeof window === "undefined") return
    playbackNudgeTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId))
    playbackNudgeTimeoutsRef.current = []
  }, [])

  const enforceActivePlayback = useCallback(() => {
    const now = Date.now()
    if (now - lastEnforceRef.current < 1000) return
    lastEnforceRef.current = now
    resumeBufferPlayback(activeBuffer)
  }, [activeBuffer, resumeBufferPlayback])

  const transitionToIndex = useCallback(
    async (nextIndex: number | null) => {
      if (nextIndex == null || switchingRef.current) return
      const incomingBuffer = activeBuffer === 0 ? 1 : 0
      switchingRef.current = true

      clearPlaybackNudges()

      await primeBuffer(incomingBuffer, nextIndex)

      setActiveBuffer(incomingBuffer)
      setCurrentIndex(nextIndex)

      // Release switching flag first, then start playback
      fadeTimeoutRef.current = window.setTimeout(() => {
        stopBuffer(activeBuffer)
        switchingRef.current = false
      }, FADE_DURATION_MS)

      // Kick playback off shortly after the state change
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          playBuffer(incomingBuffer)

          // Sanity nudge to ensure Safari keeps playing
          playbackNudgeTimeoutsRef.current = [
            window.setTimeout(() => {
              if (!switchingRef.current) {
                const video = bufferRefs.current[incomingBuffer]?.current
                if (video && video.paused && !video.ended) {
                  playBuffer(incomingBuffer)
                }
              }
            }, 700) // After the switching flag flips back to false
          ]
        }, 50)
      }
    },
    [activeBuffer, clearPlaybackNudges, playBuffer, primeBuffer, stopBuffer]
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
    enforceActivePlayback()
  }, [activeBuffer, enforceActivePlayback])

  useEffect(() => {
    if (typeof document === "undefined") return
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        enforceActivePlayback()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enforceActivePlayback])

  useEffect(() => {
    if (typeof window === "undefined") return
    const guardTick = () => {
      enforceActivePlayback()
    }
    playbackGuardIntervalRef.current = window.setInterval(guardTick, PLAYBACK_GUARD_INTERVAL_MS)
    return () => {
      if (playbackGuardIntervalRef.current) {
        window.clearInterval(playbackGuardIntervalRef.current)
        playbackGuardIntervalRef.current = null
      }
    }
  }, [enforceActivePlayback])

  useEffect(() => {
    return () => {
      clearPlaybackNudges()
    }
  }, [clearPlaybackNudges])

  useEffect(() => {
    return () => {
      localVideoRef.current = null
    }
  }, [localVideoRef])

  const getNextIndexFromQueue = useCallback(() => {
    if (!playlist.length) return null

    if (playQueueRef.current.length === 0) {
      const refilledQueue = createShuffledQueue(playlist.length)
      if (currentIndex != null && refilledQueue.length > 1 && refilledQueue[0] === currentIndex) {
        const swapIndex = refilledQueue.findIndex(index => index !== currentIndex)
        if (swapIndex > 0) {
          ;[refilledQueue[0], refilledQueue[swapIndex]] = [refilledQueue[swapIndex], refilledQueue[0]]
        }
      }
      playQueueRef.current = refilledQueue
    }

    return playQueueRef.current.shift() ?? null
  }, [currentIndex, playlist.length])

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
    const nextIndex = getNextIndexFromQueue()
    if (nextIndex == null) return
    void transitionToIndex(nextIndex)
  }, [activeBuffer, getNextIndexFromQueue, playBuffer, playlist.length, transitionToIndex])

  const handlePlaybackComplete = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const bufferIndex = Number(event.currentTarget.dataset.bufferIndex) as 0 | 1
      if (bufferIndex !== activeBuffer) return
      handleCycle()
    },
    [activeBuffer, handleCycle]
  )

  const handleTimeUpdate = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (playlist.length <= 1 || switchingRef.current) return
      const bufferIndex = Number(event.currentTarget.dataset.bufferIndex) as 0 | 1
      if (bufferIndex !== activeBuffer) return
      const video = event.currentTarget
      const duration = video.duration
      if (!Number.isFinite(duration) || duration <= 0) return
      const remainingMs = (duration - video.currentTime) * 1000
      if (remainingMs <= CROSSFADE_LEAD_MS) {
        handleCycle()
      }
    },
    [activeBuffer, handleCycle, playlist.length]
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
          autoPlay={true}
          loop={false}
          tabIndex={-1}
          onEnded={handlePlaybackComplete}
          onError={handlePlaybackComplete}
          onTimeUpdate={handleTimeUpdate}
        />
      ))}
      {opacity > 0 && (
        <div className="tunio-visualizer-video-overlay" style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }} />
      )}
    </div>
  )
}

export default VisualizerVideoBackground
