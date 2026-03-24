/**
 * 3x3 hybrid solver:
 * 1. IDA* for short solutions (≤5 moves) — instant, no heuristic needed
 * 2. Kociemba (cubejs) for everything else — guaranteed ≤22 moves
 * Returns the shorter of the two.
 */

import { type CubeState3, DISPLAY_MOVES_3, applyMove, isSolved, stateToFaceletString } from './cube3'
import { solve3Sync } from './cubejs-wrapper'

export { initSolver3 } from './cubejs-wrapper'

/**
 * IDA* brute-force for very short solutions.
 * Depth 5 = 12^5 ≈ 250K nodes = <50ms.
 */
function solveShortIDA(initial: CubeState3, maxDepth: number = 5): string[] | null {
  if (isSolved(initial)) return []

  const path: string[] = []

  function search(state: CubeState3, depth: number, limit: number, lastFace: string): boolean {
    if (isSolved(state)) return true
    if (depth >= limit) return false

    for (const move of DISPLAY_MOVES_3) {
      if (move[0] === lastFace) continue
      const next = applyMove(state, move)
      path.push(move)
      if (search(next, depth + 1, limit, move[0])) return true
      path.pop()
    }
    return false
  }

  for (let limit = 1; limit <= maxDepth; limit++) {
    if (search(initial, 0, limit, '')) return [...path]
  }
  return null
}

export function solve3(state: CubeState3): string[] {
  // Try IDA* for short solutions (instant)
  const shortSolution = solveShortIDA(state)
  if (shortSolution) return shortSolution

  // Kociemba for deeper scrambles
  const faceletStr = stateToFaceletString(state)
  return solve3Sync(faceletStr)
}
