import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from './gameConstants'
import { clearCanvas, drawPixelText } from './canvasUtils'
import ControlsOverlay from './ControlsOverlay'
import './QuickDrawGame.css'

// Western palette
const W = {
  SKY_TOP: '#1a0800',
  SKY_MID: '#4a1800',
  SKY_BOTTOM: '#cc5500',
  HORIZON: '#ff8833',
  MESA1: '#3a1500',
  MESA2: '#4a2000',
  MESA3: '#2a1000',
  GROUND: '#8b6914',
  GROUND_DARK: '#6b4f10',
  GROUND_LINE: '#5a3e0d',
  DUST: '#c8a060',
  PONCHO: '#cc3333',
  PONCHO_DARK: '#991a1a',
  HAT_BROWN: '#5a3e20',
  HAT_DARK: '#3a2810',
  SKIN: '#dba06a',
  SKIN_SHADOW: '#b8844a',
  DUSTER: '#2a2a3a',
  DUSTER_LIGHT: '#3a3a4a',
  BOOT: '#3a2010',
  BELT: '#4a3020',
  FLASH_WHITE: '#ffffee',
  SMOKE: 'rgba(180,170,150,0.6)',
  STAR: '#ffeedd',
  TUMBLEWEED: '#8b7355',
  TUMBLEWEED_DARK: '#6b5335',
}

const TOTAL_ROUNDS = 5
const STANDOFF_DURATION = 1.0
const RESULT_DURATION = 2.5
const FINAL_DURATION = 4.0

// Difficulty: [opponentReactionMs, waitMin, waitMax]
const DIFFICULTY_CONFIG = [
  { opponentMs: 400, waitMin: 2.5, waitMax: 4.0 },
  { opponentMs: 350, waitMin: 2.0, waitMax: 3.5 },
  { opponentMs: 300, waitMin: 1.5, waitMax: 3.0 },
  { opponentMs: 250, waitMin: 1.0, waitMax: 2.5 },
]

function randRange(a, b) {
  return a + Math.random() * (b - a)
}

function initGameState(difficulty) {
  const diffIdx = Math.min(Math.max(difficulty, 1), 4) - 1
  const cfg = DIFFICULTY_CONFIG[diffIdx]

  return {
    phase: 'standoff', // standoff, waiting, draw, result, final
    round: 1,
    playerWins: 0,
    opponentWins: 0,
    phaseTimer: 0,
    waitDuration: randRange(cfg.waitMin, cfg.waitMax),
    drawTime: 0,        // timestamp when DRAW appeared
    playerReacted: false,
    playerReactionMs: 0,
    opponentReactionMs: cfg.opponentMs,
    falseStart: false,
    roundResult: '',     // 'win', 'lose', 'false_start'
    reactionTimes: [],   // player reaction times for won rounds
    cfg,
    // Visual state
    elapsed: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    flashTimer: 0,
    flashSide: '',       // 'left' or 'right'
    tumbleweeds: generateTumbleweeds(),
    dustParticles: generateDustParticles(),
    smokeParticles: [],
    stars: generateStars(),
    drawFlashAlpha: 0,
    winnerText: '',
    // Ana arm angle (radians offset from resting)
    anaArmRaised: false,
    opponentArmRaised: false,
    finished: false,
  }
}

function generateTumbleweeds() {
  const tw = []
  for (let i = 0; i < 3; i++) {
    tw.push({
      x: -50 - Math.random() * 200,
      y: CANVAS_HEIGHT - 80 + Math.random() * 30,
      size: 12 + Math.random() * 10,
      speed: 30 + Math.random() * 40,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: 1 + Math.random() * 2,
      active: false,
      delay: i * 3 + Math.random() * 2,
    })
  }
  return tw
}

