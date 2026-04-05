import { COLORS } from './gameConstants'

export function clearCanvas(ctx, w, h) {
  ctx.fillStyle = COLORS.BLACK
  ctx.fillRect(0, 0, w, h)
}

export function drawPixelText(ctx, text, x, y, size = 12, color = COLORS.WHITE, align = 'left') {
  ctx.save()
  ctx.font = `${size}px "Press Start 2P", monospace`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function drawPixelRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

export function drawPixelBorder(ctx, x, y, w, h, color = COLORS.BLUE, thickness = 2) {
  ctx.strokeStyle = color
  ctx.lineWidth = thickness
  ctx.strokeRect(x, y, w, h)
}

export function drawTimerBar(ctx, timeLeft, totalTime, canvasWidth) {
  const barHeight = 6
  const pct = timeLeft / totalTime
  ctx.fillStyle = '#222'
  ctx.fillRect(0, 0, canvasWidth, barHeight)
  ctx.fillStyle = pct > 0.3 ? COLORS.GREEN : pct > 0.1 ? COLORS.GOLD : COLORS.RED
  ctx.fillRect(0, 0, canvasWidth * pct, barHeight)
}

export function flashScreen(ctx, w, h, color, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

// Simple pixel sprite for Ana (Pac-Man style circle with mouth)
export function drawAnaSprite(ctx, x, y, size, direction = 0, mouthOpen = 0.3) {
  ctx.save()
  ctx.fillStyle = COLORS.GOLD
  ctx.beginPath()
  const startAngle = direction + mouthOpen
  const endAngle = direction + (Math.PI * 2 - mouthOpen)
  ctx.arc(x + size / 2, y + size / 2, size / 2, startAngle, endAngle)
  ctx.lineTo(x + size / 2, y + size / 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// Ghost sprite (simple pixel ghost shape)
export function drawGhost(ctx, x, y, size, color) {
  ctx.fillStyle = color
  // Body (rounded top, flat bottom with "legs")
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, Math.PI, 0)
  ctx.lineTo(x + size, y + size)
  // Wavy bottom
  const legW = size / 4
  for (let i = 0; i < 4; i++) {
    const lx = x + size - (i * legW)
    ctx.lineTo(lx - legW / 2, y + size - legW / 2)
    ctx.lineTo(lx - legW, y + size)
  }
  ctx.closePath()
  ctx.fill()
  // Eyes
  ctx.fillStyle = COLORS.WHITE
  ctx.fillRect(x + size * 0.25, y + size * 0.3, size * 0.18, size * 0.2)
  ctx.fillRect(x + size * 0.55, y + size * 0.3, size * 0.18, size * 0.2)
  ctx.fillStyle = '#222'
  ctx.fillRect(x + size * 0.3, y + size * 0.35, size * 0.1, size * 0.12)
  ctx.fillRect(x + size * 0.6, y + size * 0.35, size * 0.1, size * 0.12)
}
