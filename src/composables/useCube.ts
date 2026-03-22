import { ref, computed, shallowRef, watch, type Ref } from 'vue'
import * as cube2 from '../engine/cube'
import * as cube3 from '../engine/cube3'
import { solveBFS, initSolver } from '../engine/solver'
import { solve3, initSolver3 } from '../engine/solver3'

// Pre-build 2x2 pruning tables
setTimeout(initSolver, 100)

function invertMove(move: string): string {
  if (move.endsWith('2')) return move // R2 inverse = R2
  if (move.endsWith("'")) return move[0]
  return move + "'"
}

export function useCube(puzzleSize: Ref<number>) {
  const cubeState = shallowRef<any>(cube2.createSolvedState())
  const moveQueue = ref<string[]>([])
  const isAnimating = ref(false)
  const currentMove = ref<string | null>(null)
  const moveCount = ref(0)
  const isRandomSolving = ref(false)
  const isRandomizing = ref(false)
  const isSolving = ref(false)
  const isThinking = ref(false)
  const statusMessage = ref('')
  const sceneVersion = ref(0)

  // Timer
  const elapsedMs = ref(0)
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let timerStart = 0

  // History
  const moveHistory = ref<string[]>([])
  const redoStack = ref<string[]>([])

  const solved = computed(() => {
    return puzzleSize.value === 2
      ? cube2.isSolved(cubeState.value)
      : cube3.isSolved(cubeState.value)
  })

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
  let randomizeTimer: ReturnType<typeof setInterval> | null = null

  // Engine helpers
  function createSolved() {
    return puzzleSize.value === 2 ? cube2.createSolvedState() : cube3.createSolvedState()
  }

  function applyMoveToState(state: any, move: string) {
    return puzzleSize.value === 2
      ? cube2.applyMove(state, move as cube2.Move)
      : cube3.applyMove(state, move as cube3.Move3)
  }

  function getRandomMoveForSize(lastMove?: string) {
    return puzzleSize.value === 2
      ? cube2.getRandomMove(lastMove as cube2.Move | undefined)
      : cube3.getRandomMove(lastMove as cube3.Move3 | undefined)
  }

  function checkSolved(state: any) {
    return puzzleSize.value === 2 ? cube2.isSolved(state) : cube3.isSolved(state)
  }

  // Timer
  function startTimer() {
    stopTimer()
    timerStart = Date.now()
    elapsedMs.value = 0
    timerInterval = setInterval(() => { elapsedMs.value = Date.now() - timerStart }, 33)
  }
  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
    if (timerStart) elapsedMs.value = Date.now() - timerStart
  }
  function resumeTimer() {
    if (timerInterval) return
    timerStart = Date.now() - elapsedMs.value
    timerInterval = setInterval(() => { elapsedMs.value = Date.now() - timerStart }, 33)
  }
  function resetTimer() {
    stopTimer(); elapsedMs.value = 0; timerStart = 0
  }

  function isBusy() {
    return isAnimating.value || isSolving.value || moveQueue.value.length > 0
  }

  function stopRandomize() {
    if (randomizeTimer) { clearInterval(randomizeTimer); randomizeTimer = null }
    isRandomizing.value = false
  }

  function stopRandomSolve() {
    if (randomSolveTimer) { clearInterval(randomSolveTimer); randomSolveTimer = null }
    isRandomSolving.value = false
  }

  function reset() {
    stopRandomize()
    stopRandomSolve()
    resetTimer()
    isThinking.value = false
    cubeState.value = createSolved()
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

  function randomize() {
    if (isRandomizing.value) {
      stopRandomize()
      statusMessage.value = `Scrambled with ${moveCount.value} moves! Choose a solver or try it yourself.`
      moveCount.value = 0
      return
    }
    stopRandomSolve()
    resetTimer()
    isSolving.value = false
    cubeState.value = createSolved()
    isAnimating.value = false
    currentMove.value = null
    moveCount.value = 0
    moveHistory.value = []
    redoStack.value = []
    sceneVersion.value++
    isRandomizing.value = true
    statusMessage.value = 'Randomizing... click Stop to finish'
    let lastMove: string | undefined

    randomizeTimer = setInterval(() => {
      if (!isAnimating.value && moveQueue.value.length === 0) {
        const move = getRandomMoveForSize(lastMove)
        lastMove = move
        moveQueue.value = [move]
      }
    }, 250)
  }

  function solveQuick() {
    if (solved.value) { statusMessage.value = 'Already solved!'; return }
    stopRandomSolve()
    stopRandomize()
    isSolving.value = true
    isThinking.value = true
    statusMessage.value = 'Thinking...'

    const doSolve = async () => {
      let solution: string[]
      if (puzzleSize.value === 2) {
        solution = solveBFS(cubeState.value)
      } else {
        await initSolver3()
        solution = solve3(cubeState.value)
      }
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
    }
    setTimeout(doSolve, 50)
  }

  function solveRandom() {
    // Toggle: pause if already running
    if (isRandomSolving.value) {
      stopRandomSolve()
      stopTimer()
      isSolving.value = false
      statusMessage.value = `Paused at ${moveCount.value} moves. ${elapsedFormatted.value}`
      return
    }

    if (solved.value) { statusMessage.value = 'Already solved!'; return }
    stopRandomize()
    isRandomSolving.value = true
    isSolving.value = true
    if (!timerStart) startTimer()
    else resumeTimer()
    statusMessage.value = 'Random solving...'
    let lastMove: string | undefined

    randomSolveTimer = setInterval(() => {
      if (!isAnimating.value && moveQueue.value.length === 0) {
        if (checkSolved(cubeState.value)) {
          stopRandomSolve()
          stopTimer()
          statusMessage.value = `Solved by luck in ${moveCount.value} moves!`
          return
        }
        const move = getRandomMoveForSize(lastMove)
        lastMove = move
        moveQueue.value = [move]
      }
    }, 300)
  }

  function applyManualMove(move: string) {
    if (isBusy()) return
    stopRandomSolve()
    stopRandomize()
    isSolving.value = false
    moveQueue.value = [move]
    redoStack.value = []
    statusMessage.value = ''
  }

  function undo() {
    if (!canUndo.value) return
    const lastMove = moveHistory.value[moveHistory.value.length - 1]
    moveHistory.value = moveHistory.value.slice(0, -1)
    redoStack.value = [...redoStack.value, lastMove]
    moveQueue.value = [invertMove(lastMove)]
    moveCount.value = Math.max(0, moveCount.value - 1)
    statusMessage.value = ''
    undoRedoInProgress = true
  }

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

  function dequeueMove(): string | null {
    if (isAnimating.value) return null
    if (moveQueue.value.length === 0) {
      if (isSolving.value && !isRandomSolving.value && checkSolved(cubeState.value)) {
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

  function commitMove(move: string) {
    cubeState.value = applyMoveToState(cubeState.value, move)
    if (!undoRedoInProgress) {
      moveHistory.value = [...moveHistory.value, move]
      moveCount.value++
    }
    undoRedoInProgress = false
    currentMove.value = null
    isAnimating.value = false

    if (!isSolving.value && checkSolved(cubeState.value) && moveHistory.value.length > 0) {
      statusMessage.value = `You solved it in ${moveHistory.value.length} moves!`
    }
  }

  // When puzzle size changes, reset everything
  watch(puzzleSize, () => {
    reset()
    if (puzzleSize.value === 3) {
      isThinking.value = true
      statusMessage.value = 'Loading 3x3 solver...'
      initSolver3().then(() => {
        isThinking.value = false
        statusMessage.value = ''
      })
    }
  })

  return {
    cubeState, moveQueue, isAnimating, currentMove, moveCount,
    isRandomizing, isRandomSolving, isSolving, isThinking,
    statusMessage, sceneVersion, elapsedMs, elapsedFormatted,
    moveHistory, redoStack, solved, canUndo, canRedo,
    reset, randomize, solveQuick, solveRandom,
    applyManualMove, undo, redo, dequeueMove, commitMove,
  }
}
