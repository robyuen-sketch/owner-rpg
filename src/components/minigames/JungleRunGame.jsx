import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from './gameConstants'
import { clearCanvas, drawPixelText } from './canvasUtils'
import './JungleRunGame.css'

// Game constants
const GROUND_Y = CANVAS_HEIGHT - 60
const ANA_X = 120           // Ana's fixed horizontal position
const ANA_WIDTH = 32
const ANA_HEIGHT = 48
const GRAVITY = 1800
const JUMP_VELOCITY = -620
const COURSE_LENGTH = 6000  // total distance to escape
const BASE_SPEED = 200      // pixels/sec at normal speed
const SLOWDOWN_SPEED = 60   // speed when hit
const SLOWDOWN_DURATION = 1.0 // seconds of slowdown
const CULLEN_X = 30         // Cullen chase position

// Obstacle templates
const OBSTACLE_TYPES = [
  { type: 'rock', width: 30, height: 28, color: '#555', groundLevel: true },
  { type: 'log', width: 50, height: 20, color: '#5a3a1a', groundLevel: true },
  { type: 'root', width: 35, height: 22, color: '#3d2b1f', groundLevel: true },
  { type: 'vine', width: 12, height: 50, color: '#2d5a2d', groundLevel: false },
  { type: 'puddle', width: 45, height: 10, color: '#1a3a2a', groundLevel: true },
]

function spawnObstacle(distance, difficulty) {
  const template = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)]
  return {
    ...template,
    x: CANVAS_WIDTH + 50,
    y: template.groundLevel
      ? GROUND_Y - template.height
      : GROUND_Y - 60 - Math.random() * 30, // vines hang from above
    distance,
    hit: false,
  }
}

function initGameState(difficulty) {
  const diffMult = Math.min(difficulty, 4)
  // More obstacles at higher difficulty
  const obstacleGap = Math.max(180, 320 - diffMult * 35)

  // Pre-generate obstacles along the course
  const obstacles = []
  let d = 400
  while (d < COURSE_LENGTH - 200) {
    obstacles.push(spawnObstacle(d, diffMult))
    d += obstacleGap + Math.random() * 100
  }

  return {
    distance: 0,
    speed: BASE_SPEED,
    slowTimer: 0,
    ana: {
      y: GROUND_Y - ANA_HEIGHT,
      vy: 0,
      jumping: false,
      grounded: true,
    },
    obstacles,
    cullenOffset: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    hitCount: 0,
    elapsed: 0,
    finished: false,
    // Parallax scroll offsets
    bgFar: 0,
    bgMid: 0,
    bgNear: 0,
    // Visual trees
    trees: generateTrees(),
    groundTiles: generateGround(),
    difficulty: diffMult,
  }
}

function generateTrees() {
  const trees = []
  for (let i = 0; i < 25; i++) {
    trees.push({
      x: i * 120 + Math.random() * 60,
      height: 80 + Math.random() * 120,
      width: 20 + Math.random() * 30,
      layer: Math.random() < 0.4 ? 'far' : Math.random() < 0.7 ? 'mid' : 'near',
      shade: Math.random(),
    })
  }
  return trees
}

function generateGround() {
  const tiles = []
  for (let i = 0; i < 60; i++) {
    tiles.push({
      x: i * 40,
      hasGrass: Math.random() > 0.3,
      grassHeight: 3 + Math.random() * 6,
    })
  }
  return tiles
}

