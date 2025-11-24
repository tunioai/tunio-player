"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { StreamConfig } from "../../types"

const DEFAULT_BASE_URL = "https://radio-cdn.website.yandexcloud.net/live-backgrounds"

export type VisualizerVideoBackgroundProps = {
  streamConfig: StreamConfig
  opacity?: number
}

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const switchingRef = useRef(false)
  const playQueueRef = useRef<number[]>([])

  const playlist = useMemo(() => streamConfig.live_backgrounds.filter(Boolean), [streamConfig.live_backgrounds])
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)

  // Reset playlist index when list changes
  useEffect(() => {
    if (!playlist.length) {
      playQueueRef.current = []
      setCurrentIndex(null)
      switchingRef.current = false
      const video = videoRef.current
      if (video) {
        video.pause()
        video.removeAttribute("src")
        video.load()
      }
      return
    }

    const nextQueue = createShuffledQueue(playlist.length)
    const initialIndex = nextQueue.shift() ?? null
    playQueueRef.current = nextQueue
    if (initialIndex != null) {
      switchingRef.current = true
    }
    setCurrentIndex(initialIndex)
  }, [playlist])

  const loadAndPlay = useCallback(
    async (index: number) => {
      const video = videoRef.current
      if (!video || !playlist[index]) return

      const source = `${DEFAULT_BASE_URL}/${playlist[index]}.mp4`
      if (video.src !== source) {
        video.src = source
        video.load()
      } else {
        video.pause()
      }

      await waitForCanPlay(video)
      try {
        video.currentTime = 0
      } catch {
        video.load()
      }

      const playPromise = video.play()
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // ignore autoplay restrictions
        })
      }
    },
    [playlist]
  )

  useEffect(() => {
    if (currentIndex == null) return

    let canceled = false
    const startPlayback = async () => {
      await loadAndPlay(currentIndex)
      if (!canceled) {
        switchingRef.current = false
      }
    }

    void startPlayback()

    return () => {
      canceled = true
    }
  }, [currentIndex, loadAndPlay])

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

  const transitionToIndex = useCallback(
    (nextIndex: number | null) => {
      if (nextIndex == null || switchingRef.current) return
      switchingRef.current = true
      setCurrentIndex(nextIndex)
    },
    []
  )

  const handleCycle = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (playlist.length <= 1) {
      video.currentTime = 0
      const playPromise = video.play()
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {})
      }
      return
    }

    const nextIndex = getNextIndexFromQueue()
    if (nextIndex == null) return
    transitionToIndex(nextIndex)
  }, [getNextIndexFromQueue, playlist.length, transitionToIndex])

  const handleVideoEvent = useCallback(() => {
    handleCycle()
  }, [handleCycle])

  if (!playlist.length) {
    return null
  }

  return (
    <div className="tunio-visualizer-video-wrapper" aria-hidden="true">
      <video
        ref={videoRef}
        className="tunio-visualizer-video"
        playsInline={true}
        muted={true}
        preload="auto"
        autoPlay={false}
        loop={false}
        tabIndex={-1}
        onEnded={handleVideoEvent}
        onError={handleVideoEvent}
      />
      {opacity > 0 && (
        <div className="tunio-visualizer-video-overlay" style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }} />
      )}
    </div>
  )
}

export default VisualizerVideoBackground
