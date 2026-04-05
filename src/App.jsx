import { useState, useCallback, useEffect } from 'react'
import gameScript from './data/gameScript.json'
import { getMiniGameForTransition } from './data/miniGameConfig'
import { getRealmCutscene, isCompletionBeforeMiniGame } from './data/realmCutscenes'
import { useHighScore } from './hooks/useHighScore'
import IntroScreen from './components/IntroScreen'
import Cutscene from './components/Cutscene'
import RealmCutscene from './components/RealmCutscene'
import MiniGameWrapper from './components/minigames/MiniGameWrapper'
import HighScoreEntry from './components/HighScoreEntry'
import TopBar from './components/TopBar'
import ScenePanel from './components/ScenePanel'
import DialogueBox from './components/DialogueBox'
import OptionButtons from './components/OptionButtons'
import Overlay from './components/Overlay'
import GameOver from './components/GameOver'
import Victory from './components/Victory'

const TOTAL_GEMS = gameScript.length
const STARTING_LIVES = 10
const MINI_GAME_MULTIPLIER = 3

// Checkpoint: first question index of Repeat Order Railway (halfway through)
const CHECKPOINT_REALM = 'Repeat Order Railway'
const CHECKPOINT_INDEX = gameScript.findIndex(q => q.realm === CHECKPOINT_REALM)

function getAccuracyMultiplier(correct, total) {
  const ratio = correct / total
  if (ratio >= 1.0) return 1.5
  if (ratio >= 0.94) return 1.3
  if (ratio >= 0.89) return 1.2
  if (ratio >= 0.83) return 1.1
  return 1.0
}

function getSpeedBonus(elapsedSeconds) {
  return Math.max(0, Math.floor((15 - elapsedSeconds) * (500 / 15)))
}

