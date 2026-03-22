/**
 * Ultra-fast 2x2 solver: IDA* with precomputed move tables + pruning tables.
 *
 * Key optimization: each node in the search is just two integers (permIdx, orientIdx).
 * Applying a move = two array lookups. Zero allocations during search.
 *
 * - permMoveTable[permIdx * 12 + moveIdx] → new permIdx
 * - orientMoveTable[orientIdx * 12 + moveIdx] → new orientIdx
 * - permPrune[permIdx] → min moves to solve permutation
 * - orientPrune[orientIdx] → min moves to solve orientation
 * - heuristic = max(permPrune, orientPrune)
 */

import { type CubeState, type Move, type Face, ALL_MOVES, applyMove, isSolved, createSolvedState } from './cube'

// ─── Corner definitions ──────────────────────────────────────────────────
const CC: [Face, Face, Face][] = [
  ['U','B','L'], ['U','R','B'], ['U','F','R'], ['U','L','F'],
  ['D','F','L'], ['D','R','F'], ['D','B','R'], ['D','L','B'],
]
const CF: [Face,number,Face,number,Face,number][] = [
  ['U',0,'B',1,'L',0], ['U',1,'R',1,'B',0], ['U',3,'F',1,'R',0], ['U',2,'L',1,'F',0],
  ['D',0,'F',2,'L',3], ['D',1,'R',2,'F',3], ['D',3,'B',2,'R',3], ['D',2,'L',2,'B',3],
]

function extractCorners(state: CubeState): { perm: number[]; orient: number[] } {
  const perm: number[] = []
  const orient: number[] = []
  for (let pos = 0; pos < 8; pos++) {
    const [f0,i0,f1,i1,f2,i2] = CF[pos]
    const c0 = state[f0][i0], c1 = state[f1][i1], c2 = state[f2][i2]
    for (let cubie = 0; cubie < 8; cubie++) {
      const [id0,id1,id2] = CC[cubie]
      if (c0===id0 && c1===id1 && c2===id2) { perm.push(cubie); orient.push(0); break }
      if (c1===id0 && c2===id1 && c0===id2) { perm.push(cubie); orient.push(1); break }
      if (c2===id0 && c0===id1 && c1===id2) { perm.push(cubie); orient.push(2); break }
    }
  }
  return { perm, orient }
}

// ─── Index encoding ──────────────────────────────────────────────────────
const FACT = [1,1,2,6,24,120,720,5040,40320]

function permToIndex(p: number[]): number {
  let idx = 0
  for (let i = 0; i < 8; i++) {
    let c = 0
    for (let j = i + 1; j < 8; j++) if (p[j] < p[i]) c++
    idx = idx * (8 - i) + c
  }
  return idx
}

function indexToPerm(idx: number): number[] {
  const p = new Array(8)
  const avail = [0,1,2,3,4,5,6,7]
  for (let i = 0; i < 8; i++) {
    const f = FACT[7 - i]
    const k = Math.floor(idx / f)
    idx %= f
    p[i] = avail[k]
    avail.splice(k, 1)
  }
  return p
}

function orientToIndex(o: number[]): number {
  let idx = 0
  for (let i = 0; i < 7; i++) idx = idx * 3 + o[i]
  return idx
}

function indexToOrient(idx: number): number[] {
  const o = new Array(8)
  let sum = 0
  for (let i = 6; i >= 0; i--) {
    o[i] = idx % 3; sum += o[i]; idx = Math.floor(idx / 3)
  }
  o[7] = (3 - (sum % 3)) % 3
  return o
}

// ─── Move cycle definitions ──────────────────────────────────────────────
// Computed from cube.ts: for each move, cycle [a,b,c,d] means a←b, b←c, c←d, d←a

interface MCycle { c: [number,number,number,number]; d: [number,number,number,number] }

function computeCycles(): MCycle[] {
  const solved = createSolvedState()
  const cycles: MCycle[] = []

  for (const move of ALL_MOVES) {
    const after = applyMove(solved, move)
    const sp = extractCorners(solved)
    const ap = extractCorners(after)

    const changed: number[] = []
    for (let i = 0; i < 8; i++) if (sp.perm[i] !== ap.perm[i]) changed.push(i)

    // Build cycle: position a gets the cubie that was at position b, etc.
    const cycle: number[] = [changed[0]]
    let cur = changed[0]
    for (let step = 0; step < 3; step++) {
      for (const j of changed) {
        if (ap.perm[cur] === sp.perm[j]) { cycle.push(j); cur = j; break }
      }
    }

    cycles.push({
      c: cycle as [number,number,number,number],
      d: cycle.map(pos => ap.orient[pos]) as [number,number,number,number],
    })
  }

  return cycles
}

// ─── Precomputed tables ──────────────────────────────────────────────────
const PERM_SIZE = 40320
const ORIENT_SIZE = 2187
const N_MOVES = 12

