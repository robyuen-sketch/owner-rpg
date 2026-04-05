import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_DURATION, COLORS, SPACE_CONFIG } from './gameConstants'
import { clearCanvas, drawPixelText, drawPixelRect, drawTimerBar } from './canvasUtils'
import ControlsOverlay from './ControlsOverlay'
import './SpaceCommandersGame.css'

// --------------- DIMENSIONS ---------------
const PLAYER_W = 40
const PLAYER_H = 24
const BULLET_W = 4
const BULLET_H = 12
const ENEMY_W = 30
const ENEMY_H = 22
const ENEMY_BULLET_W = 3
const ENEMY_BULLET_H = 10
const SHIELD_W = 60
const SHIELD_H = 20

// Row colors for enemies (top row first)
const ENEMY_COLORS = ['#ff3333', '#39ff14', '#9b59b6', '#00ccff', '#ffd700']
const ENEMY_POINTS = [100, 70, 50, 30, 10]

// --------------- STARFIELD ---------------
function createStarfield() {
  const layers = []
  for (let layer = 0; layer < 3; layer++) {
    const stars = []
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: 0.5 + layer * 0.4 + Math.random() * 0.5,
        baseAlpha: 0.15 + layer * 0.25,
        twinkleSpeed: 1.5 + Math.random() * 2.5,
        twinkleOffset: Math.random() * Math.PI * 2,
      })
    }
    layers.push({ stars, speed: 8 + layer * 16 })
  }
  return layers
}

function createShootingStar() {
  return {
    x: Math.random() * CANVAS_WIDTH * 0.6,
    y: Math.random() * CANVAS_HEIGHT * 0.3,
    vx: 400 + Math.random() * 300,
    vy: 150 + Math.random() * 100,
    life: 0,
    maxLife: 0.4 + Math.random() * 0.3,
    length: 30 + Math.random() * 40,
  }
}

// --------------- SPACE DUST ---------------
function createSpaceDust() {
  const particles = []
  for (let i = 0; i < 25; i++) {
    particles.push({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: 1 + Math.random() * 1.5,
      alpha: 0.03 + Math.random() * 0.05,
      speed: 3 + Math.random() * 5,
      drift: (Math.random() - 0.5) * 2,
    })
  }
  return particles
}

// --------------- PARTICLE SYSTEM ---------------
function spawnExplosion(particles, x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6
    const speed = 60 + Math.random() * 140
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + Math.random() * 0.2,
      maxLife: 0.5 + Math.random() * 0.2,
      size: 2 + Math.random() * 3,
      color,
      type: 'fragment',
    })
  }
  // White flash at impact
  particles.push({
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0.15,
    maxLife: 0.15,
    size: 14,
    color: '#ffffff',
    type: 'flash',
  })
}

function spawnImpactFlash(particles, x, y) {
  particles.push({
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0.12,
    maxLife: 0.12,
    size: 8,
    color: '#ffffff',
    type: 'flash',
  })
}

// --------------- GAME STATE ---------------
function initGameState(difficulty) {
  const config = SPACE_CONFIG[Math.min(difficulty - 1, 3)]
  const enemies = []
  const startX = (CANVAS_WIDTH - config.cols * (ENEMY_W + 12)) / 2
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      enemies.push({
        x: startX + c * (ENEMY_W + 12),
        y: 40 + r * (ENEMY_H + 10),
        alive: true,
        row: r,
        bobOffset: Math.random() * Math.PI * 2,
      })
    }
  }

  // Shields
  const shields = []
  const shieldCount = 4
  const shieldSpacing = CANVAS_WIDTH / (shieldCount + 1)
  for (let i = 0; i < shieldCount; i++) {
    shields.push({
      x: shieldSpacing * (i + 1) - SHIELD_W / 2,
      y: CANVAS_HEIGHT - 100,
      hp: 4,
      flashTimer: 0,
    })
  }

  return {
    player: { x: CANVAS_WIDTH / 2 - PLAYER_W / 2, y: CANVAS_HEIGHT - 50 },
    enemies,
    bullets: [],
    enemyBullets: [],
    shields,
    score: 0,
    timeLeft: GAME_DURATION,
    moveDir: 1,
    moveTimer: 0,
    moveInterval: 1.0 / config.moveSpeed,
    dropAmount: config.dropSpeed,
    fireRate: config.fireRate,
    config,
    ufo: null,
    ufoTimer: 15 + Math.random() * 10,
    canShoot: true,
    shootCooldown: 0,
    // Visual state
    starfield: createStarfield(),
    spaceDust: createSpaceDust(),
    shootingStar: null,
    shootingStarTimer: 4 + Math.random() * 6,
    particles: [],
    globalTime: 0,
    playerVelX: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    killFlashTimer: 0,
    chainKills: 0,
    chainTimer: 0,
    shieldBubbleTimer: 0,
    playerShieldHP: 4,
  }
}

