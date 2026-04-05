import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from './gameConstants'
import { clearCanvas, drawPixelText } from './canvasUtils'
import ControlsOverlay from './ControlsOverlay'
import './PirateShipGame.css'

// Layout constants
const LANE_COUNT = 13
const LANE_HEIGHT = Math.floor(CANVAS_HEIGHT / LANE_COUNT)
const SHIP_SIZE = 28
const TOTAL_CROSSINGS = 3
const SAFE_LANES = [0, 6, 12] // top island, middle dock, bottom dock
const INVINCIBILITY_DURATION = 1.0
const MOVE_INTERP_SPEED = 12 // interpolation speed for smooth movement
const MAX_LIVES = 3

// Difficulty configs: [minSpeed, maxSpeed, minPerLane, maxPerLane]
const DIFFICULTY_CONFIG = [
  { minSpd: 60, maxSpd: 100, minObs: 2, maxObs: 3 },
  { minSpd: 80, maxSpd: 140, minObs: 3, maxObs: 4 },
  { minSpd: 100, maxSpd: 180, minObs: 3, maxObs: 5 },
  { minSpd: 120, maxSpd: 220, minObs: 4, maxObs: 5 },
]

// Obstacle types
const OBS_CHARGEBACK = 'chargeback'  // large, slow
const OBS_PCI = 'pci'                // medium, faster
const OBS_SERPENT = 'serpent'         // small, sine wave
const OBS_WHIRLPOOL = 'whirlpool'    // static spinning

function randRange(a, b) {
  return a + Math.random() * (b - a)
}

function randInt(a, b) {
  return Math.floor(randRange(a, b + 1))
}

function generateLaneObstacles(lane, crossing, diffCfg) {
  // Scale up per crossing
  const crossingMult = 1 + (crossing - 1) * 0.3
  const count = randInt(diffCfg.minObs, diffCfg.maxObs)
  const speed = randRange(diffCfg.minSpd, diffCfg.maxSpd) * crossingMult
  const direction = Math.random() < 0.5 ? 1 : -1
  const obstacles = []

  for (let i = 0; i < count; i++) {
    // Pick type: weighted random
    const r = Math.random()
    let type, w, h
    if (r < 0.15) {
      type = OBS_WHIRLPOOL; w = 30; h = 30
    } else if (r < 0.40) {
      type = OBS_CHARGEBACK; w = 60; h = 30
    } else if (r < 0.70) {
      type = OBS_PCI; w = 40; h = 25
    } else {
      type = OBS_SERPENT; w = 30; h = 20
    }

    // Spread obstacles evenly across the lane width
    const spacing = CANVAS_WIDTH / count
    const x = spacing * i + randRange(0, spacing * 0.6)

    obstacles.push({
      type,
      x,
      y: lane * LANE_HEIGHT + (LANE_HEIGHT - h) / 2,
      w,
      h,
      speed: type === OBS_WHIRLPOOL ? 0 : speed * (type === OBS_CHARGEBACK ? 0.7 : type === OBS_SERPENT ? 1.3 : 1.0),
      direction: type === OBS_WHIRLPOOL ? 0 : direction,
      baseY: lane * LANE_HEIGHT + (LANE_HEIGHT - h) / 2,
      sineOffset: Math.random() * Math.PI * 2,
      spinAngle: 0,
    })
  }
  return obstacles
}

function generateAllObstacles(crossing, diffCfg) {
  const obstacles = []
  // Danger lanes: 1-5 and 7-11
  for (let lane = 1; lane <= 5; lane++) {
    obstacles.push(...generateLaneObstacles(lane, crossing, diffCfg))
  }
  for (let lane = 7; lane <= 11; lane++) {
    obstacles.push(...generateLaneObstacles(lane, crossing, diffCfg))
  }
  return obstacles
}

function generateWaves() {
  const waves = []
  for (let i = 0; i < 40; i++) {
    waves.push({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      len: 15 + Math.random() * 25,
      speed: 20 + Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return waves
}

function generateClouds() {
  const clouds = []
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * CANVAS_WIDTH * 1.5,
      y: Math.random() * 40,
      w: 40 + Math.random() * 60,
      h: 12 + Math.random() * 10,
      speed: 8 + Math.random() * 15,
    })
  }
  return clouds
}

