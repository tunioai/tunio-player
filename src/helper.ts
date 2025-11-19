import type { StreamConfig } from "./types"

interface Color {
  r: number
  g: number
  b: number
}

export const getDominantColor = (image: HTMLImageElement): { r: number; g: number; b: number } | null => {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  canvas.width = image.width
  canvas.height = image.height
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data

  const colorCount: Record<string, number> = {}
  let maxCount = 0
  let dominantColor = ""

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const color = `${r},${g},${b}`

    colorCount[color] = (colorCount[color] || 0) + 1

    if (colorCount[color] > maxCount) {
      maxCount = colorCount[color]
      dominantColor = color
    }
  }

  if (dominantColor) {
    const [r, g, b] = dominantColor.split(",").map(Number)
    return { r, g, b }
  }

  return null
}

export const lightenColor = (color: Color, percent: number) => {
  const lighten = (value: number) => {
    return Math.min(255, value + (255 - value) * (percent / 100))
  }

  return {
    r: lighten(color.r),
    g: lighten(color.g),
    b: lighten(color.b)
  }
}

export const fetchPlayerConfig = async (id: string): Promise<StreamConfig | null> => {
  try {
    const response = await fetch(`https://api.tunio.ai/v1/stream/${id}/player-config`, {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      keepalive: true
    })
    const data: StreamConfig = await response.json()

    if (!data.stream_name) return null

    return data
  } catch {
    return null
  }
}
