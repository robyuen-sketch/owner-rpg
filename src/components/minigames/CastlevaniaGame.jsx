import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from './gameConstants'
import { clearCanvas, drawPixelText } from './canvasUtils'
import './CastlevaniaGame.css'

// Game constants
const GROUND_Y = CANVAS_HEIGHT - 60
const ANA_WIDTH = 32
const ANA_HEIGHT = 48
const GRAVITY = 1800
const JUMP_VELOCITY = -650
const COURSE_LENGTH = 6000
const ANA_SPEED = 250
const SCROLL_OFFSET = 200
const WHIP_RANGE = 64
const WHIP_DURATION = 0.3
const INVINCIBILITY_DURATION = 1.0
const MAX_HP = 3
const PIT_DAMAGE_RESPAWN_Y_OFFSET = 80

// Dungeon palette
const DNG = {
  BG_DARK: '#0a0610',
  BG_MID: '#120e1a',
  BG_LIGHT: '#1a1428',
  STONE: '#3a3444',
  STONE_DARK: '#2a2434',
  STONE_LIGHT: '#4a4454',
  TORCH_ORANGE: '#ff8c00',
  TORCH_YELLOW: '#ffd700',
  PURPLE_FOG: 'rgba(40, 20, 60, 0.4)',
  GROUND_TOP: '#2a2434',
  GROUND_MID: '#1a1428',
  GROUND_BOT: '#0a0610',
  PLATFORM: '#3a3444',
  PLATFORM_EDGE: '#222',
  PLATFORM_TOP: '#4a4454',
  ENEMY_STALKER: '#1a0a2a',
  ENEMY_STALKER_HOOD: '#2a1a3a',
  GARGOYLE: '#5a5060',
  GARGOYLE_WING: '#4a4050',
  WHIP_COLOR: '#c8a060',
}

// Generate platforms along the course
function generatePlatforms(difficulty) {
  const platforms = []
  const gapChance = 0.15 + difficulty * 0.05 // more gaps at higher difficulty

  // Ground segments with gaps
  let gx = 0
  while (gx < COURSE_LENGTH) {
    const segLen = 200 + Math.random() * 300
    const hasGap = gx > 300 && Math.random() < gapChance
    if (hasGap) {
      const gapLen = 60 + Math.random() * 40
      // Mark gap region
      platforms.push({ x: gx, y: GROUND_Y, w: 0, h: 0, isGap: true, gapStart: gx, gapEnd: gx + gapLen })
      gx += gapLen
    } else {
      gx += segLen
    }
  }

  // Elevated stone platforms
  let px = 300
  while (px < COURSE_LENGTH - 200) {
    const pw = 60 + Math.random() * 60
    const ph = 16
    const py = GROUND_Y - 80 - Math.random() * 100
    platforms.push({ x: px, y: py, w: pw, h: ph, isGap: false })
    px += 200 + Math.random() * 250
  }

  return platforms
}

// Generate enemies along the course
function generateEnemies(difficulty) {
  const enemies = []
  const enemyGap = Math.max(250, 500 - difficulty * 60)
  let ex = 500

  while (ex < COURSE_LENGTH - 300) {
    const isGargoyle = difficulty >= 2 && Math.random() < 0.3 + (difficulty - 2) * 0.1
    if (isGargoyle) {
      enemies.push({
        type: 'gargoyle',
        x: ex,
        baseY: GROUND_Y - 120 - Math.random() * 60,
        y: 0,
        w: 28,
        h: 28,
        speed: (60 + difficulty * 20) * (Math.random() < 0.5 ? 1 : -1),
        sineOffset: Math.random() * Math.PI * 2,
        alive: true,
        flashTimer: 0,
      })
    } else {
      enemies.push({
        type: 'stalker',
        x: ex,
        baseX: ex,
        y: GROUND_Y - 36,
        w: 24,
        h: 36,
        speed: 40 + difficulty * 15,
        patrolRange: 60 + Math.random() * 40,
        dir: 1,
        alive: true,
        flashTimer: 0,
      })
    }
    ex += enemyGap + Math.random() * 120
  }

  return enemies
}

// Generate torch positions for ambiance
function generateTorches() {
  const torches = []
  let tx = 150
  while (tx < COURSE_LENGTH) {
    torches.push({
      x: tx,
      y: GROUND_Y - 140 - Math.random() * 60,
      layer: Math.random() < 0.5 ? 'far' : 'mid',
    })
    tx += 180 + Math.random() * 200
  }
  return torches
}

