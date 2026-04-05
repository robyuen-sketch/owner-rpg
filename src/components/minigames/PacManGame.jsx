import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_DURATION, COLORS, PACMAN_CONFIG, PACMAN_MAZES } from './gameConstants'
import { clearCanvas, drawPixelText, drawTimerBar } from './canvasUtils'
import ControlsOverlay from './ControlsOverlay'
import './PacManGame.css'

const TILE_W = CANVAS_WIDTH / 20
const TILE_H = CANVAS_HEIGHT / 12
const GHOST_COLORS = ['#ff3333', '#ff8c00', '#00ccff', '#ff69b4']
const TWO_PI = Math.PI * 2

// --- Particle helpers ---
function spawnPelletParticles(particles, cx, cy, color = '#ffff44') {
  const count = 4 + Math.floor(Math.random() * 3)
  for (let i = 0; i < count; i++) {
    const angle = (TWO_PI / count) * i + Math.random() * 0.5
    const speed = 40 + Math.random() * 60
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.4 + Math.random() * 0.2,
      maxLife: 0.5,
      color,
      size: 2 + Math.random() * 2,
    })
  }
}

function spawnGhostEatFlash(effects) {
  effects.screenFlash = { alpha: 0.35, decay: 2.5, color: '#ffffff' }
}

function spawnDeathShake(effects) {
  effects.shake = { intensity: 6, decay: 4.0, time: 0 }
}

function spawnPowerPulse(effects) {
  effects.wallPulse = { alpha: 0.6, decay: 1.8 }
}

function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt
    p.vx *= 0.96
    p.vy *= 0.96
    if (p.life <= 0) particles.splice(i, 1)
  }
}

// --- Init ---
function initGameState(difficulty) {
  const config = PACMAN_CONFIG[Math.min(difficulty - 1, 3)]
  const maze = PACMAN_MAZES[Math.min(difficulty - 1, 3)].map(row => [...row])

  let playerX = 1, playerY = 1
  outer: for (let r = maze.length - 2; r >= 1; r--) {
    for (let c = 1; c < maze[0].length - 1; c++) {
      if (maze[r][c] === 1 || maze[r][c] === 3) {
        playerX = c
        playerY = r
        break outer
      }
    }
  }

  const ghosts = []
  for (let r = 0; r < maze.length; r++) {
    for (let c = 0; c < maze[0].length; c++) {
      if (maze[r][c] === 4 && ghosts.length < config.ghostCount) {
        ghosts.push({
          x: c, y: r,
          px: c * TILE_W, py: r * TILE_H,
          dir: Math.random() < 0.5 ? 'left' : 'right',
          color: GHOST_COLORS[ghosts.length % 4],
          scared: false,
          deathAnim: 0,    // >0 while dying (counts down from 0.5)
          bobPhase: Math.random() * TWO_PI,
        })
        maze[r][c] = 3
      }
    }
  }

  let pelletCount = 0
  for (let r = 0; r < maze.length; r++) {
    for (let c = 0; c < maze[0].length; c++) {
      if (maze[r][c] === 1 || maze[r][c] === 2) pelletCount++
    }
  }

  return {
    maze,
    player: {
      x: playerX, y: playerY,
      px: playerX * TILE_W, py: playerY * TILE_H,
      dir: 0,
      nextDir: null,
      moving: false,
    },
    ghosts,
    score: 0,
    timeLeft: GAME_DURATION,
    powerTimer: 0,
    pelletCount,
    mouthAngle: 0,
    mouthDir: 1,
    config,
    globalTime: 0,
    particles: [],
    effects: {},
  }
}

function canMove(maze, col, row) {
  if (row < 0 || row >= maze.length || col < 0 || col >= maze[0].length) return false
  return maze[row][col] !== 0
}