// --------------- DRAWING HELPERS ---------------
function drawStarfield(ctx, layers, globalTime, dt) {
  for (const layer of layers) {
    for (const star of layer.stars) {
      star.y += layer.speed * dt
      if (star.y > CANVAS_HEIGHT) {
        star.y = -2
        star.x = Math.random() * CANVAS_WIDTH
      }
      const twinkle = Math.sin(globalTime * star.twinkleSpeed + star.twinkleOffset)
      const alpha = star.baseAlpha + twinkle * 0.15
      ctx.fillStyle = `rgba(200, 220, 255, ${Math.max(0.05, alpha)})`
      ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size)
    }
  }
}

function drawShootingStar(ctx, ss) {
  if (!ss) return
  const progress = ss.life / ss.maxLife
  const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2
  const tailX = ss.x - (ss.vx * 0.06) * (ss.length / 30)
  const tailY = ss.y - (ss.vy * 0.06) * (ss.length / 30)
  const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y)
  grad.addColorStop(0, `rgba(180, 200, 255, 0)`)
  grad.addColorStop(1, `rgba(220, 240, 255, ${alpha * 0.9})`)
  ctx.strokeStyle = grad
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(tailX, tailY)
  ctx.lineTo(ss.x, ss.y)
  ctx.stroke()
  // Bright head
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
  ctx.beginPath()
  ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2)
  ctx.fill()
}

