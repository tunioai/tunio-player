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
