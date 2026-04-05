import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_DURATION, COLORS, PACMAN_CONFIG, PACMAN_MAZES } from './gameConstants'
import { clearCanvas, drawPixelText, drawPixelRect, drawTimerBar, drawAnaSprite, drawGhost } from './canvasUtils'
import './PacManGame.css'

const TILE_W = CANVAS_WIDTH / 20
const TILE_H = CANVAS_HEIGHT / 12
const GHOST_COLORS = ['#ff3333', '#ff8c00', '#00ccff', '#ff69b4']

function initGameState(difficulty) {
  const config = PACMAN_CONFIG[Math.min(difficulty - 1, 3)]
  const maze = PACMAN_MAZES[Math.min(difficulty - 1, 3)].map(row => [...row])

  // Find player start (first pellet position near bottom-left)
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

  // Find ghost spawn positions
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
        })
        maze[r][c] = 3
      }
    }
  }

  // Count pellets
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
      dir: 0, // 0=right, PI=left, PI/2=down, -PI/2=up
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
    const { maze, player, ghosts, config } = s
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    // Timer
    s.timeLeft -= dt
    if (s.timeLeft <= 0) {
      s.timeLeft = 0
      endGame()
      return
    }

    // Mouth animation
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
      // Get direction from angle
      let dx = Math.round(Math.cos(player.dir))
      let dy = Math.round(Math.sin(player.dir))
      const targetX = player.x + dx
      const targetY = player.y + dy

      if (canMove(maze, targetX, targetY)) {
        player.px += dx * speed
        player.py += dy * speed

        // Check if we reached the next tile
        const targetPx = targetX * TILE_W
        const targetPy = targetY * TILE_H
        const distX = targetPx - player.px
        const distY = targetPy - player.py

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
    } else if (maze[player.y] && maze[player.y][player.x] === 2) {
      maze[player.y][player.x] = 3
      s.score += 50
      s.pelletCount--
      s.powerTimer = 5
      ghosts.forEach(g => { g.scared = true })
    }

    // All pellets collected
    if (s.pelletCount <= 0) {
      endGame()
      return
    }

    // Ghost movement (simple AI)
    const ghostSpeed = config.ghostSpeed * TILE_W * dt
    ghosts.forEach(g => {
      // Determine possible directions
      const dirs = []
      if (canMove(maze, g.x + 1, g.y)) dirs.push({ dx: 1, dy: 0 })
      if (canMove(maze, g.x - 1, g.y)) dirs.push({ dx: -1, dy: 0 })
      if (canMove(maze, g.x, g.y + 1)) dirs.push({ dx: 0, dy: 1 })
      if (canMove(maze, g.x, g.y - 1)) dirs.push({ dx: 0, dy: -1 })

      if (dirs.length > 0) {
        // At tile center, pick new direction
        const atCenter = Math.abs(g.px - g.x * TILE_W) < 2 && Math.abs(g.py - g.y * TILE_H) < 2
        if (atCenter) {
          let chosen
          if (g.scared) {
            // Run away from player
            chosen = dirs.reduce((best, d) => {
              const dist = Math.abs((g.x + d.dx) - player.x) + Math.abs((g.y + d.dy) - player.y)
              const bestDist = Math.abs((g.x + best.dx) - player.x) + Math.abs((g.y + best.dy) - player.y)
              return dist > bestDist ? d : best
            }, dirs[0])
          } else {
            // Chase player (with some randomness)
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

        if (g.dir && canMove(maze, g.x + g.dir.dx, g.y + g.dir.dy)) {
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
          g.x = 9
          g.y = 5
          g.px = g.x * TILE_W
          g.py = g.y * TILE_H
          g.scared = false
        } else {
          // Player hit - lose some time
          s.timeLeft -= 3
          player.x = 1
          player.y = 10
          player.px = player.x * TILE_W
          player.py = player.y * TILE_H
        }
      }
    })

    // === RENDER ===
    clearCanvas(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw maze
    for (let r = 0; r < maze.length; r++) {
      for (let c = 0; c < maze[r].length; c++) {
        const x = c * TILE_W
        const y = r * TILE_H
        if (maze[r][c] === 0) {
          drawPixelRect(ctx, x, y, TILE_W, TILE_H, '#112')
          // Wall borders
          ctx.strokeStyle = COLORS.BLUE
          ctx.lineWidth = 1
          if (r > 0 && maze[r - 1][c] !== 0) ctx.strokeRect(x, y, TILE_W, 1)
          if (r < maze.length - 1 && maze[r + 1][c] !== 0) ctx.strokeRect(x, y + TILE_H - 1, TILE_W, 1)
          if (c > 0 && maze[r][c - 1] !== 0) ctx.strokeRect(x, y, 1, TILE_H)
          if (c < maze[r].length - 1 && maze[r][c + 1] !== 0) ctx.strokeRect(x + TILE_W - 1, y, 1, TILE_H)
        } else {
          // Floor
          drawPixelRect(ctx, x, y, TILE_W, TILE_H, '#0a0a0a')
          // Pellets
          if (maze[r][c] === 1) {
            ctx.fillStyle = '#fff'
            ctx.beginPath()
            ctx.arc(x + TILE_W / 2, y + TILE_H / 2, 3, 0, Math.PI * 2)
            ctx.fill()
          } else if (maze[r][c] === 2) {
            ctx.fillStyle = COLORS.GOLD
            ctx.beginPath()
            ctx.arc(x + TILE_W / 2, y + TILE_H / 2, 6, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = 'rgba(255,215,0,0.3)'
            ctx.beginPath()
            ctx.arc(x + TILE_W / 2, y + TILE_H / 2, 10, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }

    // Draw ghosts
    ghosts.forEach(g => {
      const ghostSize = TILE_W * 0.85
      const color = g.scared ? '#3333ff' : g.color
      drawGhost(ctx, g.px + (TILE_W - ghostSize) / 2, g.py + (TILE_H - ghostSize) / 2, ghostSize, color)
    })

    // Draw player (Ana as pac-man)
    drawAnaSprite(ctx, player.px + 2, player.py + 2, TILE_W - 4, player.dir, Math.max(0.05, s.mouthAngle))

    // HUD
    drawTimerBar(ctx, s.timeLeft, GAME_DURATION, CANVAS_WIDTH)
    drawPixelText(ctx, `SCORE: ${s.score}`, 10, 14, 10, COLORS.WHITE)
    drawPixelText(ctx, `TIME: ${Math.ceil(s.timeLeft)}`, CANVAS_WIDTH - 10, 14, 10, COLORS.GOLD, 'right')

    if (s.powerTimer > 0) {
      drawPixelText(ctx, 'POWER!', CANVAS_WIDTH / 2, 14, 10, '#3333ff', 'center')
    }
  }, [endGame]), isPlaying && !ended)

  return (
    <div className="pacman-game">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="mg-canvas"
      />
      <div className="mg-controls-hint">
        ARROW KEYS / WASD TO MOVE
      </div>
    </div>
  )
}

export default PacManGame
