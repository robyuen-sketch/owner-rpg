import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_DURATION, COLORS, SNAKE_CONFIG } from './gameConstants'
import { clearCanvas, drawPixelText, drawPixelRect, drawTimerBar } from './canvasUtils'
import './SnakeGame.css'

const COLS = 40
const ROWS = 25
const CELL_W = CANVAS_WIDTH / COLS
const CELL_H = CANVAS_HEIGHT / ROWS

const DIR_MAP = {
  ArrowRight: { dx: 1, dy: 0 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowUp: { dx: 0, dy: -1 },
  d: { dx: 1, dy: 0 },
  a: { dx: -1, dy: 0 },
  s: { dx: 0, dy: 1 },
  w: { dx: 0, dy: -1 },
}

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
    })
  }
  return obs
}

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
  }
}

function SnakeGame({ difficulty, onEnd, isPlaying }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(initGameState(difficulty))
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e) => {
      const d = DIR_MAP[e.key]
      if (!d) return
      e.preventDefault()
      const s = stateRef.current
      // Prevent reversing
      if (d.dx !== -s.dir.dx || d.dy !== -s.dir.dy) {
        s.nextDir = d
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const endGame = useCallback(() => {
    if (ended) return
    setEnded(true)
    const s = stateRef.current
    const lengthBonus = s.snake.length * 10
    onEnd(s.score + lengthBonus)
  }, [onEnd, ended])

  useGameLoop(useCallback((dt) => {
    const s = stateRef.current
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    s.timeLeft -= dt
    if (s.timeLeft <= 0 || s.dead) {
      s.timeLeft = Math.max(0, s.timeLeft)
      endGame()
      return
    }

    // Tick-based movement
    s.tickTimer += dt * 1000
    if (s.tickTimer >= s.tickMs) {
      s.tickTimer = 0
      s.dir = s.nextDir

      const head = s.snake[0]
      let newX = head.x + s.dir.dx
      let newY = head.y + s.dir.dy

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
        s.food = placeFood(s.snake, s.obstacles)
        // Speed up slightly
        s.tickMs = Math.max(50, s.tickMs - 2)
      } else {
        s.snake.pop()
      }
    }

    // === RENDER ===
    clearCanvas(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Grid background
    ctx.strokeStyle = 'rgba(45, 112, 255, 0.08)'
    ctx.lineWidth = 1
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath()
      ctx.moveTo(c * CELL_W, 0)
      ctx.lineTo(c * CELL_W, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * CELL_H)
      ctx.lineTo(CANVAS_WIDTH, r * CELL_H)
      ctx.stroke()
    }

    // Draw obstacles
    s.obstacles.forEach(o => {
      drawPixelRect(ctx, o.x * CELL_W + 1, o.y * CELL_H + 1, CELL_W - 2, CELL_H - 2, '#444')
      ctx.strokeStyle = '#666'
      ctx.lineWidth = 1
      ctx.strokeRect(o.x * CELL_W + 1, o.y * CELL_H + 1, CELL_W - 2, CELL_H - 2)
    })

    // Draw food (arepa - golden circle)
    const fx = s.food.x * CELL_W
    const fy = s.food.y * CELL_H
    ctx.fillStyle = COLORS.GOLD
    ctx.beginPath()
    ctx.arc(fx + CELL_W / 2, fy + CELL_H / 2, CELL_W / 2 - 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b8860b'
    ctx.beginPath()
    ctx.arc(fx + CELL_W / 2, fy + CELL_H / 2, CELL_W / 4, 0, Math.PI * 2)
    ctx.fill()
    // Glow
    ctx.fillStyle = 'rgba(255,215,0,0.2)'
    ctx.beginPath()
    ctx.arc(fx + CELL_W / 2, fy + CELL_H / 2, CELL_W, 0, Math.PI * 2)
    ctx.fill()

    // Draw snake
    s.snake.forEach((seg, i) => {
      const isHead = i === 0
      const color = isHead ? COLORS.GREEN : (i % 2 === 0 ? '#2ecc40' : '#27ae60')
      drawPixelRect(ctx, seg.x * CELL_W + 1, seg.y * CELL_H + 1, CELL_W - 2, CELL_H - 2, color)
      if (isHead) {
        // Eyes
        const eyeOffset = 3
        ctx.fillStyle = '#fff'
        ctx.fillRect(seg.x * CELL_W + eyeOffset, seg.y * CELL_H + eyeOffset, 4, 4)
        ctx.fillRect(seg.x * CELL_W + CELL_W - eyeOffset - 4, seg.y * CELL_H + eyeOffset, 4, 4)
        ctx.fillStyle = '#000'
        ctx.fillRect(seg.x * CELL_W + eyeOffset + 1, seg.y * CELL_H + eyeOffset + 1, 2, 2)
        ctx.fillRect(seg.x * CELL_W + CELL_W - eyeOffset - 3, seg.y * CELL_H + eyeOffset + 1, 2, 2)
      }
    })

    // Border for non-wrap mode
    if (!s.wrap) {
      ctx.strokeStyle = COLORS.RED
      ctx.lineWidth = 2
      ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    // HUD
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
      <div className="mg-controls-hint">
        ARROW KEYS / WASD TO MOVE
      </div>
    </div>
  )
}

export default SnakeGame