// Generate background stone arches for parallax
function generateArches() {
  const arches = []
  for (let i = 0; i < 30; i++) {
    arches.push({
      x: i * 140 + Math.random() * 60,
      height: 120 + Math.random() * 80,
      width: 60 + Math.random() * 40,
      layer: Math.random() < 0.35 ? 'far' : Math.random() < 0.6 ? 'mid' : 'near',
      shade: Math.random(),
    })
  }
  return arches
}

function initGameState(difficulty) {
  const diffMult = Math.min(difficulty, 4)

  // Collect gap info for ground rendering
  const platforms = generatePlatforms(diffMult)
  const gaps = platforms.filter(p => p.isGap)
  const elevatedPlatforms = platforms.filter(p => !p.isGap)

  return {
    cameraX: 0,
    ana: {
      x: 100,
      y: GROUND_Y - ANA_HEIGHT,
      vx: 0,
      vy: 0,
      grounded: true,
      jumping: false,
      facingRight: true,
      hp: MAX_HP,
      invTimer: 0,
      whipTimer: 0,
      lastPlatformX: 100,
      lastPlatformY: GROUND_Y - ANA_HEIGHT,
    },
    keys: { left: false, right: false, jump: false, whip: false },
    gaps,
    platforms: elevatedPlatforms,
    enemies: generateEnemies(diffMult),
    torches: generateTorches(),
    arches: generateArches(),
    bgFar: 0,
    bgMid: 0,
    bgNear: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    elapsed: 0,
    finished: false,
    difficulty: diffMult,
    // Torch particle pool
    particles: [],
  }
}