function JungleRunGame({ difficulty, onEnd, isPlaying }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(initGameState(difficulty))
  const [ended, setEnded] = useState(false)

  // Input handling: jump on space, up arrow, or click/tap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault()
        const ana = stateRef.current.ana
        if (ana.grounded) {
          ana.vy = JUMP_VELOCITY
          ana.jumping = true
          ana.grounded = false
        }
      }
    }
    const handleClick = () => {
      const ana = stateRef.current.ana
      if (ana.grounded) {
        ana.vy = JUMP_VELOCITY
        ana.jumping = true
        ana.grounded = false
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('touchstart', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('touchstart', handleClick)
    }
  }, [])

  const endGame = useCallback(() => {
    if (ended) return
    setEnded(true)
    const s = stateRef.current
    // Score: faster = more points. Perfect run ~30s = ~1000pts, slowest ~60s = ~200pts
    const maxTime = 60
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

    // Update speed
    if (s.slowTimer > 0) {
      s.slowTimer -= dt
      s.speed = SLOWDOWN_SPEED
    } else {
      // Ramp up speed slightly over time
      s.speed = BASE_SPEED + s.distance * 0.01
    }

    // Update distance
    s.distance += s.speed * dt

    // Check if finished
    if (s.distance >= COURSE_LENGTH) {
      s.finished = true
      endGame()
      return
    }

    // Update Ana physics (jump/gravity)
    const ana = s.ana
    if (!ana.grounded) {
      ana.vy += GRAVITY * dt
      ana.y += ana.vy * dt

      if (ana.y >= GROUND_Y - ANA_HEIGHT) {
        ana.y = GROUND_Y - ANA_HEIGHT
        ana.vy = 0
        ana.grounded = true
        ana.jumping = false
      }
    }

    // Update screen shake
    if (s.shakeTimer > 0) {
      s.shakeTimer -= dt
      s.shakeIntensity *= 0.95
    }

    // Update parallax
    s.bgFar = (s.bgFar + s.speed * 0.1 * dt) % 800
    s.bgMid = (s.bgMid + s.speed * 0.3 * dt) % 800
    s.bgNear = (s.bgNear + s.speed * 0.6 * dt) % 800

    // Cullen chase animation - they get closer when Ana is slow
    const normalizedSpeed = s.speed / BASE_SPEED
    s.cullenOffset += (1 - normalizedSpeed) * 30 * dt
    s.cullenOffset = Math.max(0, Math.min(s.cullenOffset, 60))
    if (normalizedSpeed >= 0.9) {
      s.cullenOffset = Math.max(0, s.cullenOffset - 20 * dt)
    }

    // Obstacle collision detection
    s.obstacles.forEach(obs => {
      if (obs.hit) return

      // Convert obstacle distance to screen position
      const screenX = ANA_X + (obs.distance - s.distance)
      obs.x = screenX

      // Check collision
      if (
        screenX < ANA_X + ANA_WIDTH - 4 &&
        screenX + obs.width > ANA_X + 4 &&
        ana.y + ANA_HEIGHT > obs.y + 4 &&
        ana.y < obs.y + obs.height - 4
      ) {
        obs.hit = true
        s.hitCount++
        s.slowTimer = SLOWDOWN_DURATION
        s.shakeTimer = 0.3
        s.shakeIntensity = 6
      }
    })

    // === RENDER ===
    const shakeX = s.shakeTimer > 0 ? (Math.random() - 0.5) * s.shakeIntensity : 0
    const shakeY = s.shakeTimer > 0 ? (Math.random() - 0.5) * s.shakeIntensity : 0

    ctx.save()
    ctx.translate(shakeX, shakeY)

    // Sky gradient (dark forest)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
    skyGrad.addColorStop(0, '#0a0f0a')
    skyGrad.addColorStop(0.4, '#0d1a0d')
    skyGrad.addColorStop(1, '#1a2a1a')
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y)

    // Far background trees (darkest, slowest parallax)
    s.trees.forEach(tree => {
      if (tree.layer !== 'far') return
      const tx = ((tree.x - s.bgFar) % (CANVAS_WIDTH + 200)) - 100
      ctx.fillStyle = `rgba(10, 30, 10, ${0.6 + tree.shade * 0.3})`
      // Trunk
      ctx.fillRect(tx + tree.width * 0.3, GROUND_Y - tree.height * 0.6, tree.width * 0.4, tree.height * 0.6)
      // Canopy
      ctx.beginPath()
      ctx.arc(tx + tree.width * 0.5, GROUND_Y - tree.height * 0.6, tree.width * 0.8, Math.PI, 0)
      ctx.fill()
    })

    // Mid trees
    s.trees.forEach(tree => {
      if (tree.layer !== 'mid') return
      const tx = ((tree.x - s.bgMid) % (CANVAS_WIDTH + 200)) - 100
      ctx.fillStyle = `rgba(15, 40, 15, ${0.5 + tree.shade * 0.4})`
      ctx.fillRect(tx + tree.width * 0.3, GROUND_Y - tree.height * 0.5, tree.width * 0.35, tree.height * 0.5)
      ctx.beginPath()
      ctx.arc(tx + tree.width * 0.5, GROUND_Y - tree.height * 0.5, tree.width * 0.7, Math.PI, 0)
      ctx.fill()
    })

    // Near trees (most visible)
    s.trees.forEach(tree => {
      if (tree.layer !== 'near') return
      const tx = ((tree.x - s.bgNear) % (CANVAS_WIDTH + 200)) - 100
      ctx.fillStyle = `rgba(20, 50, 20, ${0.4 + tree.shade * 0.5})`
      ctx.fillRect(tx + tree.width * 0.25, GROUND_Y - tree.height * 0.4, tree.width * 0.3, tree.height * 0.4)
      ctx.beginPath()
      ctx.arc(tx + tree.width * 0.4, GROUND_Y - tree.height * 0.4, tree.width * 0.6, Math.PI, 0)
      ctx.fill()
    })

    // Fog / atmosphere
    const fogGrad = ctx.createLinearGradient(0, GROUND_Y - 80, 0, GROUND_Y)
    fogGrad.addColorStop(0, 'rgba(20, 40, 20, 0)')
    fogGrad.addColorStop(1, 'rgba(20, 40, 20, 0.4)')
    ctx.fillStyle = fogGrad
    ctx.fillRect(0, GROUND_Y - 80, CANVAS_WIDTH, 80)

    // Ground
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT)
    groundGrad.addColorStop(0, '#2a1a0a')
    groundGrad.addColorStop(0.3, '#1a1008')
    groundGrad.addColorStop(1, '#0a0804')
    ctx.fillStyle = groundGrad
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y)

    // Ground line
    ctx.fillStyle = '#3a2a1a'
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 3)

    // Ground grass tufts
    s.groundTiles.forEach(tile => {
      if (!tile.hasGrass) return
      const gx = ((tile.x - s.bgNear) % (CANVAS_WIDTH + 80)) - 40
      ctx.fillStyle = '#1a3a1a'
      ctx.fillRect(gx, GROUND_Y - tile.grassHeight, 3, tile.grassHeight)
      ctx.fillRect(gx + 5, GROUND_Y - tile.grassHeight * 0.7, 2, tile.grassHeight * 0.7)
    })

    // Draw obstacles
    s.obstacles.forEach(obs => {
      const screenX = ANA_X + (obs.distance - s.distance)
      if (screenX < -60 || screenX > CANVAS_WIDTH + 60) return

      ctx.globalAlpha = obs.hit ? 0.3 : 1.0

      if (obs.type === 'rock') {
        // Rock: triangle-ish shape
        ctx.fillStyle = obs.color
        ctx.beginPath()
        ctx.moveTo(screenX, obs.y + obs.height)
        ctx.lineTo(screenX + obs.width / 2, obs.y)
        ctx.lineTo(screenX + obs.width, obs.y + obs.height)
        ctx.closePath()
        ctx.fill()
        // Highlight
        ctx.fillStyle = '#777'
        ctx.beginPath()
        ctx.moveTo(screenX + obs.width * 0.3, obs.y + obs.height * 0.3)
        ctx.lineTo(screenX + obs.width / 2, obs.y + 2)
        ctx.lineTo(screenX + obs.width * 0.5, obs.y + obs.height * 0.4)
        ctx.closePath()
        ctx.fill()
      } else if (obs.type === 'log') {
        // Fallen log
        ctx.fillStyle = obs.color
        ctx.fillRect(screenX, obs.y, obs.width, obs.height)
        // Wood grain
        ctx.fillStyle = '#4a2a10'
        ctx.fillRect(screenX + 5, obs.y + 4, obs.width - 10, 3)
        ctx.fillRect(screenX + 8, obs.y + 12, obs.width - 16, 2)
        // End circles
        ctx.fillStyle = '#6a4a2a'
        ctx.beginPath()
        ctx.ellipse(screenX, obs.y + obs.height / 2, obs.height / 2, obs.height / 2, 0, 0, Math.PI * 2)
        ctx.fill()
      } else if (obs.type === 'root') {
        // Gnarled root
        ctx.fillStyle = obs.color
        ctx.beginPath()
        ctx.moveTo(screenX, obs.y + obs.height)
        ctx.quadraticCurveTo(screenX + obs.width * 0.3, obs.y, screenX + obs.width * 0.6, obs.y + obs.height * 0.3)
        ctx.quadraticCurveTo(screenX + obs.width * 0.8, obs.y + obs.height * 0.1, screenX + obs.width, obs.y + obs.height)
        ctx.closePath()
        ctx.fill()
      } else if (obs.type === 'vine') {
        // Hanging vine
        ctx.fillStyle = obs.color
        ctx.fillRect(screenX, 0, obs.width, obs.y + obs.height)
        // Leaves
        ctx.fillStyle = '#3a6a3a'
        for (let i = 0; i < 4; i++) {
          const ly = obs.y + i * 12
          ctx.beginPath()
          ctx.ellipse(screenX + obs.width / 2 + (i % 2 ? 8 : -8), ly, 6, 4, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (obs.type === 'puddle') {
        // Muddy puddle
        ctx.fillStyle = obs.color
        ctx.beginPath()
        ctx.ellipse(screenX + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2)
        ctx.fill()
        // Sheen
        ctx.fillStyle = 'rgba(100, 180, 100, 0.2)'
        ctx.beginPath()
        ctx.ellipse(screenX + obs.width / 2 - 5, obs.y + obs.height / 2 - 2, obs.width / 4, obs.height / 4, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1.0
    })

    // Draw Cullens (chasing vampires behind Ana)
    const cullenBaseX = CULLEN_X + s.cullenOffset
    drawCullen(ctx, cullenBaseX, GROUND_Y - 50, '#8b0000', s.elapsed)
    drawCullen(ctx, cullenBaseX - 25, GROUND_Y - 46, '#4a0020', s.elapsed + 0.3)
    drawCullen(ctx, cullenBaseX - 45, GROUND_Y - 52, '#2a0030', s.elapsed + 0.7)

    // Draw Ana
    drawAnaRunner(ctx, ANA_X, ana.y, ANA_WIDTH, ANA_HEIGHT, s.elapsed, s.slowTimer > 0)

    // Speed lines when going fast
    if (s.speed > BASE_SPEED * 0.9) {
      ctx.globalAlpha = 0.15
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        const ly = 50 + i * 80 + Math.sin(s.elapsed * 3 + i) * 20
        const lx = 200 + Math.random() * 400
        ctx.beginPath()
        ctx.moveTo(lx, ly)
        ctx.lineTo(lx - 40 - Math.random() * 30, ly)
        ctx.stroke()
      }
      ctx.globalAlpha = 1.0
    }

    // Slowdown visual effect
    if (s.slowTimer > 0) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.08)'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    ctx.restore()

    // HUD (outside shake transform)
    // Progress bar
    const progress = Math.min(1, s.distance / COURSE_LENGTH)
    const barY = 8
    const barH = 8
    const barPad = 80
    ctx.fillStyle = '#222'
    ctx.fillRect(barPad, barY, CANVAS_WIDTH - barPad * 2, barH)
    const barGrad = ctx.createLinearGradient(barPad, 0, CANVAS_WIDTH - barPad, 0)
    barGrad.addColorStop(0, '#ff3333')
    barGrad.addColorStop(0.5, COLORS.GOLD)
    barGrad.addColorStop(1, COLORS.GREEN)
    ctx.fillStyle = barGrad
    ctx.fillRect(barPad, barY, (CANVAS_WIDTH - barPad * 2) * progress, barH)
    // Border
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.strokeRect(barPad, barY, CANVAS_WIDTH - barPad * 2, barH)

    // Labels
    drawPixelText(ctx, 'RUN!', 10, 6, 8, COLORS.RED)
    drawPixelText(ctx, 'SAFE', CANVAS_WIDTH - 10, 6, 8, COLORS.GREEN, 'right')

    // Ana marker on progress bar
    const markerX = barPad + (CANVAS_WIDTH - barPad * 2) * progress
    ctx.fillStyle = COLORS.GOLD
    ctx.beginPath()
    ctx.arc(markerX, barY + barH / 2, 5, 0, Math.PI * 2)
    ctx.fill()

    // Speed indicator
    const speedPct = Math.floor((s.speed / (BASE_SPEED * 1.5)) * 100)
    const speedColor = s.slowTimer > 0 ? COLORS.RED : COLORS.GREEN
    drawPixelText(ctx, `SPEED: ${Math.min(100, speedPct)}%`, 10, CANVAS_HEIGHT - 20, 8, speedColor)

    // Hit counter
    if (s.hitCount > 0) {
      drawPixelText(ctx, `HITS: ${s.hitCount}`, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 20, 8, COLORS.RED, 'right')
    }

  }, [endGame]), isPlaying && !ended)

  return (
    <div className="jungle-run-game">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="mg-canvas"
      />
      <div className="mg-controls-hint">
        SPACE / TAP TO JUMP
      </div>
    </div>
  )
}

