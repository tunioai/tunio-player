"use client"

import React, { useCallback, useEffect, useRef } from "react"
import type { TrackBackground } from "../types"

type AudioGraph = {
  context: AudioContext
  analyser: AnalyserNode
  dataArray: Uint8Array
}

const audioGraphStore = new WeakMap<HTMLAudioElement, AudioGraph>()

const getAudioContextConstructor = () => {
  if (typeof window === "undefined") return null
  return (
    window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null
  )
}

type VisualizerAudioCanvasProps = {
  isOpen: boolean
  audioRef: React.MutableRefObject<HTMLAudioElement | null>
  backdropRef: React.RefObject<HTMLDivElement | null>
  backdropUrl: string
  trackBackground: TrackBackground | null
}

const BAR_COUNT = 50

// simple peak-cap physics
const PEAK_FALL_SPEED = 3 // px per frame when bar is lower
const PEAK_TRIGGER_DELTA = 2 // minimal diff to move peak up

const CAP_MIN = 0.1
const CAP_MAX = 4

const MAX_DPR = 1.5 // clamp DPR to avoid huge canvases on Retina

const VisualizerAudioCanvas: React.FC<VisualizerAudioCanvasProps> = ({
  isOpen,
  audioRef,
  backdropRef,
  backdropUrl,
  trackBackground
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)

  const barLevelsRef = useRef<Float32Array | null>(null)
  const peakYRef = useRef<Float32Array | null>(null)

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const resizeRafRef = useRef<number | null>(null)

  // Background image state
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const bgReadyRef = useRef(false)

  // Precomputed lookup tables for indices and floor values per bar
  const lutRef = useRef<{
    bucketIndex: Uint16Array
    mirroredIndex: Uint16Array
    floorValue: Float32Array
  } | null>(null)

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas) return

    const DPR = typeof window !== "undefined" ? Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1)) : 1

    const { innerWidth, innerHeight } = window

    // CSS size
    canvas.style.width = `${innerWidth}px`
    canvas.style.height = `${innerHeight}px`

    // Internal buffer size
    canvas.width = Math.floor(innerWidth * DPR)
    canvas.height = Math.floor(innerHeight * DPR)

    if (ctx) {
      // Normalize coordinates back to CSS pixels
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
  }, [])

  // Load / reload background image when URL changes
  useEffect(() => {
    const src = backdropUrl

    if (!src) {
      bgImageRef.current = null
      bgReadyRef.current = false
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous" // safe default for remote images
    img.src = src
    bgReadyRef.current = false

    img.onload = () => {
      bgImageRef.current = img
      bgReadyRef.current = true
    }

    img.onerror = () => {
      bgImageRef.current = null
      bgReadyRef.current = false
    }

    return () => {
      bgImageRef.current = null
      bgReadyRef.current = false
    }
  }, [backdropUrl, trackBackground])

  useEffect(() => {
    if (!isOpen) {
      stopAnimation()
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctxRef.current = ctx

    resizeCanvas()

    // Throttled resize handler
    const handleResize = () => {
      if (resizeRafRef.current != null) return
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeCanvas()
        resizeRafRef.current = null
      })
    }

    window.addEventListener("resize", handleResize)

    // Draw function: draws a single frame. Scheduling is handled separately.
    const draw = () => {
      const ctx = ctxRef.current
      const analyser = analyserRef.current
      const dataArray = dataArrayRef.current
      const audioElement = audioRef.current

      // Stop if component is closed, audio is not playing, or page is hidden
      if (!isOpen || !ctx || !analyser || !dataArray || !audioElement || audioElement.paused || document.hidden) {
        stopAnimation()
        return
      }

      const canvas = canvasRef.current
      if (!canvas) {
        stopAnimation()
        return
      }

      // @ts-ignore
      analyser.getByteFrequencyData(dataArray)

      const DPR = typeof window !== "undefined" ? Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1)) : 1

      const width = canvas.width / DPR
      const height = canvas.height / DPR

      // 1) Clear canvas fully each frame
      ctx.clearRect(0, 0, width, height)

      // 2) Draw blurred background image (cover)
      const bgImg = bgImageRef.current
      if (bgImg && bgReadyRef.current) {
        ctx.save()

        const imgRatio = bgImg.width / bgImg.height
        const canvasRatio = width / height

        let drawWidth: number
        let drawHeight: number
        let drawX: number
        let drawY: number

        // cover logic
        if (imgRatio > canvasRatio) {
          // image is wider than canvas
          drawHeight = height
          drawWidth = height * imgRatio
          drawX = (width - drawWidth) / 2
          drawY = 0
        } else {
          // image is taller than canvas
          drawWidth = width
          drawHeight = width / imgRatio
          drawX = 0
          drawY = (height - drawHeight) / 2
        }

        const blurRadius = 10
        ctx.filter = `blur(${blurRadius}px)`
        ctx.drawImage(bgImg, drawX, drawY, drawWidth, drawHeight)
        ctx.filter = "none"

        ctx.save()
        ctx.globalCompositeOperation = "multiply"
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)" // ← adjust darkness here
        ctx.fillRect(0, 0, width, height)
        ctx.restore()

        // Soft vignette on top of blurred background
        ctx.save()

        ctx.globalCompositeOperation = "multiply"

        ctx.restore()
      } else {
        // fallback background if image not ready
        ctx.fillStyle = "#050712"
        ctx.fillRect(0, 0, width, height)
      }

      // 3) Color overlay on top of blurred image
      ctx.save()

      const barWidth = width / BAR_COUNT

      if (!barLevelsRef.current || barLevelsRef.current.length !== BAR_COUNT)
        barLevelsRef.current = new Float32Array(BAR_COUNT)
      if (!peakYRef.current || peakYRef.current.length !== BAR_COUNT)
        peakYRef.current = new Float32Array(BAR_COUNT).fill(height)

      const barLevels = barLevelsRef.current
      const peakY = peakYRef.current

      const binCount = dataArray.length

      // Use precomputed LUTs when available
      const lut = lutRef.current

      // Single shared gradient for all bars per frame (cheaper than 50 gradients)
      const barGradient = ctx.createLinearGradient(0, height, 0, 0)
      barGradient.addColorStop(0, "rgba(64, 169, 255, 0.50)")
      barGradient.addColorStop(0.4, "rgba(120, 200, 255, 0.70)")

      if (trackBackground) {
        barGradient.addColorStop(1, `rgba(${trackBackground?.r}, ${trackBackground?.g}, ${trackBackground?.b}, 1)`)
      } else {
        barGradient.addColorStop(1, "rgba(1, 92, 152, 1)")
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        let bucketIndex: number
        let mirroredIndex: number
        let floorValue: number

        if (lut) {
          bucketIndex = lut.bucketIndex[i]
          mirroredIndex = lut.mirroredIndex[i]
          floorValue = lut.floorValue[i]
        } else {
          const proportion = i / Math.max(1, BAR_COUNT - 1)
          const curved = Math.pow(proportion, 0.85)
          bucketIndex = Math.min(Math.floor(curved * (binCount - 1)), binCount - 1)
          mirroredIndex = Math.min(Math.floor((1 - proportion * 0.6) * (binCount - 1)), binCount - 1)
          floorValue = 0.08 + (1 - proportion) * 0.05
        }

        const rawValue = dataArray[bucketIndex] / 255
        const mirrored = dataArray[mirroredIndex] / 255
        const blended = rawValue * 0.55 + mirrored * 0.35
        const target = Math.min(1, blended + floorValue)
        const eased = barLevels[i] * 0.945 + target * 0.055
        barLevels[i] = eased

        const easedHeight = Math.pow(eased, 1.3)
        const barHeight = Math.max(4, height * easedHeight * 0.75)
        const x = i * barWidth
        const yTop = height - barHeight

        // Bars
        ctx.fillStyle = barGradient
        ctx.fillRect(x + barWidth * 0.3, yTop, barWidth * 0.4, barHeight)

        // Simple peak cap: snaps up instantly, falls down with constant speed
        let currentPeakY = peakY[i]

        if (yTop < currentPeakY - PEAK_TRIGGER_DELTA) {
          // bar went significantly higher → snap cap to bar top
          currentPeakY = yTop
        } else if (yTop > currentPeakY) {
          // bar is below peak → let the cap fall down smoothly
          currentPeakY = Math.min(yTop, currentPeakY + PEAK_FALL_SPEED)
        }

        peakY[i] = currentPeakY

        const capH = Math.max(CAP_MIN, Math.min(CAP_MAX, barWidth * 0.25))
        ctx.fillStyle = "rgba(255,255,255,0.95)"
        ctx.fillRect(x + barWidth * 0.28, Math.max(0, currentPeakY - capH), barWidth * 0.44, capH)
      }
    }

    const startAnimation = () => {
      // Avoid multiple concurrent RAF loops
      if (animationFrameRef.current != null) return
      animationFrameRef.current = requestAnimationFrame(function loop() {
        draw()
        // draw() may cancel RAF via stopAnimation(); check before rescheduling
        if (animationFrameRef.current != null) {
          animationFrameRef.current = requestAnimationFrame(loop)
        }
      })
    }

    const setupAudioGraph = async () => {
      const audioElement = audioRef.current
      if (!audioElement) return
      const AudioContextConstructor = getAudioContextConstructor()
      if (!AudioContextConstructor) return

      let graph = audioGraphStore.get(audioElement)
      if (!graph) {
        const context = new AudioContextConstructor()
        const source = context.createMediaElementSource(audioElement)
        const analyser = context.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        analyser.connect(context.destination)
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        graph = { context, analyser, dataArray }
        audioGraphStore.set(audioElement, graph)
      }

      if (graph.context.state === "suspended") {
        try {
          await graph.context.resume()
        } catch (err) {
          console.warn("Unable to resume audio context", err)
        }
      }

      analyserRef.current = graph.analyser
      dataArrayRef.current = graph.dataArray

      // Precompute LUTs once per audio graph
      const binCount = graph.dataArray.length
      const bucketIndex = new Uint16Array(BAR_COUNT)
      const mirroredIndex = new Uint16Array(BAR_COUNT)
      const floorValue = new Float32Array(BAR_COUNT)

      for (let i = 0; i < BAR_COUNT; i++) {
        const proportion = i / Math.max(1, BAR_COUNT - 1)
        const curved = Math.pow(proportion, 0.85)
        bucketIndex[i] = Math.min(Math.floor(curved * (binCount - 1)), binCount - 1)
        mirroredIndex[i] = Math.min(Math.floor((1 - proportion * 0.6) * (binCount - 1)), binCount - 1)
        floorValue[i] = 0.08 + (1 - proportion) * 0.05
      }

      lutRef.current = { bucketIndex, mirroredIndex, floorValue }

      // Start animation only when audio is actually playing
      if (!audioElement.paused && !document.hidden) {
        startAnimation()
      }
    }

    // Visibility handler to pause/resume animation
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAnimation()
      } else {
        const audioElement = audioRef.current
        if (audioElement && !audioElement.paused && isOpen) {
          startAnimation()
        }
      }
    }

    // Audio play/pause handlers
    const audioElement = audioRef.current
    const handleAudioPlay = () => {
      if (!document.hidden && isOpen) {
        startAnimation()
      }
    }
    const handleAudioPause = () => {
      stopAnimation()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    if (audioElement) {
      audioElement.addEventListener("play", handleAudioPlay)
      audioElement.addEventListener("pause", handleAudioPause)
    }

    setupAudioGraph()

    return () => {
      window.removeEventListener("resize", handleResize)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (audioElement) {
        audioElement.removeEventListener("play", handleAudioPlay)
        audioElement.removeEventListener("pause", handleAudioPause)
      }
      if (resizeRafRef.current != null) {
        cancelAnimationFrame(resizeRafRef.current)
        resizeRafRef.current = null
      }
      stopAnimation()
    }
  }, [audioRef, backdropRef, isOpen, resizeCanvas, stopAnimation, backdropUrl, trackBackground])

  return (
    <>
      <div className="tunio-visualizer-backdrop tunio-visualizer-backdrop--audio"></div>
      <canvas ref={canvasRef} className="tunio-visualizer-canvas" aria-hidden="true" />
    </>
  )
}

export default VisualizerAudioCanvas
