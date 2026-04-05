import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_DURATION, COLORS, SPACE_CONFIG } from './gameConstants'
import { clearCanvas, drawPixelText, drawPixelRect, drawTimerBar } from './canvasUtils'
import './SpaceCommandersGame.css'

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

const ENEMY_COLORS = ['#ff3333', '#ff8c00', '#ffd700', '#39ff14', '#00ccff']
const ENEMY_POINTS = [100, 70, 50, 30, 10]

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
  }
}

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

    s.timeLeft -= dt
    if (s.timeLeft <= 0) {
      s.timeLeft = 0
      endGame()
      return
    }

    const keys = keysRef.current
    const playerSpeed = 300 * dt

    // Player movement
    if (keys.has('ArrowLeft') || keys.has('a')) {
      s.player.x = Math.max(0, s.player.x - playerSpeed)
    }
    if (keys.has('ArrowRight') || keys.has('d')) {
      s.player.x = Math.min(CANVAS_WIDTH - PLAYER_W, s.player.x + playerSpeed)
    }

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
      // Front row enemies fire
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
          return false
        }
      }
      // UFO collision
      if (s.ufo && bullet.x < s.ufo.x + 36 && bullet.x + BULLET_W > s.ufo.x &&
          bullet.y < s.ufo.y + 16 && bullet.y + BULLET_H > s.ufo.y) {
        s.score += 500
        s.ufo = null
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
        return false
      }
      return true
    })

    // Enemy reached bottom
    if (aliveEnemies.some(e => e.y + ENEMY_H >= s.player.y)) {
      s.timeLeft -= 5
    }

    // All enemies dead - bonus
    if (aliveEnemies.length === 0) {
      s.score += 500
      endGame()
      return
    }

    // === RENDER ===
    clearCanvas(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Starfield background
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137 + 50) % CANVAS_WIDTH
      const sy = (i * 89 + 30) % CANVAS_HEIGHT
      ctx.fillStyle = `rgba(255,255,255,${0.2 + (i % 3) * 0.2})`
      ctx.fillRect(sx, sy, 1, 1)
    }

    // Draw shields
    s.shields.forEach(shield => {
      if (shield.hp <= 0) return
      const alpha = shield.hp / 4
      ctx.fillStyle = `rgba(57, 255, 20, ${alpha})`
      ctx.fillRect(shield.x, shield.y, SHIELD_W, SHIELD_H)
      ctx.strokeStyle = COLORS.GREEN
      ctx.lineWidth = 1
      ctx.strokeRect(shield.x, shield.y, SHIELD_W, SHIELD_H)
    })

    // Draw enemies
    s.enemies.forEach(e => {
      if (!e.alive) return
      const color = ENEMY_COLORS[Math.min(e.row, 4)]
      // Body
      drawPixelRect(ctx, e.x + 4, e.y, ENEMY_W - 8, ENEMY_H, color)
      drawPixelRect(ctx, e.x, e.y + 4, ENEMY_W, ENEMY_H - 8, color)
      // Eyes
      drawPixelRect(ctx, e.x + 8, e.y + 6, 4, 4, '#000')
      drawPixelRect(ctx, e.x + ENEMY_W - 12, e.y + 6, 4, 4, '#000')
      // Antenna
      drawPixelRect(ctx, e.x + 6, e.y - 4, 2, 6, color)
      drawPixelRect(ctx, e.x + ENEMY_W - 8, e.y - 4, 2, 6, color)
    })

    // Draw UFO
    if (s.ufo) {
      ctx.fillStyle = '#ff69b4'
      ctx.beginPath()
      ctx.ellipse(s.ufo.x + 18, s.ufo.y + 8, 18, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ff3399'
      ctx.beginPath()
      ctx.ellipse(s.ufo.x + 18, s.ufo.y + 4, 10, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      drawPixelText(ctx, '?', s.ufo.x + 14, s.ufo.y - 2, 8, COLORS.WHITE)
    }

    // Draw player (cannon)
    drawPixelRect(ctx, s.player.x, s.player.y + 8, PLAYER_W, PLAYER_H - 8, COLORS.GOLD)
    drawPixelRect(ctx, s.player.x + PLAYER_W / 2 - 4, s.player.y, 8, 12, COLORS.GOLD)
    drawPixelRect(ctx, s.player.x + 4, s.player.y + 12, PLAYER_W - 8, 4, '#b8860b')

    // Draw bullets
    s.bullets.forEach(b => {
      drawPixelRect(ctx, b.x, b.y, BULLET_W, BULLET_H, COLORS.GREEN)
      ctx.fillStyle = 'rgba(57,255,20,0.3)'
      ctx.fillRect(b.x - 2, b.y, BULLET_W + 4, BULLET_H + 4)
    })

    // Draw enemy bullets
    s.enemyBullets.forEach(b => {
      drawPixelRect(ctx, b.x, b.y, ENEMY_BULLET_W, ENEMY_BULLET_H, COLORS.RED)
    })

    // HUD
    drawTimerBar(ctx, s.timeLeft, GAME_DURATION, CANVAS_WIDTH)
    drawPixelText(ctx, `SCORE: ${s.score}`, 10, 14, 10, COLORS.WHITE)
    drawPixelText(ctx, `TIME: ${Math.ceil(s.timeLeft)}`, CANVAS_WIDTH - 10, 14, 10, COLORS.GOLD, 'right')
  }, [endGame]), isPlaying && !ended)

  return (
    <div className="space-game">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="mg-canvas"
      />
      <div className="mg-controls-hint">
        LEFT/RIGHT TO MOVE &bull; SPACE TO FIRE
      </div>
    </div>
  )
}

export default SpaceCommandersGame
