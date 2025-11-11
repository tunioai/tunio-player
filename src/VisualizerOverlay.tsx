"use client"

import React, { useEffect, useRef, useCallback } from "react"
import WaterMark from "./WaterMark"
import type { Track, Stream } from "./types"

type VisualizerOverlayProps = {
  isOpen: boolean
  onClose: () => void
  audioRef: React.MutableRefObject<HTMLAudioElement | null>
  stream: Stream | null
  name: string
  track?: Track
}

type AudioGraph = {
  context: AudioContext
  source: MediaElementAudioSourceNode
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

const VisualizerOverlay: React.FC<VisualizerOverlayProps> = ({ isOpen, onClose, audioRef, track, name, stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backdropRef = useRef<HTMLDivElement | null>(null) // NEW: backdrop ref
  const animationFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const barLevelsRef = useRef<Float32Array | null>(null)
  const peakYRef = useRef<Float32Array | null>(null)
  const peakVelRef = useRef<Float32Array | null>(null)

  // backdrop zoom physics
  const BASE_ZOOM = 1.035
  const ZOOM_FROM_BASS = 0.045
  const SPRING_K = 0.12
  const DAMPING = 0.1
  let zoom = BASE_ZOOM
  let zoomVel = 0
  let bassSmooth = 0

  const BAR_COUNT = 120
  const DPR = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1
  const TRAIL_ALPHA = 0.08
  const PEAK_GRAVITY = 0.45
  const PEAK_BOOST = 6.0
  const PEAK_MIN_STEP = 0.8
  const CAP_MIN = 2
  const CAP_MAX = 4

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { innerWidth, innerHeight } = window
    canvas.style.width = `${innerWidth}px`
    canvas.style.height = `${innerHeight}px`
    canvas.width = Math.floor(innerWidth * DPR)
    canvas.height = Math.floor(innerHeight * DPR)
    const ctx = canvas.getContext("2d")
    if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  }, [DPR])

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      stopAnimation()
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    resizeCanvas()

    const handleResize = () => resizeCanvas()
    window.addEventListener("resize", handleResize)

    const draw = () => {
      const ctx = canvas.getContext("2d")
      const analyser = analyserRef.current
      const dataArray = dataArrayRef.current

      if (!ctx || !analyser || !dataArray) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }

      // @ts-ignore
      analyser.getByteFrequencyData(dataArray)
      const width = canvas.width / DPR
      const height = canvas.height / DPR

      // ghost trail background
      ctx.fillStyle = `rgba(8, 12, 26, ${TRAIL_ALPHA})`
      ctx.fillRect(0, 0, width, height)

      const barCount = BAR_COUNT
      const barWidth = width / barCount

      if (!barLevelsRef.current || barLevelsRef.current.length !== barCount)
        barLevelsRef.current = new Float32Array(barCount)
      if (!peakYRef.current || peakYRef.current.length !== barCount)
        peakYRef.current = new Float32Array(barCount).fill(height)
      if (!peakVelRef.current || peakVelRef.current.length !== barCount) peakVelRef.current = new Float32Array(barCount)

      const barLevels = barLevelsRef.current
      const peakY = peakYRef.current
      const peakVel = peakVelRef.current

      for (let i = 0; i < barCount; i++) {
        const proportion = i / Math.max(1, barCount - 1)
        const curved = Math.pow(proportion, 0.85)
        const bucketIndex = Math.min(Math.floor(curved * (dataArray.length - 1)), dataArray.length - 1)
        const rawValue = dataArray[bucketIndex] / 255

        const mirroredIndex = Math.min(
          Math.floor((1 - proportion * 0.6) * (dataArray.length - 1)),
          dataArray.length - 1
        )
        const mirrored = dataArray[mirroredIndex] / 255
        const floorValue = 0.08 + (1 - proportion) * 0.05
        const blendedAmplitude = rawValue * 0.55 + mirrored * 0.35
        const target = Math.min(1, blendedAmplitude + floorValue)
        const eased = barLevels[i] * 0.945 + target * 0.055
        barLevels[i] = eased

        const easedHeight = Math.pow(eased, 1.3)
        const barHeight = Math.max(4, height * easedHeight * 0.75)
        const x = i * barWidth
        const yTop = height - barHeight

        const gradient = ctx.createLinearGradient(x, height, x, yTop)
        gradient.addColorStop(0, "rgba(64, 169, 255, 0)")
        gradient.addColorStop(0.4, "rgba(120, 200, 255, 0.4)")
        gradient.addColorStop(1, "rgba(194, 163, 255, 0.9)")
        ctx.fillStyle = gradient
        ctx.fillRect(x + barWidth * 0.3, yTop, barWidth * 0.4, barHeight)

        // peak caps
        const currentPeakY = peakY[i]
        if (yTop < currentPeakY - 1) {
          peakY[i] = yTop
          peakVel[i] = PEAK_BOOST
        } else {
          peakVel[i] = Math.max(PEAK_MIN_STEP, peakVel[i] - PEAK_GRAVITY)
          peakY[i] = Math.min(height, currentPeakY + peakVel[i])
        }

        const capH = Math.max(CAP_MIN, Math.min(CAP_MAX, barWidth * 0.25))
        ctx.fillStyle = "rgba(255,255,255,0.95)"
        ctx.fillRect(x + barWidth * 0.28, Math.max(0, peakY[i] - capH), barWidth * 0.44, capH)
      }

      // pulse and backdrop zoom
      const bassValue = dataArray[5] / 255
      const pulseRadius = 180 + bassValue * 140
      const hue = 210 + bassValue * 25

      ctx.save()
      ctx.globalCompositeOperation = "screen"
      ctx.beginPath()
      ctx.strokeStyle = `hsla(${hue}, 80%, 65%, 0.15)`
      ctx.lineWidth = 1.5
      ctx.shadowBlur = 30
      ctx.shadowColor = `hsla(${hue}, 80%, 65%, 0.5)`
      ctx.arc(width / 2, height / 2, pulseRadius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // backdrop "breathing" zoom synced to bass
      bassSmooth = bassSmooth * 0.88 + bassValue * 0.12
      const targetZoom = BASE_ZOOM + bassSmooth * ZOOM_FROM_BASS
      const accel = (targetZoom - zoom) * SPRING_K - zoomVel * DAMPING
      zoomVel += accel
      zoom += zoomVel
      if (zoom < 1.02) zoom = 1.02
      if (zoom > 1.14) zoom = 1.14
      const bd = backdropRef.current
      if (bd) bd.style.transform = `scale(${zoom})`

      animationFrameRef.current = requestAnimationFrame(draw)
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
        graph = { context, source, analyser, dataArray }
        audioGraphStore.set(audioElement, graph)
      }

      audioContextRef.current = graph.context
      analyserRef.current = graph.analyser
      dataArrayRef.current = graph.dataArray

      if (graph.context.state === "suspended") {
        try {
          await graph.context.resume()
        } catch (err) {
          console.warn("Unable to resume audio context", err)
        }
      }

      draw()
    }

    setupAudioGraph()
    return () => {
      window.removeEventListener("resize", handleResize)
      stopAnimation()
    }
  }, [audioRef, isOpen, resizeCanvas, stopAnimation, DPR])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const stationLabel = stream?.title || "Tunio Radio"
  const title = track?.title || "Live stream"
  const titleKey = `${stationLabel}-${title}`
  const normalizedStationLength = stationLabel.replace(/\s+/g, "").length
  const stationClassName =
    normalizedStationLength <= 10
      ? "tunio-visualizer-station tunio-visualizer-station-xl"
      : normalizedStationLength <= 22
      ? "tunio-visualizer-station tunio-visualizer-station-lg"
      : "tunio-visualizer-station"

  const backdropUrl = track?.is_music
    ? `https://app.tunio.ai/api/d/audio-image/${track.uuid}.jpg`
    : `https://app.tunio.ai/api/d/image/stream-${name}.webp`

  return (
    <div className="tunio-visualizer-overlay" role="dialog" aria-modal={true} onClick={onClose}>
      <div ref={backdropRef} className="tunio-visualizer-backdrop" style={{ backgroundImage: `url(${backdropUrl})` }} />
      <canvas ref={canvasRef} className="tunio-visualizer-canvas" aria-hidden="true" />
      <div className="tunio-visualizer-planet" />
      <div className="tunio-visualizer-info">
        <div className="tunio-visualizer-watermark">
          <WaterMark height={30} color="#fff" />
        </div>
        <div className={stationClassName}>{stationLabel}</div>
        <div key={titleKey} className="tunio-visualizer-title tunio-visualizer-text-change">
          {title}
        </div>
      </div>
    </div>
  )
}

export default VisualizerOverlay