const DIR_MAP = {
  ArrowRight: { dx: 1, dy: 0, angle: 0 },
  ArrowLeft: { dx: -1, dy: 0, angle: Math.PI },
  ArrowDown: { dx: 0, dy: 1, angle: Math.PI / 2 },
  ArrowUp: { dx: 0, dy: -1, angle: -Math.PI / 2 },
  d: { dx: 1, dy: 0, angle: 0 },
  a: { dx: -1, dy: 0, angle: Math.PI },
  s: { dx: 0, dy: 1, angle: Math.PI / 2 },
  w: { dx: 0, dy: -1, angle: -Math.PI / 2 },
}

// --- Drawing helpers ---

function drawNeonWalls(ctx, maze, globalTime, wallPulseAlpha) {
  const rows = maze.length
  const cols = maze[0].length

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (maze[r][c] !== 0) continue
      const x = c * TILE_W
      const y = r * TILE_H

      // Dark wall fill
      ctx.fillStyle = '#080818'
      ctx.fillRect(x, y, TILE_W, TILE_H)

      // Neon border edges (only draw edges adjacent to open space)
      const wallColor = wallPulseAlpha > 0
        ? lerpColor('#2d70ff', '#ffd700', wallPulseAlpha)
        : '#2d70ff'

      ctx.save()
      ctx.shadowBlur = 6
      ctx.shadowColor = wallPulseAlpha > 0
        ? lerpColor('#2d70ff', '#ffd700', wallPulseAlpha)
        : '#2d70ff'
      ctx.strokeStyle = wallColor
      ctx.lineWidth = 2
      ctx.lineCap = 'round'

      // Top edge
      if (r > 0 && maze[r - 1][c] !== 0) {
        ctx.beginPath()
        ctx.moveTo(x + 1, y + 1)
        ctx.lineTo(x + TILE_W - 1, y + 1)
        ctx.stroke()
      }
      // Bottom edge
      if (r < rows - 1 && maze[r + 1][c] !== 0) {
        ctx.beginPath()
        ctx.moveTo(x + 1, y + TILE_H - 1)
        ctx.lineTo(x + TILE_W - 1, y + TILE_H - 1)
        ctx.stroke()
      }
      // Left edge
      if (c > 0 && maze[r][c - 1] !== 0) {
        ctx.beginPath()
        ctx.moveTo(x + 1, y + 1)
        ctx.lineTo(x + 1, y + TILE_H - 1)
        ctx.stroke()
      }
      // Right edge
      if (c < cols - 1 && maze[r][c + 1] !== 0) {
        ctx.beginPath()
        ctx.moveTo(x + TILE_W - 1, y + 1)
        ctx.lineTo(x + TILE_W - 1, y + TILE_H - 1)
        ctx.stroke()
      }
      ctx.restore()

      // Inner highlight line (subtle)
      ctx.save()
      ctx.globalAlpha = 0.08
      ctx.fillStyle = '#4488ff'
      ctx.fillRect(x + 3, y + 3, TILE_W - 6, TILE_H - 6)
      ctx.restore()
    }
  }
}

function drawFloorAndPellets(ctx, maze, globalTime) {
  const rows = maze.length
  const cols = maze[0].length
  const pelletPulse = 0.85 + 0.15 * Math.sin(globalTime * 5)
  const powerPulse = 0.7 + 0.3 * Math.sin(globalTime * 3)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = maze[r][c]
      if (cell === 0) continue
      const x = c * TILE_W
      const y = r * TILE_H
      const cx = x + TILE_W / 2
      const cy = y + TILE_H / 2

      // Floor
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(x, y, TILE_W, TILE_H)

      if (cell === 1) {
        // Regular pellet with pulse
        const radius = 3 * pelletPulse
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, TWO_PI)
        ctx.fill()
      } else if (cell === 2) {
        // Power pellet - rotating glow aura
        const auraRadius = 12 + 3 * Math.sin(globalTime * 4)

        // Ambient glow on background
        const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, TILE_W * 1.2)
        ambientGrad.addColorStop(0, 'rgba(255,215,0,0.12)')
        ambientGrad.addColorStop(1, 'rgba(255,215,0,0)')
        ctx.fillStyle = ambientGrad
        ctx.fillRect(x - TILE_W * 0.5, y - TILE_H * 0.5, TILE_W * 2, TILE_H * 2)

        // Concentric rings
        for (let ring = 2; ring >= 0; ring--) {
          const rr = auraRadius - ring * 3
          const alpha = 0.1 + ring * 0.05
          ctx.save()
          ctx.globalAlpha = alpha * powerPulse
          ctx.strokeStyle = COLORS.GOLD
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(cx, cy, rr, globalTime * (1 + ring * 0.3), globalTime * (1 + ring * 0.3) + Math.PI * 1.5)
          ctx.stroke()
          ctx.restore()
        }

        // Core
        ctx.fillStyle = COLORS.GOLD
        ctx.beginPath()
        ctx.arc(cx, cy, 6 * powerPulse, 0, TWO_PI)
        ctx.fill()

        // Bright center
        ctx.save()
        ctx.globalAlpha = 0.5
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(cx, cy, 3, 0, TWO_PI)
        ctx.fill()
        ctx.restore()
      }
    }
  }
}

