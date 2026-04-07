import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_DURATION, COLORS, SNAKE_CONFIG } from './gameConstants'
import { clearCanvas, drawPixelText, drawTimerBar } from './canvasUtils'
import ControlsOverlay from './ControlsOverlay'
import audioManager from '../../hooks/useAudio'
import './SnakeGame.css'

// ── Grid constants ──────────────────────────────────────────────
const COLS = 40
const ROWS = 25
const CELL_W = CANVAS_WIDTH / COLS
const CELL_H = CANVAS_HEIGHT / ROWS

// ── Direction map (arrow keys + WASD) ───────────────────────────
const DIR_MAP = {
  ArrowRight: { dx: 1, dy: 0 },
  ArrowLeft:  { dx: -1, dy: 0 },
  ArrowDown:  { dx: 0, dy: 1 },
  ArrowUp:    { dx: 0, dy: -1 },
  d: { dx: 1, dy: 0 },
  a: { dx: -1, dy: 0 },
  s: { dx: 0, dy: 1 },
  w: { dx: 0, dy: -1 },
}

// ── Helpers ─────────────────────────────────────────────────────
function placeFood(snake, obstacles) {
  const occupied = new Set()
  snake.forEach(seg => occupied.add(`${seg.x},${seg.y}`))
  obstacles.forEach(o => occupied.add(`${o.x},${o.y}`))
  let x, y
  do {
    x = Math.floor(Math.random() * (COLS - 2)) + 1
    y = Math.floor(Math.random() * (ROWS - 2)) + 1
  } while (occupied.has(`${x},${y}`))
  return { x, y }
}

function generateObstacles(count) {
  const obs = []
  for (let i = 0; i < count; i++) {
    obs.push({
      x: Math.floor(Math.random() * (COLS - 4)) + 2,
      y: Math.floor(Math.random() * (ROWS - 4)) + 2,
      shimmerOffset: Math.random() * Math.PI * 2,
    })
  }
  return obs
}

function lerp(a, b, t) { return a + (b - a) * t }

function initGameState(difficulty) {
  const config = SNAKE_CONFIG[Math.min(difficulty - 1, 3)]
  const snake = [
    { x: 10, y: 12 },
    { x: 9, y: 12 },
    { x: 8, y: 12 },
  ]
  const obstacles = generateObstacles(config.obstacles)
  return {
    snake,
    dir: { dx: 1, dy: 0 },
    nextDir: { dx: 1, dy: 0 },
    food: placeFood(snake, obstacles),
    obstacles,
    score: 0,
    timeLeft: GAME_DURATION,
    tickTimer: 0,
    tickMs: config.tickMs,
    wrap: config.wrap,
    dead: false,
    foodEaten: 0,
    // Visual state
    elapsedTime: 0,
    tongueTimer: 0,
    tongueVisible: false,
    foodSpawnAnim: 1.0,        // 0..1 spawn animation progress (1 = done)
    foodPulsePhase: 0,
    screenFlash: 0,            // flash alpha (decays)
    screenFlashColor: '#ffd700',
    particles: [],
    ghostTrail: [],            // trailing head ghosts
    // Death animation
    deathTimer: 0,
    deathParticles: [],
    deathShake: 0,
    dyingPhase: false,         // true during 1-sec death anim
  }
}

// ── Particle factory ────────────────────────────────────────────
function spawnFoodParticles(x, y) {
  const particles = []
  const count = 6 + Math.floor(Math.random() * 3) // 6-8
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
    const speed = 80 + Math.random() * 120
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.6 + Math.random() * 0.3,
      maxLife: 0.6 + Math.random() * 0.3,
      color: Math.random() > 0.3 ? '#ffd700' : '#fff8dc',
      size: 2 + Math.random() * 3,
    })
  }
  return particles
}

