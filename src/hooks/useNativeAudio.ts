"use client"

import { useEffect, useState, useRef } from "react"

type AudioState = {
  isPlaying: boolean
  volume: number
  isMuted: boolean
  loading: boolean
  buffering: boolean
}

const areArraysEqual = (a: Array<string>, b: Array<string>): boolean => {
  if (a.length !== b.length) return false
  return a.every((item, index) => item === b[index])
}

const useNativeAudio = (streams: Array<string> = []) => {
  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    volume: 0.7,
    isMuted: false,
    loading: false,
    buffering: false
  })

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
    clearReconnectTimer()
  }
  clearTimersRef.current = clearTimers

  const attemptReconnect = () => {
    if (!shouldAutoReconnect.current) {
      reconnectAttempts.current = 0
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

      initAudio(currentStreamUrl.current)

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

  const initAudio = (streamUrl: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute("src")
      audioRef.current.load()
    } else {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current
    audio.src = streamUrl
    audio.volume = state.volume
    audio.muted = state.isMuted
    audio.preload = "auto"
    audio.crossOrigin = "anonymous"

    audio.onloadstart = () => {
      setState(prev => ({ ...prev, loading: true }))
    }

    audio.oncanplay = () => {
      setState(prev => ({ ...prev, loading: false }))
      reconnectAttempts.current = 0
      clearReconnectTimer(false)
    }

    audio.onplaying = () => {
      setState(prev => ({ ...prev, isPlaying: true, buffering: false }))
      shouldAutoReconnect.current = true
      clearReconnectTimer()
    }

    audio.onwaiting = () => {
      setState(prev => ({ ...prev, buffering: true }))
    }

    audio.onpause = () => {
      setState(prev => ({ ...prev, isPlaying: false, buffering: false }))
      if (!shouldAutoReconnect.current) {
        clearReconnectTimer()
      }
    }

    audio.onended = () => {
      setState(prev => ({ ...prev, isPlaying: false, buffering: false }))
      attemptReconnect()
    }

    audio.onerror = () => {
      setState(prev => ({ ...prev, isPlaying: false, loading: false, buffering: false }))

      if (shouldAutoReconnect.current) {
        attemptReconnect()
      }
    }

    audio.addEventListener("stalled", () => {
      setState(prev => ({ ...prev, buffering: true }))
      if (shouldAutoReconnect.current) {
        attemptReconnect()
      }
    })

    audio.addEventListener("suspend", () => {
      if (audio.paused && shouldAutoReconnect.current && state.isPlaying) {
        attemptReconnect()
      }
    })

    audio.addEventListener("timeupdate", () => {
      reconnectAttempts.current = 0
    })

    currentStreamUrl.current = streamUrl
  }
  initAudioRef.current = initAudio

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
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
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
      setState(prev => ({ ...prev, buffering: true }))
      clearReconnectTimer()
      shouldAutoReconnect.current = true
      reconnectAttempts.current = 0

      const playPromise = audioRef.current.play()

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            bufferingTimer.current = setTimeout(() => {
              setState(prev => ({ ...prev, buffering: false }))
            }, 500)
          })
          .catch(() => {
            setState(prev => ({ ...prev, isPlaying: false, buffering: false }))
            shouldAutoReconnect.current = false
          })
      }
    }
  }

  const play = () => {
    if (!audioRef.current || state.isPlaying) return

    setState(prev => ({ ...prev, buffering: true }))
    clearReconnectTimer()
    shouldAutoReconnect.current = true
    reconnectAttempts.current = 0

    const playPromise = audioRef.current.play()

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          bufferingTimer.current = setTimeout(() => {
            setState(prev => ({ ...prev, buffering: false }))
          }, 500)
        })
        .catch(() => {
          setState(prev => ({ ...prev, isPlaying: false, buffering: false }))
          shouldAutoReconnect.current = false
        })
    }
  }

  const stop = () => {
    if (!audioRef.current || !state.isPlaying) return

    resetAutoReconnect()
    audioRef.current.pause()
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
    stop
  }
}

export default useNativeAudio
