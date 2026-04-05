import { useState, useEffect, useRef } from 'react'
import './DialogueBox.css'

function DialogueBox({ realm, npc, dialogue, questionNumber, totalQuestions }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const intervalRef = useRef(null)

  useEffect(() => {
    setDisplayedText('')
    setIsTyping(true)
    let i = 0

    intervalRef.current = setInterval(() => {
      if (i < dialogue.length) {
        setDisplayedText(dialogue.slice(0, i + 1))
        i++
      } else {
        setIsTyping(false)
        clearInterval(intervalRef.current)
      }
    }, 25)

    return () => clearInterval(intervalRef.current)
  }, [dialogue])

  const skipTypewriter = () => {
    if (isTyping) {
      clearInterval(intervalRef.current)
      setDisplayedText(dialogue)
      setIsTyping(false)
    }
  }

  return (
    <div className="dialogue-box pixel-border" onClick={skipTypewriter}>
      <div className="dialogue-header">
        <span className="dialogue-realm">{realm}</span>
        <span className="dialogue-progress">{questionNumber}/{totalQuestions}</span>
      </div>
      <div className="dialogue-npc-name">{npc}</div>
      <div className="dialogue-text">
        {displayedText}
        <span className={`dialogue-cursor ${isTyping ? '' : 'blink'}`}>&#9608;</span>
      </div>
    </div>
  )
}

export default DialogueBox
