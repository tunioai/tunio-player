"use client"

import React, { useCallback, useEffect, useRef } from "react"
import VisualizerAmbientLayers from "./VisualizerAmbientLayers"

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
}

const BAR_COUNT = 120
const TRAIL_ALPHA = 0.08
const PEAK_GRAVITY = 0.45
const PEAK_BOOST = 6.0
const PEAK_MIN_STEP = 0.8
const CAP_MIN = 2
const CAP_MAX = 4
const BASE_ZOOM = 1.035
const ZOOM_FROM_BASS = 0.045
const SPRING_K = 0.12
const DAMPING = 0.1

const VisualizerAudioCanvas: React.FC<VisualizerAudioCanvasProps> = ({ isOpen, audioRef, backdropRef, backdropUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const barLevelsRef = useRef<Float32Array | null>(null)
  const peakYRef = useRef<Float32Array | null>(null)
  const peakVelRef = useRef<Float32Array | null>(null)
  const zoomRef = useRef({ zoom: BASE_ZOOM, zoomVel: 0, bassSmooth: 0 })

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const DPR = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1
    const { innerWidth, innerHeight } = window
    canvas.style.width = `${innerWidth}px`
    canvas.style.height = `${innerHeight}px`
    canvas.width = Math.floor(innerWidth * DPR)
    canvas.height = Math.floor(innerHeight * DPR)
    const ctx = canvas.getContext("2d")
    if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
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
      const DPR = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1
      const width = canvas.width / DPR
      const height = canvas.height / DPR

      ctx.fillStyle = `rgba(8, 12, 26, ${TRAIL_ALPHA})`
      ctx.fillRect(0, 0, width, height)

      const barWidth = width / BAR_COUNT
      if (!barLevelsRef.current || barLevelsRef.current.length !== BAR_COUNT)
        barLevelsRef.current = new Float32Array(BAR_COUNT)
      if (!peakYRef.current || peakYRef.current.length !== BAR_COUNT)
        peakYRef.current = new Float32Array(BAR_COUNT).fill(height)
      if (!peakVelRef.current || peakVelRef.current.length !== BAR_COUNT)
        peakVelRef.current = new Float32Array(BAR_COUNT)

      const barLevels = barLevelsRef.current
      const peakY = peakYRef.current
      const peakVel = peakVelRef.current

      for (let i = 0; i < BAR_COUNT; i++) {
        const proportion = i / Math.max(1, BAR_COUNT - 1)
        const curved = Math.pow(proportion, 0.85)
        const bucketIndex = Math.min(Math.floor(curved * (dataArray.length - 1)), dataArray.length - 1)
        const rawValue = dataArray[bucketIndex] / 255

        const mirroredIndex = Math.min(
          Math.floor((1 - proportion * 0.6) * (dataArray.length - 1)),
          dataArray.length - 1,
        )
        const mirrored = dataArray[mirroredIndex] / 255
        const floorValue = 0.08 + (1 - proportion) * 0.05
        const blended = rawValue * 0.55 + mirrored * 0.35
        const target = Math.min(1, blended + floorValue)
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

      const dataArrayIndex = Math.min(5, dataArray.length - 1)
      const bassValue = dataArray[dataArrayIndex] / 255
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

      const zoomState = zoomRef.current
      zoomState.bassSmooth = zoomState.bassSmooth * 0.88 + bassValue * 0.12
      const targetZoom = BASE_ZOOM + zoomState.bassSmooth * ZOOM_FROM_BASS
      const accel = (targetZoom - zoomState.zoom) * SPRING_K - zoomState.zoomVel * DAMPING
      zoomState.zoomVel += accel
      zoomState.zoom += zoomState.zoomVel
      zoomState.zoom = Math.min(1.14, Math.max(1.02, zoomState.zoom))
      const bd = backdropRef.current
      if (bd) bd.style.transform = `scale(${zoomState.zoom})`

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
      draw()
    }

    setupAudioGraph()

    return () => {
      window.removeEventListener("resize", handleResize)
      stopAnimation()
    }
  }, [audioRef, backdropRef, isOpen, resizeCanvas, stopAnimation])

  return (
    <>
      <div
        ref={backdropRef}
        className="tunio-visualizer-backdrop tunio-visualizer-backdrop--audio"
        style={{ backgroundImage: `url(${backdropUrl})` }}
      >
        <VisualizerAmbientLayers />
      </div>
      <canvas ref={canvasRef} className="tunio-visualizer-canvas" aria-hidden="true" />
    </>
  )
}

export default VisualizerAudioCanvas