// Draw Ana as a running pixel character
function drawAnaRunner(ctx, x, y, w, h, time, isSlowed) {
  const runCycle = Math.floor(time * 8) % 4
  const bodyColor = isSlowed ? '#cc9900' : COLORS.GOLD
  const skinColor = '#f5c6a0'

  // Head
  ctx.fillStyle = skinColor
  ctx.fillRect(x + 8, y, w - 16, 14)

  // Hair
  ctx.fillStyle = '#3a1a0a'
  ctx.fillRect(x + 6, y - 2, w - 12, 8)
  ctx.fillRect(x + 4, y + 4, 4, 12) // side hair

  // Eyes
  ctx.fillStyle = '#222'
  ctx.fillRect(x + 12, y + 6, 3, 3)
  ctx.fillRect(x + 19, y + 6, 3, 3)

  // Body / dress
  ctx.fillStyle = bodyColor
  ctx.fillRect(x + 6, y + 14, w - 12, 18)

  // Apron
  ctx.fillStyle = '#fff'
  ctx.fillRect(x + 10, y + 16, w - 20, 14)

  // Arms (animated)
  ctx.fillStyle = skinColor
  if (runCycle < 2) {
    ctx.fillRect(x + 2, y + 16, 4, 10) // left arm forward
    ctx.fillRect(x + w - 6, y + 20, 4, 10) // right arm back
  } else {
    ctx.fillRect(x + 2, y + 20, 4, 10) // left arm back
    ctx.fillRect(x + w - 6, y + 16, 4, 10) // right arm forward
  }

  // Legs (animated running)
  ctx.fillStyle = skinColor
  const legOffset = runCycle < 2 ? 0 : 4
  ctx.fillRect(x + 10, y + 32, 5, 12 + legOffset) // left leg
  ctx.fillRect(x + w - 15, y + 32, 5, 16 - legOffset) // right leg

  // Shoes
  ctx.fillStyle = '#8b4513'
  ctx.fillRect(x + 8, y + 44 + legOffset, 8, 4) // left shoe
  ctx.fillRect(x + w - 17, y + 48 - legOffset, 8, 4) // right shoe

  // Glow when slowed (damage effect)
  if (isSlowed) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'
    ctx.fillRect(x - 2, y - 4, w + 4, h + 8)
  }
}

