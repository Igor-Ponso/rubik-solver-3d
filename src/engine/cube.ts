/**
 * 2x2 Rubik's Cube state engine
 *
 * Face layout (indices 0-3 per face):
 *   [0][1]
 *   [2][3]
 *
 * Faces: U(up/white), D(down/yellow), F(front/green), B(back/blue), L(left/orange), R(right/red)
 */

export type Face = 'U' | 'D' | 'F' | 'B' | 'L' | 'R'
export type Move = 'R' | 'R\'' | 'L' | 'L\'' | 'U' | 'U\'' | 'D' | 'D\'' | 'F' | 'F\'' | 'B' | 'B\''

export const FACES: Face[] = ['U', 'D', 'F', 'B', 'L', 'R']
export const ALL_MOVES: Move[] = ['R', 'R\'', 'L', 'L\'', 'U', 'U\'', 'D', 'D\'', 'F', 'F\'', 'B', 'B\'']

export const COLORS: Record<Face, string> = {
  U: '#FFFFFF', // white
  D: '#FFD500', // yellow
  F: '#009B48', // green
  B: '#0045AD', // blue
  L: '#FF5900', // orange
  R: '#B90000', // red
}

// Each face has 4 stickers: [0,1,2,3] laid out as:
// [0][1]
// [2][3]
export type CubeState = Record<Face, Face[]>

export function createSolvedState(): CubeState {
  return {
    U: ['U', 'U', 'U', 'U'],
    D: ['D', 'D', 'D', 'D'],
    F: ['F', 'F', 'F', 'F'],
    B: ['B', 'B', 'B', 'B'],
    L: ['L', 'L', 'L', 'L'],
    R: ['R', 'R', 'R', 'R'],
  }
}

export function cloneState(state: CubeState): CubeState {
  return {
    U: [...state.U],
    D: [...state.D],
    F: [...state.F],
    B: [...state.B],
    L: [...state.L],
    R: [...state.R],
  }
}

function rotateFaceCW(state: CubeState, face: Face) {
  const f = state[face]
  const tmp = f[0]
  f[0] = f[2]
  f[2] = f[3]
  f[3] = f[1]
  f[1] = tmp
}

function rotateFaceCCW(state: CubeState, face: Face) {
  const f = state[face]
  const tmp = f[0]
  f[0] = f[1]
  f[1] = f[3]
  f[3] = f[2]
  f[2] = tmp
}

