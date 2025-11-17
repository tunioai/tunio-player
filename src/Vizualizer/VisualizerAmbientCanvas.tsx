"use client"

import React, { useCallback, useEffect, useRef } from "react"

type VisualizerAmbientCanvasProps = {
  isOpen: boolean
  backdropRef: React.RefObject<HTMLDivElement | null>
  backdropUrl: string
}

type BlobConfig = {
  radius: number
  color: string
  speed: number
  orbitRadius: number
  initialAngle: number
  tailStrength: number
  tailDirection: number
}

type BlobState = BlobConfig & {
  x: number
  y: number
  angle: number
  driftPhase: number
}

const BACKGROUND_COLOR = "#222222"
const BLOB_CONFIGS: BlobConfig[] = [
  {
    radius: 360,
    color: "rgba(255, 230, 90, 0.75)",
    speed: 0.00022,
    orbitRadius: 140,
    initialAngle: 0,
    tailStrength: 1.35,
    tailDirection: Math.PI * 0.12,
  },
  {
    radius: 320,
    color: "rgba(255, 80, 200, 0.6)",
    speed: 0.0003,
    orbitRadius: 190,
    initialAngle: Math.PI * 0.5,
    tailStrength: 1.8,
    tailDirection: Math.PI * 0.65,
  },
  {
    radius: 280,
    color: "rgba(80, 220, 255, 0.6)",
    speed: 0.00027,
    orbitRadius: 160,
    initialAngle: Math.PI * 1.2,
    tailStrength: 1.6,
    tailDirection: Math.PI * 1.2,
  },
  {
    radius: 230,
    color: "rgba(255, 150, 120, 0.65)",
    speed: 0.00032,
    orbitRadius: 120,
    initialAngle: Math.PI * 1.8,
    tailStrength: 1.5,
    tailDirection: Math.PI * 1.75,
  },
]

const AMBIENT_SCALE_MIN = 0.02
const AMBIENT_SCALE_MAX = 1.05
const AMBIENT_OFFSET_X = 2.2
const AMBIENT_OFFSET_Y = 1.2
const AMBIENT_TARGET_INTERVAL = 5400
const AMBIENT_EASE = 0.014

const VisualizerAmbientCanvas: React.FC<VisualizerAmbientCanvasProps> = ({ isOpen, backdropRef, backdropUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = contextRef.current
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      stopAnimation()
      return
    }

    const canvas = canvasRef.current
    const backdropElement = backdropRef.current
    if (!canvas || !backdropElement) return

    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return
    contextRef.current = ctx

    resizeCanvas()

    const blobs: BlobState[] = BLOB_CONFIGS.map((config) => ({
      ...config,
      x: 0,
      y: 0,
      angle: config.initialAngle,
      driftPhase: Math.random() * Math.PI * 2,
    }))

    const handleResize = () => resizeCanvas()
    window.addEventListener("resize", handleResize)

    const motionState = {
      scale: AMBIENT_SCALE_MIN,
      targetScale: AMBIENT_SCALE_MIN,
      offsetX: 0,
      offsetY: 0,
      targetOffsetX: 0,
      targetOffsetY: 0,
      nextTargetTime: 0,
    }

    let lastTime = 0

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      const width = window.innerWidth
      const height = window.innerHeight
      const centerX = width / 2
      const centerY = height / 2

      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = BACKGROUND_COLOR
      ctx.fillRect(0, 0, width, height)

      blobs.forEach((blob) => {
        blob.angle += blob.speed * deltaTime
        blob.x = centerX + Math.cos(blob.angle) * blob.orbitRadius
        blob.y = centerY + Math.sin(blob.angle) * blob.orbitRadius
      })

      ctx.save()
      ctx.filter = "blur(110px)"
      blobs.forEach((blob) => {
        const tailPulse = 0.85 + 0.15 * Math.sin(blob.driftPhase + currentTime * 0.00025)
        const stretch = blob.radius * blob.tailStrength * tailPulse
        const controlDistance = blob.radius * 0.55
        const tailX = blob.x + Math.cos(blob.tailDirection) * stretch
        const tailY = blob.y + Math.sin(blob.tailDirection) * stretch
        const ctrlX = blob.x + Math.cos(blob.tailDirection) * controlDistance
        const ctrlY = blob.y + Math.sin(blob.tailDirection) * controlDistance

        const gradient = ctx.createLinearGradient(blob.x, blob.y, tailX, tailY)
        gradient.addColorStop(0, blob.color)
        gradient.addColorStop(0.4, blob.color)
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)")

        ctx.globalCompositeOperation = "screen"
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(blob.x, blob.y)
        ctx.quadraticCurveTo(ctrlX, ctrlY, tailX, tailY)
        ctx.quadraticCurveTo(ctrlX * 0.8 + blob.x * 0.2, ctrlY * 0.8 + blob.y * 0.2, blob.x, blob.y)
        ctx.closePath()
        ctx.fill()

        const coreGradient = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.radius * 0.9)
        coreGradient.addColorStop(0, blob.color)
        coreGradient.addColorStop(1, "rgba(0, 0, 0, 0)")
        ctx.fillStyle = coreGradient
        ctx.beginPath()
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.restore()

      ctx.save()
      ctx.filter = "blur(60px)"
      ctx.globalCompositeOperation = "lighter"
      const centerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 200)
      centerGlow.addColorStop(0, "rgba(255, 255, 255, 0.3)")
      centerGlow.addColorStop(0.4, "rgba(255, 200, 120, 0.25)")
      centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)")
      ctx.fillStyle = centerGlow
      ctx.beginPath()
      ctx.arc(centerX, centerY, 200, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      if (currentTime >= motionState.nextTargetTime) {
        motionState.targetScale = AMBIENT_SCALE_MIN + Math.random() * (AMBIENT_SCALE_MAX - AMBIENT_SCALE_MIN)
        motionState.targetOffsetX = (Math.random() * 2 - 1) * AMBIENT_OFFSET_X
        motionState.targetOffsetY = (Math.random() * 2 - 1) * AMBIENT_OFFSET_Y
        motionState.nextTargetTime = currentTime + AMBIENT_TARGET_INTERVAL + Math.random() * 2200
      }
      motionState.scale += (motionState.targetScale - motionState.scale) * AMBIENT_EASE
      motionState.offsetX += (motionState.targetOffsetX - motionState.offsetX) * AMBIENT_EASE
      motionState.offsetY += (motionState.targetOffsetY - motionState.offsetY) * AMBIENT_EASE
      backdropElement.style.transform = `translate3d(${motionState.offsetX.toFixed(2)}%, ${motionState.offsetY.toFixed(
        2
      )}%, 0) scale(${motionState.scale.toFixed(3)})`

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener("resize", handleResize)
      stopAnimation()
      contextRef.current = null
      backdropElement.style.transform = ""
    }
  }, [backdropRef, isOpen, resizeCanvas, stopAnimation])

  return (
    <>
      <div
        ref={backdropRef}
        className="tunio-visualizer-backdrop tunio-visualizer-backdrop--ambient"
        style={{ backgroundImage: `url(${backdropUrl})` }}
      />
      <canvas ref={canvasRef} className="tunio-visualizer-canvas" aria-hidden="true" />
    </>
  )
}

export default VisualizerAmbientCanvas