function spawnDeathParticles(snake) {
  const particles = []
  snake.forEach((seg, i) => {
    const cx = seg.x * CELL_W + CELL_W / 2
    const cy = seg.y * CELL_H + CELL_H / 2
    const angle = Math.random() * Math.PI * 2
    const speed = 100 + Math.random() * 200
    const hue = lerp(130, 90, i / Math.max(snake.length - 1, 1))
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      life: 0.8 + Math.random() * 0.4,
      maxLife: 0.8 + Math.random() * 0.4,
      color: `hsl(${hue}, 90%, 50%)`,
      size: CELL_W * 0.4 + Math.random() * CELL_W * 0.3,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 8,
    })
  })
  return particles
}

// ── Update particles ────────────────────────────────────────────
function updateParticles(arr, dt) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 300 * dt  // gravity
    p.life -= dt
    if (p.rotation !== undefined) p.rotation += (p.rotSpeed || 0) * dt
    if (p.life <= 0) arr.splice(i, 1)
  }
}

// ── Draw particles ──────────────────────────────────────────────
function drawParticles(ctx, particles) {
  particles.forEach(p => {
    const alpha = Math.max(0, p.life / p.maxLife)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    if (p.rotation !== undefined) {
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      const hs = p.size / 2
      ctx.beginPath()
      ctx.moveTo(-hs, -hs)
      ctx.lineTo(hs, -hs * 0.3)
      ctx.lineTo(hs * 0.3, hs)
      ctx.lineTo(-hs * 0.4, hs * 0.6)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  })
}

// ── Draw checkerboard background ────────────────────────────────
function drawBackground(ctx, s) {
  // Shift hue warmer as snake gets longer
  const warmth = Math.min((s.snake.length - 3) / 30, 1)
  const baseDark = lerp(8, 14, warmth)
  const baseLighter = lerp(12, 20, warmth)
  const rShift = Math.floor(warmth * 6)

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const isDark = (c + r) % 2 === 0
      const base = isDark ? baseDark : baseLighter
      ctx.fillStyle = `rgb(${base + rShift}, ${base}, ${Math.max(base - rShift, 0)})`
      ctx.fillRect(c * CELL_W, r * CELL_H, CELL_W, CELL_H)
    }
  }
}

