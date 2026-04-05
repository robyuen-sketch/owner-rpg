import { useState, useEffect, useRef, useCallback } from 'react'
import './RealmCutscene.css'

/**
 * RealmCutscene - shows story cutscenes between realm transitions.
 * Each cutscene has an image, narrative text, and optional particles.
 */
function RealmCutscene({ slides, onComplete }) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const intervalRef = useRef(null)
  const transitionRef = useRef(null)

  const slide = slides[slideIndex]

  // Preload next image
  useEffect(() => {
    const next = slideIndex + 1
    if (next < slides.length) {
      const img = new Image()
      img.src = slides[next].bgImage
    }
  }, [slideIndex, slides])

  // Typewriter effect
  useEffect(() => {
    setDisplayedText('')
    setIsTyping(true)
    let i = 0

    intervalRef.current = setInterval(() => {
      if (i < slide.text.length) {
        setDisplayedText(slide.text.slice(0, i + 1))
        i++
      } else {
        setIsTyping(false)
        clearInterval(intervalRef.current)
      }
    }, 25)

    return () => {
      clearInterval(intervalRef.current)
      clearTimeout(transitionRef.current)
    }
  }, [slideIndex, slide.text])

  const handleAdvance = useCallback(() => {
    if (transitioning) return

    if (isTyping) {
      clearInterval(intervalRef.current)
      setDisplayedText(slide.text)
      setIsTyping(false)
      return
    }

    if (slideIndex >= slides.length - 1) {
      onComplete()
      return
    }

    setTransitioning(true)
    transitionRef.current = setTimeout(() => {
      setSlideIndex(prev => prev + 1)
      setTransitioning(false)
    }, 500)
  }, [isTyping, slideIndex, slides.length, onComplete, transitioning, slide.text])

  // Keyboard support
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleAdvance()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleAdvance])

  return (
    <div className="rc-container" onClick={handleAdvance}>
      <div
        className={`rc-slide ${transitioning ? 'rc-fade-out' : 'rc-fade-in'}`}
        key={slideIndex}
      >
        <img src={slide.bgImage} alt="" className="rc-bg-image" />
        <div className="rc-vignette" />

        <div className="rc-text-overlay">
          <p className="rc-narrative-text" style={{ color: slide.textColor || '#ffd700' }}>
            {displayedText}
            <span className={`rc-cursor ${isTyping ? '' : 'blink'}`}>&#9608;</span>
          </p>
        </div>
      </div>

      {!isTyping && !transitioning && (
        <div className="rc-prompt">
          {slideIndex >= slides.length - 1 ? '>>> CONTINUE >>>' : 'CLICK TO CONTINUE'}
        </div>
      )}
    </div>
  )
}

export default RealmCutscene