function CastlevaniaGame({ difficulty, onEnd, isPlaying }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(initGameState(difficulty))
  const [ended, setEnded] = useState(false)

  // Input handling
  useEffect(() => {
    const setKey = (key, val) => {
      const k = stateRef.current.keys
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') k.left = val
      if (key === 'ArrowRight' || key === 'd' || key === 'D') k.right = val
      if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') k.jump = val
      if (key === 'x' || key === 'X') k.whip = val
    }

    const handleKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'A', 'd', 'D', 'w', 'W', 'x', 'X'].includes(e.key)) {
        e.preventDefault()
        setKey(e.key, true)
      }
    }
    const handleKeyUp = (e) => {
      setKey(e.key, false)
    }
    const handleClick = () => {
      // Tap/click triggers whip
      const s = stateRef.current
      if (s.ana.whipTimer <= 0) {
        s.ana.whipTimer = WHIP_DURATION
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('touchstart', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('touchstart', handleClick)
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

    const ana = s.ana

    // === INPUT ===
    // Horizontal movement
    ana.vx = 0
    if (s.keys.left) { ana.vx = -ANA_SPEED; ana.facingRight = false }
    if (s.keys.right) { ana.vx = ANA_SPEED; ana.facingRight = true }

    // Jump
    if (s.keys.jump && ana.grounded) {
      ana.vy = JUMP_VELOCITY
      ana.jumping = true
      ana.grounded = false
      s.keys.jump = false // consume so you must re-press
    }

    // Whip
    if (s.keys.whip && ana.whipTimer <= 0) {
      ana.whipTimer = WHIP_DURATION
      s.keys.whip = false
    }

    // === PHYSICS ===
    // Apply gravity
    if (!ana.grounded) {
      ana.vy += GRAVITY * dt
    }

    ana.x += ana.vx * dt
    ana.y += ana.vy * dt

    // Clamp Ana to course bounds
    if (ana.x < 0) ana.x = 0
    if (ana.x > COURSE_LENGTH - ANA_WIDTH) ana.x = COURSE_LENGTH - ANA_WIDTH

    // Ground collision (check if not over a gap)
    let overGap = false
    for (const gap of s.gaps) {
      if (ana.x + ANA_WIDTH > gap.gapStart + 8 && ana.x < gap.gapEnd - 8) {
        overGap = true
        break
      }
    }

    if (!overGap && ana.y >= GROUND_Y - ANA_HEIGHT) {
      ana.y = GROUND_Y - ANA_HEIGHT
      ana.vy = 0
      ana.grounded = true
      ana.jumping = false
      ana.lastPlatformX = ana.x
      ana.lastPlatformY = GROUND_Y - ANA_HEIGHT
    }

    // Platform collision (only when falling)
    if (ana.vy >= 0) {
      for (const plat of s.platforms) {
        if (
          ana.x + ANA_WIDTH > plat.x + 4 &&
          ana.x < plat.x + plat.w - 4 &&
          ana.y + ANA_HEIGHT >= plat.y &&
          ana.y + ANA_HEIGHT <= plat.y + plat.h + ana.vy * dt + 8
        ) {
          ana.y = plat.y - ANA_HEIGHT
          ana.vy = 0
          ana.grounded = true
          ana.jumping = false
          ana.lastPlatformX = ana.x
          ana.lastPlatformY = plat.y - ANA_HEIGHT
          break
        }
      }
    }

    // If still not grounded and over gap, check for falling below ground
    if (overGap && ana.grounded && ana.y + ANA_HEIGHT < GROUND_Y + 10) {
      ana.grounded = false
    }

    // Pit fall detection
    if (ana.y > CANVAS_HEIGHT + 50) {
      // Respawn at last safe position, take damage
      ana.x = ana.lastPlatformX
      ana.y = ana.lastPlatformY - PIT_DAMAGE_RESPAWN_Y_OFFSET
      ana.vy = 0
      ana.grounded = false
      if (ana.invTimer <= 0) {
        ana.hp--
        ana.invTimer = INVINCIBILITY_DURATION
        s.shakeTimer = 0.3
        s.shakeIntensity = 8
      }
      if (ana.hp <= 0) {
        s.finished = true
        endGame()
        return
      }
    }

    // Update invincibility
    if (ana.invTimer > 0) ana.invTimer -= dt

    // Update whip timer
    if (ana.whipTimer > 0) ana.whipTimer -= dt

    // === CAMERA ===
    s.cameraX = ana.x - SCROLL_OFFSET
    if (s.cameraX < 0) s.cameraX = 0
    if (s.cameraX > COURSE_LENGTH - CANVAS_WIDTH) s.cameraX = COURSE_LENGTH - CANVAS_WIDTH

    // Check finish
    if (ana.x >= COURSE_LENGTH - 60) {
      s.finished = true
      endGame()
      return
    }

    // === ENEMIES ===
    s.enemies.forEach(en => {
      if (!en.alive) {
        if (en.flashTimer > 0) en.flashTimer -= dt
        return
      }

      if (en.type === 'stalker') {
        // Patrol back and forth
        en.x += en.speed * en.dir * dt
        if (en.x > en.baseX + en.patrolRange) en.dir = -1
        if (en.x < en.baseX - en.patrolRange) en.dir = 1
      } else if (en.type === 'gargoyle') {
        // Sine wave flight
        en.x += en.speed * dt
        en.y = en.baseY + Math.sin(s.elapsed * 2.5 + en.sineOffset) * 40
        // Wrap around patrol area
        if (en.x > en.baseX + 200) en.speed = -Math.abs(en.speed)
        if (en.x < en.baseX - 200) en.speed = Math.abs(en.speed)
        // For gargoyle, baseX is initial x
        if (!en.baseX_init) { en.baseX_init = en.x }
      }

      // Whip collision
      if (ana.whipTimer > 0) {
        const whipX = ana.facingRight ? ana.x + ANA_WIDTH : ana.x - WHIP_RANGE
        const whipY = ana.y + 12
        const whipW = WHIP_RANGE
        const whipH = 16

        const enY = en.type === 'gargoyle' ? en.y : en.y
        if (
          whipX < en.x + en.w &&
          whipX + whipW > en.x &&
          whipY < enY + en.h &&
          whipY + whipH > enY
        ) {
          en.alive = false
          en.flashTimer = 0.4
        }
      }

      // Contact damage to Ana
      if (ana.invTimer <= 0) {
        const enY = en.type === 'gargoyle' ? en.y : en.y
        if (
          ana.x + ANA_WIDTH - 6 > en.x &&
          ana.x + 6 < en.x + en.w &&
          ana.y + ANA_HEIGHT - 4 > enY &&
          ana.y + 4 < enY + en.h
        ) {
          ana.hp--
          ana.invTimer = INVINCIBILITY_DURATION
          s.shakeTimer = 0.3
          s.shakeIntensity = 6
          if (ana.hp <= 0) {
            s.finished = true
            endGame()
            return
          }
        }
      }
    })

    // Update shake
    if (s.shakeTimer > 0) {
      s.shakeTimer -= dt
      s.shakeIntensity *= 0.93
    }

    // Update parallax offsets
    s.bgFar = (s.cameraX * 0.1) % 800
    s.bgMid = (s.cameraX * 0.3) % 800
    s.bgNear = (s.cameraX * 0.6) % 800

    // Spawn torch particles
    s.torches.forEach(torch => {
      const screenTX = torch.x - s.cameraX
      if (screenTX > -40 && screenTX < CANVAS_WIDTH + 40) {
        if (Math.random() < 0.3) {
          s.particles.push({
            x: torch.x + (Math.random() - 0.5) * 6,
            y: torch.y - 4,
            vy: -30 - Math.random() * 20,
            life: 0.4 + Math.random() * 0.3,
            maxLife: 0.4 + Math.random() * 0.3,
            size: 2 + Math.random() * 2,
          })
        }
      }
    })

    // Update particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i]
      p.y += p.vy * dt
      p.life -= dt
      if (p.life <= 0) {
        s.particles.splice(i, 1)
      }
    }

    // === RENDER ===
    const shakeX = s.shakeTimer > 0 ? (Math.random() - 0.5) * s.shakeIntensity : 0
    const shakeY = s.shakeTimer > 0 ? (Math.random() - 0.5) * s.shakeIntensity : 0

    ctx.save()
    ctx.translate(shakeX, shakeY)

    // Dark dungeon background gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
    skyGrad.addColorStop(0, DNG.BG_DARK)
    skyGrad.addColorStop(0.5, DNG.BG_MID)
    skyGrad.addColorStop(1, DNG.BG_LIGHT)
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y)

    // Far background stone arches (slowest parallax)
    s.arches.forEach(arch => {
      if (arch.layer !== 'far') return
      const ax = ((arch.x - s.bgFar) % (CANVAS_WIDTH + 300)) - 150
      ctx.fillStyle = `rgba(20, 15, 30, ${0.5 + arch.shade * 0.3})`
      // Pillar left
      ctx.fillRect(ax, GROUND_Y - arch.height, 12, arch.height)
      // Pillar right
      ctx.fillRect(ax + arch.width - 12, GROUND_Y - arch.height, 12, arch.height)
      // Arch top
      ctx.beginPath()
      ctx.arc(ax + arch.width / 2, GROUND_Y - arch.height, arch.width / 2, Math.PI, 0)
      ctx.fill()
    })

    // Mid arches
    s.arches.forEach(arch => {
      if (arch.layer !== 'mid') return
      const ax = ((arch.x - s.bgMid) % (CANVAS_WIDTH + 300)) - 150
      ctx.fillStyle = `rgba(28, 22, 40, ${0.4 + arch.shade * 0.4})`
      ctx.fillRect(ax, GROUND_Y - arch.height * 0.8, 14, arch.height * 0.8)
      ctx.fillRect(ax + arch.width - 14, GROUND_Y - arch.height * 0.8, 14, arch.height * 0.8)
      ctx.beginPath()
      ctx.arc(ax + arch.width / 2, GROUND_Y - arch.height * 0.8, arch.width / 2, Math.PI, 0)
      ctx.fill()
    })

    // Near arches
    s.arches.forEach(arch => {
      if (arch.layer !== 'near') return
      const ax = ((arch.x - s.bgNear) % (CANVAS_WIDTH + 300)) - 150
      ctx.fillStyle = `rgba(36, 28, 50, ${0.3 + arch.shade * 0.5})`
      ctx.fillRect(ax, GROUND_Y - arch.height * 0.6, 16, arch.height * 0.6)
      ctx.fillRect(ax + arch.width - 16, GROUND_Y - arch.height * 0.6, 16, arch.height * 0.6)
      ctx.beginPath()
      ctx.arc(ax + arch.width / 2, GROUND_Y - arch.height * 0.6, arch.width / 2, Math.PI, 0)
      ctx.fill()
    })

    // Purple fog overlay
    const fogGrad = ctx.createLinearGradient(0, GROUND_Y - 100, 0, GROUND_Y)
    fogGrad.addColorStop(0, 'rgba(40, 20, 60, 0)')
    fogGrad.addColorStop(1, DNG.PURPLE_FOG)
    ctx.fillStyle = fogGrad
    ctx.fillRect(0, GROUND_Y - 100, CANVAS_WIDTH, 100)

    // Torch glow (drawn in background layer)
    s.torches.forEach(torch => {
      const screenTX = torch.x - s.cameraX * (torch.layer === 'far' ? 0.3 : 0.6)
      if (screenTX < -60 || screenTX > CANVAS_WIDTH + 60) return

      // Glow circle
      const glowRad = 40 + Math.sin(s.elapsed * 5 + torch.x) * 8
      const glow = ctx.createRadialGradient(screenTX, torch.y, 2, screenTX, torch.y, glowRad)
      glow.addColorStop(0, 'rgba(255, 140, 0, 0.25)')
      glow.addColorStop(0.5, 'rgba(255, 100, 0, 0.08)')
      glow.addColorStop(1, 'rgba(255, 60, 0, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(screenTX - glowRad, torch.y - glowRad, glowRad * 2, glowRad * 2)

      // Torch bracket
      ctx.fillStyle = '#444'
      ctx.fillRect(screenTX - 2, torch.y, 4, 16)
      ctx.fillRect(screenTX - 4, torch.y + 12, 8, 4)

      // Flame
      const flicker = Math.sin(s.elapsed * 12 + torch.x) * 2
      ctx.fillStyle = DNG.TORCH_ORANGE
      ctx.beginPath()
      ctx.moveTo(screenTX - 3, torch.y)
      ctx.lineTo(screenTX, torch.y - 8 + flicker)
      ctx.lineTo(screenTX + 3, torch.y)
      ctx.fill()
      ctx.fillStyle = DNG.TORCH_YELLOW
      ctx.beginPath()
      ctx.moveTo(screenTX - 1, torch.y)
      ctx.lineTo(screenTX, torch.y - 5 + flicker)
      ctx.lineTo(screenTX + 1, torch.y)
      ctx.fill()
    })

    // Torch particles
    s.particles.forEach(p => {
      const px = p.x - s.cameraX * 0.5
      if (px < -10 || px > CANVAS_WIDTH + 10) return
      const alpha = (p.life / p.maxLife) * 0.8
      ctx.fillStyle = `rgba(255, ${Math.floor(100 + 100 * (p.life / p.maxLife))}, 0, ${alpha})`
      ctx.fillRect(px - p.size / 2, p.y - p.size / 2, p.size, p.size)
    })

    // === GROUND ===
    // Draw ground with gaps
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT)
    groundGrad.addColorStop(0, DNG.GROUND_TOP)
    groundGrad.addColorStop(0.3, DNG.GROUND_MID)
    groundGrad.addColorStop(1, DNG.GROUND_BOT)

    // Render ground in segments, skipping gaps
    const camL = s.cameraX
    const camR = s.cameraX + CANVAS_WIDTH

    // First fill entire ground, then cut gaps
    ctx.fillStyle = groundGrad
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y)

    // Ground surface line
    ctx.fillStyle = DNG.STONE_LIGHT
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 3)

    // Stone tile pattern on ground
    for (let tx = Math.floor(camL / 40) * 40; tx < camR + 40; tx += 40) {
      const screenTX = tx - s.cameraX
      // Check if over a gap
      let inGap = false
      for (const gap of s.gaps) {
        if (tx + 40 > gap.gapStart && tx < gap.gapEnd) {
          inGap = true
          break
        }
      }
      if (inGap) {
        // Draw pit darkness
        ctx.fillStyle = '#020004'
        ctx.fillRect(screenTX, GROUND_Y, 40, CANVAS_HEIGHT - GROUND_Y)
      } else {
        // Stone tile lines
        ctx.fillStyle = DNG.STONE_DARK
        ctx.fillRect(screenTX, GROUND_Y + 3, 1, CANVAS_HEIGHT - GROUND_Y - 3)
        ctx.fillRect(screenTX, GROUND_Y + 20, 40, 1)
      }
    }

    // === PLATFORMS ===
    s.platforms.forEach(plat => {
      const px = plat.x - s.cameraX
      if (px + plat.w < -20 || px > CANVAS_WIDTH + 20) return

      // Main stone block
      ctx.fillStyle = DNG.PLATFORM
      ctx.fillRect(px, plat.y, plat.w, plat.h)
      // Top edge (lighter)
      ctx.fillStyle = DNG.PLATFORM_TOP
      ctx.fillRect(px, plat.y, plat.w, 3)
      // Bottom edge (darker)
      ctx.fillStyle = DNG.PLATFORM_EDGE
      ctx.fillRect(px, plat.y + plat.h - 2, plat.w, 2)
      // Side edges
      ctx.fillRect(px, plat.y, 2, plat.h)
      ctx.fillRect(px + plat.w - 2, plat.y, 2, plat.h)
      // Stone line detail
      ctx.fillStyle = DNG.STONE_DARK
      ctx.fillRect(px + plat.w * 0.4, plat.y + 4, 1, plat.h - 6)
    })

    // === ENEMIES ===
    s.enemies.forEach(en => {
      if (!en.alive && en.flashTimer <= 0) return
      const ex = en.x - s.cameraX
      if (ex < -40 || ex > CANVAS_WIDTH + 40) return

      if (!en.alive) {
        // Death flash
        ctx.globalAlpha = en.flashTimer / 0.4
        ctx.fillStyle = '#fff'
        ctx.fillRect(ex - 2, (en.type === 'gargoyle' ? en.y : en.y) - 2, en.w + 4, en.h + 4)
        ctx.globalAlpha = 1
        return
      }

      if (en.type === 'stalker') {
        drawStalker(ctx, ex, en.y, en.w, en.h, s.elapsed, en.dir)
      } else if (en.type === 'gargoyle') {
        drawGargoyle(ctx, ex, en.y, en.w, en.h, s.elapsed)
      }
    })

    // === ANA ===
    const anaScreenX = ana.x - s.cameraX
    const isInv = ana.invTimer > 0
    // Flash during invincibility
    if (!isInv || Math.floor(s.elapsed * 10) % 2 === 0) {
      drawAnaCastlevania(ctx, anaScreenX, ana.y, ANA_WIDTH, ANA_HEIGHT, s.elapsed, ana.facingRight, ana.whipTimer > 0, ana.vx !== 0)
    }

    // Draw whip
    if (ana.whipTimer > 0) {
      const whipProgress = 1 - (ana.whipTimer / WHIP_DURATION)
      const whipLen = WHIP_RANGE * Math.sin(whipProgress * Math.PI)
      const whipStartX = ana.facingRight ? anaScreenX + ANA_WIDTH : anaScreenX
      const whipEndX = ana.facingRight ? whipStartX + whipLen : whipStartX - whipLen
      const whipY = ana.y + 16

      ctx.strokeStyle = DNG.WHIP_COLOR
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(whipStartX, whipY)
      // Curved whip
      const cpY = whipY - 10 - Math.sin(whipProgress * Math.PI) * 15
      const cpX = (whipStartX + whipEndX) / 2
      ctx.quadraticCurveTo(cpX, cpY, whipEndX, whipY + 4)
      ctx.stroke()

      // Whip tip spark
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(whipEndX, whipY + 4, 2 + Math.random() * 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Vignette effect (darken edges)
    const vigGrad = ctx.createRadialGradient(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.3,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.8
    )
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)')
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.4)')
    ctx.fillStyle = vigGrad
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Damage flash
    if (ana.invTimer > INVINCIBILITY_DURATION - 0.15) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.15)'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    ctx.restore()

    // === HUD (outside shake) ===

    // Progress bar
    const progress = Math.min(1, ana.x / COURSE_LENGTH)
    const barY = 8
    const barH = 8
    const barPad = 80
    ctx.fillStyle = '#222'
    ctx.fillRect(barPad, barY, CANVAS_WIDTH - barPad * 2, barH)
    const barGrad = ctx.createLinearGradient(barPad, 0, CANVAS_WIDTH - barPad, 0)
    barGrad.addColorStop(0, '#8833aa')
    barGrad.addColorStop(0.5, COLORS.GOLD)
    barGrad.addColorStop(1, COLORS.GREEN)
    ctx.fillStyle = barGrad
    ctx.fillRect(barPad, barY, (CANVAS_WIDTH - barPad * 2) * progress, barH)
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.strokeRect(barPad, barY, CANVAS_WIDTH - barPad * 2, barH)

    // Progress marker
    const markerX = barPad + (CANVAS_WIDTH - barPad * 2) * progress
    ctx.fillStyle = COLORS.GOLD
    ctx.beginPath()
    ctx.arc(markerX, barY + barH / 2, 5, 0, Math.PI * 2)
    ctx.fill()

    // Labels
    drawPixelText(ctx, 'ENTER', 10, 6, 7, '#8833aa')
    drawPixelText(ctx, 'EXIT', CANVAS_WIDTH - 10, 6, 7, COLORS.GREEN, 'right')

    // Title
    drawPixelText(ctx, 'DOMAIN DUNGEONS', CANVAS_WIDTH / 2, 22, 8, '#aa66cc', 'center')

    // HP Hearts
    for (let i = 0; i < MAX_HP; i++) {
      const hx = 10 + i * 22
      const hy = 28
      if (i < ana.hp) {
        drawHeart(ctx, hx, hy, 16, COLORS.RED)
      } else {
        drawHeart(ctx, hx, hy, 16, '#333')
      }
    }

    // Time display
    const timeStr = `TIME: ${Math.floor(s.elapsed)}s`
    drawPixelText(ctx, timeStr, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 20, 7, '#777', 'right')

  }, [endGame]), isPlaying && !ended)

  return (
    <div className="castlevania-game">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="mg-canvas"
      />
      <div className="mg-controls-hint">
        ARROWS: MOVE | SPACE: JUMP | X/TAP: WHIP
      </div>
    </div>
  )
}