function drawSpaceDust(ctx, dust, dt) {
  for (const p of dust) {
    p.y += p.speed * dt
    p.x += p.drift * dt
    if (p.y > CANVAS_HEIGHT) { p.y = -2; p.x = Math.random() * CANVAS_WIDTH }
    if (p.x < 0) p.x = CANVAS_WIDTH
    if (p.x > CANVAS_WIDTH) p.x = 0
    ctx.fillStyle = `rgba(160, 140, 200, ${p.alpha})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawNebulaOverlay(ctx) {
  const grad = ctx.createRadialGradient(
    CANVAS_WIDTH * 0.3, CANVAS_HEIGHT * 0.2, 40,
    CANVAS_WIDTH * 0.3, CANVAS_HEIGHT * 0.2, CANVAS_WIDTH * 0.7
  )
  grad.addColorStop(0, 'rgba(80, 40, 120, 0.06)')
  grad.addColorStop(0.5, 'rgba(30, 30, 90, 0.04)')
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  const grad2 = ctx.createRadialGradient(
    CANVAS_WIDTH * 0.75, CANVAS_HEIGHT * 0.65, 30,
    CANVAS_WIDTH * 0.75, CANVAS_HEIGHT * 0.65, CANVAS_WIDTH * 0.5
  )
  grad2.addColorStop(0, 'rgba(30, 50, 120, 0.05)')
  grad2.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad2
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
}

function drawPlayerShip(ctx, px, py, velX, globalTime) {
  const cx = px + PLAYER_W / 2
  // Slight tilt based on movement
  const tilt = velX * 0.0015
  ctx.save()
  ctx.translate(cx, py + PLAYER_H / 2)
  ctx.rotate(tilt)
  ctx.translate(-cx, -(py + PLAYER_H / 2))

  // Thruster flames
  const flicker1 = 6 + Math.sin(globalTime * 25) * 3 + Math.random() * 2
  const flicker2 = 4 + Math.cos(globalTime * 30) * 2 + Math.random() * 1.5
  const thrustBoost = Math.abs(velX) > 50 ? 1.4 : 1.0
  // Left thruster
  ctx.fillStyle = '#ff6600'
  ctx.beginPath()
  ctx.moveTo(cx - 10, py + PLAYER_H)
  ctx.lineTo(cx - 14, py + PLAYER_H + flicker1 * thrustBoost)
  ctx.lineTo(cx - 6, py + PLAYER_H)
  ctx.fill()
  ctx.fillStyle = '#ffcc00'
  ctx.beginPath()
  ctx.moveTo(cx - 10, py + PLAYER_H)
  ctx.lineTo(cx - 12, py + PLAYER_H + flicker2 * thrustBoost)
  ctx.lineTo(cx - 8, py + PLAYER_H)
  ctx.fill()
  // Right thruster
  ctx.fillStyle = '#ff6600'
  ctx.beginPath()
  ctx.moveTo(cx + 10, py + PLAYER_H)
  ctx.lineTo(cx + 14, py + PLAYER_H + flicker1 * thrustBoost)
  ctx.lineTo(cx + 6, py + PLAYER_H)
  ctx.fill()
  ctx.fillStyle = '#ffcc00'
  ctx.beginPath()
  ctx.moveTo(cx + 10, py + PLAYER_H)
  ctx.lineTo(cx + 12, py + PLAYER_H + flicker2 * thrustBoost)
  ctx.lineTo(cx + 8, py + PLAYER_H)
  ctx.fill()

  // Wings
  ctx.fillStyle = '#5577aa'
  ctx.beginPath()
  ctx.moveTo(cx - 4, py + 8)
  ctx.lineTo(cx - 20, py + PLAYER_H + 2)
  ctx.lineTo(cx - 18, py + PLAYER_H + 2)
  ctx.lineTo(cx - 2, py + 14)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + 4, py + 8)
  ctx.lineTo(cx + 20, py + PLAYER_H + 2)
  ctx.lineTo(cx + 18, py + PLAYER_H + 2)
  ctx.lineTo(cx + 2, py + 14)
  ctx.fill()

  // Main body (triangular)
  ctx.fillStyle = '#88aacc'
  ctx.beginPath()
  ctx.moveTo(cx, py - 2)
  ctx.lineTo(cx - 10, py + PLAYER_H)
  ctx.lineTo(cx + 10, py + PLAYER_H)
  ctx.closePath()
  ctx.fill()

  // Body detail stripe
  ctx.fillStyle = '#6688aa'
  ctx.beginPath()
  ctx.moveTo(cx, py + 6)
  ctx.lineTo(cx - 6, py + PLAYER_H)
  ctx.lineTo(cx + 6, py + PLAYER_H)
  ctx.closePath()
  ctx.fill()

  // Cockpit window
  ctx.fillStyle = '#66ddff'
  ctx.beginPath()
  ctx.moveTo(cx, py + 2)
  ctx.lineTo(cx - 4, py + 9)
  ctx.lineTo(cx + 4, py + 9)
  ctx.closePath()
  ctx.fill()
  // Cockpit shine
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.beginPath()
  ctx.moveTo(cx - 1, py + 3)
  ctx.lineTo(cx - 3, py + 7)
  ctx.lineTo(cx, py + 7)
  ctx.closePath()
  ctx.fill()

  // Wing tips
  ctx.fillStyle = '#ff4444'
  ctx.fillRect(cx - 20, py + PLAYER_H - 1, 3, 3)
  ctx.fillRect(cx + 17, py + PLAYER_H - 1, 3, 3)

  ctx.restore()
}

function drawEnemy(ctx, e, globalTime) {
  const color = ENEMY_COLORS[Math.min(e.row, 4)]
  const bob = Math.sin(globalTime * 3 + e.bobOffset) * 2
  const ey = e.y + bob

  // Antenna with movement
  const antWave = Math.sin(globalTime * 4 + e.bobOffset) * 2
  ctx.fillStyle = color
  ctx.fillRect(e.x + 6, ey - 6 + antWave, 2, 8)
  ctx.fillRect(e.x + ENEMY_W - 8, ey - 6 - antWave, 2, 8)
  // Antenna tips
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(e.x + 7, ey - 6 + antWave, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(e.x + ENEMY_W - 7, ey - 6 - antWave, 2, 0, Math.PI * 2)
  ctx.fill()

  // Body
  drawPixelRect(ctx, e.x + 4, ey, ENEMY_W - 8, ENEMY_H, color)
  drawPixelRect(ctx, e.x, ey + 4, ENEMY_W, ENEMY_H - 8, color)
  // Darker center
  const darkerColor = shadeColor(color, -30)
  drawPixelRect(ctx, e.x + 6, ey + 4, ENEMY_W - 12, ENEMY_H - 10, darkerColor)

  // Eyes with glow pulse
  const eyeGlow = 0.5 + Math.sin(globalTime * 5 + e.bobOffset) * 0.5
  ctx.fillStyle = '#000000'
  drawPixelRect(ctx, e.x + 8, ey + 6, 5, 5, '#000')
  drawPixelRect(ctx, e.x + ENEMY_W - 13, ey + 6, 5, 5, '#000')
  // Eye glow
  ctx.fillStyle = `rgba(255, 255, 255, ${eyeGlow})`
  ctx.fillRect(e.x + 9, ey + 7, 2, 2)
  ctx.fillRect(e.x + ENEMY_W - 12, ey + 7, 2, 2)

  // Wing flaps
  const wingAngle = Math.sin(globalTime * 6 + e.bobOffset) * 0.15
  ctx.save()
  ctx.fillStyle = color
  // Left wing
  ctx.translate(e.x, ey + ENEMY_H / 2)
  ctx.rotate(-wingAngle)
  ctx.fillRect(-4, -3, 5, 6)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // Right wing
  ctx.translate(e.x + ENEMY_W, ey + ENEMY_H / 2)
  ctx.rotate(wingAngle)
  ctx.fillRect(-1, -3, 5, 6)
  ctx.restore()
}

function drawUFO(ctx, ufo, globalTime) {
  const ux = ufo.x
  const uy = ufo.y
  const pulse = 0.4 + Math.sin(globalTime * 6) * 0.3

  // Pulsing magenta aura
  ctx.save()
  ctx.globalAlpha = pulse * 0.3
  ctx.fillStyle = '#ff00ff'
  ctx.beginPath()
  ctx.ellipse(ux + 18, uy + 8, 26, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Body disc
  ctx.fillStyle = '#cc44aa'
  ctx.beginPath()
  ctx.ellipse(ux + 18, uy + 10, 18, 7, 0, 0, Math.PI * 2)
  ctx.fill()

  // Dome
  ctx.fillStyle = '#ff66cc'
  ctx.beginPath()
  ctx.ellipse(ux + 18, uy + 6, 10, 8, 0, Math.PI, 0)
  ctx.fill()
  // Dome shine
  ctx.fillStyle = 'rgba(255,200,255,0.5)'
  ctx.beginPath()
  ctx.ellipse(ux + 15, uy + 3, 4, 3, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // Blinking lights along rim
  const lightCount = 5
  for (let i = 0; i < lightCount; i++) {
    const angle = (Math.PI * 2 * i) / lightCount + globalTime * 3
    const lx = ux + 18 + Math.cos(angle) * 14
    const ly = uy + 10 + Math.sin(angle) * 5
    const on = Math.sin(globalTime * 8 + i * 1.5) > 0
    ctx.fillStyle = on ? '#ffff00' : '#886600'
    ctx.beginPath()
    ctx.arc(lx, ly, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // Score text
  drawPixelText(ctx, '500', ux + 6, uy - 10, 7, '#ff88ff')
}

function drawPlayerBullet(ctx, b, globalTime) {
  // Trailing glow copies
  for (let i = 2; i >= 0; i--) {
    const trailAlpha = 0.15 - i * 0.04
    const trailY = b.y + i * 6
    ctx.fillStyle = `rgba(57, 255, 20, ${trailAlpha})`
    ctx.fillRect(b.x - 2, trailY, BULLET_W + 4, BULLET_H)
  }
  // Main bullet
  ctx.fillStyle = COLORS.GREEN
  ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H)
  // Bright core
  ctx.fillStyle = 'rgba(180, 255, 180, 0.8)'
  ctx.fillRect(b.x + 1, b.y + 1, BULLET_W - 2, BULLET_H - 4)
}

function drawEnemyBullet(ctx, b, globalTime) {
  // Trailing glow
  for (let i = 2; i >= 0; i--) {
    const trailAlpha = 0.12 - i * 0.03
    const trailY = b.y - i * 5
    ctx.fillStyle = `rgba(255, 50, 50, ${trailAlpha})`
    ctx.fillRect(b.x - 1, trailY, ENEMY_BULLET_W + 2, ENEMY_BULLET_H)
  }
  // Main bullet
  ctx.fillStyle = COLORS.RED
  ctx.fillRect(b.x, b.y, ENEMY_BULLET_W, ENEMY_BULLET_H)
  // Bright core
  ctx.fillStyle = 'rgba(255, 180, 180, 0.7)'
  ctx.fillRect(b.x + 0.5, b.y + 2, ENEMY_BULLET_W - 1, ENEMY_BULLET_H - 4)
}

function drawShield(ctx, shield, globalTime) {
  if (shield.hp <= 0) return
  const segments = 4
  const segW = SHIELD_W / segments
  const baseAlpha = shield.hp / 4

  // Flash red on recent hit
  const isFlashing = shield.flashTimer > 0
  const flashAlpha = isFlashing ? shield.flashTimer * 4 : 0

  for (let i = 0; i < shield.hp; i++) {
    const segX = shield.x + i * segW
    if (isFlashing) {
      ctx.fillStyle = `rgba(255, 60, 60, ${0.3 + flashAlpha * 0.4})`
    } else {
      ctx.fillStyle = `rgba(57, 255, 20, ${baseAlpha * 0.6})`
    }
    ctx.fillRect(segX + 1, shield.y + 1, segW - 2, SHIELD_H - 2)
  }

  // Border
  ctx.strokeStyle = isFlashing ? `rgba(255,100,100,${0.5 + flashAlpha})` : COLORS.GREEN
  ctx.lineWidth = 1
  ctx.strokeRect(shield.x, shield.y, SHIELD_W, SHIELD_H)
  // Segment lines
  ctx.strokeStyle = `rgba(57, 255, 20, ${baseAlpha * 0.3})`
  for (let i = 1; i < segments; i++) {
    ctx.beginPath()
    ctx.moveTo(shield.x + i * segW, shield.y)
    ctx.lineTo(shield.x + i * segW, shield.y + SHIELD_H)
    ctx.stroke()
  }
}

function drawShieldBubble(ctx, px, py, timer) {
  if (timer <= 0) return
  const alpha = timer * 2.5
  const radius = 28 + (1 - timer) * 12
  ctx.save()
  ctx.globalAlpha = Math.min(alpha, 0.5)
  ctx.strokeStyle = '#66ddff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(px + PLAYER_W / 2, py + PLAYER_H / 2, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawLowShieldWarning(ctx, shieldHP) {
  if (shieldHP > 1) return
  const intensity = shieldHP <= 0 ? 0.15 : 0.08
  // Red edge vignette
  const grad = ctx.createRadialGradient(
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.35,
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.7
  )
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)')
  grad.addColorStop(1, `rgba(180, 0, 0, ${intensity})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
}

function drawParticles(ctx, particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= dt
    if (p.life <= 0) {
      particles.splice(i, 1)
      continue
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
    const progress = p.life / p.maxLife

    if (p.type === 'flash') {
      // Expanding white circle that fades
      const radius = p.size * (1 - progress) + 2
      ctx.save()
      ctx.globalAlpha = progress
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    } else {
      // Fragment particle
      ctx.save()
      ctx.globalAlpha = progress
      ctx.fillStyle = p.color
      const sz = p.size * (0.3 + progress * 0.7)
      ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz)
      ctx.restore()
    }
  }
}

