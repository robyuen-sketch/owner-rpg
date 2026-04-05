import { useState, useEffect } from 'react'
import './ControlsOverlay.css'

/**
 * On-screen control button guide that shows keyboard/touch controls.
 * Fades out after 5 seconds, reappears on hover.
 *
 * Props:
 *   controls: [{ keys: ['←', '→'], label: 'MOVE' }, { keys: ['SPACE'], label: 'JUMP' }]
 */
function ControlsOverlay({ controls }) {
  const [visible, setVisible] = useState(true)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  const show = visible || hovered

  return (
    <div
      className={`controls-overlay ${show ? 'controls-visible' : 'controls-hidden'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {controls.map((group, i) => (
        <div key={i} className="controls-group">
          <div className="controls-keys">
            {group.keys.map((key, j) => (
              <span key={j} className="controls-key">{key}</span>
            ))}
          </div>
          <span className="controls-label">{group.label}</span>
        </div>
      ))}
    </div>
  )
}

export default ControlsOverlay