function drawPacMan(ctx, player, mouthAngle, globalTime) {
  const size = TILE_W - 4
  const cx = player.px + TILE_W / 2
  const cy = player.py + TILE_H / 2
  const radius = size / 2

  ctx.save()
  ctx.translate(cx, cy)

  // Body with mouth
  ctx.fillStyle = COLORS.GOLD
  ctx.beginPath()
  const startAngle = player.dir + mouthAngle
  const endAngle = player.dir + (TWO_PI - mouthAngle)
  ctx.arc(0, 0, radius, startAngle, endAngle)
  ctx.lineTo(0, 0)
  ctx.closePath()
  ctx.fill()

  // Subtle shading on body
  const bodyGrad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, 0, 0, 0, radius)
  bodyGrad.addColorStop(0, 'rgba(255,255,200,0.25)')
  bodyGrad.addColorStop(1, 'rgba(255,180,0,0.1)')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.arc(0, 0, radius, startAngle, endAngle)
  ctx.lineTo(0, 0)
  ctx.closePath()
  ctx.fill()

  // Eye - positioned relative to facing direction
  const eyeOffX = Math.cos(player.dir - 0.6) * radius * 0.35
  const eyeOffY = Math.sin(player.dir - 0.6) * radius * 0.35

  // Eye white
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(eyeOffX, eyeOffY, 3.5, 0, TWO_PI)
  ctx.fill()

  // Pupil - slight movement toward direction
  const pupilShift = 1.2
  const pupilX = eyeOffX + Math.cos(player.dir) * pupilShift
  const pupilY = eyeOffY + Math.sin(player.dir) * pupilShift
  ctx.fillStyle = '#111111'
  ctx.beginPath()
  ctx.arc(pupilX, pupilY, 1.8, 0, TWO_PI)
  ctx.fill()

  ctx.restore()
}

function drawGhostEnhanced(ctx, g, playerPx, playerPy, globalTime) {
  if (g.deathAnim > 0) {
    // Death animation: spin and shrink
    const t = 1 - (g.deathAnim / 0.5) // 0 -> 1
    const scale = 1 - t
    const spin = t * Math.PI * 4
    if (scale <= 0.05) return

    ctx.save()
    ctx.translate(g.px + TILE_W / 2, g.py + TILE_H / 2)
    ctx.rotate(spin)
    ctx.scale(scale, scale)
    ctx.globalAlpha = scale
    drawGhostBody(ctx, -TILE_W * 0.42, -TILE_H * 0.42, TILE_W * 0.85, g.color, g, playerPx, playerPy, globalTime)
    ctx.restore()
    return
  }

  const ghostSize = TILE_W * 0.85
  // Bob animation
  const bobY = Math.sin(globalTime * 6 + g.bobPhase) * 3

  ctx.save()
  ctx.translate(g.px + (TILE_W - ghostSize) / 2, g.py + (TILE_H - ghostSize) / 2 + bobY)

  if (g.scared) {
    // Pulse between blue and white
    const pulse = Math.sin(globalTime * 8)
    const scaredColor = pulse > 0 ? '#3333ff' : '#aaaaff'
    drawGhostBody(ctx, 0, 0, ghostSize, scaredColor, g, playerPx, playerPy, globalTime)
  } else {
    drawGhostBody(ctx, 0, 0, ghostSize, g.color, g, playerPx, playerPy, globalTime)
  }

  ctx.restore()
}

