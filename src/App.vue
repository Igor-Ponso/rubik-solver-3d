<script setup lang="ts">
import { ref } from 'vue'
import RubikCube from './components/RubikCube.vue'
import { useCube } from './composables/useCube'

const puzzleSize = ref(2)
const darkMode = ref(true)

function toggleTheme() {
  darkMode.value = !darkMode.value
  document.documentElement.setAttribute('data-theme', darkMode.value ? 'dark' : 'light')
}

const {
  isAnimating,
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
} = useCube(puzzleSize)

function isBusy() {
  return isSolving.value || isAnimating.value
}

const moveButtons = [
  { label: 'R', move: 'R' },
  { label: "R'", move: "R'" },
  { label: 'L', move: 'L' },
  { label: "L'", move: "L'" },
  { label: 'U', move: 'U' },
  { label: "U'", move: "U'" },
  { label: 'D', move: 'D' },
  { label: "D'", move: "D'" },
  { label: 'F', move: 'F' },
  { label: "F'", move: "F'" },
  { label: 'B', move: 'B' },
  { label: "B'", move: "B'" },
]
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-row">
        <h1>Rubik's Cube <span class="accent">{{ puzzleSize }}x{{ puzzleSize }}</span></h1>
        <button class="theme-btn" @click="toggleTheme" :title="darkMode ? 'Light mode' : 'Dark mode'">
          {{ darkMode ? '&#x2600;' : '&#x1F319;' }}
        </button>
      </div>
      <div class="size-toggle">
        <button :class="{ active: puzzleSize === 2 }" @click="puzzleSize = 2">2x2</button>
        <button :class="{ active: puzzleSize === 3 }" @click="puzzleSize = 3">3x3</button>
      </div>
    </header>

    <main class="main">
      <div class="scene-wrapper">
        <RubikCube
          :dequeueMove="dequeueMove"
          :commitMove="commitMove"
          :isAnimating="isAnimating"
          :sceneVersion="sceneVersion"
          :puzzleSize="puzzleSize"
        />
      </div>

      <div class="controls">
        <div class="status-bar">
          <div class="status-info">
            <span class="move-counter">Moves: {{ moveCount }}</span>
            <span v-if="elapsedMs > 0" class="timer">{{ elapsedFormatted }}</span>
            <span v-if="solved && !isSolving" class="solved-badge">
              {{ moveCount === 0 ? 'Solved' : 'Solved!' }}
            </span>
          </div>
          <div v-if="isThinking" class="thinking">
            <span class="spinner" />
            <span>Thinking...</span>
          </div>
          <p v-else-if="statusMessage" class="status-message">{{ statusMessage }}</p>
        </div>

        <!-- Move controls for manual solving -->
        <div class="move-controls">
          <button
            v-for="mb in moveButtons"
            :key="mb.label"
            class="move-btn"
            :disabled="isBusy()"
            @click="applyManualMove(mb.move)"
          >
            {{ mb.label }}
          </button>
        </div>

        <!-- Undo / Redo -->
        <div class="history-controls">
          <button class="btn btn-undo" :disabled="!canUndo" @click="undo">
            <span class="btn-icon">&#x21A9;</span> Undo
          </button>
          <div class="history-display">
            <span
              v-for="(m, i) in moveHistory.slice(-12)"
              :key="i"
              class="history-move"
            >{{ m }}</span>
            <span v-if="moveHistory.length === 0" class="history-empty">No moves yet</span>
          </div>
          <button class="btn btn-redo" :disabled="!canRedo" @click="redo">
            Redo <span class="btn-icon">&#x21AA;</span>
          </button>
        </div>

        <!-- Action buttons -->
        <div class="button-group">
          <button
            class="btn btn-scramble"
            :class="{ active: isRandomizing }"
            :disabled="!isRandomizing && isThinking"
            @click="randomize"
          >
            <span class="btn-icon">{{ isRandomizing ? '&#x23F9;' : '&#x1f3b2;' }}</span>
            {{ isRandomizing ? 'Stop' : 'Randomize' }}
          </button>

          <button class="btn btn-solve-quick" :disabled="solved && !isRandomSolving" @click="solveQuick">
            <span class="btn-icon">&#x26a1;</span>
            Quick Solve
          </button>

          <button
            class="btn btn-solve-random"
            :class="{ active: isRandomSolving }"
            :disabled="solved && !isRandomSolving"
            @click="solveRandom"
          >
            <span class="btn-icon">{{ isRandomSolving ? '&#x23F8;' : '&#x1f340;' }}</span>
            {{ isRandomSolving ? 'Pause' : 'Random Solve' }}
          </button>

          <button class="btn btn-reset" @click="reset">
            <span class="btn-icon">&#x21ba;</span>
            Reset
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

:root, [data-theme="dark"] {
  --bg: #0a0a10;
  --bg-controls: rgba(10, 10, 16, 0.8);
  --text: #e0e0e0;
  --text-muted: #888;
  --text-dim: #555;
  --title: #fff;
  --border: rgba(255, 255, 255, 0.1);
  --border-hover: rgba(255, 255, 255, 0.25);
  --btn-bg: rgba(255, 255, 255, 0.05);
  --btn-bg-hover: rgba(255, 255, 255, 0.12);
  --input-bg: rgba(255, 255, 255, 0.03);
  --badge-bg: rgba(255, 255, 255, 0.08);
  --cubie-border: #1a1a1a;
}