// Draw Ana in Castlevania style
function drawAnaCastlevania(ctx, x, y, w, h, time, facingRight, whipping, moving) {
  const runCycle = moving ? Math.floor(time * 8) % 4 : 0
  const bodyColor = COLORS.GOLD
  const skinColor = '#f5c6a0'

  ctx.save()
  if (!facingRight) {
    ctx.translate(x + w / 2, 0)
    ctx.scale(-1, 1)
    ctx.translate(-(x + w / 2), 0)
  }

  // Head
  ctx.fillStyle = skinColor
  ctx.fillRect(x + 8, y, w - 16, 14)

  // Hair (dark, longer for dungeon style)
  ctx.fillStyle = '#2a0a0a'
  ctx.fillRect(x + 6, y - 2, w - 12, 8)
  ctx.fillRect(x + 4, y + 4, 4, 16) // side hair left
  ctx.fillRect(x + w - 8, y + 4, 4, 14) // side hair right

  // Eyes
  ctx.fillStyle = '#222'
  ctx.fillRect(x + 12, y + 6, 3, 3)
  ctx.fillRect(x + 19, y + 6, 3, 3)

  // Determined expression
  ctx.fillStyle = '#c44'
  ctx.fillRect(x + 12, y + 6, 3, 1) // slight red tint above eyes

  // Body / battle dress (darker gold)
  ctx.fillStyle = bodyColor
  ctx.fillRect(x + 6, y + 14, w - 12, 18)

  // Belt
  ctx.fillStyle = '#8b4513'
  ctx.fillRect(x + 6, y + 22, w - 12, 3)
  // Belt buckle
  ctx.fillStyle = '#ccc'
  ctx.fillRect(x + 14, y + 22, 4, 3)

  // Cape (dark purple, flows behind)
  ctx.fillStyle = '#3a1a4a'
  const capeFlutter = Math.sin(time * 6) * 3
  ctx.beginPath()
  ctx.moveTo(x + 8, y + 14)
  ctx.lineTo(x + 2 + capeFlutter, y + 40)
  ctx.lineTo(x + 12, y + 34)
  ctx.closePath()
  ctx.fill()

  // Arms
  ctx.fillStyle = skinColor
  if (whipping) {
    // Whip arm extended
    ctx.fillRect(x + w - 6, y + 16, 8, 4)
    ctx.fillRect(x + 2, y + 20, 4, 8)
  } else if (runCycle < 2) {
    ctx.fillRect(x + 2, y + 16, 4, 10)
    ctx.fillRect(x + w - 6, y + 20, 4, 10)
  } else {
    ctx.fillRect(x + 2, y + 20, 4, 10)
    ctx.fillRect(x + w - 6, y + 16, 4, 10)
  }

  // Legs (animated running)
  ctx.fillStyle = '#444'
  const legOffset = moving ? (runCycle < 2 ? 0 : 4) : 0
  ctx.fillRect(x + 10, y + 32, 5, 12 + legOffset)
  ctx.fillRect(x + w - 15, y + 32, 5, 16 - legOffset)

  // Boots
  ctx.fillStyle = '#2a1a0a'
  ctx.fillRect(x + 8, y + 44 + legOffset, 8, 4)
  ctx.fillRect(x + w - 17, y + 48 - legOffset, 8, 4)

  ctx.restore()
}