function generateDustParticles() {
  const particles = []
  for (let i = 0; i < 30; i++) {
    particles.push({
      x: Math.random() * CANVAS_WIDTH,
      y: CANVAS_HEIGHT - 100 + Math.random() * 80,
      size: 1 + Math.random() * 2,
      speed: 5 + Math.random() * 15,
      alpha: 0.1 + Math.random() * 0.3,
      drift: Math.random() * 0.5 - 0.25,
    })
  }
  return particles
}

function generateStars() {
  const stars = []
  for (let i = 0; i < 40; i++) {
    stars.push({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * 150,
      size: Math.random() < 0.1 ? 2 : 1,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 1 + Math.random() * 3,
    })
  }
  return stars
}

function spawnSmoke(x, y) {
  const particles = []
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 20 + Math.random() * 40
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 15,
      size: 3 + Math.random() * 5,
      alpha: 0.7 + Math.random() * 0.3,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 0.5 + Math.random() * 0.5,
    })
  }
  return particles
}

// ---------- DRAWING FUNCTIONS ----------

function drawSkyGradient(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT * 0.65)
  grad.addColorStop(0, W.SKY_TOP)
  grad.addColorStop(0.4, W.SKY_MID)
  grad.addColorStop(0.8, W.SKY_BOTTOM)
  grad.addColorStop(1, W.HORIZON)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT * 0.65)
}

function drawStars(ctx, stars, elapsed) {
  for (const star of stars) {
    const alpha = 0.3 + Math.sin(star.twinkle + elapsed * star.twinkleSpeed) * 0.3
    ctx.globalAlpha = alpha
    ctx.fillStyle = W.STAR
    ctx.fillRect(star.x, star.y, star.size, star.size)
  }
  ctx.globalAlpha = 1
}

function drawMesas(ctx) {
  // Far mesa left
  ctx.fillStyle = W.MESA3
  drawMesaShape(ctx, -40, 180, 200, 80)
  // Far mesa right
  drawMesaShape(ctx, 600, 170, 250, 90)
  // Mid mesa center-left
  ctx.fillStyle = W.MESA1
  drawMesaShape(ctx, 100, 200, 150, 60)
  // Mid mesa center-right
  ctx.fillStyle = W.MESA2
  drawMesaShape(ctx, 520, 190, 180, 70)
}

function drawMesaShape(ctx, x, y, w, h) {
  ctx.beginPath()
  // Flat top mesa shape
  const topInset = w * 0.2
  ctx.moveTo(x, y + h)
  ctx.lineTo(x + topInset * 0.3, y + h * 0.3)
  ctx.lineTo(x + topInset, y)
  ctx.lineTo(x + w - topInset, y)
  ctx.lineTo(x + w - topInset * 0.3, y + h * 0.3)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()
  ctx.fill()
}

function drawGround(ctx) {
  const groundY = CANVAS_HEIGHT * 0.55
  // Main ground
  const grad = ctx.createLinearGradient(0, groundY, 0, CANVAS_HEIGHT)
  grad.addColorStop(0, W.GROUND)
  grad.addColorStop(0.3, W.GROUND_DARK)
  grad.addColorStop(1, W.GROUND_LINE)
  ctx.fillStyle = grad
  ctx.fillRect(0, groundY, CANVAS_WIDTH, CANVAS_HEIGHT - groundY)

  // Ground texture lines
  ctx.strokeStyle = W.GROUND_LINE
  ctx.lineWidth = 1
  for (let i = 0; i < 8; i++) {
    const ly = groundY + 15 + i * 18
    ctx.beginPath()
    ctx.moveTo(0, ly)
    for (let x = 0; x < CANVAS_WIDTH; x += 20) {
      ctx.lineTo(x + 10, ly + (Math.random() * 3 - 1.5))
    }
    ctx.stroke()
  }

  // Small rocks
  ctx.fillStyle = W.GROUND_DARK
  for (let i = 0; i < 12; i++) {
    const rx = 50 + i * 65 + (i % 3) * 15
    const ry = groundY + 20 + (i % 4) * 25
    ctx.fillRect(rx, ry, 3 + (i % 3) * 2, 2 + (i % 2))
  }
}

