import { useEffect, useRef } from 'react'

export function useGameLoop(callback, isRunning) {
  const frameRef = useRef()
  const previousTimeRef = useRef()
  const callbackRef = useRef(callback)
  const usesFallbackRef = useRef(false)

  callbackRef.current = callback

  useEffect(() => {
    if (!isRunning) {
      previousTimeRef.current = undefined
      return
    }

    let cancelled = false

    const animate = (time) => {
      if (cancelled) return
      if (previousTimeRef.current !== undefined) {
        const deltaTime = Math.min((time - previousTimeRef.current) / 1000, 0.05)
        try {
          callbackRef.current(deltaTime)
        } catch (e) {
          console.error('Game loop error:', e)
        }
      }
      previousTimeRef.current = time
      if (!cancelled) {
        if (usesFallbackRef.current) {
          frameRef.current = setTimeout(() => animate(performance.now()), 16)
        } else {
          frameRef.current = requestAnimationFrame(animate)
        }
      }
    }

    // Test if rAF fires within 100ms; if not, fall back to setTimeout
    let rAFWorks = false
    const testId = requestAnimationFrame(() => { rAFWorks = true })
    setTimeout(() => {
      if (cancelled) return
      cancelAnimationFrame(testId)
      usesFallbackRef.current = !rAFWorks
      if (usesFallbackRef.current) {
        frameRef.current = setTimeout(() => animate(performance.now()), 16)
      } else {
        frameRef.current = requestAnimationFrame(animate)
      }
    }, 100)

    return () => {
      cancelled = true
      if (usesFallbackRef.current) {
        clearTimeout(frameRef.current)
      } else {
        cancelAnimationFrame(frameRef.current)
      }
      previousTimeRef.current = undefined
    }
  }, [isRunning])
}
