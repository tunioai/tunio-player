"use client"

import { useEffect, useState, useRef } from "react"
import Hls from "hls.js"
import { metadataFromTagList } from "../playlistMetadata"
import type { PlaylistTrackMetadata } from "../playlistMetadata"

type AudioState = {
  isPlaying: boolean
  volume: number
  isMuted: boolean
  loading: boolean
  buffering: boolean
}

type PlaybackMode = "live" | "buffered"

type UseNativeAudioOptions = {
  mode?: PlaybackMode
  onMetadataUpdate?: (metadata: PlaylistTrackMetadata[]) => void
}

const BUFFERED_SEGMENT_COUNT = 6

// iOS needs a larger buffer for stable playback
const IOS_BUFFERED_SEGMENT_COUNT = 4

const areArraysEqual = (a: Array<string>, b: Array<string>): boolean => {
  if (a.length !== b.length) return false
  return a.every((item, index) => item === b[index])
}

const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent || "")

const useNativeAudio = (streams: Array<string> = [], options: UseNativeAudioOptions = {}) => {
  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    volume: 0.7,
    isMuted: false,
    loading: false,
    buffering: false
  })

  const playbackMode: PlaybackMode = options.mode ?? "live"
  const isLiveMode = playbackMode === "live"

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bufferingTimer = useRef<NodeJS.Timeout | null>(null)
  const currentStreamUrl = useRef<string | null>(null)
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef<number>(0)
  const shouldAutoReconnect = useRef<boolean>(false)
  const previousStreams = useRef<Array<string>>([])
  const initAudioRef = useRef<(streamUrl: string) => void>(() => undefined)
  const resetAutoReconnectRef = useRef<() => void>(() => undefined)
  const clearTimersRef = useRef<() => void>(() => undefined)
  const hlsRef = useRef<Hls | null>(null)
  const isBufferingRef = useRef<boolean>(false)
  const bufferRecoveryTimer = useRef<NodeJS.Timeout | null>(null)
  const metadataCallbackRef = useRef<((metadata: PlaylistTrackMetadata[]) => void) | undefined>(
    options.onMetadataUpdate
  )

  useEffect(() => {
    metadataCallbackRef.current = options.onMetadataUpdate
  }, [options.onMetadataUpdate])

  const clearReconnectTimer = (resetAttempts = true) => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }

    if (resetAttempts) {
      reconnectAttempts.current = 0
    }
  }

  const clearTimers = () => {
    if (bufferingTimer.current) {
      clearTimeout(bufferingTimer.current)
      bufferingTimer.current = null
    }
    if (bufferRecoveryTimer.current) {
      clearTimeout(bufferRecoveryTimer.current)
      bufferRecoveryTimer.current = null
    }
    clearReconnectTimer()
  }
  clearTimersRef.current = clearTimers

  const destroyHlsInstance = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }

  const attemptReconnect = () => {
    if (!shouldAutoReconnect.current) {
      reconnectAttempts.current = 0
      return
    }

    if (!isLiveMode) {
      const streamUrl = currentStreamUrl.current
      if (!streamUrl) return

      if (hlsRef.current) {
        hlsRef.current.startLoad()
      } else {
        setupAudioSource(streamUrl)
      }

      const audio = audioRef.current
      if (!audio) {
        return
      }

      if (audio.paused) {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            /* ignore */
          })
        }
      }

      return
    }

    if (reconnectTimer.current) return

    const delay = 1_000
    reconnectAttempts.current += 1

    setState(prev => ({ ...prev, buffering: true }))

    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null

      if (!shouldAutoReconnect.current || !currentStreamUrl.current) {
        clearReconnectTimer(false)
        return
      }

      initAudio(currentStreamUrl.current, true)

      if (shouldAutoReconnect.current) {
        const audio = audioRef.current
        if (!audio) {
          attemptReconnect()
          return
        }

        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            attemptReconnect()
          })
        }
      }
    }, delay)
  }

  const resetAutoReconnect = () => {
    shouldAutoReconnect.current = false
    clearReconnectTimer()
  }
  resetAutoReconnectRef.current = resetAutoReconnect

  const setupAudioSource = (streamUrl: string) => {
    const audio = audioRef.current
    if (!audio) return

    if (playbackMode === "buffered") {
      destroyHlsInstance()

      // Use the native player on iOS with optimized settings
      if (isIOS && audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = streamUrl
        // Use auto to improve buffering
        audio.preload = "auto"
      } else if (Hls.isSupported()) {
        const segmentCount = isIOS ? IOS_BUFFERED_SEGMENT_COUNT : BUFFERED_SEGMENT_COUNT
        
        const hls = new Hls({
          enableWorker: true,
          startPosition: -1,
          liveSyncDurationCount: segmentCount,
          liveMaxLatencyDurationCount: segmentCount + 2,
          // Increased buffer for iOS
          maxBufferLength: isIOS ? 20 : 15,
          maxMaxBufferLength: isIOS ? 40 : 30,
          maxBufferSize: 60 * 1000 * 1000,
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeMaxRetry: 5,
          nudgeOffset: 0.1,
          // Timeouts
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 9999,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 4,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 6,
          // Additional stability settings
          backBufferLength: isIOS ? 10 : 5,
          liveDurationInfinity: true,
          // Disable low-latency mode for stability
          lowLatencyMode: false
        })
        hlsRef.current = hls

        hls.attachMedia(audio)
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(streamUrl)
        })

        hls.on(Hls.Events.LEVEL_UPDATED, (_event, data) => {
          const callback = metadataCallbackRef.current
          if (!callback) return
          const fragments = data?.details?.fragments ?? []
          const metadataEntries: PlaylistTrackMetadata[] = []

          for (const fragment of fragments) {
            const metadata = metadataFromTagList(fragment.tagList)
            if (metadata) {
              metadataEntries.push(metadata)
            }
          }

          if (metadataEntries.length) {
            callback(metadataEntries)
          }
        })

        // Track buffer level
        hls.on(Hls.Events.BUFFER_APPENDING, () => {
          if (bufferRecoveryTimer.current) {
            clearTimeout(bufferRecoveryTimer.current)
            bufferRecoveryTimer.current = null
          }
        })

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          // Try to resume if there were buffer issues
          if (isBufferingRef.current && audio.paused && shouldAutoReconnect.current) {
            audio.play().catch(() => {
              /* ignore */
            })
          }
        })

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.log('HLS Error:', data.type, data.details)
          
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (data.fatal) {
              hls.startLoad()
            }
            return
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
            return
          }

          if (data.fatal) {
            destroyHlsInstance()
            if (shouldAutoReconnect.current) {
              setupAudioSource(streamUrl)
            }
          }
        })
      } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = streamUrl
      } else {
        audio.src = streamUrl
      }
    } else {
      audio.src = streamUrl
    }
  }

  const initAudio = (streamUrl: string, loadImmediately = false) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute("src")
      audioRef.current.load()
    } else {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current
    audio.volume = state.volume
    audio.muted = state.isMuted
    audio.preload = playbackMode === "buffered" ? "auto" : "none"
    audio.crossOrigin = "anonymous"

    destroyHlsInstance()

    audio.onloadstart = () => {
      setState(prev => ({ ...prev, loading: true }))
    }

    audio.onloadedmetadata = () => {
      setState(prev => ({ ...prev, loading: false }))
    }

    audio.oncanplay = () => {
      setState(prev => ({ ...prev, loading: false }))
      reconnectAttempts.current = 0
      clearReconnectTimer(false)
      isBufferingRef.current = false
    }

    audio.oncanplaythrough = () => {
      // Enough data buffered for continuous playback
      isBufferingRef.current = false
      setState(prev => ({ ...prev, buffering: false }))
    }

    audio.onplaying = () => {
      setState(prev => ({ ...prev, isPlaying: true, buffering: false }))
      shouldAutoReconnect.current = true
      isBufferingRef.current = false
      clearReconnectTimer()
      
      if (bufferRecoveryTimer.current) {
        clearTimeout(bufferRecoveryTimer.current)
        bufferRecoveryTimer.current = null
      }
    }

    audio.onwaiting = () => {
      isBufferingRef.current = true
      setState(prev => ({ ...prev, buffering: true }))
      
      // Give iOS more time to recover the buffer
      if (isIOS && shouldAutoReconnect.current) {
        if (bufferRecoveryTimer.current) {
          clearTimeout(bufferRecoveryTimer.current)
        }
        
        bufferRecoveryTimer.current = setTimeout(() => {
          if (audio.paused && shouldAutoReconnect.current) {
            audio.play().catch(() => {
              /* ignore */
            })
          }
          bufferRecoveryTimer.current = null
        }, 1000)
      }
    }

    audio.onpause = () => {
      setState(prev => ({ ...prev, isPlaying: false, buffering: false }))
      if (!shouldAutoReconnect.current) {
        clearReconnectTimer()
        isBufferingRef.current = false
      }
    }

    audio.onended = () => {
      setState(prev => ({ ...prev, isPlaying: false, buffering: false }))
      attemptReconnect()
    }

    audio.onerror = () => {
      setState(prev => ({ ...prev, isPlaying: false, loading: false, buffering: false }))
      isBufferingRef.current = false

      if (shouldAutoReconnect.current) {
        attemptReconnect()
      }
    }

    audio.addEventListener("stalled", () => {
      isBufferingRef.current = true
      setState(prev => ({ ...prev, buffering: true }))
      
      if (shouldAutoReconnect.current && isIOS) {
        if (hlsRef.current) {
          hlsRef.current.startLoad()
        }
      }
    })

    audio.addEventListener("suspend", () => {
      // Suspend can be normal on iOS, so do not panic
      if (!isIOS && audio.paused && shouldAutoReconnect.current && state.isPlaying) {
        attemptReconnect()
      }
    })

    audio.addEventListener("timeupdate", () => {
      reconnectAttempts.current = 0
      
      // When playback runs, drop the buffering flag
      if (!audio.paused && isBufferingRef.current) {
        isBufferingRef.current = false
        setState(prev => ({ ...prev, buffering: false }))
      }
    })

    audio.addEventListener("progress", () => {
      // Data keeps downloading
      if (isBufferingRef.current && audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1)
        const currentTime = audio.currentTime
        
        // When there is enough buffer ahead
        if (bufferedEnd - currentTime > 2 && audio.paused && shouldAutoReconnect.current) {
          audio.play().catch(() => {
            /* ignore */
          })
        }
      }
    })

    currentStreamUrl.current = streamUrl

    if (loadImmediately) {
      setupAudioSource(streamUrl)
    } else {
      audio.removeAttribute("src")
    }
  }
  initAudioRef.current = initAudio

  useEffect(() => {
    if (typeof window === "undefined" || playbackMode !== "buffered") return

    const handleOnline = () => {
      if (!currentStreamUrl.current) return

      if (hlsRef.current) {
        hlsRef.current.startLoad()
      } else {
        setupAudioSource(currentStreamUrl.current)
      }

      const audio = audioRef.current
      if (!audio) return

      if (audio.paused && shouldAutoReconnect.current) {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            /* ignore */
          })
        }
      }
    }

    const handleOffline = () => {
      // Flag buffering on iOS when the connection drops
      if (isIOS) {
        isBufferingRef.current = true
        setState(prev => ({ ...prev, buffering: true }))
      }
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [playbackMode])

  useEffect(() => {
    if (areArraysEqual(streams, previousStreams.current)) {
      return
    }

    previousStreams.current = [...streams]
    const streamUrl = streams[0]

    if (!streamUrl) return

    if (streamUrl === currentStreamUrl.current) return

    if (audioRef.current && !audioRef.current.paused) return

    initAudioRef.current(streamUrl)

    return () => {
      resetAutoReconnectRef.current()
      clearTimersRef.current()
      destroyHlsInstance()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.removeAttribute("src")
        audioRef.current.load()
      }
    }
  }, [streams])

  const togglePlay = () => {
    if (!audioRef.current) return

    if (state.isPlaying) {
      resetAutoReconnect()
      audioRef.current.pause()
    } else {
      play()
    }
  }

  const play = () => {
    if (!audioRef.current || state.isPlaying || !currentStreamUrl.current) return

    const audio = audioRef.current
    if (playbackMode === "buffered") {
      setupAudioSource(currentStreamUrl.current)
    } else {
      if (audio.src !== currentStreamUrl.current) {
        setupAudioSource(currentStreamUrl.current)
      }
      audio.load()
    }

    setState(prev => ({ ...prev, buffering: true }))
    isBufferingRef.current = true
    clearReconnectTimer()
    reconnectAttempts.current = 0
    shouldAutoReconnect.current = true

    const playPromise = audio.play()

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          bufferingTimer.current = setTimeout(() => {
            if (!isBufferingRef.current) {
              setState(prev => ({ ...prev, buffering: false }))
            }
          }, 500)
        })
        .catch(() => {
          setState(prev => ({ ...prev, isPlaying: false, buffering: false }))
          shouldAutoReconnect.current = false
          isBufferingRef.current = false
        })
    }
  }

  const stop = () => {
    if (!audioRef.current) return

    resetAutoReconnect()
    audioRef.current.pause()
    audioRef.current.removeAttribute("src")
    audioRef.current.load()
    destroyHlsInstance()
    isBufferingRef.current = false
    setState(prev => ({ ...prev, isPlaying: false, buffering: false, loading: false }))
  }

  const setVolume = (volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }

    setState(prev => ({ ...prev, volume }))
  }

  const toggleMute = () => {
    const newMutedState = !state.isMuted

    if (audioRef.current) {
      audioRef.current.muted = newMutedState
    }

    setState(prev => ({ ...prev, isMuted: newMutedState, volume: newMutedState ? 0 : 0.7 }))
  }

  return {
    ...state,
    togglePlay,
    setVolume,
    toggleMute,
    play,
    stop,
    audioRef
  }
}

export default useNativeAudio
