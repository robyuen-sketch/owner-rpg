import './TopBar.css'

function TopBar({ lives, maxLives, gems, totalGems, score }) {
  const healthPercent = (lives / maxLives) * 100

  const getHealthColor = () => {
    if (healthPercent > 60) return '#39ff14'
    if (healthPercent > 30) return '#ffd700'
    return '#ff3333'
  }

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <img
          src="/logo.jpeg"
          alt="Owner.com"
          className="top-bar-logo"
          style={{ imageRendering: 'pixelated' }}
        />
        <img
          src="/ana-avatar.png"
          alt="Ana"
          className="top-bar-ana"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className="health-section">
          <span className="health-label">ANA'S MARGIN %</span>
          <div className="health-bar-outer">
            <div
              className="health-bar-inner"
              style={{
                width: `${healthPercent}%`,
                backgroundColor: getHealthColor(),
              }}
            />
          </div>
          <span className="lives-text">{lives}/{maxLives}</span>
        </div>
      </div>

      <div className="top-bar-right">
        {score > 0 && (
          <div className="score-counter">
            <span className="score-text">{score.toLocaleString()}</span>
          </div>
        )}
        <div className="gem-counter">
          <span className="gem-icon">&#x1F48E;</span>
          <span className="gem-text">{gems}/{totalGems}</span>
        </div>
      </div>
    </div>
  )
}

export default TopBar