function drawAnaFigure(ctx, x, y, armRaised, phase) {
  const scale = 1.8
  const s = (v) => v * scale

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(x, y + s(42), s(18), s(5), 0, 0, Math.PI * 2)
  ctx.fill()

  // Legs
  ctx.fillStyle = W.BOOT
  ctx.fillRect(x - s(6), y + s(28), s(5), s(14))
  ctx.fillRect(x + s(1), y + s(28), s(5), s(14))
  // Boot tops
  ctx.fillRect(x - s(7), y + s(36), s(7), s(6))
  ctx.fillRect(x, y + s(36), s(7), s(6))

  // Poncho body (wide draped shape)
  ctx.fillStyle = W.PONCHO
  ctx.beginPath()
  ctx.moveTo(x - s(18), y + s(28))
  ctx.lineTo(x - s(14), y + s(4))
  ctx.lineTo(x + s(14), y + s(4))
  ctx.lineTo(x + s(18), y + s(28))
  ctx.closePath()
  ctx.fill()
  // Poncho stripe
  ctx.fillStyle = W.PONCHO_DARK
  ctx.fillRect(x - s(12), y + s(14), s(24), s(3))
  ctx.fillRect(x - s(10), y + s(20), s(20), s(2))

  // Belt
  ctx.fillStyle = W.BELT
  ctx.fillRect(x - s(8), y + s(24), s(16), s(3))
  // Belt buckle
  ctx.fillStyle = COLORS.GOLD
  ctx.fillRect(x - s(2), y + s(24), s(4), s(3))

  // Head
  ctx.fillStyle = W.SKIN
  ctx.fillRect(x - s(5), y - s(4), s(10), s(9))
  // Eyes
  ctx.fillStyle = '#222'
  ctx.fillRect(x - s(3), y - s(1), s(2), s(2))
  ctx.fillRect(x + s(1), y - s(1), s(2), s(2))
  // Determined mouth
  ctx.fillRect(x - s(2), y + s(3), s(4), s(1))

  // Hat (wide brim cowboy hat)
  ctx.fillStyle = W.HAT_BROWN
  ctx.fillRect(x - s(14), y - s(6), s(28), s(3)) // brim
  ctx.fillStyle = W.HAT_DARK
  ctx.fillRect(x - s(7), y - s(14), s(14), s(9)) // crown
  ctx.fillRect(x - s(8), y - s(6), s(16), s(2))  // band

  // Arm with gun
  if (armRaised) {
    // Arm raised to the right, gun pointing at opponent
    ctx.fillStyle = W.SKIN
    ctx.save()
    ctx.translate(x + s(10), y + s(8))
    ctx.rotate(-0.3)
    ctx.fillRect(0, -s(2), s(14), s(4))
    // Gun
    ctx.fillStyle = '#333'
    ctx.fillRect(s(12), -s(3), s(8), s(6))
    ctx.fillRect(s(16), -s(5), s(3), s(3))
    // Muzzle flash when phase is result and player won
    ctx.restore()
  } else {
    // Arm at side, resting on holster
    ctx.fillStyle = W.SKIN_SHADOW
    ctx.fillRect(x + s(10), y + s(10), s(4), s(12))
    // Holster
    ctx.fillStyle = W.BELT
    ctx.fillRect(x + s(9), y + s(20), s(6), s(8))
  }
}

