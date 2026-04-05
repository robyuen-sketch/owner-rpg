import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameLoop } from './useGameLoop'
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from './gameConstants'
import { clearCanvas, drawPixelText } from './canvasUtils'
import './WirePuzzleGame.css'

// Game constants
const TILE_SIZE = 60
const WIRE_WIDTH = 4
const TOTAL_PUZZLES = 2
const BG_COLOR = '#0a2a2a'
const GRID_COLOR = '#0d4a4a'
const WIRE_OFF = '#00ffcc'
const WIRE_ON = '#ffd700'
const SOURCE_COLOR = '#39ff14'
const TARGET_COLOR = '#ffd700'

// Directions: bitmask
const UP = 1
const RIGHT = 2
const DOWN = 4
const LEFT = 8

// Tile types: each is a bitmask of connections
const TILE_TYPES = {
  EMPTY: 0,
  STRAIGHT_H: RIGHT | LEFT,        // --
  STRAIGHT_V: UP | DOWN,            // |
  CORNER_UR: UP | RIGHT,            // L top-right
  CORNER_RD: RIGHT | DOWN,          // L bottom-right
  CORNER_DL: DOWN | LEFT,           // L bottom-left
  CORNER_LU: LEFT | UP,             // L top-left
  T_URD: UP | RIGHT | DOWN,         // T right
  T_RDL: RIGHT | DOWN | LEFT,       // T down
  T_DLU: DOWN | LEFT | UP,          // T left
  T_LUR: LEFT | UP | RIGHT,         // T up
  CROSS: UP | RIGHT | DOWN | LEFT,  // +
}

// Rotate a connection bitmask 90 degrees clockwise
function rotateCW(connections) {
  let result = 0
  if (connections & UP) result |= RIGHT
  if (connections & RIGHT) result |= DOWN
  if (connections & DOWN) result |= LEFT
  if (connections & LEFT) result |= UP
  return result
}

// Opposite direction
function opposite(dir) {
  switch (dir) {
    case UP: return DOWN
    case DOWN: return UP
    case LEFT: return RIGHT
    case RIGHT: return LEFT
    default: return 0
  }
}

// Direction to grid offset
function dirOffset(dir) {
  switch (dir) {
    case UP: return { dr: -1, dc: 0 }
    case DOWN: return { dr: 1, dc: 0 }
    case LEFT: return { dr: 0, dc: -1 }
    case RIGHT: return { dr: 0, dc: 1 }
    default: return { dr: 0, dc: 0 }
  }
}

// Get grid config based on difficulty and puzzle number
function getGridConfig(difficulty, puzzleNum) {
  const d = Math.min(difficulty, 4)
  if (d <= 1) return { cols: 6, rows: 5 }
  if (d === 2) return puzzleNum === 0 ? { cols: 6, rows: 5 } : { cols: 7, rows: 5 }
  if (d === 3) return puzzleNum === 0 ? { cols: 7, rows: 5 } : { cols: 7, rows: 6 }
  return puzzleNum === 0 ? { cols: 7, rows: 6 } : { cols: 8, rows: 6 }
}

