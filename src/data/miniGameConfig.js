import gameScript from './gameScript.json'

function buildTransitionIndices() {
  const transitions = []
  for (let i = 0; i < gameScript.length - 1; i++) {
    if (gameScript[i].realm !== gameScript[i + 1].realm) {
      transitions.push(i)
    }
  }
  return transitions
}

export const TRANSITION_INDICES = buildTransitionIndices()

// Only these transitions have mini-games; all others skip straight to cutscenes
const TRANSITION_GAMES = {
  0: 'jungle_run',    // After Top of Funnel → Ana escapes the Cullens
  1: 'castlevania',   // After Domain Dungeon → Ana fights through the dungeon
  2: 'pirate_ship',   // After Stripe Sanctuary → Ana sails the Payment Line
  3: 'wire_puzzle',   // After Integration Isles → Ana connects the wires in 6767
  5: 'snake',         // After Conversion Cliffs → Arepa Snake
  6: 'quick_draw',    // After Repeat Order Railway → Western Quick Draw duel
}

export function getMiniGameForTransition(questionIndex) {
  const transitionIdx = TRANSITION_INDICES.indexOf(questionIndex)
  if (transitionIdx === -1) return null

  const gameType = TRANSITION_GAMES[transitionIdx]
  if (!gameType) return null // No mini-game for this transition

  return {
    gameType,
    difficulty: Math.floor(transitionIdx / 3) + 1,
    transitionNumber: transitionIdx + 1,
    totalTransitions: TRANSITION_INDICES.length,
    fromRealm: gameScript[questionIndex].realm,
    toRealm: gameScript[questionIndex + 1].realm,
  }
}
