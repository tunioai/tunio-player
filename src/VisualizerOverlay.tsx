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
  const animationFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const barLevelsRef = useRef<Float32Array | null>(null)

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { innerWidth, innerHeight } = window
    canvas.width = innerWidth
    canvas.height = innerHeight
  }, [])

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
      const context = canvas.getContext("2d")
      const analyser = analyserRef.current
      const dataArray = dataArrayRef.current

      if (!context || !analyser || !dataArray) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }

      // @ts-ignore
      analyser.getByteFrequencyData(dataArray)

      const width = canvas.width
      const height = canvas.height

      context.fillStyle = "rgba(8, 12, 26, 0.24)"
      context.fillRect(0, 0, width, height)

      const barCount = 120
      const barWidth = width / barCount
      if (!barLevelsRef.current || barLevelsRef.current.length !== barCount) {
        barLevelsRef.current = new Float32Array(barCount)
      }
      const barLevels = barLevelsRef.current
      if (!barLevels) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }

      for (let i = 0; i < barCount; i += 1) {
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
        const barHeight = height * easedHeight * 0.75
        const x = i * barWidth
        const gradient = context.createLinearGradient(x, height, x, height - barHeight)
        gradient.addColorStop(0, "rgba(64, 169, 255, 0)")
        gradient.addColorStop(0.4, "rgba(120, 200, 255, 0.4)")
        gradient.addColorStop(1, "rgba(194, 163, 255, 0.9)")
        context.fillStyle = gradient
        context.fillRect(x + barWidth * 0.3, height - barHeight, barWidth * 0.4, Math.max(barHeight, 4))
      }

      const bassValue = dataArray[5] / 255
      const pulseRadius = 180 + bassValue * 140
      const hue = 210 + bassValue * 25

      context.save()
      context.globalCompositeOperation = "screen"
      context.beginPath()
      context.strokeStyle = `hsla(${hue}, 80%, 65%, 0.45)`
      context.lineWidth = 1.5
      context.shadowBlur = 30
      context.shadowColor = `hsla(${hue}, 80%, 65%, 0.6)`
      context.arc(width / 2, height / 2, pulseRadius, 0, Math.PI * 2)
      context.stroke()
      context.restore()

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
        } catch (error) {
          console.warn("Unable to resume audio context", error)
        }
      }

      draw()
    }

    setupAudioGraph()

    return () => {
      window.removeEventListener("resize", handleResize)
      stopAnimation()
    }
  }, [audioRef, isOpen, resizeCanvas, stopAnimation])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const stationLabel = stream?.title || "Tunio Radio"
  const title = track?.title || "Live stream"
  const artist = track?.artist || stationLabel
  const titleKey = `${stationLabel}-${title}`
  const artistKey = `${stationLabel}-${artist}`
  const normalizedStationLength = stationLabel.replace(/\s+/g, "").length
  const stationClassName =
    normalizedStationLength <= 10
      ? "tunio-visualizer-station tunio-visualizer-station-xl"
      : normalizedStationLength <= 22
      ? "tunio-visualizer-station tunio-visualizer-station-lg"
      : "tunio-visualizer-station"

  const backdropUrl = `https://app.tunio.ai/api/d/image/stream-${name}.webp`

  return (
    <div className="tunio-visualizer-overlay" role="dialog" aria-modal={true} onClick={onClose}>
      <div className="tunio-visualizer-backdrop" style={{ backgroundImage: `url(${backdropUrl})` }} />
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
        {/* <div key={artistKey} className="tunio-visualizer-artist tunio-visualizer-text-change">
          {artist}
        </div> */}
      </div>
    </div>
  )
}

export default VisualizerOverlay