function drawOpponentFigure(ctx, x, y, armRaised, phase) {
  const scale = 1.8
  const s = (v) => v * scale

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(x, y + s(42), s(18), s(5), 0, 0, Math.PI * 2)
  ctx.fill()

  // Legs
  ctx.fillStyle = W.BOOT
  ctx.fillRect(x - s(6), y + s(28), s(5), s(14))
  ctx.fillRect(x + s(1), y + s(28), s(5), s(14))
  ctx.fillRect(x - s(7), y + s(36), s(7), s(6))
  ctx.fillRect(x, y + s(36), s(7), s(6))

  // Duster coat (long dark coat)
  ctx.fillStyle = W.DUSTER
  ctx.beginPath()
  ctx.moveTo(x - s(14), y + s(34))
  ctx.lineTo(x - s(12), y + s(2))
  ctx.lineTo(x + s(12), y + s(2))
  ctx.lineTo(x + s(14), y + s(34))
  ctx.closePath()
  ctx.fill()
  // Coat details
  ctx.fillStyle = W.DUSTER_LIGHT
  ctx.fillRect(x - s(1), y + s(4), s(2), s(28))
  // Collar
  ctx.fillRect(x - s(10), y + s(2), s(4), s(4))
  ctx.fillRect(x + s(6), y + s(2), s(4), s(4))

  // Belt with ticket punch
  ctx.fillStyle = W.BELT
  ctx.fillRect(x - s(8), y + s(18), s(16), s(3))
  ctx.fillStyle = '#888'
  ctx.fillRect(x + s(3), y + s(18), s(4), s(3))

  // Head (slightly menacing)
  ctx.fillStyle = W.SKIN_SHADOW
  ctx.fillRect(x - s(5), y - s(4), s(10), s(9))
  // Eyes (narrowed, menacing)
  ctx.fillStyle = '#cc0000'
  ctx.fillRect(x - s(3), y - s(1), s(2), s(1))
  ctx.fillRect(x + s(1), y - s(1), s(2), s(1))
  // Scar
  ctx.fillStyle = '#994444'
  ctx.fillRect(x + s(3), y - s(2), s(1), s(5))
  // Scowl
  ctx.fillRect(x - s(2), y + s(3), s(4), s(1))

  // Hat (conductor/villain style - flat top)
  ctx.fillStyle = '#1a1a2a'
  ctx.fillRect(x - s(10), y - s(6), s(20), s(3))  // brim
  ctx.fillRect(x - s(7), y - s(12), s(14), s(7))   // crown
  // Hat band with ticket
  ctx.fillStyle = '#cc0000'
  ctx.fillRect(x - s(7), y - s(6), s(14), s(1))

  // Arm with gun
  if (armRaised) {
    ctx.fillStyle = W.SKIN_SHADOW
    ctx.save()
    ctx.translate(x - s(10), y + s(8))
    ctx.rotate(0.3)
    ctx.fillRect(-s(14), -s(2), s(14), s(4))
    ctx.fillStyle = '#333'
    ctx.fillRect(-s(20), -s(3), s(8), s(6))
    ctx.fillRect(-s(19), -s(5), s(3), s(3))
    ctx.restore()
  } else {
    ctx.fillStyle = W.SKIN_SHADOW
    ctx.fillRect(x - s(14), y + s(10), s(4), s(12))
    ctx.fillStyle = W.BELT
    ctx.fillRect(x - s(15), y + s(20), s(6), s(8))
  }
}

