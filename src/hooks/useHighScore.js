import { useCallback } from 'react'

const STORAGE_KEY = 'owner-rpg-highscores-v2'
const MAX_DISPLAY = 5

export function useHighScore() {
  const getAllScores = useCallback(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return []
      return JSON.parse(data).scores || []
    } catch {
      return []
    }
  }, [])

  const getScores = useCallback(() => {
    return getAllScores().slice(0, MAX_DISPLAY)
  }, [getAllScores])

  const getMonthlyScores = useCallback(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    return getAllScores()
      .filter(entry => {
        if (!entry.date) return false
        const d = new Date(entry.date)
        return d.getFullYear() === year && d.getMonth() === month
      })
      .slice(0, MAX_DISPLAY)
  }, [getAllScores])

  const getCurrentMonthLabel = useCallback(() => {
    return new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
  }, [])

  const isHighScore = useCallback((score) => {
    const scores = getScores()
    if (scores.length < MAX_DISPLAY) return score > 0
    return score > scores[scores.length - 1].score
  }, [getScores])

  const addScore = useCallback((initials, score) => {
    const scores = getAllScores()
    scores.push({ initials, score, date: new Date().toISOString() })
    scores.sort((a, b) => b.score - a.score)
    // Keep more entries in storage for monthly filtering (top 50)
    const trimmed = scores.slice(0, 50)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scores: trimmed }))
    return trimmed.slice(0, MAX_DISPLAY)
  }, [getAllScores])

  const getTopScore = useCallback(() => {
    const scores = getScores()
    return scores.length > 0 ? scores[0] : null
  }, [getScores])

  return { getScores, getMonthlyScores, getCurrentMonthLabel, isHighScore, addScore, getTopScore }
}
