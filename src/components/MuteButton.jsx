import { useState } from 'react'
import audioManager from '../hooks/useAudio'
import './MuteButton.css'

function MuteButton() {
  const [muted, setMuted] = useState(audioManager.muted)

  const handleToggle = () => {
    audioManager.toggleMute()
    setMuted(audioManager.muted)
  }

  return (
    <button className="mute-btn" onClick={handleToggle} title={muted ? 'Unmute' : 'Mute'}>
      {muted ? '\u{1F507}' : '\u{1F50A}'}
    </button>
  )
}

export default MuteButton