function drawTumbleweeds(ctx, tumbleweeds) {
  for (const tw of tumbleweeds) {
    if (!tw.active) continue
    ctx.save()
    ctx.translate(tw.x, tw.y)
    ctx.rotate(tw.rotation)
    // Draw tumbleweed as intersecting circles/arcs
    ctx.strokeStyle = W.TUMBLEWEED
    ctx.lineWidth = 1.5
    const r = tw.size / 2
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(Math.cos(angle) * r * 0.3, Math.sin(angle) * r * 0.3, r * 0.6, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = W.TUMBLEWEED_DARK
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawDustParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = p.alpha
    ctx.fillStyle = W.DUST
    ctx.fillRect(p.x, p.y, p.size, p.size)
  }
  ctx.globalAlpha = 1
}

function drawSmokeParticles(ctx, particles) {
  for (const p of particles) {
    if (p.alpha <= 0) continue
    ctx.globalAlpha = p.alpha * 0.5
    ctx.fillStyle = W.SMOKE
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawMuzzleFlash(ctx, x, y, timer) {
  if (timer <= 0) return
  const alpha = Math.min(timer * 4, 1)
  ctx.globalAlpha = alpha
  // Bright white core
  ctx.fillStyle = W.FLASH_WHITE
  ctx.beginPath()
  ctx.arc(x, y, 15 + (1 - timer) * 20, 0, Math.PI * 2)
  ctx.fill()
  // Orange ring
  ctx.fillStyle = COLORS.ORANGE
  ctx.beginPath()
  ctx.arc(x, y, 25 + (1 - timer) * 30, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawHUD(ctx, s) {
  // Round counter
  const roundText = `ROUND ${s.round}/${TOTAL_ROUNDS}`
  drawPixelText(ctx, roundText, CANVAS_WIDTH / 2, 16, 14, COLORS.WHITE, 'center')

  // Score tally
  const anaScore = `ANA: ${s.playerWins}`
  const oppScore = `OPPONENT: ${s.opponentWins}`
  drawPixelText(ctx, anaScore, 20, 16, 10, COLORS.GOLD, 'left')
  drawPixelText(ctx, oppScore, CANVAS_WIDTH - 20, 16, 10, COLORS.RED, 'right')

  // Score pips
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    const pipX = CANVAS_WIDTH / 2 - 60 + i * 30
    const pipY = 36
    ctx.fillStyle = i < s.playerWins ? COLORS.GOLD : i < s.playerWins + s.opponentWins ? COLORS.RED : '#333'
    ctx.fillRect(pipX, pipY, 8, 8)
    ctx.strokeStyle = '#555'
    ctx.lineWidth = 1
    ctx.strokeRect(pipX, pipY, 8, 8)
  }
}

// ---------- MAIN COMPONENT ----------

function QuickDrawGame({ difficulty, onEnd, isPlaying }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(initGameState(difficulty))
  const [ended, setEnded] = useState(false)

  // Input handling
  useEffect(() => {
    const handleAction = (e) => {
      if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Enter') return
      if (e.type === 'keydown') e.preventDefault()

      const s = stateRef.current
      if (s.finished) return

      // Player fires
      if (s.phase === 'waiting') {
        // False start!
        s.falseStart = true
        s.roundResult = 'false_start'
        s.opponentWins++
        s.winnerText = 'FALSE START!'
        s.phase = 'result'
        s.phaseTimer = 0
        s.shakeTimer = 0.3
        s.shakeIntensity = 4
      } else if (s.phase === 'draw' && !s.playerReacted) {
        // Player draws!
        s.playerReacted = true
        s.playerReactionMs = (performance.now() - s.drawTime)
      }
    }

    window.addEventListener('keydown', handleAction)
    window.addEventListener('mousedown', handleAction)
    window.addEventListener('touchstart', handleAction)

    return () => {
      window.removeEventListener('keydown', handleAction)
      window.removeEventListener('mousedown', handleAction)
      window.removeEventListener('touchstart', handleAction)
    }
  }, [])

  const endGame = useCallback(() => {
    if (ended) return
    setEnded(true)
    const s = stateRef.current
    let score
    if (s.playerWins >= 3) {
      // Won — score based on average reaction time
      const avg = s.reactionTimes.length > 0
        ? s.reactionTimes.reduce((a, b) => a + b, 0) / s.reactionTimes.length
        : 999
      if (avg < 200) score = 1000
      else if (avg < 300) score = 800
      else if (avg < 400) score = 600
      else if (avg < 500) score = 400
      else score = 200
    } else {
      score = 100
    }
    onEnd(score)
  }, [onEnd, ended])

  // Game loop
  useGameLoop(useCallback((dt) => {
    const s = stateRef.current
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || s.finished) return

    s.elapsed += dt
    s.phaseTimer += dt

    // Decay timers
    if (s.shakeTimer > 0) s.shakeTimer -= dt
    if (s.flashTimer > 0) s.flashTimer -= dt

    // Update tumbleweeds
    for (const tw of s.tumbleweeds) {
      if (!tw.active) {
        tw.delay -= dt
        if (tw.delay <= 0) tw.active = true
        continue
      }
      tw.x += tw.speed * dt
      tw.y += Math.sin(s.elapsed * 2 + tw.rotation) * 0.3
      tw.rotation += tw.rotSpeed * dt
      if (tw.x > CANVAS_WIDTH + 50) {
        tw.x = -50
        tw.y = CANVAS_HEIGHT - 80 + Math.random() * 30
        tw.speed = 30 + Math.random() * 40
      }
    }

    // Update dust particles
    for (const p of s.dustParticles) {
      p.x += p.speed * dt
      p.y += p.drift
      if (p.x > CANVAS_WIDTH) p.x = -5
    }

    // Update smoke particles
    for (const p of s.smokeParticles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy -= 20 * dt // rise
      p.size += 3 * dt
      p.life -= dt
      p.alpha = Math.max(0, p.life / p.maxLife)
    }
    s.smokeParticles = s.smokeParticles.filter(p => p.life > 0)

    // ---------- PHASE LOGIC ----------

    if (s.phase === 'standoff') {
      s.anaArmRaised = false
      s.opponentArmRaised = false
      if (s.phaseTimer >= STANDOFF_DURATION) {
        s.phase = 'waiting'
        s.phaseTimer = 0
        s.waitDuration = randRange(s.cfg.waitMin, s.cfg.waitMax)
        s.falseStart = false
        s.playerReacted = false
      }
    } else if (s.phase === 'waiting') {
      if (s.phaseTimer >= s.waitDuration) {
        s.phase = 'draw'
        s.phaseTimer = 0
        s.drawTime = performance.now()
        s.drawFlashAlpha = 1
      }
    } else if (s.phase === 'draw') {
      // Flash decay
      s.drawFlashAlpha = Math.max(0, 1 - s.phaseTimer * 3)

      const elapsedMs = performance.now() - s.drawTime
      const opponentFired = elapsedMs >= s.opponentReactionMs

      if (s.playerReacted) {
        // Player already fired - determine outcome
        if (s.playerReactionMs < s.opponentReactionMs) {
          // Player wins!
          s.roundResult = 'win'
          s.playerWins++
          s.reactionTimes.push(s.playerReactionMs)
          s.winnerText = 'YOU WIN!'
          s.anaArmRaised = true
          s.flashSide = 'left'
          s.flashTimer = 0.5
          s.smokeParticles.push(...spawnSmoke(250, CANVAS_HEIGHT * 0.42))
        } else {
          // Too slow
          s.roundResult = 'lose'
          s.opponentWins++
          s.winnerText = 'TOO SLOW!'
          s.opponentArmRaised = true
          s.flashSide = 'right'
          s.flashTimer = 0.5
          s.smokeParticles.push(...spawnSmoke(CANVAS_WIDTH - 250, CANVAS_HEIGHT * 0.42))
        }
        s.phase = 'result'
        s.phaseTimer = 0
        s.shakeTimer = 0.4
        s.shakeIntensity = 6
      } else if (opponentFired) {
        // Opponent fires first, player hasn't reacted
        s.roundResult = 'lose'
        s.opponentWins++
        s.winnerText = 'TOO SLOW!'
        s.opponentArmRaised = true
        s.flashSide = 'right'
        s.flashTimer = 0.5
        s.smokeParticles.push(...spawnSmoke(CANVAS_WIDTH - 250, CANVAS_HEIGHT * 0.42))
        s.phase = 'result'
        s.phaseTimer = 0
        s.shakeTimer = 0.4
        s.shakeIntensity = 6
      }
    } else if (s.phase === 'result') {
      if (s.phaseTimer >= RESULT_DURATION) {
        if (s.round >= TOTAL_ROUNDS || s.playerWins >= 3 || s.opponentWins >= 3) {
          s.phase = 'final'
          s.phaseTimer = 0
        } else {
          s.round++
          s.phase = 'standoff'
          s.phaseTimer = 0
          s.anaArmRaised = false
          s.opponentArmRaised = false
          s.roundResult = ''
          s.winnerText = ''
          s.falseStart = false
          s.playerReacted = false
          s.flashSide = ''
        }
      }
    } else if (s.phase === 'final') {
      if (s.phaseTimer >= FINAL_DURATION && !s.finished) {
        s.finished = true
        endGame()
      }
    }

    // ---------- DRAWING ----------
    ctx.save()

    // Screen shake
    if (s.shakeTimer > 0) {
      const ox = (Math.random() - 0.5) * s.shakeIntensity
      const oy = (Math.random() - 0.5) * s.shakeIntensity
      ctx.translate(ox, oy)
      s.shakeIntensity *= 0.95
    }

    // Sky
    drawSkyGradient(ctx)
    drawStars(ctx, s.stars, s.elapsed)
    drawMesas(ctx)
    drawGround(ctx)

    // Dust particles (background layer)
    drawDustParticles(ctx, s.dustParticles)

    // Tumbleweeds
    drawTumbleweeds(ctx, s.tumbleweeds)

    // Characters
    const anaX = 180
    const oppX = CANVAS_WIDTH - 180
    const figureY = CANVAS_HEIGHT * 0.38
    drawAnaFigure(ctx, anaX, figureY, s.anaArmRaised, s.phase)
    drawOpponentFigure(ctx, oppX, figureY, s.opponentArmRaised, s.phase)

    // Muzzle flash
    if (s.flashTimer > 0) {
      if (s.flashSide === 'left') {
        drawMuzzleFlash(ctx, anaX + 50, figureY + 8, s.flashTimer)
      } else {
        drawMuzzleFlash(ctx, oppX - 50, figureY + 8, s.flashTimer)
      }
    }

    // Smoke
    drawSmokeParticles(ctx, s.smokeParticles)

    // --- PHASE TEXT ---

    if (s.phase === 'standoff') {
      // Pulsing READY text
      const pulse = 0.7 + Math.sin(s.elapsed * 6) * 0.3
      ctx.globalAlpha = pulse
      drawPixelText(ctx, 'READY...', CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.18, 20, COLORS.WHITE, 'center')
      ctx.globalAlpha = 1
    } else if (s.phase === 'waiting') {
      // Tense waiting text with dots animation
      const dots = '.'.repeat(1 + Math.floor(s.phaseTimer * 2) % 3)
      drawPixelText(ctx, 'WAIT' + dots, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.18, 16, '#aaa', 'center')
      // Tension lines on sides
      const tensionAlpha = Math.min(s.phaseTimer / s.waitDuration, 1) * 0.5
      ctx.globalAlpha = tensionAlpha
      ctx.strokeStyle = COLORS.RED
      ctx.lineWidth = 2
      for (let i = 0; i < 5; i++) {
        const ly = CANVAS_HEIGHT * 0.35 + i * 20
        // Left side tension lines
        ctx.beginPath()
        ctx.moveTo(20, ly)
        ctx.lineTo(40 + Math.random() * 10, ly)
        ctx.stroke()
        // Right side
        ctx.beginPath()
        ctx.moveTo(CANVAS_WIDTH - 20, ly)
        ctx.lineTo(CANVAS_WIDTH - 40 - Math.random() * 10, ly)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    } else if (s.phase === 'draw') {
      // Massive flashing DRAW! text
      const flashRate = Math.sin(s.phaseTimer * 30)
      const drawColor = flashRate > 0 ? COLORS.RED : '#ff6600'

      // Background flash
      if (s.drawFlashAlpha > 0) {
        ctx.globalAlpha = s.drawFlashAlpha * 0.3
        ctx.fillStyle = COLORS.RED
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        ctx.globalAlpha = 1
      }

      // Shadow
      drawPixelText(ctx, 'DRAW!', CANVAS_WIDTH / 2 + 3, CANVAS_HEIGHT * 0.17 + 3, 36, '#000', 'center')
      // Main text
      drawPixelText(ctx, 'DRAW!', CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.17, 36, drawColor, 'center')
    } else if (s.phase === 'result') {
      // Result text
      let resultColor = COLORS.GOLD
      let resultText = s.winnerText
      if (s.roundResult === 'lose') resultColor = COLORS.RED
      if (s.roundResult === 'false_start') resultColor = COLORS.ORANGE

      // "BANG!" effect
      if (s.phaseTimer < 0.8) {
        const bangAlpha = Math.max(0, 1 - s.phaseTimer * 2)
        ctx.globalAlpha = bangAlpha
        drawPixelText(ctx, 'BANG!', CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.12, 28, COLORS.ORANGE, 'center')
        ctx.globalAlpha = 1
      }

      // Winner text with bounce
      const bounce = s.phaseTimer < 0.5 ? Math.sin(s.phaseTimer * 10) * 5 : 0
      drawPixelText(ctx, resultText, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.22 + bounce, 18, resultColor, 'center')

      // Show reaction time if player won
      if (s.roundResult === 'win' && s.playerReactionMs > 0) {
        const ms = Math.round(s.playerReactionMs)
        drawPixelText(ctx, `${ms}ms`, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.30, 12, COLORS.WHITE, 'center')
      }
    } else if (s.phase === 'final') {
      // Darken background
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      const won = s.playerWins >= 3
      const titleText = won ? 'VICTORY!' : 'DEFEATED'
      const titleColor = won ? COLORS.GOLD : COLORS.RED

      drawPixelText(ctx, titleText, CANVAS_WIDTH / 2, 80, 28, titleColor, 'center')
      drawPixelText(ctx, `ANA: ${s.playerWins}  -  OPPONENT: ${s.opponentWins}`, CANVAS_WIDTH / 2, 140, 14, COLORS.WHITE, 'center')

      if (won && s.reactionTimes.length > 0) {
        const avg = Math.round(s.reactionTimes.reduce((a, b) => a + b, 0) / s.reactionTimes.length)
        drawPixelText(ctx, `AVG REACTION: ${avg}ms`, CANVAS_WIDTH / 2, 180, 10, COLORS.GOLD, 'center')

        let rating = ''
        if (avg < 200) rating = 'LIGHTNING FAST!'
        else if (avg < 300) rating = 'SHARP SHOOTER!'
        else if (avg < 400) rating = 'QUICK DRAW!'
        else if (avg < 500) rating = 'STEADY HAND'
        else rating = 'CLOSE CALL'
        drawPixelText(ctx, rating, CANVAS_WIDTH / 2, 210, 12, COLORS.ORANGE, 'center')
      }

      // Round breakdown
      drawPixelText(ctx, 'BEST OF 5 COMPLETE', CANVAS_WIDTH / 2, 260, 10, '#888', 'center')

      // Prompt
      if (s.phaseTimer > 2) {
        const blink = Math.sin(s.elapsed * 4) > 0
        if (blink) {
          drawPixelText(ctx, 'TALLYING SCORE...', CANVAS_WIDTH / 2, 320, 10, '#aaa', 'center')
        }
      }
    }

    // HUD (always on top)
    drawHUD(ctx, s)

    // Name labels
    drawPixelText(ctx, 'ANA', anaX, CANVAS_HEIGHT - 30, 10, COLORS.GOLD, 'center')
    drawPixelText(ctx, 'TICKET MASTER', oppX, CANVAS_HEIGHT - 30, 8, COLORS.RED, 'center')

    ctx.restore()
  }, [endGame]), isPlaying)

  return (
    <div className="quick-draw-game">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ width: '100%', maxWidth: CANVAS_WIDTH, imageRendering: 'pixelated' }}
      />
      <ControlsOverlay controls={[{ keys: ['SPACE', 'CLICK'], label: 'DRAW!' }]} />
    </div>
  )
}

export default QuickDrawGame
