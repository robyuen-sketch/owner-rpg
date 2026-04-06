import { useState, useEffect } from 'react'
import './IntroScreen.css'

function IntroScreen({ onStart, leaderboard = [], monthlyLeaderboard = [], monthLabel = '' }) {
  const [showPress, setShowPress] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setShowPress(prev => !prev)
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="intro-screen">
      <div className="intro-scanlines" />

      <div className="intro-content">
        <img
          src="/logo.jpeg"
          alt="Owner.com"
          className="intro-logo"
          style={{ imageRendering: 'pixelated' }}
        />

        <div className="intro-ana-portrait">
          <img
            src="/ana-avatar.png"
            alt="Ana de Arepas"
            className="intro-ana-img"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        <div className="intro-title-block">
          <h1 className="intro-title">Ana de Arepas</h1>
          <h2 className="intro-subtitle">OWNER</h2>
          <h3 className="intro-tagline">The FKAT Trials</h3>
        </div>

        <div className="intro-story-box">
          <p className="intro-story">
            Ana de Arepas is in trouble. The Third-Party Delivery
            Empire has bled her restaurant dry. Her margins are
            gone. Her customers... lost.
          </p>
          <p className="intro-story">
            She doesn't know how to market to her guests
            or get them to order more. Her website doesn't rank,
            and thousands of hungry guests nearby will never
            even know her food exists.
          </p>
          <p className="intro-story intro-story-highlight">
            Without our help, her restaurant is doomed.
          </p>
          <p className="intro-story">
            That's where you come in, champion. Guide Ana through
            dangerous realms, prove your Fundamental Knowledge by
            collecting Magic Gems, and rescue her restaurant
            from ruin.
          </p>
        </div>

        {leaderboard.length > 0 && (
          <div className="intro-leaderboard-wrap">
            <div className="intro-leaderboard">
              <div className="intro-lb-title">ALL TIME</div>
              {Array.from({ length: 5 }, (_, i) => {
                const entry = leaderboard[i]
                return (
                  <div key={i} className={`intro-lb-row ${!entry ? 'intro-lb-empty' : ''} ${i === 0 && entry ? 'intro-lb-top' : ''}`}>
                    <span className="intro-lb-rank">{i + 1}.</span>
                    <span className="intro-lb-initials">{entry ? entry.initials : '---'}</span>
                    <span className="intro-lb-dots">{'·'.repeat(6)}</span>
                    <span className="intro-lb-score">{entry ? entry.score.toLocaleString() : '-----'}</span>
                  </div>
                )
              })}
            </div>
            <div className="intro-leaderboard">
              <div className="intro-lb-title">{monthLabel?.toUpperCase() || 'THIS MONTH'}</div>
              {Array.from({ length: 5 }, (_, i) => {
                const entry = monthlyLeaderboard[i]
                return (
                  <div key={i} className={`intro-lb-row ${!entry ? 'intro-lb-empty' : ''} ${i === 0 && entry ? 'intro-lb-top' : ''}`}>
                    <span className="intro-lb-rank">{i + 1}.</span>
                    <span className="intro-lb-initials">{entry ? entry.initials : '---'}</span>
                    <span className="intro-lb-dots">{'·'.repeat(6)}</span>
                    <span className="intro-lb-score">{entry ? entry.score.toLocaleString() : '-----'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="intro-stats">
          <span>LIVES: 10</span>
          <span>GEMS: 0/{/* dynamically would need total */}89</span>
        </div>

        <button
          className="retro-btn intro-start-btn"
          onClick={onStart}
          style={{ opacity: showPress ? 1 : 0.5 }}
        >
          {'>>> PRESS START <<<'}
        </button>

        <p className="intro-credit">POWERED BY OWNER ENABLEMENT STUDIO</p>
      </div>
    </div>
  )
}

export default IntroScreen