// ── Draw food ambient glow ──────────────────────────────────────
function drawFoodGlow(ctx, fx, fy, pulse) {
  const cx = fx + CELL_W / 2
  const cy = fy + CELL_H / 2
  const radius = CELL_W * 3 + pulse * CELL_W * 0.5
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  grad.addColorStop(0, 'rgba(255, 215, 0, 0.08)')
  grad.addColorStop(0.5, 'rgba(255, 180, 0, 0.03)')
  grad.addColorStop(1, 'rgba(255, 180, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
}

// ── Draw obstacle crystal ───────────────────────────────────────
function drawObstacle(ctx, o, time) {
  const ox = o.x * CELL_W
  const oy = o.y * CELL_H
  const w = CELL_W - 2
  const h = CELL_H - 2

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.ellipse(ox + CELL_W / 2 + 1, oy + CELL_H + 1, w * 0.4, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Crystal body
  const grad = ctx.createLinearGradient(ox + 1, oy + 1, ox + w, oy + h)
  grad.addColorStop(0, '#5a5a6e')
  grad.addColorStop(0.5, '#3d3d50')
  grad.addColorStop(1, '#2a2a3a')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(ox + w * 0.2 + 1, oy + h + 1)
  ctx.lineTo(ox + 1, oy + h * 0.4 + 1)
  ctx.lineTo(ox + w * 0.35 + 1, oy + 1)
  ctx.lineTo(ox + w * 0.65 + 1, oy + 1)
  ctx.lineTo(ox + w + 1, oy + h * 0.35 + 1)
  ctx.lineTo(ox + w * 0.8 + 1, oy + h + 1)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#6a6a80'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // Shimmer highlight that moves across surface
  const shimmerX = (Math.sin(time * 2 + o.shimmerOffset) * 0.5 + 0.5) * w
  ctx.save()
  ctx.globalAlpha = 0.25 + Math.sin(time * 3 + o.shimmerOffset) * 0.15
  ctx.fillStyle = '#b0b0d0'
  ctx.beginPath()
  ctx.ellipse(ox + shimmerX + 1, oy + h * 0.35, w * 0.12, h * 0.25, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ── Draw food gem with pulse and spawn animation ────────────────
function drawFood(ctx, s) {
  const fx = s.food.x * CELL_W
  const fy = s.food.y * CELL_H
  const cx = fx + CELL_W / 2
  const cy = fy + CELL_H / 2
  const pulse = Math.sin(s.foodPulsePhase) * 0.15

  // Spawn-in scale
  let spawnScale = 1
  if (s.foodSpawnAnim < 1) {
    const t = s.foodSpawnAnim
    // Overshoot spring: 0 -> 1.2 -> 1.0
    if (t < 0.6) {
      spawnScale = (t / 0.6) * 1.25
    } else {
      spawnScale = 1.25 - (t - 0.6) / 0.4 * 0.25
    }
  }
  const scale = (1 + pulse) * spawnScale
  const radius = (CELL_W / 2 - 1) * scale

  ctx.save()
  // Glow aura
  ctx.shadowColor = '#ffd700'
  ctx.shadowBlur = 12 + pulse * 8

  // Main gem body
  const bodyGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius)
  bodyGrad.addColorStop(0, '#fff8dc')
  bodyGrad.addColorStop(0.4, '#ffd700')
  bodyGrad.addColorStop(0.8, '#daa520')
  bodyGrad.addColorStop(1, '#b8860b')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  // Diamond shape
  ctx.moveTo(cx, cy - radius)
  ctx.lineTo(cx + radius * 0.85, cy)
  ctx.lineTo(cx, cy + radius * 0.85)
  ctx.lineTo(cx - radius * 0.85, cy)
  ctx.closePath()
  ctx.fill()

  ctx.shadowBlur = 0
  // Inner facet highlight
  ctx.fillStyle = 'rgba(255, 255, 240, 0.35)'
  ctx.beginPath()
  ctx.moveTo(cx, cy - radius * 0.6)
  ctx.lineTo(cx + radius * 0.35, cy - radius * 0.1)
  ctx.lineTo(cx, cy + radius * 0.15)
  ctx.lineTo(cx - radius * 0.35, cy - radius * 0.1)
  ctx.closePath()
  ctx.fill()

  // Sparkle dot
  const sparkleAlpha = (Math.sin(s.elapsedTime * 6) * 0.5 + 0.5) * 0.8
  ctx.globalAlpha = sparkleAlpha
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(cx - radius * 0.25, cy - radius * 0.35, 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ── Draw snake body with bezier curves ──────────────────────────
function drawSnakeBody(ctx, s) {
  const snake = s.snake
  if (snake.length < 2) return

  // Build pixel-center positions
  const pts = snake.map(seg => ({
    x: seg.x * CELL_W + CELL_W / 2,
    y: seg.y * CELL_H + CELL_H / 2,
  }))

  // Draw body segments from tail to head (so head overlaps)
  const maxW = CELL_W * 0.85
  const minW = CELL_W * 0.35

  for (let i = snake.length - 1; i >= 1; i--) {
    const t = i / Math.max(snake.length - 1, 1)  // 0=head, 1=tail
    const width = lerp(maxW, minW, t)

    // Gradient color: bright green at head, dark at tail
    const hue = lerp(120, 100, t)
    const lightness = lerp(55, 28, t)
    const saturation = lerp(95, 70, t)

    const curr = pts[i]
    const prev = pts[i - 1]

    ctx.save()
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
    ctx.beginPath()
    ctx.arc(curr.x, curr.y, width / 2, 0, Math.PI * 2)
    ctx.fill()

    // Smooth connector between adjacent segments using a filled ellipse along the line
    if (i < snake.length - 1) {
      const next = pts[i + 1]
      const mx = (curr.x + next.x) / 2
      const my = (curr.y + next.y) / 2
      const nextT = (i + 1) / Math.max(snake.length - 1, 1)
      const nextWidth = lerp(maxW, minW, nextT)
      const connW = (width + nextWidth) / 2
      ctx.fillStyle = `hsl(${lerp(120, 100, (t + nextT) / 2)}, ${lerp(95, 70, (t + nextT) / 2)}%, ${lerp(55, 28, (t + nextT) / 2)}%)`
      ctx.beginPath()
      ctx.arc(mx, my, connW / 2 * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // Head segment (largest, brightest)
  const head = pts[0]
  ctx.save()
  const headGrad = ctx.createRadialGradient(head.x - 2, head.y - 2, 0, head.x, head.y, maxW / 2)
  headGrad.addColorStop(0, '#7fff50')
  headGrad.addColorStop(0.6, '#39ff14')
  headGrad.addColorStop(1, '#20c010')
  ctx.fillStyle = headGrad
  ctx.beginPath()
  ctx.arc(head.x, head.y, maxW / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ── Draw snake eyes ─────────────────────────────────────────────
function drawSnakeEyes(ctx, s) {
  const head = s.snake[0]
  const cx = head.x * CELL_W + CELL_W / 2
  const cy = head.y * CELL_H + CELL_H / 2
  const { dx, dy } = s.dir

  const eyeSpread = CELL_W * 0.22
  const eyeForward = CELL_W * 0.1
  const eyeRadius = CELL_W * 0.16
  const pupilRadius = CELL_W * 0.08

  // Two eyes perpendicular to direction
  const perpX = -dy
  const perpY = dx

  for (const side of [-1, 1]) {
    const ex = cx + perpX * eyeSpread * side + dx * eyeForward
    const ey = cy + perpY * eyeSpread * side + dy * eyeForward

    // White
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2)
    ctx.fill()

    // Pupil (shifted toward direction)
    const pupilShift = pupilRadius * 0.5
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(ex + dx * pupilShift, ey + dy * pupilShift, pupilRadius, 0, Math.PI * 2)
    ctx.fill()

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.arc(ex - pupilRadius * 0.3, ey - pupilRadius * 0.3, pupilRadius * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── Draw tongue ─────────────────────────────────────────────────
function drawTongue(ctx, s) {
  if (!s.tongueVisible) return
  const head = s.snake[0]
  const cx = head.x * CELL_W + CELL_W / 2
  const cy = head.y * CELL_H + CELL_H / 2
  const { dx, dy } = s.dir
  const tongueLen = CELL_W * 0.5
  const forkLen = CELL_W * 0.18

  const tipX = cx + dx * (CELL_W * 0.45 + tongueLen)
  const tipY = cy + dy * (CELL_H * 0.45 + tongueLen)
  const baseX = cx + dx * CELL_W * 0.4
  const baseY = cy + dy * CELL_H * 0.4

  const perpX = -dy
  const perpY = dx

  ctx.strokeStyle = '#cc2222'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'

  // Main tongue
  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  // Fork
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(tipX + dx * forkLen + perpX * forkLen * 0.6, tipY + dy * forkLen + perpY * forkLen * 0.6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(tipX + dx * forkLen - perpX * forkLen * 0.6, tipY + dy * forkLen - perpY * forkLen * 0.6)
  ctx.stroke()
}

// ── Detect if head is near food (for mouth-open effect) ─────────
function isNearFood(s) {
  const head = s.snake[0]
  const distX = Math.abs(head.x - s.food.x)
  const distY = Math.abs(head.y - s.food.y)
  return distX + distY <= 3
}

// ── Draw mouth (opens wider when near food) ─────────────────────
function drawMouth(ctx, s) {
  const head = s.snake[0]
  const cx = head.x * CELL_W + CELL_W / 2
  const cy = head.y * CELL_H + CELL_H / 2
  const { dx, dy } = s.dir
  const near = isNearFood(s)
  const mouthSize = near ? CELL_W * 0.22 : CELL_W * 0.12

  const mouthX = cx + dx * CELL_W * 0.3
  const mouthY = cy + dy * CELL_H * 0.3

  ctx.fillStyle = near ? '#440000' : '#1a3a0a'
  ctx.beginPath()
  ctx.arc(mouthX, mouthY, mouthSize, 0, Math.PI * 2)
  ctx.fill()
}

// ── Ghost trail behind head ─────────────────────────────────────
function drawGhostTrail(ctx, trail) {
  trail.forEach((ghost, i) => {
    const alpha = (1 - i / trail.length) * 0.15
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#39ff14'
    ctx.beginPath()
    ctx.arc(
      ghost.x * CELL_W + CELL_W / 2,
      ghost.y * CELL_H + CELL_H / 2,
      CELL_W * 0.35,
      0, Math.PI * 2
    )
    ctx.fill()
    ctx.restore()
  })
}

// ── Speed lines at screen edges ─────────────────────────────────
function drawSpeedLines(ctx, s) {
  const speed = Math.max(0, (150 - s.tickMs) / 100)  // 0..~1
  if (speed < 0.15) return

  const alpha = speed * 0.2
  const lineCount = Math.floor(speed * 12) + 2

  ctx.save()
  ctx.strokeStyle = `rgba(57, 255, 20, ${alpha})`
  ctx.lineWidth = 1

  for (let i = 0; i < lineCount; i++) {
    const y = (CANVAS_HEIGHT / lineCount) * i + Math.sin(s.elapsedTime * 4 + i) * 10
    const len = 15 + Math.random() * 25
    // Left edge
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(len, y)
    ctx.stroke()
    // Right edge
    ctx.beginPath()
    ctx.moveTo(CANVAS_WIDTH, y)
    ctx.lineTo(CANVAS_WIDTH - len, y)
    ctx.stroke()
  }

  // Edge glow
  const glowGrad = ctx.createLinearGradient(0, 0, 30, 0)
  glowGrad.addColorStop(0, `rgba(57, 255, 20, ${alpha * 0.5})`)
  glowGrad.addColorStop(1, 'rgba(57, 255, 20, 0)')
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, 30, CANVAS_HEIGHT)

  const glowGradR = ctx.createLinearGradient(CANVAS_WIDTH, 0, CANVAS_WIDTH - 30, 0)
  glowGradR.addColorStop(0, `rgba(57, 255, 20, ${alpha * 0.5})`)
  glowGradR.addColorStop(1, 'rgba(57, 255, 20, 0)')
  ctx.fillStyle = glowGradR
  ctx.fillRect(CANVAS_WIDTH - 30, 0, 30, CANVAS_HEIGHT)
  ctx.restore()
}

// ── Border for non-wrap mode ────────────────────────────────────
function drawBorder(ctx, time) {
  const pulse = Math.sin(time * 3) * 0.15 + 0.85
  ctx.save()
  ctx.strokeStyle = `rgba(255, 51, 51, ${pulse})`
  ctx.lineWidth = 3
  ctx.shadowColor = '#ff3333'
  ctx.shadowBlur = 6
  ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2)
  ctx.restore()
}

// ── Death animation render ──────────────────────────────────────
function renderDeathFrame(ctx, s, dt) {
  // Shake
  const shakeAmt = Math.max(0, (1 - s.deathTimer) * 8)
  const shakeX = (Math.random() - 0.5) * shakeAmt
  const shakeY = (Math.random() - 0.5) * shakeAmt

  ctx.save()
  ctx.translate(shakeX, shakeY)

  // Background
  drawBackground(ctx, s)

  // Obstacles
  s.obstacles.forEach(o => drawObstacle(ctx, o, s.elapsedTime))

  // Food
  drawFood(ctx, s)

  // Death particles (scattered snake segments)
  drawParticles(ctx, s.deathParticles)

  // Red flash overlay (fading)
  const flashAlpha = Math.max(0, 0.4 * (1 - s.deathTimer * 1.5))
  if (flashAlpha > 0) {
    ctx.save()
    ctx.globalAlpha = flashAlpha
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20)
    ctx.restore()
  }

  // Border
  if (!s.wrap) drawBorder(ctx, s.elapsedTime)

  // HUD
  drawTimerBar(ctx, s.timeLeft, GAME_DURATION, CANVAS_WIDTH)
  drawPixelText(ctx, `SCORE: ${s.score}`, 10, 14, 10, COLORS.WHITE)
  drawPixelText(ctx, `TIME: ${Math.ceil(s.timeLeft)}`, CANVAS_WIDTH - 10, 14, 10, COLORS.GOLD, 'right')
  drawPixelText(ctx, `LENGTH: ${s.snake.length}`, CANVAS_WIDTH / 2, 14, 10, COLORS.GREEN, 'center')

  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════
function SnakeGame({ difficulty, onEnd, isPlaying }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(initGameState(difficulty))
  const [ended, setEnded] = useState(false)

  // ── Keyboard input ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const d = DIR_MAP[e.key]
      if (!d) return
      e.preventDefault()
      const s = stateRef.current
      if (s.dyingPhase) return
      // Prevent reversing
      if (d.dx !== -s.dir.dx || d.dy !== -s.dir.dy) {
        s.nextDir = d
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── End game callback ───────────────────────────────────────
  const endGame = useCallback(() => {
    if (ended) return
    setEnded(true)
    const s = stateRef.current
    const lengthBonus = s.snake.length * 10
    onEnd(s.score + lengthBonus)
  }, [onEnd, ended])

  // ── Game loop ───────────────────────────────────────────────
  useGameLoop(useCallback((dt) => {
    const s = stateRef.current
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    s.elapsedTime += dt

    // ── Death animation phase ─────────────────────────────────
    if (s.dyingPhase) {
      s.deathTimer += dt
      updateParticles(s.deathParticles, dt)
      renderDeathFrame(ctx, s, dt)
      if (s.deathTimer >= 1.0) {
        endGame()
      }
      return
    }

    // ── Timer ─────────────────────────────────────────────────
    s.timeLeft -= dt
    if (s.timeLeft <= 0) {
      s.timeLeft = 0
      endGame()
      return
    }

    if (s.dead) {
      // Start death animation
      s.dyingPhase = true
      s.deathTimer = 0
      s.deathParticles = spawnDeathParticles(s.snake)
      return
    }

    // ── Visual timers ─────────────────────────────────────────
    s.foodPulsePhase += dt * 4
    if (s.foodSpawnAnim < 1) {
      s.foodSpawnAnim = Math.min(1, s.foodSpawnAnim + dt * 3.3) // ~0.3s
    }
    s.tongueTimer += dt
    if (!s.tongueVisible && s.tongueTimer > 2.5 + Math.random()) {
      s.tongueVisible = true
      s.tongueTimer = 0
    } else if (s.tongueVisible && s.tongueTimer > 0.2) {
      s.tongueVisible = false
      s.tongueTimer = 0
    }

    // Screen flash decay
    if (s.screenFlash > 0) {
      s.screenFlash = Math.max(0, s.screenFlash - dt * 5)
    }

    // Update particles
    updateParticles(s.particles, dt)

    // ── Tick-based movement ───────────────────────────────────
    s.tickTimer += dt * 1000
    if (s.tickTimer >= s.tickMs) {
      s.tickTimer = 0
      s.dir = s.nextDir

      const head = s.snake[0]
      let newX = head.x + s.dir.dx
      let newY = head.y + s.dir.dy

      // Ghost trail: record head position before move
      s.ghostTrail.unshift({ x: head.x, y: head.y })
      if (s.ghostTrail.length > 4) s.ghostTrail.pop()

      // Wrap or wall collision
      if (s.wrap) {
        if (newX < 0) newX = COLS - 1
        if (newX >= COLS) newX = 0
        if (newY < 0) newY = ROWS - 1
        if (newY >= ROWS) newY = 0
      } else {
        if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
          s.dead = true
          return
        }
      }

      // Self collision
      if (s.snake.some(seg => seg.x === newX && seg.y === newY)) {
        s.dead = true
        return
      }

      // Obstacle collision
      if (s.obstacles.some(o => o.x === newX && o.y === newY)) {
        s.dead = true
        return
      }

      // Move
      s.snake.unshift({ x: newX, y: newY })

      // Food check
      if (newX === s.food.x && newY === s.food.y) {
        s.score += 50
        s.foodEaten++
        audioManager.play('snakeEat')
        // Spawn particles at food position
        const foodCx = s.food.x * CELL_W + CELL_W / 2
        const foodCy = s.food.y * CELL_H + CELL_H / 2
        s.particles.push(...spawnFoodParticles(foodCx, foodCy))
        s.screenFlash = 0.3
        s.screenFlashColor = '#ffd700'
        // New food
        s.food = placeFood(s.snake, s.obstacles)
        s.foodSpawnAnim = 0
        s.foodPulsePhase = 0
        // Speed up slightly
        s.tickMs = Math.max(50, s.tickMs - 2)
      } else {
        s.snake.pop()
      }
    }

    // ═══════════ RENDER ═══════════════════════════════════════

    // Background checkerboard
    drawBackground(ctx, s)

    // Ambient food glow
    const fx = s.food.x * CELL_W
    const fy = s.food.y * CELL_H
    drawFoodGlow(ctx, fx, fy, Math.sin(s.foodPulsePhase) * 0.5 + 0.5)

    // Obstacles
    s.obstacles.forEach(o => drawObstacle(ctx, o, s.elapsedTime))

    // Food
    drawFood(ctx, s)

    // Ghost trail
    drawGhostTrail(ctx, s.ghostTrail)

    // Snake body
    drawSnakeBody(ctx, s)

    // Snake eyes
    drawSnakeEyes(ctx, s)

    // Mouth
    drawMouth(ctx, s)

    // Tongue
    drawTongue(ctx, s)

    // Particles (food bursts etc)
    drawParticles(ctx, s.particles)

    // Speed lines
    drawSpeedLines(ctx, s)

    // Border for non-wrap mode
    if (!s.wrap) drawBorder(ctx, s.elapsedTime)

    // Screen flash overlay
    if (s.screenFlash > 0) {
      ctx.save()
      ctx.globalAlpha = s.screenFlash * 0.25
      ctx.fillStyle = s.screenFlashColor
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.restore()
    }

    // ── HUD ───────────────────────────────────────────────────
    drawTimerBar(ctx, s.timeLeft, GAME_DURATION, CANVAS_WIDTH)
    drawPixelText(ctx, `SCORE: ${s.score}`, 10, 14, 10, COLORS.WHITE)
    drawPixelText(ctx, `TIME: ${Math.ceil(s.timeLeft)}`, CANVAS_WIDTH - 10, 14, 10, COLORS.GOLD, 'right')
    drawPixelText(ctx, `LENGTH: ${s.snake.length}`, CANVAS_WIDTH / 2, 14, 10, COLORS.GREEN, 'center')
  }, [endGame]), isPlaying && !ended)

  return (
    <div className="snake-game">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="mg-canvas"
      />
      <ControlsOverlay controls={[
        { keys: ['\u2190', '\u2192', '\u2191', '\u2193'], label: 'MOVE' },
        { keys: ['W', 'A', 'S', 'D'], label: 'ALT' },
      ]} />
    </div>
  )
}

export default SnakeGame