function initGameState(difficulty) {
  const diffIdx = Math.min(Math.max(difficulty, 1), 4) - 1
  const diffCfg = DIFFICULTY_CONFIG[diffIdx]

  return {
    // Ship position (grid-aligned target and interpolated visual)
    shipLane: 12,
    shipCol: Math.floor(CANVAS_WIDTH / 2 / SHIP_SIZE),
    shipVisualX: Math.floor(CANVAS_WIDTH / 2 / SHIP_SIZE) * SHIP_SIZE,
    shipVisualY: 12 * LANE_HEIGHT + (LANE_HEIGHT - SHIP_SIZE) / 2,
    shipDir: 0, // 0=up, 1=right, 2=down, 3=left
    // Game state
    lives: MAX_LIVES,
    crossing: 1,
    invTimer: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    elapsed: 0,
    finished: false,
    // Move cooldown to prevent holding keys
    moveCooldown: 0,
    // Obstacles
    obstacles: generateAllObstacles(1, diffCfg),
    diffCfg,
    diffIdx,
    // Visual
    waves: generateWaves(),
    clouds: generateClouds(),
    waveScroll: 0,
    // Keys held
    keys: { up: false, down: false, left: false, right: false },
    // Crossing complete flash
    flashTimer: 0,
    flashColor: '',
    // Particles system
    particles: [],
    // Ship tilt
    shipTilt: 0,
  }
}

