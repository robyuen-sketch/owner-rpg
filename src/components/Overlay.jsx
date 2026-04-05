import { useEffect, useState } from 'react'
import './Overlay.css'

function Overlay({ type, explanation, onNext, pointsEarned }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const isSuccess = type === 'success'
  const isCheckpoint = type === 'checkpoint'

  return (
    <div className={`overlay ${visible ? 'overlay-visible' : ''} ${isSuccess ? 'overlay-success' : isCheckpoint ? 'overlay-checkpoint' : 'overlay-damage'}`}>
      <div className={`overlay-box ${isSuccess ? 'overlay-box-success' : isCheckpoint ? 'overlay-box-checkpoint' : 'overlay-box-damage'}`}>
        {isCheckpoint ? (
          <>
            <div className="overlay-row">
              <div className="overlay-gem-anim" style={{ fontSize: '2.5rem' }}>&#x1F6A9;</div>
              <img
                src="/ana-avatar.png"
                alt="Ana"
                className="overlay-ana overlay-ana-worried"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <h2 className="overlay-title" style={{ color: '#ffd700' }}>
              CHECKPOINT REVIVE!
            </h2>
            <p className="overlay-subtitle-success" style={{ color: '#ff8c00' }}>
              Ana returns to the Repeat Order Railway!
            </p>
          </>
        ) : isSuccess ? (
          <>
            <div className="overlay-row">
              <div className="overlay-gem-anim">&#x1F48E;</div>
              <img
                src="/ana-avatar.png"
                alt="Ana"
                className="overlay-ana overlay-ana-happy"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <h2 className="overlay-title overlay-title-success">
              MAGIC GEM COLLECTED!
            </h2>
            <p className="overlay-subtitle-success">
              Ana's margins are growing!
            </p>
            {pointsEarned && (
              <div className="overlay-points-container">
                <div className="overlay-points">+{pointsEarned.total.toLocaleString()} PTS</div>
                <div className="overlay-points-detail">
                  BASE: {pointsEarned.base.toLocaleString()}
                  {pointsEarned.speed > 0 && <> &nbsp;|&nbsp; SPEED: +{pointsEarned.speed.toLocaleString()}</>}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="overlay-row">
              <div className="overlay-damage-icon">&#x1F4A5;</div>
              <img
                src="/ana-avatar.png"
                alt="Ana"
                className="overlay-ana overlay-ana-worried"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <h2 className="overlay-title overlay-title-damage">
              WRONG! The 3rd Party Apps are closing in on Ana's restaurant!
            </h2>
          </>
        )}

        <p className="overlay-explanation">{explanation}</p>

        <button className="retro-btn overlay-next-btn" onClick={onNext}>
          {isSuccess ? 'NEXT SCENARIO >>>' : 'CONTINUE >>>'}
        </button>
      </div>
    </div>
  )
}

export default Overlay