function drawGhostBody(ctx, x, y, size, color, ghost, playerPx, playerPy, globalTime) {
  // Body
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, Math.PI, 0)
  ctx.lineTo(x + size, y + size)

  // Wavy bottom with animation
  const legW = size / 4
  const legWave = Math.sin(globalTime * 10 + ghost.bobPhase) * 2
  for (let i = 0; i < 4; i++) {
    const lx = x + size - (i * legW)
    ctx.lineTo(lx - legW / 2, y + size - legW / 2 - legWave * (i % 2 === 0 ? 1 : -1))
    ctx.lineTo(lx - legW, y + size)
  }
  ctx.closePath()
  ctx.fill()

  // Body highlight
  ctx.save()
  ctx.globalAlpha = 0.15
  const hlGrad = ctx.createRadialGradient(x + size * 0.35, y + size * 0.3, 0, x + size / 2, y + size / 2, size / 2)
  hlGrad.addColorStop(0, '#ffffff')
  hlGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = hlGrad
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, Math.PI, 0)
  ctx.lineTo(x + size, y + size)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  if (ghost.scared) {
    // Scared face - wobbly mouth and X eyes
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x + size * 0.22, y + size * 0.3, size * 0.16, size * 0.16)
    ctx.fillRect(x + size * 0.60, y + size * 0.3, size * 0.16, size * 0.16)
    // Wavy mouth
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i <= 4; i++) {
      const mx = x + size * 0.25 + (size * 0.5 / 4) * i
      const my = y + size * 0.65 + (i % 2 === 0 ? -2 : 2)
      if (i === 0) ctx.moveTo(mx, my)
      else ctx.lineTo(mx, my)
    }
    ctx.stroke()
  } else {
    // Eyes that track Pac-Man
    const eyeLX = x + size * 0.25
    const eyeRX = x + size * 0.55
    const eyeY = y + size * 0.28
    const eyeW = size * 0.20
    const eyeH = size * 0.22

    // White sclera
    ctx.fillStyle = '#ffffff'
    drawRoundRect(ctx, eyeLX, eyeY, eyeW, eyeH, 3)
    ctx.fill()
    drawRoundRect(ctx, eyeRX, eyeY, eyeW, eyeH, 3)
    ctx.fill()

    // Pupils track toward player
    const gCx = ghost.px + TILE_W / 2
    const gCy = ghost.py + TILE_H / 2
    const angle = Math.atan2(playerPy - gCy, playerPx - gCx)
    const pupilDist = 2.5
    const pdx = Math.cos(angle) * pupilDist
    const pdy = Math.sin(angle) * pupilDist
    const pupilSize = size * 0.10

    ctx.fillStyle = '#111133'
    ctx.beginPath()
    ctx.arc(eyeLX + eyeW / 2 + pdx, eyeY + eyeH / 2 + pdy, pupilSize, 0, TWO_PI)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(eyeRX + eyeW / 2 + pdx, eyeY + eyeH / 2 + pdy, pupilSize, 0, TWO_PI)
    ctx.fill()
  }
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawParticles(ctx, particles) {
  particles.forEach(p => {
    const alpha = Math.max(0, p.life / p.maxLife)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * alpha, 0, TWO_PI)
    ctx.fill()
    ctx.restore()
  })
}

