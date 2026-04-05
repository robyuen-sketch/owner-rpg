import { useState, useEffect, useCallback, useRef } from 'react'
import PacManGame from './PacManGame'
import SpaceCommandersGame from './SpaceCommandersGame'
import SnakeGame from './SnakeGame'
import JungleRunGame from './JungleRunGame'
import CastlevaniaGame from './CastlevaniaGame'
import PirateShipGame from './PirateShipGame'
import WirePuzzleGame from './WirePuzzleGame'
import QuickDrawGame from './QuickDrawGame'
import './MiniGameWrapper.css'

const GAME_COMPONENTS = {
  pacman: PacManGame,
  space_commanders: SpaceCommandersGame,
  snake: SnakeGame,
  jungle_run: JungleRunGame,
  castlevania: CastlevaniaGame,
  pirate_ship: PirateShipGame,
  wire_puzzle: WirePuzzleGame,
  quick_draw: QuickDrawGame,
}

const GAME_NAMES = {
  pacman: "ANA'S ESCAPE",
  space_commanders: 'SPACE COMMANDERS',
  snake: 'AREPA SNAKE',
  jungle_run: 'JUNGLE RUN',
  castlevania: 'DOMAIN DUNGEONS',
  pirate_ship: 'PAYMENT LINE',
  wire_puzzle: 'WIRE CONNECT',
  quick_draw: 'QUICK DRAW',
}

function MiniGameWrapper({ gameType, difficulty, fromRealm, toRealm, onComplete, scoreMultiplier = 3 }) {
  const [phase, setPhase] = useState('intro') // intro | countdown | playing | ending | summary
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const countdownRef = useRef(null)

  // Intro phase: show game name + realm transition for 2 seconds
  useEffect(() => {
    if (phase === 'intro') {
      const t = setTimeout(() => setPhase('countdown'), 2000)
      return () => clearTimeout(t)
    }
  }, [phase])

  // Countdown phase: 3, 2, 1, GO
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      setPhase('playing')
      return
    }
    countdownRef.current = setTimeout(() => {
      setCountdown(prev => prev - 1)
    }, 700)
    return () => clearTimeout(countdownRef.current)
  }, [phase, countdown])

  const handleGameEnd = useCallback((finalScore) => {
    setScore(finalScore)
    setPhase('ending')
  }, [])

  // Ending phase: show "TIME'S UP" for 1.5 seconds, then summary
  useEffect(() => {
    if (phase === 'ending') {
      const t = setTimeout(() => setPhase('summary'), 1500)
      return () => clearTimeout(t)
    }
  }, [phase])

  const handleContinue = useCallback(() => {
    onComplete(score)
  }, [onComplete, score])

  // Keyboard support for summary
  useEffect(() => {
    if (phase !== 'summary') return
    const handleKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleContinue()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [phase, handleContinue])

  const GameComponent = GAME_COMPONENTS[gameType]
  const gameName = GAME_NAMES[gameType]

  return (
    <div className="mg-container">
      {/* Intro overlay */}
      {phase === 'intro' && (
        <div className="mg-overlay">
          <div className="mg-realm-transition">
            <div className="mg-from-realm">{fromRealm}</div>
            <div className="mg-arrow">&#9660;</div>
            <div className="mg-to-realm">{toRealm}</div>
          </div>
          <div className="mg-game-name">{gameName}</div>
          <div className="mg-difficulty">
            {'★'.repeat(difficulty)}{'☆'.repeat(4 - difficulty)}
          </div>
        </div>
      )}

      {/* Countdown overlay */}
      {phase === 'countdown' && (
        <div className="mg-overlay">
          <div className="mg-countdown">
            {countdown > 0 ? countdown : 'GO!'}
          </div>
        </div>
      )}

      {/* Game canvas */}
      {(phase === 'playing' || phase === 'ending') && GameComponent && (
        <GameComponent
          difficulty={difficulty}
          onEnd={handleGameEnd}
          isPlaying={phase === 'playing'}
        />
      )}

      {/* Ending overlay */}
      {phase === 'ending' && (
        <div className="mg-overlay mg-overlay-transparent">
          <div className="mg-times-up">TIME&apos;S UP!</div>
        </div>
      )}

      {/* Summary overlay */}
      {phase === 'summary' && (
        <div className="mg-overlay">
          <div className="mg-summary">
            <div className="mg-summary-title">{gameName}</div>
            <div className="mg-summary-label">MINI-GAME SCORE</div>
            <div className="mg-summary-raw">{score.toLocaleString()}</div>
            <div className="mg-summary-multiplier">x{scoreMultiplier}</div>
            <div className="mg-summary-score">{(score * scoreMultiplier).toLocaleString()}</div>
            <button className="retro-btn mg-continue-btn" onClick={handleContinue}>
              CONTINUE QUEST
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MiniGameWrapper
