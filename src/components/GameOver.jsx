import { useEffect, useState } from 'react'
import './GameOver.css'

const BAGS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  left: 10 + (i * 11),
  delay: i * 0.3,
  duration: 1.5 + (i % 3) * 0.5,
}))

function GameOver({ onRestart }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  return (
    <div className={`gameover-screen ${visible ? 'gameover-visible' : ''}`}>
      <div className="gameover-fire-bg" />

      <div className="gameover-bags">
        {BAGS.map(bag => (
          <div
            key={bag.id}
            className="gameover-bag"
            style={{
              left: `${bag.left}%`,
              animationDelay: `${bag.delay}s`,
              animationDuration: `${bag.duration}s`,
            }}
          >
            <span className="bag-face">&#x1F4E6;</span>
            <span className="bag-angry">&#x1F620;</span>
          </div>
        ))}
      </div>

      <div className="gameover-content">
        <h1 className="gameover-title">MISSION FAILED</h1>

        <div className="gameover-ana-defeated">
          <img
            src="/ana-avatar.png"
            alt="Ana de Arepas"
            className="gameover-ana-img"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        <div className="gameover-text-box">
          <p className="gameover-text">
            You could not save Ana de Arepas.
            The Third-Party Delivery Empire has consumed
            her restaurant entirely.
          </p>
          <p className="gameover-text gameover-text-final">
            Ana's restaurant is no more.
          </p>
        </div>

        <button className="retro-btn gameover-restart-btn" onClick={onRestart}>
          TRY AGAIN
        </button>

        <p className="gameover-hint">
          TIP: Study the Owner.com platform to save Ana!
        </p>
      </div>
    </div>
  )
}

export default GameOver