// Generate a puzzle: create a valid path, place tiles, randomize rotations
function generatePuzzle(cols, rows, difficulty) {
  // Initialize empty grid
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ connections: 0, solved: false }))
  )

  // Pick source and target rows
  const sourceRow = Math.floor(rows / 2)
  const targetRow = Math.floor(rows / 2) + (Math.random() < 0.5 ? -1 : 0)

  // Generate a valid path from (sourceRow, 0) to (targetRow, cols-1) using random walk
  const path = []
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false))

  function buildPath(r, c, targetR, targetC) {
    path.push({ r, c })
    visited[r][c] = true

    if (r === targetR && c === targetC) return true

    // Bias towards moving right, but allow up/down
    const dirs = []
    // Always try right first with high priority
    if (c < targetC) dirs.push(RIGHT, RIGHT, RIGHT)
    // Allow vertical movement
    if (r > 0 && !visited[r - 1][c]) dirs.push(UP)
    if (r < rows - 1 && !visited[r + 1][c]) dirs.push(DOWN)
    if (c < cols - 1 && !visited[r][c + 1]) dirs.push(RIGHT)

    // Shuffle with bias
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]]
    }

    // Remove duplicates
    const tried = new Set()
    for (const dir of dirs) {
      if (tried.has(dir)) continue
      tried.add(dir)

      const { dr, dc } = dirOffset(dir)
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      if (visited[nr][nc]) continue
      // Don't go left
      if (nc < c) continue

      if (buildPath(nr, nc, targetR, targetC)) return true
    }

    path.pop()
    visited[r][c] = false
    return false
  }

  buildPath(sourceRow, 0, targetRow, cols - 1)

  // Set connections along the path
  for (let i = 0; i < path.length; i++) {
    const { r, c } = path[i]
    let conn = 0
    if (i > 0) {
      const prev = path[i - 1]
      if (prev.r < r) conn |= UP
      if (prev.r > r) conn |= DOWN
      if (prev.c < c) conn |= LEFT
      if (prev.c > c) conn |= RIGHT
    }
    if (i < path.length - 1) {
      const next = path[i + 1]
      if (next.r < r) conn |= UP
      if (next.r > r) conn |= DOWN
      if (next.c < c) conn |= LEFT
      if (next.c > c) conn |= RIGHT
    }
    // Source tile gets LEFT connection (from outside)
    if (i === 0) conn |= LEFT
    // Target tile gets RIGHT connection (to outside)
    if (i === path.length - 1) conn |= RIGHT

    grid[r][c].connections = conn
    grid[r][c].isPath = true
  }

  // Fill non-path tiles with random wire segments
  const d = Math.min(difficulty, 4)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].isPath) continue

      const rand = Math.random()
      if (rand < 0.25) {
        // Empty
        grid[r][c].connections = 0
      } else if (rand < 0.55) {
        // Straight
        grid[r][c].connections = Math.random() < 0.5
          ? (UP | DOWN) : (LEFT | RIGHT)
      } else if (rand < 0.8) {
        // Corner
        const corners = [UP | RIGHT, RIGHT | DOWN, DOWN | LEFT, LEFT | UP]
        grid[r][c].connections = corners[Math.floor(Math.random() * 4)]
      } else if (d >= 2 && rand < 0.92) {
        // T-junction
        const ts = [UP | RIGHT | DOWN, RIGHT | DOWN | LEFT, DOWN | LEFT | UP, LEFT | UP | RIGHT]
        grid[r][c].connections = ts[Math.floor(Math.random() * 4)]
      } else if (d >= 4) {
        // Cross
        grid[r][c].connections = UP | RIGHT | DOWN | LEFT
      } else {
        grid[r][c].connections = Math.random() < 0.5
          ? (UP | DOWN) : (LEFT | RIGHT)
      }
    }
  }

  // Store the solution connections
  const solution = grid.map(row => row.map(t => t.connections))

  // Randomly rotate ALL tiles (1-3 times)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].connections === 0) continue
      // Cross tiles don't need rotation (symmetrical)
      if (grid[r][c].connections === (UP | RIGHT | DOWN | LEFT)) continue

      const rotations = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < rotations; i++) {
        grid[r][c].connections = rotateCW(grid[r][c].connections)
      }
    }
  }

  return {
    grid,
    solution,
    sourceRow,
    targetRow,
    cols,
    rows,
  }
}

// BFS from source to check connectivity
function checkConnectivity(grid, rows, cols, sourceRow, targetRow) {
  const powered = Array.from({ length: rows }, () => Array(cols).fill(false))
  const queue = []

  // Source is col 0, sourceRow - check if it has LEFT connection (to external source)
  const startTile = grid[sourceRow][0]
  if (startTile.connections & LEFT) {
    powered[sourceRow][0] = true
    queue.push({ r: sourceRow, c: 0 })
  }

  while (queue.length > 0) {
    const { r, c } = queue.shift()
    const tile = grid[r][c]

    const directions = [UP, RIGHT, DOWN, LEFT]
    for (const dir of directions) {
      if (!(tile.connections & dir)) continue

      const { dr, dc } = dirOffset(dir)
      const nr = r + dr
      const nc = c + dc

      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      if (powered[nr][nc]) continue

      // Check if neighbor connects back
      const neighbor = grid[nr][nc]
      if (neighbor.connections & opposite(dir)) {
        powered[nr][nc] = true
        queue.push({ r: nr, c: nc })
      }
    }
  }

  // Check if target is reached
  const targetReached = powered[targetRow][cols - 1] &&
    (grid[targetRow][cols - 1].connections & RIGHT)

  return { powered, targetReached }
}

