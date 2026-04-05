import { useState, useEffect, useCallback } from 'react'
import './HighScoreEntry.css'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function HighScoreEntry({ score, onComplete }) {
  const [initials, setInitials] = useState([0, 0, 0]) // indices into LETTERS
  const [activeSlot, setActiveSlot] = useState(0)

  const cycleLetter = useCallback((slot, dir) => {
    setInitials(prev => {
      const next = [...prev]
      next[slot] = (next[slot] + dir + 26) % 26
      return next
    })
  }, [])

  const handleConfirm = useCallback(() => {
    const str = initials.map(i => LETTERS[i]).join('')
    onComplete(str)
  }, [initials, onComplete])

  useEffect(() => {
    const handleKey = (e) => {
      e.preventDefault()
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          cycleLetter(activeSlot, 1)
          break
        case 'ArrowDown':
        case 's':
          cycleLetter(activeSlot, -1)
          break
        case 'ArrowLeft':
        case 'a':
          setActiveSlot(prev => Math.max(0, prev - 1))
          break
        case 'ArrowRight':
        case 'd':
          setActiveSlot(prev => Math.min(2, prev + 1))
          break
        case 'Enter':
        case ' ':
          if (activeSlot < 2) {
            setActiveSlot(prev => prev + 1)
          } else {
            handleConfirm()
          }
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeSlot, cycleLetter, handleConfirm])

  return (
    <div className="hs-screen">
      <div className="hs-glow" />
      <div className="hs-content">
        <h1 className="hs-title">NEW HIGH SCORE!</h1>
        <div className="hs-score-display">{score.toLocaleString()}</div>

        <p className="hs-instruction">ENTER YOUR INITIALS</p>

        <div className="hs-initials-row">
          {initials.map((letterIdx, i) => (
            <div key={i} className={`hs-slot ${i === activeSlot ? 'hs-slot-active' : ''}`}>
              <button
                className="hs-arrow hs-arrow-up"
                onClick={() => { setActiveSlot(i); cycleLetter(i, 1) }}
              >
                &#9650;
              </button>
              <span className="hs-letter">{LETTERS[letterIdx]}</span>
              <button
                className="hs-arrow hs-arrow-down"
                onClick={() => { setActiveSlot(i); cycleLetter(i, -1) }}
              >
                &#9660;
              </button>
            </div>
          ))}
        </div>

        <button className="retro-btn hs-confirm-btn" onClick={handleConfirm}>
          ENTER
        </button>

        <p className="hs-hint">ARROWS TO SELECT &bull; ENTER TO CONFIRM</p>
      </div>
    </div>
  )
}

export default HighScoreEntry