[data-theme="light"] {
  --bg: #f0f0f5;
  --bg-controls: rgba(240, 240, 245, 0.9);
  --text: #333;
  --text-muted: #666;
  --text-dim: #aaa;
  --title: #111;
  --border: rgba(0, 0, 0, 0.12);
  --border-hover: rgba(0, 0, 0, 0.3);
  --btn-bg: rgba(0, 0, 0, 0.04);
  --btn-bg-hover: rgba(0, 0, 0, 0.08);
  --input-bg: rgba(0, 0, 0, 0.03);
  --badge-bg: rgba(0, 0, 0, 0.07);
  --cubie-border: #333;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
  height: 100vh;
  width: 100vw;
  transition: background 0.3s, color 0.3s;
}

#app {
  height: 100vh;
  width: 100vw;
}
</style>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.header {
  text-align: center;
  padding: 1rem 1rem 0.3rem;
  flex-shrink: 0;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
}

.header h1 {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--title);
}

.theme-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.25rem 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1;
}
.theme-btn:hover {
  background: var(--btn-bg-hover);
}

.accent {
  background: linear-gradient(135deg, #ff5900, #b90000);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.size-toggle {
  display: flex;
  justify-content: center;
  gap: 0.3rem;
  margin-top: 0.4rem;
}

.size-toggle button {
  padding: 0.25rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--btn-bg);
  color: var(--text-muted);
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.size-toggle button.active {
  background: rgba(255,89,0,0.2);
  border-color: #ff5900;
  color: var(--title);
}

.size-toggle button:hover:not(.active) {
  background: rgba(255,255,255,0.1);
  color: var(--text);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.scene-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
}

.controls {
  flex-shrink: 0;
  padding: 0.6rem 1rem 1rem;
  background: linear-gradient(to top, var(--bg), var(--bg-controls));
}

.status-bar {
  text-align: center;
  margin-bottom: 0.5rem;
  min-height: 2.2rem;
}

.status-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
}

.move-counter {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
}

.solved-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: #009B48;
  color: var(--title);
}

.timer {
  font-size: 0.85rem;
  font-weight: 700;
  color: #c084fc;
  font-variant-numeric: tabular-nums;
}

.thinking {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 0.2rem;
  font-size: 0.8rem;
  color: #c084fc;
  font-weight: 600;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(192, 132, 252, 0.3);
  border-top-color: #c084fc;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-message {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

/* Move buttons grid */
.move-controls {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.3rem;
  max-width: 420px;
  margin: 0 auto 0.5rem;
}

.move-btn {
  padding: 0.4rem 0;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: var(--btn-bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.move-btn:hover:not(:disabled) {
  background: var(--btn-bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.move-btn:active:not(:disabled) {
  transform: translateY(0);
}

.move-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* History bar */
.history-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 600px;
  margin: 0 auto 0.6rem;
}

.history-display {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.5rem;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  min-height: 2rem;
  overflow-x: auto;
  justify-content: center;
}

.history-move {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--badge-bg);
  color: var(--text);
  white-space: nowrap;
}

.history-empty {
  font-size: 0.7rem;
  color: var(--text-dim);
}

.btn-undo,
.btn-redo {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--btn-bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-undo:hover:not(:disabled),
.btn-redo:hover:not(:disabled) {
  background: var(--btn-bg-hover);
  border-color: var(--border-hover);
}

.btn-undo:disabled,
.btn-redo:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Action buttons */
.button-group {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  max-width: 600px;
  margin: 0 auto;
}

.btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.6rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--btn-bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.btn:hover:not(:disabled) {
  background: var(--btn-bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.btn:active:not(:disabled) {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 1.2rem;
}

.btn-scramble:hover:not(:disabled) {
  border-color: #FFD500;
  box-shadow: 0 0 20px rgba(255, 213, 0, 0.15);
}

.btn-scramble.active {
  border-color: #ff4444;
  background: rgba(255, 68, 68, 0.15);
  box-shadow: 0 0 20px rgba(255, 68, 68, 0.2);
}

.btn-solve-quick:hover:not(:disabled) {
  border-color: #009B48;
  box-shadow: 0 0 20px rgba(0, 155, 72, 0.15);
}

.btn-solve-random:hover:not(:disabled) {
  border-color: #0045AD;
  box-shadow: 0 0 20px rgba(0, 69, 173, 0.15);
}

.btn-solve-random.active {
  border-color: #FFD500;
  background: rgba(255, 213, 0, 0.15);
  box-shadow: 0 0 20px rgba(255, 213, 0, 0.2);
}

.btn-reset:hover:not(:disabled) {
  border-color: #ff5900;
  box-shadow: 0 0 20px rgba(255, 89, 0, 0.15);
}

@media (max-width: 480px) {
  .button-group {
    grid-template-columns: repeat(2, 1fr);
  }

  .move-controls {
    grid-template-columns: repeat(4, 1fr);
  }

  .header h1 {
    font-size: 1.3rem;
  }
}
</style>
