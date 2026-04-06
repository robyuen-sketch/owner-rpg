import { useEffect, useState } from 'react'
import './Victory.css'

function LeaderboardPanel({ scores, currentScore, title }) {
  const slots = 5
  return (
    <div className="lb-panel">
      <div className="lb-title">{title}</div>
      {Array.from({ length: slots }, (_, i) => {
        const entry = scores[i]
        const isCurrent = entry && entry.score === currentScore
        return (
          <div key={i} className={`lb-row ${isCurrent ? 'lb-row-current' : ''} ${!entry ? 'lb-row-empty' : ''}`}>
            <span className="lb-rank">{i + 1}.</span>
            <span className="lb-initials">{entry ? entry.initials : '---'}</span>
            <span className="lb-dots">{'·'.repeat(6)}</span>
            <span className="lb-score">{entry ? entry.score.toLocaleString() : '-----'}</span>
          </div>
        )
      })}
    </div>
  )
}

function Leaderboard({ scores, monthlyScores, currentScore, monthLabel }) {
  return (
    <div className="lb-container">
      <LeaderboardPanel scores={scores} currentScore={currentScore} title="ALL TIME" />
      <LeaderboardPanel scores={monthlyScores} currentScore={currentScore} title={monthLabel?.toUpperCase() || 'THIS MONTH'} />
    </div>
  )
}

function Victory({ gems, totalGems, score, onContinue, scoreBreakdown, leaderboard, monthlyLeaderboard, monthLabel, onRestart }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const isFinal = !!scoreBreakdown

  return (
    <div className={`victory-screen ${visible ? 'victory-visible' : ''}`}>
      <div className="victory-glow" />

      <div className="victory-sparkles">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="sparkle"
            style={{
              left: `${8 + (i * 7.5)}%`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${1.5 + (i % 3) * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="victory-content">
        <div className="victory-ana-celebrate">
          <img
            src="/ana-avatar.png"
            alt="Ana de Arepas - Saved!"
            className="victory-ana-img"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        <h1 className="victory-title">VICTORY!</h1>

        <div className="victory-gems-display">
          {Array.from({ length: totalGems }, (_, i) => (
            <span
              key={i}
              className={`victory-gem ${i < gems ? 'victory-gem-collected' : ''}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              &#x1F48E;
            </span>
          ))}
        </div>

        <div className="victory-text-box">
          <p className="victory-text">
            You saved Ana de Arepas! You collected the Magic
            Gems, mastered the Fundamental Knowledge, and
            freed her restaurant from the Third-Party
            Delivery Empire!
          </p>
        </div>

        <div className="victory-secret-box">
          <p className="victory-secret-label">
            To prove your worth to the Enablement team,
            present this Secret Code:
          </p>
          <p className="victory-secret-code">676767676767</p>
        </div>

        {/* Score Breakdown (final screen only) */}
        {isFinal && scoreBreakdown && (
          <div className="victory-breakdown">
            <div className="victory-bd-title">SCORE BREAKDOWN</div>

            <div className="victory-bd-row">
              <span className="victory-bd-label">QUESTIONS</span>
              <span className="victory-bd-value">{scoreBreakdown.questionBase.toLocaleString()}</span>
            </div>
            <div className="victory-bd-row">
              <span className="victory-bd-label">SPEED BONUS</span>
              <span className="victory-bd-value">{scoreBreakdown.questionSpeed.toLocaleString()}</span>
            </div>
            <div className="victory-bd-row">
              <span className="victory-bd-label">ACCURACY x{scoreBreakdown.accuracyMultiplier}</span>
              <span className="victory-bd-value">{scoreBreakdown.questionTotal.toLocaleString()}</span>
            </div>

            <div className="victory-bd-divider" />

            <div className="victory-bd-row">
              <span className="victory-bd-label">MINI-GAMES (x{scoreBreakdown.miniGameMultiplier})</span>
              <span className="victory-bd-value">{scoreBreakdown.miniGameTotal.toLocaleString()}</span>
            </div>
            <div className="victory-bd-row">
              <span className="victory-bd-label">COMPLETION BONUS</span>
              <span className="victory-bd-value">{scoreBreakdown.completionBonus.toLocaleString()}</span>
            </div>

            <div className="victory-bd-divider-thick" />

            <div className="victory-bd-row victory-bd-total-row">
              <span className="victory-bd-label victory-bd-total-label">TOTAL</span>
              <span className="victory-bd-total-value">{scoreBreakdown.grandTotal.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Simple score (initial victory screen before breakdown) */}
        {!isFinal && score > 0 && (
          <div className="victory-score-box">
            <span className="victory-score-label">SCORE SO FAR</span>
            <span className="victory-score-value">{score.toLocaleString()}</span>
          </div>
        )}

        {/* Leaderboard (final screen only) */}
        {isFinal && leaderboard && (
          <Leaderboard scores={leaderboard} monthlyScores={monthlyLeaderboard || []} currentScore={score} monthLabel={monthLabel} />
        )}

        {isFinal && (
          <div className="victory-ending-image">
            <img src="/storyboard-ending.jpg" alt="Ana's restaurant empire" />
          </div>
        )}

        <div className="victory-badge">
          <span className="badge-icon">&#x1F3C6;</span>
          <span className="badge-text">OWNER CHAMPION CERTIFIED</span>
        </div>

        {onContinue && (
          <button className="retro-btn victory-continue-btn" onClick={onContinue}>
            CONTINUE
          </button>
        )}

        {isFinal && onRestart && (
          <button className="retro-btn victory-continue-btn" onClick={onRestart}>
            PLAY AGAIN
          </button>
        )}

        <img
          src="/logo.jpeg"
          alt="Owner.com"
          className="victory-logo"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  )
}

export default Victory