function initGameState(difficulty) {
  const d = Math.min(Math.max(difficulty, 1), 4)
  const config = getGridConfig(d, 0)
  const puzzle = generatePuzzle(config.cols, config.rows, d)
  const { powered, targetReached } = checkConnectivity(
    puzzle.grid, puzzle.rows, puzzle.cols, puzzle.sourceRow, puzzle.targetRow
  )

  return {
    difficulty: d,
    puzzleIndex: 0,
    puzzle,
    powered,
    targetReached,
    elapsed: 0,
    finished: false,
    solveFlash: 0,
    solveDelay: 0,
    particles: [],
    hoverTile: null,
    lastClicked: null,
    clickAnim: 0,
    // Electricity flow animation
    flowOffset: 0,
  }
}

function WirePuzzleGame({ difficulty, onEnd, isPlaying }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(initGameState(difficulty))
  const [ended, setEnded] = useState(false)

  // Click/tap handler: rotate tile
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleClick = (e) => {
      const s = stateRef.current
      if (s.finished || s.solveDelay > 0) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = CANVAS_WIDTH / rect.width
      const scaleY = CANVAS_HEIGHT / rect.height

      let clientX, clientY
      if (e.touches) {
        clientX = e.touches[0].clientX
        clientY = e.touches[0].clientY
      } else {
        clientX = e.clientX
        clientY = e.clientY
      }

      const px = (clientX - rect.left) * scaleX
      const py = (clientY - rect.top) * scaleY

      const { puzzle } = s
      const gridW = puzzle.cols * TILE_SIZE
      const gridH = puzzle.rows * TILE_SIZE
      const offsetX = (CANVAS_WIDTH - gridW) / 2
      const offsetY = (CANVAS_HEIGHT - gridH) / 2 + 10

      const col = Math.floor((px - offsetX) / TILE_SIZE)
      const row = Math.floor((py - offsetY) / TILE_SIZE)

      if (col < 0 || col >= puzzle.cols || row < 0 || row >= puzzle.rows) return

      const tile = puzzle.grid[row][col]
      if (tile.connections === 0) return
      // Don't rotate cross tiles (symmetrical)
      if (tile.connections === (UP | RIGHT | DOWN | LEFT)) return

      // Rotate clockwise
      tile.connections = rotateCW(tile.connections)
      s.lastClicked = { r: row, c: col }
      s.clickAnim = 0.3

      // Recheck connectivity
      const { powered, targetReached } = checkConnectivity(
        puzzle.grid, puzzle.rows, puzzle.cols, puzzle.sourceRow, puzzle.targetRow
      )
      s.powered = powered
      s.targetReached = targetReached

      if (targetReached && s.solveDelay <= 0) {
        s.solveFlash = 1.0
        s.solveDelay = 1.5 // delay before next puzzle or end
      }
    }

    const handleMouseMove = (e) => {
      const s = stateRef.current
      const rect = canvas.getBoundingClientRect()
      const scaleX = CANVAS_WIDTH / rect.width
      const scaleY = CANVAS_HEIGHT / rect.height
      const px = (e.clientX - rect.left) * scaleX
      const py = (e.clientY - rect.top) * scaleY

      const { puzzle } = s
      const gridW = puzzle.cols * TILE_SIZE
      const gridH = puzzle.rows * TILE_SIZE
      const offsetX = (CANVAS_WIDTH - gridW) / 2
      const offsetY = (CANVAS_HEIGHT - gridH) / 2 + 10

      const col = Math.floor((px - offsetX) / TILE_SIZE)
      const row = Math.floor((py - offsetY) / TILE_SIZE)

      if (col >= 0 && col < puzzle.cols && row >= 0 && row < puzzle.rows) {
        s.hoverTile = { r: row, c: col }
      } else {
        s.hoverTile = null
      }
    }

    canvas.addEventListener('mousedown', handleClick)
    canvas.addEventListener('touchstart', handleClick, { passive: true })
    canvas.addEventListener('mousemove', handleMouseMove)

    return () => {
      canvas.removeEventListener('mousedown', handleClick)
      canvas.removeEventListener('touchstart', handleClick)
      canvas.removeEventListener('mousemove', handleMouseMove)
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
    s.flowOffset += dt * 80
    if (s.clickAnim > 0) s.clickAnim -= dt

    // Handle puzzle solve delay
    if (s.solveDelay > 0) {
      s.solveDelay -= dt
      s.solveFlash = Math.max(0, s.solveFlash - dt * 0.8)

      if (s.solveDelay <= 0) {
        if (s.puzzleIndex < TOTAL_PUZZLES - 1) {
          // Next puzzle
          s.puzzleIndex++
          const config = getGridConfig(s.difficulty, s.puzzleIndex)
          s.puzzle = generatePuzzle(config.cols, config.rows, s.difficulty)
          const { powered, targetReached } = checkConnectivity(
            s.puzzle.grid, s.puzzle.rows, s.puzzle.cols,
            s.puzzle.sourceRow, s.puzzle.targetRow
          )
          s.powered = powered
          s.targetReached = targetReached
          s.solveFlash = 0
          s.lastClicked = null
        } else {
          // All puzzles done
          s.finished = true
          endGame()
          return
        }
      }
    }

    // Update particles
    if (s.targetReached) {
      // Spawn particles along the powered path
      if (Math.random() < 0.3) {
        const { puzzle, powered } = s
        for (let r = 0; r < puzzle.rows; r++) {
          for (let c = 0; c < puzzle.cols; c++) {
            if (powered[r][c] && Math.random() < 0.02) {
              const gridW = puzzle.cols * TILE_SIZE
              const gridH = puzzle.rows * TILE_SIZE
              const offsetX = (CANVAS_WIDTH - gridW) / 2
              const offsetY = (CANVAS_HEIGHT - gridH) / 2 + 10
              s.particles.push({
                x: offsetX + c * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * 20,
                y: offsetY + r * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 60,
                vy: (Math.random() - 0.5) * 60 - 30,
                life: 0.5 + Math.random() * 0.5,
                size: 2 + Math.random() * 3,
              })
            }
          }
        }
      }
    }

    // Update particles
    s.particles = s.particles.filter(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      return p.life > 0
    })

    // === RENDER ===
    const { puzzle, powered } = s
    const gridW = puzzle.cols * TILE_SIZE
    const gridH = puzzle.rows * TILE_SIZE
    const offsetX = (CANVAS_WIDTH - gridW) / 2
    const offsetY = (CANVAS_HEIGHT - gridH) / 2 + 10

    // Background
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Circuit board texture - faint trace lines
    ctx.strokeStyle = '#0d3535'
    ctx.lineWidth = 1
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let i = 0; i < CANVAS_HEIGHT; i += 20) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(CANVAS_WIDTH, i)
      ctx.stroke()
    }

    // Small decorative circuit dots
    ctx.fillStyle = '#0d4040'
    for (let i = 20; i < CANVAS_WIDTH; i += 60) {
      for (let j = 20; j < CANVAS_HEIGHT; j += 60) {
        if (Math.abs(i - CANVAS_WIDTH / 2) < gridW / 2 + 20 &&
            Math.abs(j - CANVAS_HEIGHT / 2) < gridH / 2 + 20) continue
        ctx.beginPath()
        ctx.arc(i, j, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Grid background
    ctx.fillStyle = '#061a1a'
    ctx.fillRect(offsetX - 2, offsetY - 2, gridW + 4, gridH + 4)

    // Draw grid lines
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    for (let c = 0; c <= puzzle.cols; c++) {
      ctx.beginPath()
      ctx.moveTo(offsetX + c * TILE_SIZE, offsetY)
      ctx.lineTo(offsetX + c * TILE_SIZE, offsetY + gridH)
      ctx.stroke()
    }
    for (let r = 0; r <= puzzle.rows; r++) {
      ctx.beginPath()
      ctx.moveTo(offsetX, offsetY + r * TILE_SIZE)
      ctx.lineTo(offsetX + gridW, offsetY + r * TILE_SIZE)
      ctx.stroke()
    }

    // Draw tiles
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const tile = puzzle.grid[r][c]
        const tx = offsetX + c * TILE_SIZE
        const ty = offsetY + r * TILE_SIZE
        const cx = tx + TILE_SIZE / 2
        const cy = ty + TILE_SIZE / 2
        const isPowered = powered[r][c]

        // Hover highlight
        if (s.hoverTile && s.hoverTile.r === r && s.hoverTile.c === c && tile.connections !== 0) {
          ctx.fillStyle = 'rgba(0, 255, 204, 0.08)'
          ctx.fillRect(tx + 1, ty + 1, TILE_SIZE - 2, TILE_SIZE - 2)
        }

        // Last clicked animation
        if (s.lastClicked && s.lastClicked.r === r && s.lastClicked.c === c && s.clickAnim > 0) {
          ctx.fillStyle = `rgba(0, 255, 204, ${s.clickAnim * 0.3})`
          ctx.fillRect(tx + 1, ty + 1, TILE_SIZE - 2, TILE_SIZE - 2)
        }

        if (tile.connections === 0) continue

        // Wire color
        const wireColor = isPowered ? WIRE_ON : WIRE_OFF

        // Draw center node
        ctx.fillStyle = wireColor
        ctx.beginPath()
        ctx.arc(cx, cy, WIRE_WIDTH + 1, 0, Math.PI * 2)
        ctx.fill()

        // Glow for powered wires
        if (isPowered) {
          ctx.save()
          ctx.shadowColor = WIRE_ON
          ctx.shadowBlur = 8
        }

        // Draw wire segments
        ctx.strokeStyle = wireColor
        ctx.lineWidth = WIRE_WIDTH
        ctx.lineCap = 'round'

        if (tile.connections & UP) {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx, ty)
          ctx.stroke()
        }
        if (tile.connections & DOWN) {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx, ty + TILE_SIZE)
          ctx.stroke()
        }
        if (tile.connections & LEFT) {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(tx, cy)
          ctx.stroke()
        }
        if (tile.connections & RIGHT) {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(tx + TILE_SIZE, cy)
          ctx.stroke()
        }

        if (isPowered) {
          ctx.restore()
        }

        // Electricity flow animation on powered wires
        if (isPowered) {
          const dirs = [UP, DOWN, LEFT, RIGHT]
          for (const dir of dirs) {
            if (!(tile.connections & dir)) continue
            // Draw flowing dots along the wire
            const { dr, dc } = dirOffset(dir)
            for (let t = 0; t < 3; t++) {
              const frac = ((s.flowOffset / 60 + t * 0.33) % 1)
              const dotX = cx + dc * (TILE_SIZE / 2) * frac
              const dotY = cy + dr * (TILE_SIZE / 2) * frac
              ctx.fillStyle = `rgba(255, 255, 255, ${0.8 - frac * 0.6})`
              ctx.beginPath()
              ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      }
    }

    // Draw power source (left side)
    const srcX = offsetX - 20
    const srcY = offsetY + puzzle.sourceRow * TILE_SIZE + TILE_SIZE / 2
    // Pulsing glow
    const pulse = Math.sin(s.elapsed * 4) * 0.3 + 0.7
    ctx.save()
    ctx.shadowColor = SOURCE_COLOR
    ctx.shadowBlur = 12 * pulse
    ctx.fillStyle = SOURCE_COLOR
    ctx.beginPath()
    ctx.arc(srcX, srcY, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    // Source wire to grid
    ctx.strokeStyle = SOURCE_COLOR
    ctx.lineWidth = WIRE_WIDTH
    ctx.beginPath()
    ctx.moveTo(srcX + 10, srcY)
    ctx.lineTo(offsetX, srcY)
    ctx.stroke()
    // "PWR" label
    drawPixelText(ctx, 'PWR', srcX - 18, srcY - 20, 7, SOURCE_COLOR, 'center')

    // Draw target endpoint (right side)
    const tgtX = offsetX + gridW + 20
    const tgtY = offsetY + puzzle.targetRow * TILE_SIZE + TILE_SIZE / 2
    // Chip icon
    ctx.save()
    if (s.targetReached) {
      ctx.shadowColor = TARGET_COLOR
      ctx.shadowBlur = 15
    }
    ctx.fillStyle = s.targetReached ? TARGET_COLOR : '#664400'
    ctx.fillRect(tgtX - 10, tgtY - 10, 20, 20)
    // Chip pins
    ctx.fillStyle = s.targetReached ? '#fff' : '#553300'
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(tgtX - 13, tgtY + i * 6 - 2, 4, 3)
      ctx.fillRect(tgtX + 9, tgtY + i * 6 - 2, 4, 3)
      ctx.fillRect(tgtX + i * 6 - 2, tgtY - 13, 3, 4)
      ctx.fillRect(tgtX + i * 6 - 2, tgtY + 9, 3, 4)
    }
    ctx.restore()
    // Target wire from grid
    ctx.strokeStyle = s.targetReached ? TARGET_COLOR : '#664400'
    ctx.lineWidth = WIRE_WIDTH
    ctx.beginPath()
    ctx.moveTo(offsetX + gridW, tgtY)
    ctx.lineTo(tgtX - 10, tgtY)
    ctx.stroke()
    // "API" label
    drawPixelText(ctx, 'API', tgtX + 2, tgtY - 22, 7,
      s.targetReached ? TARGET_COLOR : '#664400', 'center')

    // Draw particles
    s.particles.forEach(p => {
      ctx.fillStyle = `rgba(255, 215, 0, ${p.life})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
      ctx.fill()
    })

    // Solve flash
    if (s.solveFlash > 0) {
      ctx.fillStyle = `rgba(255, 215, 0, ${s.solveFlash * 0.15})`
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // "CONNECTED!" text
      ctx.save()
      ctx.shadowColor = WIRE_ON
      ctx.shadowBlur = 20
      drawPixelText(ctx, 'CONNECTED!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60,
        16, WIRE_ON, 'center')
      ctx.restore()
    }

    // === HUD ===
    // Puzzle indicator
    drawPixelText(ctx, `PUZZLE ${s.puzzleIndex + 1}/${TOTAL_PUZZLES}`,
      CANVAS_WIDTH / 2, 6, 10, COLORS.WHITE, 'center')

    // Timer
    const timeStr = `TIME: ${Math.floor(s.elapsed)}s`
    drawPixelText(ctx, timeStr, 10, 6, 8, '#00ccaa')

    // Score estimate
    const maxTime = 90
    const minScore = 100
    const maxScore = 1000
    const timeFraction = Math.max(0, 1 - s.elapsed / maxTime)
    const estScore = Math.floor(minScore + (maxScore - minScore) * timeFraction)
    drawPixelText(ctx, `SCORE: ~${estScore}`, CANVAS_WIDTH - 10, 6, 8, COLORS.GOLD, 'right')

    // Story context
    drawPixelText(ctx, 'LOCATION: 6767 NEW JERSEY', 10, CANVAS_HEIGHT - 14, 7, '#0a6a5a')

    // Controls hint
    if (s.elapsed < 5) {
      const alpha = Math.min(1, (5 - s.elapsed) / 2)
      ctx.globalAlpha = alpha
      drawPixelText(ctx, 'CLICK TILES TO ROTATE | CONNECT THE WIRES',
        CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14, 7, '#00aa88', 'center')
      ctx.globalAlpha = 1.0
    }

  }, [endGame]), isPlaying && !ended)

  return (
    <div className="wire-puzzle-game">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="mg-canvas"
      />
      <div className="mg-controls-hint">
        CLICK TILES TO ROTATE | CONNECT THE WIRES
      </div>
    </div>
  )
}

export default WirePuzzleGame
