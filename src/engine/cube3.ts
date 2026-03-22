/**
 * 3x3 Rubik's Cube state engine
 *
 * Face layout (indices 0-8 per face):
 *   [0][1][2]
 *   [3][4][5]
 *   [6][7][8]
 */

export type Face = 'U' | 'D' | 'F' | 'B' | 'L' | 'R'
export type Move3 = 'R' | "R'" | 'R2' | 'L' | "L'" | 'L2' | 'U' | "U'" | 'U2' | 'D' | "D'" | 'D2' | 'F' | "F'" | 'F2' | 'B' | "B'" | 'B2'

export const FACES: Face[] = ['U', 'D', 'F', 'B', 'L', 'R']

export const ALL_MOVES_3: Move3[] = [
  'R', "R'", 'R2', 'L', "L'", 'L2',
  'U', "U'", 'U2', 'D', "D'", 'D2',
  'F', "F'", 'F2', 'B', "B'", 'B2',
]

// Moves shown as manual buttons (no double moves)
export const DISPLAY_MOVES_3: Move3[] = [
  'R', "R'", 'L', "L'", 'U', "U'", 'D', "D'", 'F', "F'", 'B', "B'",
]

export const COLORS: Record<Face, string> = {
  U: '#FFFFFF',
  D: '#FFD500',
  F: '#009B48',
  B: '#0045AD',
  L: '#FF5900',
  R: '#B90000',
}

export type CubeState3 = Record<Face, Face[]>

export function createSolvedState(): CubeState3 {
  const make = (f: Face): Face[] => Array(9).fill(f)
  return { U: make('U'), D: make('D'), F: make('F'), B: make('B'), L: make('L'), R: make('R') }
}

export function cloneState(state: CubeState3): CubeState3 {
  return {
    U: [...state.U], D: [...state.D], F: [...state.F],
    B: [...state.B], L: [...state.L], R: [...state.R],
  }
}

function rotateCW(face: Face, state: CubeState3) {
  const s = state[face]
  const t = [...s]
  s[0]=t[6]; s[1]=t[3]; s[2]=t[0]
  s[3]=t[7]; s[4]=t[4]; s[5]=t[1]
  s[6]=t[8]; s[7]=t[5]; s[8]=t[2]
}

function rotateCCW(face: Face, state: CubeState3) {
  const s = state[face]
  const t = [...s]
  s[0]=t[2]; s[1]=t[5]; s[2]=t[8]
  s[3]=t[1]; s[4]=t[4]; s[5]=t[7]
  s[6]=t[0]; s[7]=t[3]; s[8]=t[6]
}

// Cycle 4 strips of 3 stickers: a←b←c←d←a
function cycle4(state: CubeState3,
  a: [Face,number,number,number], b: [Face,number,number,number],
  c: [Face,number,number,number], d: [Face,number,number,number]) {
  for (let i = 0; i < 3; i++) {
    const ai = a[i+1] as number, bi = b[i+1] as number
    const ci = c[i+1] as number, di = d[i+1] as number
    const tmp = state[a[0]][ai]
    state[a[0]][ai] = state[b[0]][bi]
    state[b[0]][bi] = state[c[0]][ci]
    state[c[0]][ci] = state[d[0]][di]
    state[d[0]][di] = tmp
  }
}

export function applyMove(state: CubeState3, move: Move3): CubeState3 {
  const s = cloneState(state)
  const base = move[0] as Face
  const mod = move.slice(1) // '', "'", "2"

  if (mod === '2') {
    return applyMove(applyMove(state, base as Move3), base as Move3)
  }

  const cw = mod !== "'"

  // Rotate the face itself
  if (cw) rotateCW(base, s)
  else rotateCCW(base, s)

  // Cycle adjacent stickers
  // For CW rotation of face X, the 4 adjacent strips cycle in a specific order.
  // For CCW, reverse the cycle (swap b and d).
  switch (base) {
    case 'R':
      if (cw) cycle4(s, ['U',2,5,8], ['F',2,5,8], ['D',2,5,8], ['B',6,3,0])
      else    cycle4(s, ['U',2,5,8], ['B',6,3,0], ['D',2,5,8], ['F',2,5,8])
      break
    case 'L':
      if (cw) cycle4(s, ['U',0,3,6], ['B',8,5,2], ['D',0,3,6], ['F',0,3,6])
      else    cycle4(s, ['U',0,3,6], ['F',0,3,6], ['D',0,3,6], ['B',8,5,2])
      break
    case 'U':
      if (cw) cycle4(s, ['F',0,1,2], ['R',0,1,2], ['B',0,1,2], ['L',0,1,2])
      else    cycle4(s, ['F',0,1,2], ['L',0,1,2], ['B',0,1,2], ['R',0,1,2])
      break
    case 'D':
      if (cw) cycle4(s, ['F',6,7,8], ['L',6,7,8], ['B',6,7,8], ['R',6,7,8])
      else    cycle4(s, ['F',6,7,8], ['R',6,7,8], ['B',6,7,8], ['L',6,7,8])
      break
    case 'F':
      if (cw) cycle4(s, ['U',6,7,8], ['L',8,5,2], ['D',2,1,0], ['R',0,3,6])
      else    cycle4(s, ['U',6,7,8], ['R',0,3,6], ['D',2,1,0], ['L',8,5,2])
      break
    case 'B':
      if (cw) cycle4(s, ['U',2,1,0], ['R',8,5,2], ['D',6,7,8], ['L',0,3,6])
      else    cycle4(s, ['U',2,1,0], ['L',0,3,6], ['D',6,7,8], ['R',8,5,2])
      break
  }

  return s
}

export function isSolved(state: CubeState3): boolean {
  return FACES.every(face => {
    const f = state[face]
    return f.every(s => s === f[0])
  })
}

export function getRandomMove(lastMove?: Move3): Move3 {
  const moves = DISPLAY_MOVES_3 // avoid double moves for scrambling
  let move: Move3
  do {
    move = moves[Math.floor(Math.random() * moves.length)]
  } while (lastMove && move[0] === lastMove[0])
  return move
}

/** Convert to cubejs 54-char facelet string (URFDLB order) */
export function stateToFaceletString(state: CubeState3): string {
  return state.U.join('') + state.R.join('') + state.F.join('') +
         state.D.join('') + state.L.join('') + state.B.join('')
}
