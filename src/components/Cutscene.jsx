import { useState, useEffect, useRef, useCallback } from 'react'
import audioManager from '../hooks/useAudio'
import './Cutscene.css'

const CUTSCENE_SLIDES = [
  {
    id: 'kitchen',
    bgImage: '/slide1.jpg',
    particles: 'steam',
    text: "This is Ana de Arepas. She makes the best arepas in town.",
    textColor: '#ffd700',
  },
  {
    id: 'customers',
    bgImage: '/slide2.jpg',
    particles: 'hearts',
    text: "Everyone who tastes her food loves it. Her arepas are legendary.",
    textColor: '#ff69b4',
  },
  {
    id: 'empty',
    bgImage: '/slide3.jpg',
    particles: 'dust',
    text: "But nobody can find her restaurant online...",
    textColor: '#888',
  },
  {
    id: 'confusion',
    bgImage: '/slide4.jpg',
    particles: 'questionmarks',
    text: "She doesn't know how to market to her guests or get them to order more. Her website doesn't rank.",
    textColor: '#9b59b6',
  },
  {
    id: 'drain',
    bgImage: '/slide5.jpg',
    particles: 'draincoins',
    text: "Third-party delivery apps are draining her margins dry. Thousands of hungry guests nearby will never even know her food exists.",
    textColor: '#ff3333',
  },
  {
    id: 'sad',
    bgImage: '/slide6.jpg',
    particles: 'rain',
    text: "Ana's restaurant is on the brink...",
    textColor: '#ff3333',
  },
  {
    id: 'discovery',
    bgImage: '/slide7.jpg',
    particles: 'sparkles',
    text: "But then... she discovers Owner.com.",
    textColor: '#ffd700',
  },
  {
    id: 'champion',
    bgImage: '/slide8.jpg',
    particles: 'stars',
    text: "You are an Owner.com champion. You will guide Ana through the dangerous realms.",
    textColor: '#2d70ff',
  },
  {
    id: 'fellowship',
    bgImage: '/slide9.jpg',
    particles: 'sparkles',
    text: "A fellowship of experts stands ready to test your knowledge.",
    textColor: '#ffd700',
  },
  {
    id: 'quest',
    bgImage: '/slide10.jpg',
    particles: 'lanterns',
    text: "Collect 89 Magic Gems. Prove your worth. Save Ana's restaurant.",
    textColor: '#39ff14',
  },
  {
    id: 'map',
    bgImage: '/storyboard-map.jpg',
    particles: 'sparkles',
    text: "Her journey to the Land of Sales Growth must cross many perilous lands. Dark forests, cursed dungeons, pirate waters, and volcanic peaks lie ahead.",
    textColor: '#ffd700',
  },
  {
    id: 'funnel-intro',
    bgImage: '/storyboard-comic.jpg',
    particles: 'dust',
    text: "First: the Top of Funnel Trail, ruled by the Cullen vampire clan. They challenge all who enter to a battle of knowledge...",
    textColor: '#ff3333',
    isFinal: true,
  },
]

function CutsceneParticles({ type }) {
  const count = type === 'stars' ? 20 : type === 'rain' ? 15 : 10
  return (
    <div className="cs-particles">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`cs-particle cs-particle-${type}`}
          style={{
            '--i': i,
            '--x': `${5 + (i * 97 / count) % 95}%`,
            '--delay': `${(i * 0.4) % 3}s`,
            '--duration': `${2 + (i % 3)}s`,
            '--size': `${3 + (i % 4)}px`,
          }}
        />
      ))}
    </div>
  )
}

function Cutscene({ onComplete }) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const intervalRef = useRef(null)
  const transitionRef = useRef(null)

  const slide = CUTSCENE_SLIDES[slideIndex]

  // Preload next slide image
  useEffect(() => {
    const nextIndex = slideIndex + 1
    if (nextIndex < CUTSCENE_SLIDES.length) {
      const img = new Image()
      img.src = CUTSCENE_SLIDES[nextIndex].bgImage
    }
  }, [slideIndex])

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

    if (slideIndex >= CUTSCENE_SLIDES.length - 1) {
      onComplete()
      return
    }

    audioManager.play('slideAdvance')
    setTransitioning(true)
    transitionRef.current = setTimeout(() => {
      setSlideIndex(prev => prev + 1)
      setTransitioning(false)
    }, 500)
  }, [isTyping, slideIndex, onComplete, transitioning, slide.text])

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
    <div className="cs-container" onClick={handleAdvance}>
      <div
        className={`cs-slide ${transitioning ? 'cs-fade-out' : 'cs-fade-in'}`}
        key={slideIndex}
      >
        {/* Background art image */}
        <img
          src={slide.bgImage}
          alt=""
          className="cs-bg-image"
        />

        {/* Particles */}
        <CutsceneParticles type={slide.particles} />

        {/* Vignette */}
        <div className="cs-vignette" />

        {/* Text overlay */}
        <div className="cs-text-overlay">
          <div className="cs-slide-counter">
            {slideIndex + 1} / {CUTSCENE_SLIDES.length}
          </div>
          <p className="cs-narrative-text" style={{ color: slide.textColor }}>
            {displayedText}
            <span className={`cs-cursor ${isTyping ? '' : 'blink'}`}>&#9608;</span>
          </p>
        </div>
      </div>

      {/* Bottom prompt */}
      {!isTyping && !transitioning && (
        <div className="cs-prompt">
          {slide.isFinal
            ? '>>> BEGIN THE QUEST <<<'
            : 'CLICK TO CONTINUE'}
        </div>
      )}
    </div>
  )
}

export default Cutscene