function App() {
  const [gamePhase, setGamePhase] = useState('intro')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [gems, setGems] = useState(0)
  const [overlayData, setOverlayData] = useState(null)
  const [score, setScore] = useState(0)
  const [miniGameData, setMiniGameData] = useState(null)
  const [realmCutsceneData, setRealmCutsceneData] = useState(null)
  const [pendingMiniGame, setPendingMiniGame] = useState(null)
  const [gameStartTime, setGameStartTime] = useState(null)
  const [hasCheckpoint, setHasCheckpoint] = useState(false)
  const [checkpointScore, setCheckpointScore] = useState(0)
  const [checkpointGems, setCheckpointGems] = useState(0)
  const [checkpointCorrect, setCheckpointCorrect] = useState(0)

  // New scoring state
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [questionStartTime, setQuestionStartTime] = useState(null)
  const [questionBaseTotal, setQuestionBaseTotal] = useState(0)
  const [questionSpeedTotal, setQuestionSpeedTotal] = useState(0)
  const [miniGameRawTotal, setMiniGameRawTotal] = useState(0)
  const [scoreBreakdown, setScoreBreakdown] = useState(null)

  const { isHighScore, addScore, getScores, getTopScore } = useHighScore()

  // Save checkpoint when reaching the Railway realm
  useEffect(() => {
    if (!hasCheckpoint && currentQuestionIndex >= CHECKPOINT_INDEX && CHECKPOINT_INDEX >= 0) {
      setHasCheckpoint(true)
      setCheckpointScore(score)
      setCheckpointGems(gems)
      setCheckpointCorrect(correctAnswers)
    }
  }, [currentQuestionIndex, hasCheckpoint, score, gems, correctAnswers])

  const currentQuestion = gameScript[currentQuestionIndex]

  const handleStartGame = useCallback(() => {
    setGamePhase('cutscene')
  }, [])

  const handleCutsceneComplete = useCallback(() => {
    setGameStartTime(Date.now())
    setQuestionStartTime(Date.now())
    setGamePhase('playing')
  }, [])

  const handleAnswer = useCallback((selectedIndex) => {
    const question = gameScript[currentQuestionIndex]
    const isCorrect = selectedIndex === question.correctAnswerIndex
    const elapsed = questionStartTime ? (Date.now() - questionStartTime) / 1000 : 15

    if (isCorrect) {
      const basePoints = 1000
      const speedBonus = getSpeedBonus(elapsed)
      const totalPoints = basePoints + speedBonus

      setGems(prev => prev + 1)
      setCorrectAnswers(prev => prev + 1)
      setScore(prev => prev + totalPoints)
      setQuestionBaseTotal(prev => prev + basePoints)
      setQuestionSpeedTotal(prev => prev + speedBonus)
      setOverlayData({
        type: 'success',
        explanation: question.explanation,
        pointsEarned: { base: basePoints, speed: speedBonus, total: totalPoints },
      })
      setGamePhase('overlay')
    } else {
      const newLives = lives - 1
      setLives(newLives)

      if (newLives <= 0) {
        if (hasCheckpoint) {
          // Respawn at checkpoint with 1 life
          setCurrentQuestionIndex(CHECKPOINT_INDEX)
          setLives(1)
          setScore(checkpointScore)
          setGems(checkpointGems)
          setCorrectAnswers(checkpointCorrect)
          setOverlayData({
            type: 'checkpoint',
            explanation: "You've been revived at the Repeat Order Railway checkpoint! You have 1 life remaining — make it count!",
          })
          setGamePhase('overlay')
        } else {
          setGamePhase('gameover')
        }
      } else {
        setOverlayData({
          type: 'damage',
          explanation: question.explanation,
        })
        setGamePhase('overlay')
      }
    }
  }, [currentQuestionIndex, lives, questionStartTime])

  // Track the completed realm name so we can show its completion cutscene after the mini-game
  const [completedRealmName, setCompletedRealmName] = useState(null)

  const handleOverlayNext = useCallback(() => {
    if (overlayData?.type === 'success') {
      const nextIndex = currentQuestionIndex + 1
      if (nextIndex >= gameScript.length) {
        setGamePhase('victory')
      } else {
        const completedRealm = gameScript[currentQuestionIndex].realm
        const nextRealm = gameScript[nextIndex]?.realm
        const isRealmTransition = completedRealm !== nextRealm
        const miniGame = getMiniGameForTransition(currentQuestionIndex)

        if (isRealmTransition && miniGame) {
          // Realm transition WITH a mini-game
          setCompletedRealmName(completedRealm)
          setCurrentQuestionIndex(nextIndex)

          const completionSlides = getRealmCutscene(completedRealm, 'completion')
          if (completionSlides && isCompletionBeforeMiniGame(completedRealm)) {
            setRealmCutsceneData(completionSlides)
            setPendingMiniGame(miniGame)
            setGamePhase('realm_cutscene')
          } else {
            setMiniGameData(miniGame)
            setGamePhase('minigame')
          }
        } else if (isRealmTransition) {
          // Realm transition WITHOUT a mini-game — still show cutscenes
          setCompletedRealmName(completedRealm)
          setCurrentQuestionIndex(nextIndex)

          const completionSlides = getRealmCutscene(completedRealm, 'completion')
          const introSlides = nextRealm ? getRealmCutscene(nextRealm, 'intro') : null

          if (completionSlides && introSlides) {
            setRealmCutsceneData(completionSlides)
            setPendingMiniGame(introSlides)
            setGamePhase('realm_cutscene')
          } else if (completionSlides) {
            setRealmCutsceneData(completionSlides)
            setPendingMiniGame(null)
            setGamePhase('realm_cutscene')
          } else if (introSlides) {
            setRealmCutsceneData(introSlides)
            setPendingMiniGame(null)
            setGamePhase('realm_cutscene')
          } else {
            setQuestionStartTime(Date.now())
            setGamePhase('playing')
          }
        } else {
          // Same realm, just advance to next question
          setCurrentQuestionIndex(nextIndex)
          setQuestionStartTime(Date.now())
          setGamePhase('playing')
        }
      }
    } else {
      setQuestionStartTime(Date.now())
      setGamePhase('playing')
    }
    setOverlayData(null)
  }, [overlayData, currentQuestionIndex])

  const handleRealmCutsceneComplete = useCallback(() => {
    if (pendingMiniGame) {
      // Could be a mini-game object (has gameType) or cutscene slides array
      if (pendingMiniGame.gameType) {
        // It's a mini-game — launch it
        setMiniGameData(pendingMiniGame)
        setPendingMiniGame(null)
        setRealmCutsceneData(null)
        setGamePhase('minigame')
      } else {
        // It's cutscene slides — show them
        setRealmCutsceneData(pendingMiniGame)
        setPendingMiniGame(null)
        setGamePhase('realm_cutscene')
      }
    } else {
      setRealmCutsceneData(null)
      setQuestionStartTime(Date.now())
      setGamePhase('playing')
    }
  }, [pendingMiniGame])

  const handleMiniGameComplete = useCallback((rawScore) => {
    const multipliedScore = rawScore * MINI_GAME_MULTIPLIER
    setScore(prev => prev + multipliedScore)
    setMiniGameRawTotal(prev => prev + rawScore)
    setMiniGameData(null)

    // After mini-game: show completion cutscene of old realm (if not already shown), then intro cutscene of new realm
    const alreadyShowedCompletion = completedRealmName && isCompletionBeforeMiniGame(completedRealmName)
    const completionSlides = (!alreadyShowedCompletion && completedRealmName) ? getRealmCutscene(completedRealmName, 'completion') : null
    const nextRealm = gameScript[currentQuestionIndex]?.realm
    const introSlides = nextRealm ? getRealmCutscene(nextRealm, 'intro') : null

    if (completionSlides && introSlides) {
      // Show completion first, queue intro as pending
      setRealmCutsceneData(completionSlides)
      setPendingMiniGame(introSlides) // reusing pendingMiniGame to hold next cutscene slides
      setGamePhase('realm_cutscene')
    } else if (completionSlides) {
      setRealmCutsceneData(completionSlides)
      setPendingMiniGame(null)
      setGamePhase('realm_cutscene')
    } else if (introSlides) {
      setRealmCutsceneData(introSlides)
      setPendingMiniGame(null)
      setGamePhase('realm_cutscene')
    } else {
      setQuestionStartTime(Date.now())
      setGamePhase('playing')
    }

    setCompletedRealmName(null)
  }, [currentQuestionIndex, completedRealmName])

  const handleVictoryComplete = useCallback(() => {
    const totalSeconds = gameStartTime ? (Date.now() - gameStartTime) / 1000 : 600
    const completionBonus = Math.max(0, Math.floor((600 - totalSeconds) * 5))

    const accuracyMultiplier = getAccuracyMultiplier(correctAnswers, TOTAL_GEMS)
    const questionSubtotal = questionBaseTotal + questionSpeedTotal
    const questionTotal = Math.floor(questionSubtotal * accuracyMultiplier)
    const miniGameTotal = miniGameRawTotal * MINI_GAME_MULTIPLIER
    const grandTotal = questionTotal + miniGameTotal + completionBonus

    const breakdown = {
      questionBase: questionBaseTotal,
      questionSpeed: questionSpeedTotal,
      accuracyMultiplier,
      questionTotal,
      miniGameRaw: miniGameRawTotal,
      miniGameMultiplier: MINI_GAME_MULTIPLIER,
      miniGameTotal,
      completionBonus,
      grandTotal,
    }

    setScoreBreakdown(breakdown)
    setScore(grandTotal)

    if (isHighScore(grandTotal)) {
      setGamePhase('highscore_entry')
    } else {
      setGamePhase('victory_final')
    }
  }, [correctAnswers, questionBaseTotal, questionSpeedTotal, miniGameRawTotal, gameStartTime, isHighScore])

  const handleHighScoreSubmit = useCallback((initials) => {
    addScore(initials, score)
    setGamePhase('victory_final')
  }, [addScore, score])

  const handleRestart = useCallback(() => {
    setGamePhase('intro')
    setCurrentQuestionIndex(0)
    setLives(STARTING_LIVES)
    setGems(0)
    setOverlayData(null)
    setScore(0)
    setMiniGameData(null)
    setRealmCutsceneData(null)
    setPendingMiniGame(null)
    setGameStartTime(null)
    setCorrectAnswers(0)
    setQuestionStartTime(null)
    setQuestionBaseTotal(0)
    setQuestionSpeedTotal(0)
    setMiniGameRawTotal(0)
    setScoreBreakdown(null)
    setCompletedRealmName(null)
    setHasCheckpoint(false)
    setCheckpointScore(0)
    setCheckpointGems(0)
    setCheckpointCorrect(0)
  }, [])

  if (gamePhase === 'intro') {
    return <IntroScreen onStart={handleStartGame} leaderboard={getScores()} />
  }

  if (gamePhase === 'cutscene') {
    return <Cutscene onComplete={handleCutsceneComplete} />
  }

  if (gamePhase === 'realm_cutscene' && realmCutsceneData) {
    return <RealmCutscene slides={realmCutsceneData} onComplete={handleRealmCutsceneComplete} />
  }

  if (gamePhase === 'minigame' && miniGameData) {
    return (
      <MiniGameWrapper
        gameType={miniGameData.gameType}
        difficulty={miniGameData.difficulty}
        fromRealm={miniGameData.fromRealm}
        toRealm={miniGameData.toRealm}
        onComplete={handleMiniGameComplete}
        scoreMultiplier={MINI_GAME_MULTIPLIER}
      />
    )
  }

  if (gamePhase === 'gameover') {
    return <GameOver onRestart={handleRestart} />
  }

  if (gamePhase === 'victory') {
    return (
      <Victory
        gems={gems}
        totalGems={TOTAL_GEMS}
        score={score}
        onContinue={handleVictoryComplete}
      />
    )
  }

  if (gamePhase === 'highscore_entry') {
    return <HighScoreEntry score={score} onComplete={handleHighScoreSubmit} />
  }

  if (gamePhase === 'victory_final') {
    return (
      <Victory
        gems={gems}
        totalGems={TOTAL_GEMS}
        score={score}
        scoreBreakdown={scoreBreakdown}
        leaderboard={getScores()}
        onRestart={handleRestart}
      />
    )
  }

  return (
    <div className="game-container">
      <TopBar lives={lives} maxLives={STARTING_LIVES} gems={gems} totalGems={TOTAL_GEMS} score={score} />

      <div className="game-main">
        <ScenePanel realm={currentQuestion.realm} npc={currentQuestion.npc} />
        <DialogueBox
          realm={currentQuestion.realm}
          npc={currentQuestion.npc}
          dialogue={currentQuestion.dialogue}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={TOTAL_GEMS}
        />
      </div>

      <OptionButtons
        options={currentQuestion.options}
        onSelect={handleAnswer}
        disabled={gamePhase === 'overlay'}
      />

      {gamePhase === 'overlay' && overlayData && (
        <Overlay
          type={overlayData.type}
          explanation={overlayData.explanation}
          onNext={handleOverlayNext}
          pointsEarned={overlayData.pointsEarned}
        />
      )}
    </div>
  )
}

export default App