// Draw Slice Stalker enemy
function drawStalker(ctx, x, y, w, h, time, dir) {
  const bob = Math.sin(time * 4) * 2

  // Hood / cloak
  ctx.fillStyle = DNG.ENEMY_STALKER_HOOD
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y + bob - 4)
  ctx.lineTo(x - 4, y + h + bob)
  ctx.lineTo(x + w + 4, y + h + bob)
  ctx.closePath()
  ctx.fill()

  // Body
  ctx.fillStyle = DNG.ENEMY_STALKER
  ctx.fillRect(x + 4, y + 8 + bob, w - 8, h - 12)

  // Hood peak
  ctx.fillStyle = DNG.ENEMY_STALKER_HOOD
  ctx.beginPath()
  ctx.arc(x + w / 2, y + 6 + bob, 8, Math.PI, 0)
  ctx.fill()

  // Eyes (glowing red)
  ctx.fillStyle = '#ff2222'
  ctx.fillRect(x + 7, y + 10 + bob, 3, 2)
  ctx.fillRect(x + w - 10, y + 10 + bob, 3, 2)
  // Eye glow
  ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.arc(x + 8, y + 11 + bob, 4, 0, Math.PI * 2)
  ctx.arc(x + w - 9, y + 11 + bob, 4, 0, Math.PI * 2)
  ctx.fill()
}

