import { ref, computed, shallowRef } from 'vue'
import {
  type CubeState,
  type Move,
  createSolvedState,
  applyMove,
  isSolved,
  getRandomMove,
} from '../engine/cube'
import { solveBFS, initSolver } from '../engine/solver'

// Pre-build pruning tables on load so first solve is instant
setTimeout(initSolver, 100)

function invertMove(move: Move): Move {
  return (move.includes('\'') ? move[0] : move + '\'') as Move
}

export function useCube() {
  const cubeState = shallowRef<CubeState>(createSolvedState())
  const moveQueue = ref<Move[]>([])
  const isAnimating = ref(false)
  const currentMove = ref<Move | null>(null)
  const moveCount = ref(0)
  const isRandomSolving = ref(false)
  const isSolving = ref(false)
  const statusMessage = ref('')
  const sceneVersion = ref(0)
  const isThinking = ref(false)

  // Timer
  const elapsedMs = ref(0)
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let timerStart = 0

  // History for undo/redo
  const moveHistory = ref<Move[]>([])
  const redoStack = ref<Move[]>([])

  const solved = computed(() => isSolved(cubeState.value))
  const elapsedFormatted = computed(() => {
    const ms = elapsedMs.value
    const secs = Math.floor(ms / 1000)
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    const centis = Math.floor((ms % 1000) / 10)
    if (mins > 0) return `${mins}:${String(s).padStart(2, '0')}.${String(centis).padStart(2, '0')}`
    return `${s}.${String(centis).padStart(2, '0')}s`
  })
  const canUndo = computed(() => moveHistory.value.length > 0 && !isBusy())
  const canRedo = computed(() => redoStack.value.length > 0 && !isBusy())

  let randomSolveTimer: ReturnType<typeof setInterval> | null = null

  function startTimer() {
    stopTimer()
    timerStart = Date.now()
    elapsedMs.value = 0
    timerInterval = setInterval(() => {
      elapsedMs.value = Date.now() - timerStart
    }, 33) // ~30fps update
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    if (timerStart) elapsedMs.value = Date.now() - timerStart
  }

  function resetTimer() {
    stopTimer()
    elapsedMs.value = 0
    timerStart = 0
  }

  function isBusy() {
    return isAnimating.value || isSolving.value || moveQueue.value.length > 0
  }

  function reset() {
    stopRandomize()
    stopRandomSolve()
    resetTimer()
    isThinking.value = false
    cubeState.value = createSolvedState()
    moveQueue.value = []
    isAnimating.value = false
    currentMove.value = null
    moveCount.value = 0
    isSolving.value = false
    statusMessage.value = ''
    moveHistory.value = []
    redoStack.value = []
    sceneVersion.value++
  }

  const isRandomizing = ref(false)
  let randomizeTimer: ReturnType<typeof setInterval> | null = null

  function randomize() {
    if (isRandomizing.value) {
      stopRandomize()
      return
    }
    stopRandomSolve()
    resetTimer()
    isSolving.value = false
    cubeState.value = createSolvedState()
    isAnimating.value = false
    currentMove.value = null
    moveCount.value = 0
    moveHistory.value = []
    redoStack.value = []
    sceneVersion.value++
    isRandomizing.value = true
    statusMessage.value = 'Randomizing... click Stop to finish'
    let lastMove: Move | undefined

    randomizeTimer = setInterval(() => {
      if (!isAnimating.value && moveQueue.value.length === 0) {
        const move = getRandomMove(lastMove)
        lastMove = move
        moveQueue.value = [move]
      }
    }, 250)
  }

  function stopRandomize() {
    if (randomizeTimer) {
      clearInterval(randomizeTimer)
      randomizeTimer = null
    }
    isRandomizing.value = false
    statusMessage.value = `Scrambled with ${moveCount.value} moves! Choose a solver or try it yourself.`
    moveCount.value = 0
  }

  function solveQuick() {
    if (solved.value) {
      statusMessage.value = 'Already solved!'
      return
    }
    stopRandomSolve()
    isSolving.value = true
    isThinking.value = true
    statusMessage.value = 'Thinking...'

    setTimeout(() => {
      const solution = solveBFS(cubeState.value)
      isThinking.value = false
      if (solution.length === 0) {
        statusMessage.value = 'Already solved!'
        isSolving.value = false
        return
      }
      moveQueue.value = solution
      moveCount.value = 0
      startTimer()
      statusMessage.value = `Solving in ${solution.length} moves...`
    }, 50)
  }

  function solveRandom() {
    if (solved.value) {
      statusMessage.value = 'Already solved!'
      return
    }
    stopRandomSolve()
    isRandomSolving.value = true
    isSolving.value = true
    moveCount.value = 0
    startTimer()
    statusMessage.value = 'Random solving...'
    let lastMove: Move | undefined

    randomSolveTimer = setInterval(() => {
      if (!isAnimating.value && moveQueue.value.length === 0) {
        if (isSolved(cubeState.value)) {
          stopRandomSolve()
          stopTimer()
          statusMessage.value = `Solved by luck in ${moveCount.value} moves!`
          return
        }
        const move = getRandomMove(lastMove)
        lastMove = move
        moveQueue.value = [move]
      }
    }, 300)
  }

  function stopRandomSolve() {
    if (randomSolveTimer) {
      clearInterval(randomSolveTimer)
      randomSolveTimer = null
    }
    isRandomSolving.value = false
  }

  /** Apply a manual move (from user clicking a move button) */
  function applyManualMove(move: Move) {
    if (isBusy()) return
    stopRandomSolve()
    isSolving.value = false
    moveQueue.value = [move]
    redoStack.value = [] // clear redo on new manual move
    statusMessage.value = ''
  }

  /** Undo the last move */
  function undo() {
    if (!canUndo.value) return
    const lastMove = moveHistory.value[moveHistory.value.length - 1]
    moveHistory.value = moveHistory.value.slice(0, -1)
    redoStack.value = [...redoStack.value, lastMove]
    const inv = invertMove(lastMove)
    // Queue the inverse move but don't add to history (handled specially)
    moveQueue.value = [inv]
    moveCount.value = Math.max(0, moveCount.value - 1)
    statusMessage.value = ''
    // Flag so commitMove doesn't add to history
    undoRedoInProgress = true
  }

  /** Redo a previously undone move */
  function redo() {
    if (!canRedo.value) return
    const move = redoStack.value[redoStack.value.length - 1]
    redoStack.value = redoStack.value.slice(0, -1)
    moveHistory.value = [...moveHistory.value, move]
    moveQueue.value = [move]
    moveCount.value++
    statusMessage.value = ''
    undoRedoInProgress = true
  }

  let undoRedoInProgress = false

  function dequeueMove(): Move | null {
    if (isAnimating.value) return null
    if (moveQueue.value.length === 0) {
      if (isSolving.value && !isRandomSolving.value && isSolved(cubeState.value)) {
        stopTimer()
        statusMessage.value = `Solved in ${moveCount.value} moves!`
        isSolving.value = false
      }
      return null
    }
    const move = moveQueue.value[0]
    moveQueue.value = moveQueue.value.slice(1)
    currentMove.value = move
    isAnimating.value = true
    return move
  }

  function commitMove(move: Move) {
    cubeState.value = applyMove(cubeState.value, move)
    if (!undoRedoInProgress) {
      moveHistory.value = [...moveHistory.value, move]
      moveCount.value++
    }
    undoRedoInProgress = false
    currentMove.value = null
    isAnimating.value = false

    // Check if solved after manual move
    if (!isSolving.value && isSolved(cubeState.value) && moveHistory.value.length > 0) {
      statusMessage.value = `You solved it in ${moveHistory.value.length} moves!`
    }
  }

  return {
    cubeState,
    moveQueue,
    isAnimating,
    currentMove,
    moveCount,
    isRandomizing,
    isRandomSolving,
    isSolving,
    statusMessage,
    sceneVersion,
    isThinking,
    elapsedMs,
    elapsedFormatted,
    moveHistory,
    redoStack,
    solved,
    canUndo,
    canRedo,
    reset,
    randomize,
    solveQuick,
    solveRandom,
    applyManualMove,
    undo,
    redo,
    dequeueMove,
    commitMove,
  }
}