function drawBackground(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#050510')
  grad.addColorStop(0.5, '#080820')
  grad.addColorStop(1, '#050510')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

function drawHUD(ctx, score, timeLeft, powerTimer, canvasWidth, globalTime) {
  // Timer bar with gradient
  const barHeight = 6
  const pct = timeLeft / GAME_DURATION

  ctx.fillStyle = '#111122'
  ctx.fillRect(0, 0, canvasWidth, barHeight)

  const barGrad = ctx.createLinearGradient(0, 0, canvasWidth * pct, 0)
  if (pct > 0.3) {
    barGrad.addColorStop(0, '#00ff88')
    barGrad.addColorStop(1, '#39ff14')
  } else if (pct > 0.1) {
    barGrad.addColorStop(0, '#ffcc00')
    barGrad.addColorStop(1, '#ff8800')
  } else {
    barGrad.addColorStop(0, '#ff4444')
    barGrad.addColorStop(1, '#ff0000')
  }
  ctx.fillStyle = barGrad
  ctx.fillRect(0, 0, canvasWidth * pct, barHeight)

  // Glow on bar edge
  if (pct > 0.01) {
    ctx.save()
    ctx.shadowBlur = 8
    ctx.shadowColor = pct > 0.3 ? '#39ff14' : pct > 0.1 ? '#ffd700' : '#ff3333'
    ctx.fillRect(canvasWidth * pct - 4, 0, 4, barHeight)
    ctx.restore()
  }

  // Score with glow
  ctx.save()
  ctx.shadowBlur = 8
  ctx.shadowColor = '#ffd700'
  drawPixelText(ctx, `SCORE: ${score}`, 10, 14, 10, COLORS.WHITE)
  ctx.restore()

  // Time
  ctx.save()
  ctx.shadowBlur = 6
  ctx.shadowColor = '#ffd700'
  drawPixelText(ctx, `TIME: ${Math.ceil(timeLeft)}`, canvasWidth - 10, 14, 10, COLORS.GOLD, 'right')
  ctx.restore()

  // Power indicator
  if (powerTimer > 0) {
    const flashAlpha = 0.6 + 0.4 * Math.sin(globalTime * 10)
    ctx.save()
    ctx.globalAlpha = flashAlpha
    ctx.shadowBlur = 12
    ctx.shadowColor = '#6666ff'
    drawPixelText(ctx, 'POWER!', canvasWidth / 2, 14, 10, '#6666ff', 'center')
    ctx.restore()
  }
}

function drawPowerOverlay(ctx, w, h, powerTimer) {
  if (powerTimer <= 0) return
  // Subtle screen darkening during power mode
  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.fillStyle = '#000033'
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

function drawScreenEffects(ctx, w, h, effects, dt) {
  // Screen flash
  if (effects.screenFlash) {
    const f = effects.screenFlash
    ctx.save()
    ctx.globalAlpha = Math.max(0, f.alpha)
    ctx.fillStyle = f.color
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
    f.alpha -= f.decay * dt
    if (f.alpha <= 0) delete effects.screenFlash
  }

  // Wall pulse decay
  if (effects.wallPulse) {
    effects.wallPulse.alpha -= effects.wallPulse.decay * dt
    if (effects.wallPulse.alpha <= 0) delete effects.wallPulse
  }

  // Shake decay
  if (effects.shake) {
    effects.shake.intensity -= effects.shake.decay * dt
    if (effects.shake.intensity <= 0) delete effects.shake
  }
}

function lerpColor(a, b, t) {
  const ah = parseInt(a.slice(1), 16)
  const bh = parseInt(b.slice(1), 16)
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff
  const rr = Math.round(ar + (br - ar) * t)
  const rg = Math.round(ag + (bg - ag) * t)
  const rb = Math.round(ab + (bb - ab) * t)
  return `#${((rr << 16) | (rg << 8) | rb).toString(16).padStart(6, '0')}`
}

// --- Main Component ---

function PacManGame({ difficulty, onEnd, isPlaying }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(initGameState(difficulty))
  const keysRef = useRef(new Set())
  const [ended, setEnded] = useState(false)

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (DIR_MAP[e.key]) {
        e.preventDefault()
        keysRef.current.add(e.key)
        const d = DIR_MAP[e.key]
        stateRef.current.player.nextDir = { dx: d.dx, dy: d.dy, angle: d.angle }
      }
    }
    const handleKeyUp = (e) => {
      keysRef.current.delete(e.key)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const endGame = useCallback(() => {
    if (ended) return
    setEnded(true)
    onEnd(stateRef.current.score)
  }, [onEnd, ended])

  // Game loop
  useGameLoop(useCallback((dt) => {
    const s = stateRef.current
    const { maze, player, ghosts, config, particles, effects } = s
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    s.globalTime += dt

    // Timer
    s.timeLeft -= dt
    if (s.timeLeft <= 0) {
      s.timeLeft = 0
      endGame()
      return
    }

    // Smooth mouth animation
    s.mouthAngle += s.mouthDir * dt * 8
    if (s.mouthAngle > 0.4) s.mouthDir = -1
    if (s.mouthAngle < 0.05) s.mouthDir = 1

    // Power timer
    if (s.powerTimer > 0) {
      s.powerTimer -= dt
      if (s.powerTimer <= 0) {
        ghosts.forEach(g => { g.scared = false })
      }
    }

    // Player movement
    const speed = config.playerSpeed * TILE_W * dt
    if (player.nextDir) {
      const testX = player.x + player.nextDir.dx
      const testY = player.y + player.nextDir.dy
      if (canMove(maze, testX, testY)) {
        player.dir = player.nextDir.angle
        player.moving = true
        player.nextDir = null
      }
    }

    if (player.moving) {
      let dx = Math.round(Math.cos(player.dir))
      let dy = Math.round(Math.sin(player.dir))
      const targetX = player.x + dx
      const targetY = player.y + dy

      if (canMove(maze, targetX, targetY)) {
        player.px += dx * speed
        player.py += dy * speed

        const targetPx = targetX * TILE_W
        const targetPy = targetY * TILE_H

        if ((dx > 0 && player.px >= targetPx) || (dx < 0 && player.px <= targetPx) ||
            (dy > 0 && player.py >= targetPy) || (dy < 0 && player.py <= targetPy)) {
          player.x = targetX
          player.y = targetY
          player.px = targetPx
          player.py = targetPy
        }
      } else {
        player.moving = false
        player.px = player.x * TILE_W
        player.py = player.y * TILE_H
      }
    }

    // Collect pellets
    if (maze[player.y] && maze[player.y][player.x] === 1) {
      maze[player.y][player.x] = 3
      s.score += 10
      s.pelletCount--
      spawnPelletParticles(particles, player.px + TILE_W / 2, player.py + TILE_H / 2, '#ffff44')
    } else if (maze[player.y] && maze[player.y][player.x] === 2) {
      maze[player.y][player.x] = 3
      s.score += 50
      s.pelletCount--
      s.powerTimer = 5
      ghosts.forEach(g => { g.scared = true })
      spawnPelletParticles(particles, player.px + TILE_W / 2, player.py + TILE_H / 2, '#ffd700')
      spawnPowerPulse(effects)
    }

    // All pellets collected
    if (s.pelletCount <= 0) {
      endGame()
      return
    }

    // Ghost movement
    const ghostSpeed = config.ghostSpeed * TILE_W * dt
    ghosts.forEach(g => {
      // Update death animation
      if (g.deathAnim > 0) {
        g.deathAnim -= dt
        if (g.deathAnim <= 0) {
          g.deathAnim = 0
        }
        return
      }

      g.bobPhase += dt * 6

      const dirs = []
      if (canMove(maze, g.x + 1, g.y)) dirs.push({ dx: 1, dy: 0 })
      if (canMove(maze, g.x - 1, g.y)) dirs.push({ dx: -1, dy: 0 })
      if (canMove(maze, g.x, g.y + 1)) dirs.push({ dx: 0, dy: 1 })
      if (canMove(maze, g.x, g.y - 1)) dirs.push({ dx: 0, dy: -1 })

      if (dirs.length > 0) {
        const atCenter = Math.abs(g.px - g.x * TILE_W) < 2 && Math.abs(g.py - g.y * TILE_H) < 2
        if (atCenter) {
          let chosen
          if (g.scared) {
            chosen = dirs.reduce((best, d) => {
              const dist = Math.abs((g.x + d.dx) - player.x) + Math.abs((g.y + d.dy) - player.y)
              const bestDist = Math.abs((g.x + best.dx) - player.x) + Math.abs((g.y + best.dy) - player.y)
              return dist > bestDist ? d : best
            }, dirs[0])
          } else {
            if (Math.random() < 0.3) {
              chosen = dirs[Math.floor(Math.random() * dirs.length)]
            } else {
              chosen = dirs.reduce((best, d) => {
                const dist = Math.abs((g.x + d.dx) - player.x) + Math.abs((g.y + d.dy) - player.y)
                const bestDist = Math.abs((g.x + best.dx) - player.x) + Math.abs((g.y + best.dy) - player.y)
                return dist < bestDist ? d : best
              }, dirs[0])
            }
          }
          g.dir = chosen
        }

        if (g.dir && typeof g.dir === 'object' && canMove(maze, g.x + g.dir.dx, g.y + g.dir.dy)) {
          g.px += g.dir.dx * ghostSpeed
          g.py += g.dir.dy * ghostSpeed

          const tx = (g.x + g.dir.dx) * TILE_W
          const ty = (g.y + g.dir.dy) * TILE_H
          if ((g.dir.dx > 0 && g.px >= tx) || (g.dir.dx < 0 && g.px <= tx) ||
              (g.dir.dy > 0 && g.py >= ty) || (g.dir.dy < 0 && g.py <= ty)) {
            g.x += g.dir.dx
            g.y += g.dir.dy
            g.px = g.x * TILE_W
            g.py = g.y * TILE_H
          }
        }
      }

      // Collision with player
      const dist = Math.abs(g.px - player.px) + Math.abs(g.py - player.py)
      if (dist < TILE_W * 0.8) {
        if (g.scared) {
          // Eat ghost
          s.score += 200
          g.deathAnim = 0.5
          spawnGhostEatFlash(effects)
          spawnPelletParticles(particles, g.px + TILE_W / 2, g.py + TILE_H / 2, g.color)

          // Respawn after death animation
          setTimeout(() => {
            g.x = 9
            g.y = 5
            g.px = g.x * TILE_W
            g.py = g.y * TILE_H
            g.scared = false
            g.deathAnim = 0
          }, 500)
        } else {
          // Player hit
          s.timeLeft -= 3
          spawnDeathShake(effects)
          player.x = 1
          player.y = 10
          player.px = player.x * TILE_W
          player.py = player.y * TILE_H
        }
      }
    })

    // Update particles
    updateParticles(particles, dt)

    // === RENDER ===

    // Apply screen shake
    ctx.save()
    if (effects.shake && effects.shake.intensity > 0) {
      const shakeX = (Math.random() - 0.5) * effects.shake.intensity * 2
      const shakeY = (Math.random() - 0.5) * effects.shake.intensity * 2
      ctx.translate(shakeX, shakeY)
    }

    // Background gradient
    drawBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Maze walls with neon glow
    const wallPulseAlpha = effects.wallPulse ? Math.max(0, effects.wallPulse.alpha) : 0
    drawNeonWalls(ctx, maze, s.globalTime, wallPulseAlpha)

    // Floor and pellets
    drawFloorAndPellets(ctx, maze, s.globalTime)

    // Power mode overlay
    drawPowerOverlay(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, s.powerTimer)

    // Ghosts
    ghosts.forEach(g => {
      drawGhostEnhanced(ctx, g, player.px + TILE_W / 2, player.py + TILE_H / 2, s.globalTime)
    })

    // Player
    drawPacMan(ctx, player, Math.max(0.05, s.mouthAngle), s.globalTime)

    // Particles
    drawParticles(ctx, particles)

    // Screen effects (flash, etc)
    drawScreenEffects(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, effects, dt)

    // HUD on top
    drawHUD(ctx, s.score, s.timeLeft, s.powerTimer, CANVAS_WIDTH, s.globalTime)

    ctx.restore()
  }, [endGame]), isPlaying && !ended)

  return (
    <div className="pacman-game" style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="mg-canvas"
      />
      <ControlsOverlay controls={[
        { keys: ['←', '→', '↑', '↓'], label: 'MOVE' },
        { keys: ['W','A','S','D'], label: 'ALT' },
      ]} />
    </div>
  )
}

export default PacManGame