function drawHUD(ctx, score, timeLeft, shieldHP) {
  drawTimerBar(ctx, timeLeft, GAME_DURATION, CANVAS_WIDTH)
  drawPixelText(ctx, `SCORE: ${score}`, 10, 14, 10, COLORS.WHITE)
  drawPixelText(ctx, `TIME: ${Math.ceil(timeLeft)}`, CANVAS_WIDTH - 10, 14, 10, COLORS.GOLD, 'right')

  // Shield indicator
  const shieldBarX = CANVAS_WIDTH / 2 - 50
  const shieldBarY = 10
  drawPixelText(ctx, 'SHIELD', shieldBarX - 48, shieldBarY, 7, '#6688aa')
  for (let i = 0; i < 4; i++) {
    const sx = shieldBarX + i * 24
    if (i < shieldHP) {
      ctx.fillStyle = shieldHP <= 1 ? '#ff4444' : '#44aaff'
      ctx.fillRect(sx, shieldBarY, 20, 8)
    } else {
      ctx.fillStyle = 'rgba(100,100,100,0.3)'
      ctx.fillRect(sx, shieldBarY, 20, 8)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(sx, shieldBarY, 20, 8)
  }
}

function shadeColor(hex, amount) {
  let r = parseInt(hex.slice(1, 3), 16)
  let g = parseInt(hex.slice(3, 5), 16)
  let b = parseInt(hex.slice(5, 7), 16)
  r = Math.max(0, Math.min(255, r + amount))
  g = Math.max(0, Math.min(255, g + amount))
  b = Math.max(0, Math.min(255, b + amount))
  return `rgb(${r},${g},${b})`
}

// --------------- MAIN COMPONENT ---------------
function SpaceCommandersGame({ difficulty, onEnd, isPlaying }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(initGameState(difficulty))
  const keysRef = useRef(new Set())
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd'].includes(e.key)) {
        e.preventDefault()
        keysRef.current.add(e.key)
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

  useGameLoop(useCallback((dt) => {
    const s = stateRef.current
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    s.globalTime += dt

    // =================== UPDATE ===================
    s.timeLeft -= dt
    if (s.timeLeft <= 0) {
      s.timeLeft = 0
      endGame()
      return
    }

    // Decay timers
    if (s.shakeTimer > 0) s.shakeTimer -= dt
    if (s.killFlashTimer > 0) s.killFlashTimer -= dt
    if (s.shieldBubbleTimer > 0) s.shieldBubbleTimer -= dt
    if (s.chainTimer > 0) { s.chainTimer -= dt } else { s.chainKills = 0 }
    s.shields.forEach(sh => { if (sh.flashTimer > 0) sh.flashTimer -= dt })

    // Shooting star management
    s.shootingStarTimer -= dt
    if (s.shootingStarTimer <= 0 && !s.shootingStar) {
      s.shootingStar = createShootingStar()
      s.shootingStarTimer = 6 + Math.random() * 10
    }
    if (s.shootingStar) {
      s.shootingStar.x += s.shootingStar.vx * dt
      s.shootingStar.y += s.shootingStar.vy * dt
      s.shootingStar.life += dt
      if (s.shootingStar.life >= s.shootingStar.maxLife) s.shootingStar = null
    }

    const keys = keysRef.current
    const playerSpeed = 300 * dt
    const prevX = s.player.x

    // Player movement
    if (keys.has('ArrowLeft') || keys.has('a')) {
      s.player.x = Math.max(0, s.player.x - playerSpeed)
    }
    if (keys.has('ArrowRight') || keys.has('d')) {
      s.player.x = Math.min(CANVAS_WIDTH - PLAYER_W, s.player.x + playerSpeed)
    }
    s.playerVelX = (s.player.x - prevX) / dt

    // Shooting
    s.shootCooldown -= dt
    if ((keys.has(' ')) && s.shootCooldown <= 0) {
      s.bullets.push({
        x: s.player.x + PLAYER_W / 2 - BULLET_W / 2,
        y: s.player.y - BULLET_H,
      })
      s.shootCooldown = 0.25
    }

    // Move bullets
    s.bullets = s.bullets.filter(b => {
      b.y -= 400 * dt
      return b.y > -BULLET_H
    })

    // Enemy bullets
    s.enemyBullets = s.enemyBullets.filter(b => {
      b.y += 250 * dt
      return b.y < CANVAS_HEIGHT + 10
    })

    // Enemy movement
    s.moveTimer += dt
    if (s.moveTimer >= s.moveInterval) {
      s.moveTimer = 0
      let hitEdge = false
      s.enemies.forEach(e => {
        if (!e.alive) return
        e.x += s.moveDir * 10
        if (e.x <= 10 || e.x >= CANVAS_WIDTH - ENEMY_W - 10) hitEdge = true
      })
      if (hitEdge) {
        s.moveDir *= -1
        s.enemies.forEach(e => {
          if (e.alive) e.y += s.dropAmount
        })
      }
    }

    // Enemy firing
    const aliveEnemies = s.enemies.filter(e => e.alive)
    if (aliveEnemies.length > 0) {
      aliveEnemies.forEach(e => {
        if (Math.random() < s.fireRate) {
          s.enemyBullets.push({
            x: e.x + ENEMY_W / 2 - ENEMY_BULLET_W / 2,
            y: e.y + ENEMY_H,
          })
        }
      })
    }

    // UFO
    s.ufoTimer -= dt
    if (s.ufoTimer <= 0 && !s.ufo) {
      s.ufo = { x: -40, y: 18, dir: 1 }
      s.ufoTimer = 20 + Math.random() * 15
    }
    if (s.ufo) {
      s.ufo.x += s.ufo.dir * 120 * dt
      if (s.ufo.x > CANVAS_WIDTH + 40) s.ufo = null
    }

    // Bullet-enemy collision
    s.bullets = s.bullets.filter(bullet => {
      for (let i = 0; i < s.enemies.length; i++) {
        const e = s.enemies[i]
        if (!e.alive) continue
        if (bullet.x < e.x + ENEMY_W && bullet.x + BULLET_W > e.x &&
            bullet.y < e.y + ENEMY_H && bullet.y + BULLET_H > e.y) {
          e.alive = false
          s.score += ENEMY_POINTS[Math.min(e.row, 4)]
          // Chain kill tracking
          s.chainKills++
          s.chainTimer = 0.8
          const explosionSize = Math.min(8 + s.chainKills * 2, 18)
          const color = ENEMY_COLORS[Math.min(e.row, 4)]
          spawnExplosion(s.particles, e.x + ENEMY_W / 2, e.y + ENEMY_H / 2, color, explosionSize)
          s.killFlashTimer = 0.06
          spawnImpactFlash(s.particles, bullet.x + BULLET_W / 2, bullet.y)
          return false
        }
      }
      // UFO collision
      if (s.ufo && bullet.x < s.ufo.x + 36 && bullet.x + BULLET_W > s.ufo.x &&
          bullet.y < s.ufo.y + 16 && bullet.y + BULLET_H > s.ufo.y) {
        s.score += 500
        spawnExplosion(s.particles, s.ufo.x + 18, s.ufo.y + 8, '#ff00ff', 16)
        s.ufo = null
        s.killFlashTimer = 0.1
        return false
      }
      return true
    })

    // Bullet-shield collision
    s.bullets = s.bullets.filter(bullet => {
      for (const shield of s.shields) {
        if (shield.hp <= 0) continue
        if (bullet.x < shield.x + SHIELD_W && bullet.x + BULLET_W > shield.x &&
            bullet.y < shield.y + SHIELD_H && bullet.y + BULLET_H > shield.y) {
          shield.hp--
          shield.flashTimer = 0.25
          spawnImpactFlash(s.particles, bullet.x + BULLET_W / 2, bullet.y + BULLET_H / 2)
          return false
        }
      }
      return true
    })

    // Enemy bullet-shield collision
    s.enemyBullets = s.enemyBullets.filter(bullet => {
      for (const shield of s.shields) {
        if (shield.hp <= 0) continue
        if (bullet.x < shield.x + SHIELD_W && bullet.x + ENEMY_BULLET_W > shield.x &&
            bullet.y < shield.y + SHIELD_H && bullet.y + ENEMY_BULLET_H > shield.y) {
          shield.hp--
          shield.flashTimer = 0.25
          spawnImpactFlash(s.particles, bullet.x, bullet.y)
          return false
        }
      }
      return true
    })

    // Enemy bullet-player collision
    s.enemyBullets = s.enemyBullets.filter(bullet => {
      if (bullet.x < s.player.x + PLAYER_W && bullet.x + ENEMY_BULLET_W > s.player.x &&
          bullet.y < s.player.y + PLAYER_H && bullet.y + ENEMY_BULLET_H > s.player.y) {
        s.timeLeft -= 3
        s.playerShieldHP = Math.max(0, s.playerShieldHP - 1)
        s.shakeTimer = 0.25
        s.shakeIntensity = 4
        s.shieldBubbleTimer = 0.4
        spawnImpactFlash(s.particles, bullet.x, bullet.y)
        return false
      }
      return true
    })

    // Enemy reached bottom
    if (aliveEnemies.some(e => e.y + ENEMY_H >= s.player.y)) {
      s.timeLeft -= 5
      s.shakeTimer = 0.4
      s.shakeIntensity = 6
    }

    // All enemies dead - bonus
    if (aliveEnemies.length === 0) {
      s.score += 500
      endGame()
      return
    }

    // =================== RENDER ===================
    ctx.save()

    // Screen shake offset
    let shakeX = 0, shakeY = 0
    if (s.shakeTimer > 0) {
      shakeX = (Math.random() - 0.5) * s.shakeIntensity * 2
      shakeY = (Math.random() - 0.5) * s.shakeIntensity * 2
      ctx.translate(shakeX, shakeY)
    }

    clearCanvas(ctx, CANVAS_WIDTH + 10, CANVAS_HEIGHT + 10)

    // Nebula background overlay
    drawNebulaOverlay(ctx)

    // Starfield
    drawStarfield(ctx, s.starfield, s.globalTime, dt)

    // Shooting star
    drawShootingStar(ctx, s.shootingStar)

    // Space dust
    drawSpaceDust(ctx, s.spaceDust, dt)

    // Shields
    s.shields.forEach(shield => drawShield(ctx, shield, s.globalTime))

    // Enemies
    s.enemies.forEach(e => {
      if (!e.alive) return
      drawEnemy(ctx, e, s.globalTime)
    })

    // UFO
    if (s.ufo) drawUFO(ctx, s.ufo, s.globalTime)

    // Player ship
    drawPlayerShip(ctx, s.player.x, s.player.y, s.playerVelX, s.globalTime)

    // Shield bubble on hit
    drawShieldBubble(ctx, s.player.x, s.player.y, s.shieldBubbleTimer)

    // Player bullets
    s.bullets.forEach(b => drawPlayerBullet(ctx, b, s.globalTime))

    // Enemy bullets
    s.enemyBullets.forEach(b => drawEnemyBullet(ctx, b, s.globalTime))

    // Particles
    drawParticles(ctx, s.particles, dt)

    // Kill flash effect
    if (s.killFlashTimer > 0) {
      ctx.save()
      ctx.globalAlpha = s.killFlashTimer * 3
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.restore()
    }

    // Low shield warning (red vignette)
    drawLowShieldWarning(ctx, s.playerShieldHP)

    // HUD (draw last, on top)
    drawHUD(ctx, s.score, s.timeLeft, s.playerShieldHP)

    ctx.restore()
  }, [endGame]), isPlaying && !ended)

  return (
    <div className="space-commanders-game">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="mg-canvas"
      />
      <ControlsOverlay controls={[
        { keys: ['\u2190', '\u2192'], label: 'MOVE' },
        { keys: ['SPACE'], label: 'FIRE' },
      ]} />
    </div>
  )
}

export default SpaceCommandersGame