// Draw Gargoyle enemy
function drawGargoyle(ctx, x, y, w, h, time) {
  const wingFlap = Math.sin(time * 8) * 6

  // Wings
  ctx.fillStyle = DNG.GARGOYLE_WING
  // Left wing
  ctx.beginPath()
  ctx.moveTo(x + 4, y + 8)
  ctx.lineTo(x - 10, y + 4 + wingFlap)
  ctx.lineTo(x - 6, y + 16 + wingFlap * 0.5)
  ctx.lineTo(x + 4, y + 14)
  ctx.closePath()
  ctx.fill()
  // Right wing
  ctx.beginPath()
  ctx.moveTo(x + w - 4, y + 8)
  ctx.lineTo(x + w + 10, y + 4 + wingFlap)
  ctx.lineTo(x + w + 6, y + 16 + wingFlap * 0.5)
  ctx.lineTo(x + w - 4, y + 14)
  ctx.closePath()
  ctx.fill()

  // Body
  ctx.fillStyle = DNG.GARGOYLE
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8)

  // Head
  ctx.fillStyle = DNG.GARGOYLE
  ctx.beginPath()
  ctx.arc(x + w / 2, y + 6, 8, 0, Math.PI * 2)
  ctx.fill()

  // Eyes (yellow, menacing)
  ctx.fillStyle = '#ffcc00'
  ctx.fillRect(x + 8, y + 4, 3, 3)
  ctx.fillRect(x + w - 11, y + 4, 3, 3)

  // Horns
  ctx.fillStyle = '#444'
  ctx.beginPath()
  ctx.moveTo(x + 6, y + 2)
  ctx.lineTo(x + 2, y - 6)
  ctx.lineTo(x + 10, y + 2)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + w - 6, y + 2)
  ctx.lineTo(x + w - 2, y - 6)
  ctx.lineTo(x + w - 10, y + 2)
  ctx.closePath()
  ctx.fill()

  // Tail
  ctx.strokeStyle = DNG.GARGOYLE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y + h - 4)
  ctx.quadraticCurveTo(x + w / 2 + 10, y + h + 6, x + w / 2 + 4, y + h + 10)
  ctx.stroke()
}

// Draw a pixel heart for HP
function drawHeart(ctx, x, y, size, color) {
  const s = size / 16
  ctx.fillStyle = color
  // Left bump
  ctx.beginPath()
  ctx.arc(x + 4 * s, y + 4 * s, 4 * s, 0, Math.PI * 2)
  ctx.fill()
  // Right bump
  ctx.beginPath()
  ctx.arc(x + 12 * s, y + 4 * s, 4 * s, 0, Math.PI * 2)
  ctx.fill()
  // Bottom triangle
  ctx.beginPath()
  ctx.moveTo(x, y + 5 * s)
  ctx.lineTo(x + 8 * s, y + 15 * s)
  ctx.lineTo(x + 16 * s, y + 5 * s)
  ctx.closePath()
  ctx.fill()
}

export default CastlevaniaGame