export function applyMove(state: CubeState, move: Move): CubeState {
  const s = cloneState(state)
  switch (move) {
    case 'R': {
      rotateFaceCW(s, 'R')
      const tmp = [s.F[1], s.F[3]]
      s.F[1] = s.D[1]; s.F[3] = s.D[3]
      s.D[1] = s.B[2]; s.D[3] = s.B[0]
      s.B[2] = s.U[1]; s.B[0] = s.U[3]
      s.U[1] = tmp[0]; s.U[3] = tmp[1]
      break
    }
    case 'R\'': {
      rotateFaceCCW(s, 'R')
      const tmp = [s.F[1], s.F[3]]
      s.F[1] = s.U[1]; s.F[3] = s.U[3]
      s.U[1] = s.B[2]; s.U[3] = s.B[0]
      s.B[2] = s.D[1]; s.B[0] = s.D[3]
      s.D[1] = tmp[0]; s.D[3] = tmp[1]
      break
    }
    case 'L': {
      rotateFaceCW(s, 'L')
      const tmp = [s.F[0], s.F[2]]
      s.F[0] = s.U[0]; s.F[2] = s.U[2]
      s.U[0] = s.B[3]; s.U[2] = s.B[1]
      s.B[3] = s.D[0]; s.B[1] = s.D[2]
      s.D[0] = tmp[0]; s.D[2] = tmp[1]
      break
    }
    case 'L\'': {
      rotateFaceCCW(s, 'L')
      const tmp = [s.F[0], s.F[2]]
      s.F[0] = s.D[0]; s.F[2] = s.D[2]
      s.D[0] = s.B[3]; s.D[2] = s.B[1]
      s.B[3] = s.U[0]; s.B[1] = s.U[2]
      s.U[0] = tmp[0]; s.U[2] = tmp[1]
      break
    }
    case 'U': {
      rotateFaceCW(s, 'U')
      const tmp = [s.F[0], s.F[1]]
      s.F[0] = s.R[0]; s.F[1] = s.R[1]
      s.R[0] = s.B[0]; s.R[1] = s.B[1]
      s.B[0] = s.L[0]; s.B[1] = s.L[1]
      s.L[0] = tmp[0]; s.L[1] = tmp[1]
      break
    }
    case 'U\'': {
      rotateFaceCCW(s, 'U')
      const tmp = [s.F[0], s.F[1]]
      s.F[0] = s.L[0]; s.F[1] = s.L[1]
      s.L[0] = s.B[0]; s.L[1] = s.B[1]
      s.B[0] = s.R[0]; s.B[1] = s.R[1]
      s.R[0] = tmp[0]; s.R[1] = tmp[1]
      break
    }
    case 'D': {
      rotateFaceCW(s, 'D')
      const tmp = [s.F[2], s.F[3]]
      s.F[2] = s.L[2]; s.F[3] = s.L[3]
      s.L[2] = s.B[2]; s.L[3] = s.B[3]
      s.B[2] = s.R[2]; s.B[3] = s.R[3]
      s.R[2] = tmp[0]; s.R[3] = tmp[1]
      break
    }
    case 'D\'': {
      rotateFaceCCW(s, 'D')
      const tmp = [s.F[2], s.F[3]]
      s.F[2] = s.R[2]; s.F[3] = s.R[3]
      s.R[2] = s.B[2]; s.R[3] = s.B[3]
      s.B[2] = s.L[2]; s.B[3] = s.L[3]
      s.L[2] = tmp[0]; s.L[3] = tmp[1]
      break
    }
    case 'F': {
      rotateFaceCCW(s, 'F')
      // Cycle 1: U[3] → L[1] → D[0] → R[2] → U[3]
      const tmpF1 = s.U[3]
      s.U[3] = s.R[2]
      s.R[2] = s.D[0]
      s.D[0] = s.L[1]
      s.L[1] = tmpF1
      // Cycle 2: R[0] → U[2] → L[3] → D[1] → R[0]
      const tmpF2 = s.R[0]
      s.R[0] = s.D[1]
      s.D[1] = s.L[3]
      s.L[3] = s.U[2]
      s.U[2] = tmpF2
      break
    }
    case 'F\'': {
      rotateFaceCW(s, 'F')
      // Reverse of F cycle 1: U[3] → R[2] → D[0] → L[1] → U[3]
      const tmpFp1 = s.U[3]
      s.U[3] = s.L[1]
      s.L[1] = s.D[0]
      s.D[0] = s.R[2]
      s.R[2] = tmpFp1
      // Reverse of F cycle 2: R[0] → D[1] → L[3] → U[2] → R[0]
      const tmpFp2 = s.R[0]
      s.R[0] = s.U[2]
      s.U[2] = s.L[3]
      s.L[3] = s.D[1]
      s.D[1] = tmpFp2
      break
    }
    case 'B': {
      rotateFaceCCW(s, 'B')
      // Cycle 1: U[1] → R[3] → D[2] → L[0] → U[1]
      const tmpB1 = s.U[1]
      s.U[1] = s.L[0]
      s.L[0] = s.D[2]
      s.D[2] = s.R[3]
      s.R[3] = tmpB1
      // Cycle 2: R[1] → D[3] → L[2] → U[0] → R[1]
      const tmpB2 = s.R[1]
      s.R[1] = s.U[0]
      s.U[0] = s.L[2]
      s.L[2] = s.D[3]
      s.D[3] = tmpB2
      break
    }
    case 'B\'': {
      rotateFaceCW(s, 'B')
      // Reverse of B cycle 1: U[1] → L[0] → D[2] → R[3] → U[1]
      const tmpBp1 = s.U[1]
      s.U[1] = s.R[3]
      s.R[3] = s.D[2]
      s.D[2] = s.L[0]
      s.L[0] = tmpBp1
      // Reverse of B cycle 2: R[1] → U[0] → L[2] → D[3] → R[1]
      const tmpBp2 = s.R[1]
      s.R[1] = s.D[3]
      s.D[3] = s.L[2]
      s.L[2] = s.U[0]
      s.U[0] = tmpBp2
      break
    }
  }
  return s
}

export function isSolved(state: CubeState): boolean {
  return FACES.every(face => {
    const f = state[face]
    return f[0] === f[1] && f[1] === f[2] && f[2] === f[3]
  })
}

export function stateToString(state: CubeState): string {
  return FACES.map(f => state[f].join('')).join('|')
}

export function scramble(numMoves: number = 20): { state: CubeState; moves: Move[] } {
  let state = createSolvedState()
  const moves: Move[] = []
  let lastMove: Move | null = null

  for (let i = 0; i < numMoves; i++) {
    let move: Move
    do {
      move = ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)]
    } while (lastMove && move[0] === lastMove[0]) // avoid same face consecutive
    moves.push(move)
    state = applyMove(state, move)
    lastMove = move
  }

  return { state, moves }
}

export function getRandomMove(lastMove?: Move): Move {
  let move: Move
  do {
    move = ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)]
  } while (lastMove && move[0] === lastMove[0])
  return move
}
