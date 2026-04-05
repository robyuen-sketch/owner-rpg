import { useCallback } from 'react'

const STORAGE_KEY = 'owner-rpg-highscores-v2'
const MAX_ENTRIES = 5

export function useHighScore() {
  const getScores = useCallback(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return []
      return JSON.parse(data).scores || []
    } catch {
      return []
    }
  }, [])

  const isHighScore = useCallback((score) => {
    const scores = getScores()
    if (scores.length < MAX_ENTRIES) return score > 0
    return score > scores[scores.length - 1].score
  }, [getScores])

  const addScore = useCallback((initials, score) => {
    const scores = getScores()
    scores.push({ initials, score, date: new Date().toISOString() })
    scores.sort((a, b) => b.score - a.score)
    const trimmed = scores.slice(0, MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scores: trimmed }))
    return trimmed
  }, [getScores])

  const getTopScore = useCallback(() => {
    const scores = getScores()
    return scores.length > 0 ? scores[0] : null
  }, [getScores])

  return { getScores, isHighScore, addScore, getTopScore }
}