function PirateShipGame({ difficulty, onEnd, isPlaying }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(initGameState(difficulty))
  const [ended, setEnded] = useState(false)

  // Input handling
  useEffect(() => {
    const keyMap = {
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
    }

    const handleKeyDown = (e) => {
      const dir = keyMap[e.key]
      if (dir) {
        e.preventDefault()
        stateRef.current.keys[dir] = true
      }
    }
    const handleKeyUp = (e) => {
      const dir = keyMap[e.key]
      if (dir) {
        stateRef.current.keys[dir] = false
      }
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
    const s = stateRef.current
    const maxTime = 90
    const minScore = 100
    const maxScore = 1000
    const timeFraction = Math.max(0, 1 - s.elapsed / maxTime)
    const score = Math.floor(minScore + (maxScore - minScore) * timeFraction)
    onEnd(score)
  }, [onEnd, ended])

  // Game loop
  useGameLoop(useCallback((dt) => {
    const s = stateRef.current
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || s.finished) return

    s.elapsed += dt

    // Update timers
    if (s.invTimer > 0) s.invTimer -= dt
    if (s.shakeTimer > 0) {
      s.shakeTimer -= dt
      s.shakeIntensity *= 0.93
    }
    if (s.flashTimer > 0) s.flashTimer -= dt
    if (s.moveCooldown > 0) s.moveCooldown -= dt

    // --- SHIP MOVEMENT ---
    if (s.moveCooldown <= 0) {
      let moved = false
      if (s.keys.up && s.shipLane > 0) {
        s.shipLane--
        s.shipDir = 0
        moved = true
      } else if (s.keys.down && s.shipLane < LANE_COUNT - 1) {
        s.shipLane++
        s.shipDir = 2
        moved = true
      } else if (s.keys.left) {
        s.shipCol = Math.max(0, s.shipCol - 1)
        s.shipDir = 3
        moved = true
      } else if (s.keys.right) {
        s.shipCol = Math.min(Math.floor((CANVAS_WIDTH - SHIP_SIZE) / SHIP_SIZE), s.shipCol + 1)
        s.shipDir = 1
        moved = true
      }
      if (moved) {
        s.moveCooldown = 0.12
      }
    }

    // Interpolate visual position
    const targetX = s.shipCol * SHIP_SIZE
    const targetY = s.shipLane * LANE_HEIGHT + (LANE_HEIGHT - SHIP_SIZE) / 2
    s.shipVisualX += (targetX - s.shipVisualX) * MOVE_INTERP_SPEED * dt
    s.shipVisualY += (targetY - s.shipVisualY) * MOVE_INTERP_SPEED * dt

    // Snap when close
    if (Math.abs(s.shipVisualX - targetX) < 0.5) s.shipVisualX = targetX
    if (Math.abs(s.shipVisualY - targetY) < 0.5) s.shipVisualY = targetY

    // --- SHIP TILT ---
    const tiltTarget = s.keys.left ? -0.15 : s.keys.right ? 0.15 : 0
    s.shipTilt += (tiltTarget - s.shipTilt) * 8 * dt

    // --- SHIP WAKE PARTICLES ---
    if (s.keys.up || s.keys.down || s.keys.left || s.keys.right) {
      const wakeCount = 1 + (Math.random() < 0.5 ? 1 : 0)
      for (let i = 0; i < wakeCount; i++) {
        const dx = s.keys.left ? 1 : s.keys.right ? -1 : (Math.random() - 0.5) * 0.5
        const dy = s.keys.up ? 1 : s.keys.down ? -1 : 0.5
        s.particles.push({
          x: s.shipVisualX + SHIP_SIZE / 2 + (Math.random() - 0.5) * 6,
          y: s.shipVisualY + SHIP_SIZE / 2 + (Math.random() - 0.5) * 6,
          vx: dx * (20 + Math.random() * 15),
          vy: dy * (20 + Math.random() * 15),
          life: 0.4 + Math.random() * 0.3,
          maxLife: 0.7,
          color: '#ffffff',
          size: 1.5 + Math.random() * 1.5,
        })
      }
    }

    // --- UPDATE PARTICLES ---
    s.particles = s.particles.filter(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 60 * dt // gravity for splash particles
      p.life -= dt
      return p.life > 0
    })

    // --- OBSTACLE MOVEMENT ---
    s.obstacles.forEach(obs => {
      if (obs.type === OBS_WHIRLPOOL) {
        obs.spinAngle += dt * 3
        return
      }
      obs.x += obs.speed * obs.direction * dt
      // Wrap around
      if (obs.direction > 0 && obs.x > CANVAS_WIDTH + obs.w) {
        obs.x = -obs.w
      } else if (obs.direction < 0 && obs.x < -obs.w) {
        obs.x = CANVAS_WIDTH + obs.w
      }
      // Serpent sine wave
      if (obs.type === OBS_SERPENT) {
        obs.y = obs.baseY + Math.sin(s.elapsed * 3 + obs.sineOffset) * 6
      }
    })

    // --- WAVE SCROLL ---
    s.waveScroll = (s.waveScroll + dt * 15) % 100

    // Clouds
    s.clouds.forEach(c => {
      c.x -= c.speed * dt
      if (c.x + c.w < 0) c.x = CANVAS_WIDTH + 20
    })

    // --- COLLISION DETECTION ---
    if (s.invTimer <= 0 && !SAFE_LANES.includes(s.shipLane)) {
      const shipX = s.shipVisualX + 4
      const shipY = s.shipVisualY + 4
      const shipW = SHIP_SIZE - 8
      const shipH = SHIP_SIZE - 8

      for (const obs of s.obstacles) {
        const obsX = obs.type === OBS_WHIRLPOOL ? obs.x : obs.x
        if (
          shipX < obsX + obs.w - 4 &&
          shipX + shipW > obsX + 4 &&
          shipY < obs.y + obs.h - 4 &&
          shipY + shipH > obs.y + 4
        ) {
          // HIT - spawn water splash particles
          for (let pi = 0; pi < 10; pi++) {
            const angle = Math.random() * Math.PI * 2
            const spd = 40 + Math.random() * 80
            s.particles.push({
              x: s.shipVisualX + SHIP_SIZE / 2,
              y: s.shipVisualY + SHIP_SIZE / 2,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd - 60,
              life: 0.5 + Math.random() * 0.4,
              maxLife: 0.9,
              color: '#4488ff',
              size: 2 + Math.random() * 3,
            })
          }
          s.lives--
          s.invTimer = INVINCIBILITY_DURATION
          s.shakeTimer = 0.4
          s.shakeIntensity = 8

          if (s.lives <= 0) {
            s.finished = true
            endGame()
            return
          }

          // Reset to start of current crossing section
          if (s.shipLane >= 1 && s.shipLane <= 5) {
            s.shipLane = 6 // back to middle dock
          } else {
            s.shipLane = 12 // back to bottom dock
          }
          break
        }
      }
    }

    // --- CHECK CROSSING COMPLETE ---
    if (s.shipLane === 0) {
      if (s.crossing >= TOTAL_CROSSINGS) {
        // Final crossing celebration confetti
        for (let ci = 0; ci < 20; ci++) {
          s.particles.push({
            x: Math.random() * CANVAS_WIDTH,
            y: -5 - Math.random() * 20,
            vx: (Math.random() - 0.5) * 60,
            vy: 40 + Math.random() * 80,
            life: 1.2 + Math.random() * 0.8,
            maxLife: 2.0,
            color: '#ffd700',
            size: 2 + Math.random() * 3,
          })
        }
        s.finished = true
        s.flashTimer = 0.5
        s.flashColor = COLORS.GOLD
        endGame()
        return
      }
      // Next crossing - spawn gold confetti
      for (let ci = 0; ci < 20; ci++) {
        s.particles.push({
          x: Math.random() * CANVAS_WIDTH,
          y: -5 - Math.random() * 20,
          vx: (Math.random() - 0.5) * 60,
          vy: 40 + Math.random() * 80,
          life: 1.2 + Math.random() * 0.8,
          maxLife: 2.0,
          color: '#ffd700',
          size: 2 + Math.random() * 3,
        })
      }
      s.crossing++
      s.shipLane = 12
      s.shipVisualY = 12 * LANE_HEIGHT + (LANE_HEIGHT - SHIP_SIZE) / 2
      s.obstacles = generateAllObstacles(s.crossing, s.diffCfg)
      s.flashTimer = 0.3
      s.flashColor = COLORS.GREEN
    }

    // ============ RENDER ============
    const shakeX = s.shakeTimer > 0 ? (Math.random() - 0.5) * s.shakeIntensity : 0
    const shakeY = s.shakeTimer > 0 ? (Math.random() - 0.5) * s.shakeIntensity : 0

    ctx.save()
    ctx.translate(shakeX, shakeY)

    // --- OCEAN BACKGROUND ---
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    oceanGrad.addColorStop(0, '#0a1e3d')
    oceanGrad.addColorStop(0.3, '#0c2244')
    oceanGrad.addColorStop(0.7, '#0e2850')
    oceanGrad.addColorStop(1, '#081830')
    ctx.fillStyle = oceanGrad
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // --- LANE COLOR VARIATIONS (danger lanes slightly darker) ---
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (SAFE_LANES.includes(lane)) continue
      const laneY = lane * LANE_HEIGHT
      const shade = (lane % 2 === 0) ? 'rgba(0,0,0,0.08)' : 'rgba(0,10,30,0.1)'
      ctx.fillStyle = shade
      ctx.fillRect(0, laneY, CANVAS_WIDTH, LANE_HEIGHT)
    }

    // --- WAVE LINES on danger lanes ---
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (let lane = 1; lane <= 11; lane++) {
      if (SAFE_LANES.includes(lane)) continue
      const laneY = lane * LANE_HEIGHT + LANE_HEIGHT / 2
      for (let wx = -20; wx < CANVAS_WIDTH + 20; wx += 40) {
        const offset = s.waveScroll + lane * 7
        ctx.beginPath()
        ctx.moveTo(wx - offset % 40, laneY)
        ctx.quadraticCurveTo(wx + 10 - offset % 40, laneY - 4, wx + 20 - offset % 40, laneY)
        ctx.quadraticCurveTo(wx + 30 - offset % 40, laneY + 4, wx + 40 - offset % 40, laneY)
        ctx.stroke()
      }
    }

    // --- SAFE ZONES ---
    // Top safe zone (destination island - sandy/gold)
    drawIsland(ctx, 0, LANE_HEIGHT, s.elapsed)

    // Middle safe zone (wooden dock)
    drawDock(ctx, 6 * LANE_HEIGHT, LANE_HEIGHT, '#5a3a1a')

    // Bottom safe zone (starting dock)
    drawDock(ctx, 12 * LANE_HEIGHT, LANE_HEIGHT, '#4a2a10')

    // --- CLOUDS (parallax at top) ---
    ctx.fillStyle = 'rgba(200, 220, 255, 0.12)'
    s.clouds.forEach(c => {
      ctx.beginPath()
      ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(c.x + c.w * 0.3, c.y + c.h * 0.4, c.w * 0.3, c.h * 0.4, 0, 0, Math.PI * 2)
      ctx.fill()
    })

    // --- OBSTACLES ---
    s.obstacles.forEach(obs => {
      if (obs.x + obs.w < -10 || obs.x > CANVAS_WIDTH + 10) return
      drawObstacle(ctx, obs, s.elapsed)
    })

    // --- PLAYER SHIP ---
    const showShip = s.invTimer <= 0 || Math.floor(s.elapsed * 10) % 2 === 0
    if (showShip) {
      drawPlayerShip(ctx, s.shipVisualX, s.shipVisualY, SHIP_SIZE, s.shipDir, s.elapsed, s.shipTilt)
    }

    // --- DRAW PARTICLES ---
    s.particles.forEach(p => {
      const alpha = Math.max(0, p.life / p.maxLife)
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // Flash effect
    if (s.flashTimer > 0) {
      ctx.fillStyle = s.flashColor
      ctx.globalAlpha = s.flashTimer * 0.4
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.globalAlpha = 1
    }

    // Damage overlay
    if (s.invTimer > 0) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.06)'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    ctx.restore()

    // === HUD (outside shake transform) ===
    // Label
    drawPixelText(ctx, 'THE PAYMENT LINE', 10, 8, 8, '#6ca6d9')

    // Crossing progress
    drawPixelText(ctx, `CROSSING ${s.crossing}/${TOTAL_CROSSINGS}`, CANVAS_WIDTH / 2, 8, 8, COLORS.GOLD, 'center')

    // Lives (small ship icons)
    for (let i = 0; i < s.lives; i++) {
      drawMiniShip(ctx, CANVAS_WIDTH - 30 - i * 22, 6, 14)
    }

    // Timer
    const timeStr = `${Math.floor(s.elapsed)}s`
    drawPixelText(ctx, timeStr, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 18, 8, '#8899aa', 'right')

    // Controls hint (subtle, bottom center)
    drawPixelText(ctx, 'ARROWS / WASD TO NAVIGATE', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 18, 7, 'rgba(255,255,255,0.25)', 'center')

  }, [endGame]), isPlaying && !ended)

  return (
    <div className="pirate-ship-game">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="mg-canvas"
      />
      <ControlsOverlay controls={[
        { keys: ['\u2190', '\u2192', '\u2191', '\u2193'], label: 'NAVIGATE' },
        { keys: ['W','A','S','D'], label: 'ALT' },
      ]} />
    </div>
  )
}