let permMove: Int32Array    // [PERM_SIZE * N_MOVES]
let orientMove: Int16Array  // [ORIENT_SIZE * N_MOVES]
let permPrune: Uint8Array   // [PERM_SIZE]
let orientPrune: Uint8Array // [ORIENT_SIZE]
let ready = false
let moveCycles: MCycle[]

function applyMoveToArrays(perm: number[], orient: number[], mc: MCycle): [number[], number[]] {
  const np = perm.slice(), no = orient.slice()
  const [a,b,c,d] = mc.c
  const [da,db,dc,dd] = mc.d
  np[a] = perm[b]; no[a] = (orient[b] + da) % 3
  np[b] = perm[c]; no[b] = (orient[c] + db) % 3
  np[c] = perm[d]; no[c] = (orient[d] + dc) % 3
  np[d] = perm[a]; no[d] = (orient[a] + dd) % 3
  return [np, no]
}

function buildMoveTables() {
  permMove = new Int32Array(PERM_SIZE * N_MOVES)
  orientMove = new Int16Array(ORIENT_SIZE * N_MOVES)

  // Perm move table
  for (let pi = 0; pi < PERM_SIZE; pi++) {
    const p = indexToPerm(pi)
    for (let mi = 0; mi < N_MOVES; mi++) {
      const [np] = applyMoveToArrays(p, [0,0,0,0,0,0,0,0], moveCycles[mi])
      permMove[pi * N_MOVES + mi] = permToIndex(np)
    }
  }

  // Orient move table
  for (let oi = 0; oi < ORIENT_SIZE; oi++) {
    const o = indexToOrient(oi)
    for (let mi = 0; mi < N_MOVES; mi++) {
      const [, no] = applyMoveToArrays([0,1,2,3,4,5,6,7], o, moveCycles[mi])
      orientMove[oi * N_MOVES + mi] = orientToIndex(no)
    }
  }
}

function buildPruneTables() {
  // Perm prune table via BFS on permMove
  permPrune = new Uint8Array(PERM_SIZE).fill(255)
  permPrune[0] = 0 // identity perm = index 0
  let frontier = [0]
  let depth = 0
  while (frontier.length > 0) {
    const next: number[] = []
    for (const pi of frontier) {
      for (let mi = 0; mi < N_MOVES; mi++) {
        const npi = permMove[pi * N_MOVES + mi]
        if (permPrune[npi] === 255) {
          permPrune[npi] = depth + 1
          next.push(npi)
        }
      }
    }
    frontier = next
    depth++
  }

  // Orient prune table via BFS on orientMove
  orientPrune = new Uint8Array(ORIENT_SIZE).fill(255)
  orientPrune[0] = 0
  let oFrontier = [0]
  depth = 0
  while (oFrontier.length > 0) {
    const next: number[] = []
    for (const oi of oFrontier) {
      for (let mi = 0; mi < N_MOVES; mi++) {
        const noi = orientMove[oi * N_MOVES + mi]
        if (orientPrune[noi] === 255) {
          orientPrune[noi] = depth + 1
          next.push(noi)
        }
      }
    }
    oFrontier = next
    depth++
  }
}

export function initSolver() {
  if (ready) return
  moveCycles = computeCycles()
  buildMoveTables()
  buildPruneTables()
  ready = true
}

// ─── IDA* solver (zero allocations during search) ────────────────────────

export function solveBFS(initial: CubeState): Move[] {
  initSolver()
  if (isSolved(initial)) return []

  const { perm, orient } = extractCorners(initial)
  const startPi = permToIndex(perm)
  const startOi = orientToIndex(orient)

  // Stack-based iterative deepening
  const pathMoves: number[] = new Array(15)  // move indices
  const pathPi: number[] = new Array(15)     // perm indices
  const pathOi: number[] = new Array(15)     // orient indices
  const pathFace: number[] = new Array(15)   // face of last move (-1 for none)

  for (let maxDepth = 0; maxDepth <= 14; maxDepth++) {
    // DFS with explicit stack variables
    pathPi[0] = startPi
    pathOi[0] = startOi
    pathFace[0] = -1

    if (dfs(0, maxDepth, pathPi, pathOi, pathFace, pathMoves)) {
      return pathMoves.slice(0, maxDepth).map(i => ALL_MOVES[i])
    }
  }

  return []
}

function dfs(
  depth: number, maxDepth: number,
  pi: number[], oi: number[], face: number[], moves: number[],
): boolean {
  const p = pi[depth], o = oi[depth], lastFace = face[depth]
  const h = Math.max(permPrune[p], orientPrune[o])
  if (depth + h > maxDepth) return false
  if (p === 0 && o === 0) return true // solved

  for (let mi = 0; mi < N_MOVES; mi++) {
    const mFace = mi >> 1 // each face has 2 moves (CW, CCW)
    if (mFace === lastFace) continue

    const np = permMove[p * N_MOVES + mi]
    const no = orientMove[o * N_MOVES + mi]

    moves[depth] = mi
    pi[depth + 1] = np
    oi[depth + 1] = no
    face[depth + 1] = mFace

    if (dfs(depth + 1, maxDepth, pi, oi, face, moves)) return true
  }

  return false
}