// Draw a chasing Cullen vampire
function drawCullen(ctx, x, y, color, time) {
  const bob = Math.sin(time * 6) * 3

  // Cape fluttering
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x + 10, y + 6 + bob)
  ctx.lineTo(x - 8, y + 40 + bob + Math.sin(time * 8) * 4)
  ctx.lineTo(x + 6, y + 35 + bob)
  ctx.lineTo(x + 30, y + 42 + bob + Math.sin(time * 8 + 1) * 3)
  ctx.lineTo(x + 22, y + 6 + bob)
  ctx.closePath()
  ctx.fill()

  // Body
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(x + 6, y + 8 + bob, 20, 28)

  // Head (pale)
  ctx.fillStyle = '#d4d4d4'
  ctx.fillRect(x + 8, y + bob, 16, 12)

  // Eyes (red, glowing)
  ctx.fillStyle = '#ff0000'
  ctx.fillRect(x + 11, y + 4 + bob, 3, 3)
  ctx.fillRect(x + 18, y + 4 + bob, 3, 3)
  // Eye glow
  ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.arc(x + 12, y + 5 + bob, 5, 0, Math.PI * 2)
  ctx.arc(x + 19, y + 5 + bob, 5, 0, Math.PI * 2)
  ctx.fill()

  // Fangs
  ctx.fillStyle = '#fff'
  ctx.fillRect(x + 12, y + 10 + bob, 2, 3)
  ctx.fillRect(x + 18, y + 10 + bob, 2, 3)
}

export default JungleRunGame