// ========== DRAWING FUNCTIONS ==========

function drawIsland(ctx, y, h, time) {
  // Sandy base
  const grad = ctx.createLinearGradient(0, y, 0, y + h)
  grad.addColorStop(0, '#c4a44a')
  grad.addColorStop(0.6, '#a88830')
  grad.addColorStop(1, '#8a6e20')
  ctx.fillStyle = grad
  ctx.fillRect(0, y, CANVAS_WIDTH, h)

  // Beach texture dots
  ctx.fillStyle = 'rgba(255, 220, 120, 0.3)'
  for (let i = 0; i < 20; i++) {
    const bx = (i * 43 + 10) % CANVAS_WIDTH
    ctx.fillRect(bx, y + 5 + (i % 3) * 8, 3, 2)
  }

  // Palm trees
  for (let i = 0; i < 5; i++) {
    const px = 80 + i * 170
    const sway = Math.sin(time * 1.5 + i) * 3
    // Trunk
    ctx.fillStyle = '#5a3a1a'
    ctx.fillRect(px, y + 2, 4, h - 4)
    // Fronds
    ctx.fillStyle = '#2a7a2a'
    for (let f = 0; f < 3; f++) {
      const angle = (f - 1) * 0.6 + sway * 0.05
      ctx.save()
      ctx.translate(px + 2, y + 2)
      ctx.rotate(angle)
      ctx.fillRect(-2, -12, 4, 12)
      ctx.beginPath()
      ctx.ellipse(0, -14, 10, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // Gold treasure sparkle
  const sparkle = Math.sin(time * 4) * 0.5 + 0.5
  ctx.fillStyle = `rgba(255, 215, 0, ${0.3 + sparkle * 0.4})`
  ctx.beginPath()
  ctx.arc(CANVAS_WIDTH / 2, y + h / 2, 4, 0, Math.PI * 2)
  ctx.fill()

  // Label
  drawPixelText(ctx, 'LAND OF SALES GROWTH', CANVAS_WIDTH / 2, y + h / 2 - 4, 7, 'rgba(255,255,255,0.5)', 'center')
}

function drawDock(ctx, y, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(0, y, CANVAS_WIDTH, h)

  // Plank lines
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 1
  for (let i = 0; i < CANVAS_WIDTH; i += 30) {
    ctx.beginPath()
    ctx.moveTo(i, y)
    ctx.lineTo(i, y + h)
    ctx.stroke()
  }
  // Horizontal plank line
  ctx.beginPath()
  ctx.moveTo(0, y + h / 2)
  ctx.lineTo(CANVAS_WIDTH, y + h / 2)
  ctx.stroke()

  // Dock posts
  ctx.fillStyle = '#3a2010'
  for (let i = 0; i < CANVAS_WIDTH; i += 100) {
    ctx.fillRect(i + 45, y + 2, 10, h - 4)
  }
}

function drawObstacle(ctx, obs, time) {
  const { type, x, y, w, h } = obs

  if (type === OBS_CHARGEBACK) {
    // Large dark red/black pirate ship
    // Hull
    ctx.fillStyle = '#4a0a0a'
    ctx.beginPath()
    ctx.moveTo(x, y + h * 0.4)
    ctx.lineTo(x + 6, y + h)
    ctx.lineTo(x + w - 6, y + h)
    ctx.lineTo(x + w, y + h * 0.4)
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.25, x, y + h * 0.4)
    ctx.fill()
    // Deck
    ctx.fillStyle = '#2a0505'
    ctx.fillRect(x + 8, y + h * 0.35, w - 16, h * 0.15)
    // Mast
    ctx.fillStyle = '#1a0a00'
    ctx.fillRect(x + w / 2 - 2, y + 2, 4, h * 0.6)
    // Skull flag
    ctx.fillStyle = '#111'
    ctx.fillRect(x + w / 2 + 2, y + 3, 14, 10)
    // Skull
    ctx.fillStyle = '#ddd'
    ctx.fillRect(x + w / 2 + 5, y + 5, 8, 6)
    ctx.fillStyle = '#111'
    ctx.fillRect(x + w / 2 + 6, y + 6, 2, 2)
    ctx.fillRect(x + w / 2 + 10, y + 6, 2, 2)
    // Pirate flag on mast
    ctx.fillStyle = '#1a0a00'
    ctx.fillRect(x + w / 2 - 1, y - 6, 2, 10)
    ctx.fillStyle = '#cc2222'
    ctx.beginPath()
    ctx.moveTo(x + w / 2 + 1, y - 6)
    ctx.lineTo(x + w / 2 + 12, y - 2)
    ctx.lineTo(x + w / 2 + 1, y + 2)
    ctx.closePath()
    ctx.fill()

    // Red glow
    ctx.fillStyle = `rgba(180, 0, 0, ${0.15 + Math.sin(time * 3) * 0.08})`
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4)

  } else if (type === OBS_PCI) {
    // Medium blue/white patrol boat
    // Hull
    ctx.fillStyle = '#1a3a6a'
    ctx.beginPath()
    ctx.moveTo(x, y + h * 0.5)
    ctx.lineTo(x + 4, y + h)
    ctx.lineTo(x + w - 4, y + h)
    ctx.lineTo(x + w, y + h * 0.5)
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.3, x, y + h * 0.5)
    ctx.fill()
    // Cabin
    ctx.fillStyle = '#eee'
    ctx.fillRect(x + w * 0.3, y + h * 0.2, w * 0.4, h * 0.35)
    // Window
    ctx.fillStyle = '#3399cc'
    ctx.fillRect(x + w * 0.38, y + h * 0.28, w * 0.1, h * 0.15)
    ctx.fillRect(x + w * 0.52, y + h * 0.28, w * 0.1, h * 0.15)
    // Blue light flash
    const flash = Math.sin(time * 6) > 0.5
    if (flash) {
      ctx.fillStyle = 'rgba(50, 100, 255, 0.3)'
      ctx.beginPath()
      ctx.arc(x + w * 0.5, y + h * 0.15, 4, 0, Math.PI * 2)
      ctx.fill()
    }

  } else if (type === OBS_SERPENT) {
    // Small green sea serpent
    const segments = 5
    const segW = w / segments
    ctx.fillStyle = '#1a6a2a'
    for (let i = 0; i < segments; i++) {
      const sy = y + h / 2 + Math.sin(time * 4 + i * 0.8 + obs.sineOffset) * 4
      const sw = segW * (i === 0 || i === segments - 1 ? 0.7 : 1)
      const sh = h * (i === 0 ? 0.6 : i === segments - 1 ? 0.4 : 0.8)
      ctx.fillStyle = i === 0 ? '#2a8a3a' : '#1a6a2a'
      ctx.beginPath()
      ctx.ellipse(x + i * segW + segW / 2, sy, sw / 2, sh / 2, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // Eyes on head
    ctx.fillStyle = '#ff0'
    ctx.fillRect(x + 2, y + h / 2 - 4 + Math.sin(time * 4 + obs.sineOffset) * 4, 3, 3)
    ctx.fillRect(x + 6, y + h / 2 - 4 + Math.sin(time * 4 + obs.sineOffset) * 4, 3, 3)
    // Pupil
    ctx.fillStyle = '#000'
    ctx.fillRect(x + 3, y + h / 2 - 3 + Math.sin(time * 4 + obs.sineOffset) * 4, 1, 1)
    ctx.fillRect(x + 7, y + h / 2 - 3 + Math.sin(time * 4 + obs.sineOffset) * 4, 1, 1)

  } else if (type === OBS_WHIRLPOOL) {
    // Spinning whirlpool
    ctx.save()
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate(obs.spinAngle)
    // Concentric rings
    for (let r = 3; r >= 0; r--) {
      const radius = (r + 1) * (w / 8)
      const alpha = 0.15 + r * 0.1
      ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    // Spiral arms
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.3)'
    ctx.lineWidth = 2
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath()
      for (let t = 0; t < 12; t++) {
        const angle = arm * (Math.PI * 2 / 3) + t * 0.3
        const r = t * 1.2
        const px = Math.cos(angle) * r
        const py = Math.sin(angle) * r
        if (t === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
    ctx.restore()
    // Dark center
    ctx.fillStyle = 'rgba(0, 10, 40, 0.6)'
    ctx.beginPath()
    ctx.arc(x + w / 2, y + h / 2, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPlayerShip(ctx, x, y, size, dir, time, tilt = 0) {
  ctx.save()
  ctx.translate(x + size / 2, y + size / 2)

  // Rotate based on direction: 0=up, 1=right, 2=down, 3=left
  const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
  ctx.rotate(angles[dir] + tilt)

  const s = size / 2

  // Hull (brown wooden ship)
  ctx.fillStyle = '#6a4420'
  ctx.beginPath()
  ctx.moveTo(-s * 0.5, s * 0.6)
  ctx.lineTo(-s * 0.3, -s * 0.4)
  ctx.lineTo(0, -s * 0.8)
  ctx.lineTo(s * 0.3, -s * 0.4)
  ctx.lineTo(s * 0.5, s * 0.6)
  ctx.quadraticCurveTo(0, s * 0.8, -s * 0.5, s * 0.6)
  ctx.fill()

  // Hull detail
  ctx.fillStyle = '#5a3418'
  ctx.fillRect(-s * 0.35, -s * 0.1, s * 0.7, s * 0.12)

  // Mast
  ctx.fillStyle = '#3a2010'
  ctx.fillRect(-1, -s * 0.5, 2, s * 0.9)

  // Gold sail
  const sailPuff = Math.sin(time * 3) * 1.5
  ctx.fillStyle = '#ffd700'
  ctx.beginPath()
  ctx.moveTo(-1, -s * 0.5)
  ctx.quadraticCurveTo(-s * 0.5 - sailPuff, -s * 0.1, -1, s * 0.2)
  ctx.fill()

  // Sail highlight
  ctx.fillStyle = 'rgba(255, 240, 180, 0.3)'
  ctx.beginPath()
  ctx.moveTo(-1, -s * 0.45)
  ctx.quadraticCurveTo(-s * 0.35 - sailPuff * 0.6, -s * 0.15, -1, s * 0.05)
  ctx.fill()

  // Small wake lines at stern
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  const wakeY = s * 0.7
  ctx.beginPath()
  ctx.moveTo(-s * 0.3, wakeY)
  ctx.quadraticCurveTo(0, wakeY + 3 + Math.sin(time * 5) * 1.5, s * 0.3, wakeY)
  ctx.stroke()

  ctx.restore()
}

function drawMiniShip(ctx, x, y, size) {
  ctx.fillStyle = '#6a4420'
  ctx.beginPath()
  ctx.moveTo(x, y + size)
  ctx.lineTo(x + size * 0.3, y)
  ctx.lineTo(x + size * 0.7, y)
  ctx.lineTo(x + size, y + size)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffd700'
  ctx.fillRect(x + size * 0.35, y + 2, size * 0.3, size * 0.5)
}

export default PirateShipGame
