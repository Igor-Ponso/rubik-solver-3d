/**
 * 3x3 solver wrapper using cubejs (Kociemba two-phase algorithm).
 */

import { type CubeState3, stateToFaceletString } from './cube3'
import { solve3Sync } from './cubejs-wrapper'

export { initSolver3 } from './cubejs-wrapper'

export function solve3(state: CubeState3): string[] {
  const faceletStr = stateToFaceletString(state)
  return solve3Sync(faceletStr)
}
