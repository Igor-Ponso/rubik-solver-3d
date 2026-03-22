<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import {
  type Move,
  COLORS,
  type CubeState,
  createSolvedState,
  applyMove,
} from '../engine/cube'

const props = defineProps<{
  dequeueMove: () => Move | null
  commitMove: (move: Move) => void
  isAnimating: boolean
  sceneVersion: number
}>()

let localState: CubeState = createSolvedState()

// Camera rotation via mouse drag
const rotX = ref(-25)
const rotY = ref(35)
let isDragging = false
let lastX = 0
let lastY = 0

const ANIM_DURATION = 350 // ms

// ─── 3x3 rotation matrix helpers ───────────────────────────────────────
type Mat3 = number[] // 9 elements, row-major [r0c0, r0c1, r0c2, r1c0, ...]

const IDENTITY: Mat3 = [1,0,0, 0,1,0, 0,0,1]

function mulMat(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0]*b[0]+a[1]*b[3]+a[2]*b[6], a[0]*b[1]+a[1]*b[4]+a[2]*b[7], a[0]*b[2]+a[1]*b[5]+a[2]*b[8],
    a[3]*b[0]+a[4]*b[3]+a[5]*b[6], a[3]*b[1]+a[4]*b[4]+a[5]*b[7], a[3]*b[2]+a[4]*b[5]+a[5]*b[8],
    a[6]*b[0]+a[7]*b[3]+a[8]*b[6], a[6]*b[1]+a[7]*b[4]+a[8]*b[7], a[6]*b[2]+a[7]*b[5]+a[8]*b[8],
  ]
}

function matToCSS(m: Mat3): string {
  // Convert cube-space rotation to CSS-space (Y inverted)
  // If S = diag(1,-1,1), then CSS_matrix = S * M * S
  // This negates row1, col1 of M (indices involving Y)
  const c = [
    m[0], -m[1], m[2],
    -m[3], m[4], -m[5],
    m[6], -m[7], m[8],
  ]
  // CSS matrix3d is column-major, 4x4
  return `matrix3d(${c[0]},${c[3]},${c[6]},0,${c[1]},${c[4]},${c[7]},0,${c[2]},${c[5]},${c[8]},0,0,0,0,1)`
}

// Rotation matrices for each axis by ±90°
const ROT: Record<string, Mat3> = {
  'x+': [1,0,0, 0,0,-1, 0,1,0],   // rotateX(+90)
  'x-': [1,0,0, 0,0,1, 0,-1,0],    // rotateX(-90)
  'y+': [0,0,1, 0,1,0, -1,0,0],    // rotateY(+90)
  'y-': [0,0,-1, 0,1,0, 1,0,0],    // rotateY(-90)
  'z+': [0,-1,0, 1,0,0, 0,0,1],    // rotateZ(+90)
  'z-': [0,1,0, -1,0,0, 0,0,1],    // rotateZ(-90)
}

function transformPos(pos: [number,number,number], rotKey: string): [number,number,number] {
  const m = ROT[rotKey]
  return [
    Math.round(m[0]*pos[0] + m[1]*pos[1] + m[2]*pos[2]),
    Math.round(m[3]*pos[0] + m[4]*pos[1] + m[5]*pos[2]),
    Math.round(m[6]*pos[0] + m[7]*pos[1] + m[8]*pos[2]),
  ]
}

// ─── Corner identity and colors ────────────────────────────────────────
// Each corner cubie has a fixed identity (0-7) with 3 colored faces.
// Colors NEVER change — only position and orientation change.

const CORNER_FACES: { right: string; left: string; top: string; bottom: string; front: string; back: string }[] = [
  // 0: UBL corner — U(white) on top, B(blue) on back, L(orange) on left
  { top: COLORS.U, bottom: '#111', front: '#111', back: COLORS.B, left: COLORS.L, right: '#111' },
  // 1: UBR corner
  { top: COLORS.U, bottom: '#111', front: '#111', back: COLORS.B, left: '#111', right: COLORS.R },
  // 2: UFR corner
  { top: COLORS.U, bottom: '#111', front: COLORS.F, back: '#111', left: '#111', right: COLORS.R },
  // 3: UFL corner
  { top: COLORS.U, bottom: '#111', front: COLORS.F, back: '#111', left: COLORS.L, right: '#111' },
  // 4: DFL corner
  { top: '#111', bottom: COLORS.D, front: COLORS.F, back: '#111', left: COLORS.L, right: '#111' },
  // 5: DFR corner
  { top: '#111', bottom: COLORS.D, front: COLORS.F, back: '#111', left: '#111', right: COLORS.R },
  // 6: DBR corner
  { top: '#111', bottom: COLORS.D, front: '#111', back: COLORS.B, left: '#111', right: COLORS.R },
  // 7: DBL corner
  { top: '#111', bottom: COLORS.D, front: '#111', back: COLORS.B, left: COLORS.L, right: '#111' },
]

// Starting positions: corner i starts at position i
const START_POSITIONS: [number,number,number][] = [
  [-1, 1,-1], // 0: UBL
  [ 1, 1,-1], // 1: UBR
  [ 1, 1, 1], // 2: UFR
  [-1, 1, 1], // 3: UFL
  [-1,-1, 1], // 4: DFL
  [ 1,-1, 1], // 5: DFR
  [ 1,-1,-1], // 6: DBR
  [-1,-1,-1], // 7: DBL
]

// ─── Cubie state ───────────────────────────────────────────────────────
interface Cubie {
  id: number
  pos: [number, number, number]
  rot: Mat3
  faces: typeof CORNER_FACES[0]
}

const cubies = reactive<Cubie[]>([])

function initCubies() {
  cubies.length = 0
  for (let i = 0; i < 8; i++) {
    cubies.push({
      id: i,
      pos: [...START_POSITIONS[i]] as [number,number,number],
      rot: [...IDENTITY],
      faces: CORNER_FACES[i],
    })
  }
}

// ─── Move info ─────────────────────────────────────────────────────────
function getMoveInfo(move: Move): { rotKey: string; cssAngle: string; filter: (p: [number,number,number]) => boolean } {
  const prime = move.includes("'")
  // CSS angles are negated because CSS Y points down (mirrored handedness)
  switch (move[0]) {
    case 'R': return { rotKey: prime ? 'x+' : 'x-', cssAngle: `rotateX(${prime ? -90 : 90}deg)`, filter: p => p[0] > 0 }
    case 'L': return { rotKey: prime ? 'x-' : 'x+', cssAngle: `rotateX(${prime ? 90 : -90}deg)`, filter: p => p[0] < 0 }
    case 'U': return { rotKey: prime ? 'y+' : 'y-', cssAngle: `rotateY(${prime ? 90 : -90}deg)`, filter: p => p[1] > 0 }
    case 'D': return { rotKey: prime ? 'y-' : 'y+', cssAngle: `rotateY(${prime ? -90 : 90}deg)`, filter: p => p[1] < 0 }
    case 'F': return { rotKey: prime ? 'z-' : 'z+', cssAngle: `rotateZ(${prime ? 90 : -90}deg)`, filter: p => p[2] > 0 }
    case 'B': return { rotKey: prime ? 'z+' : 'z-', cssAngle: `rotateZ(${prime ? -90 : 90}deg)`, filter: p => p[2] < 0 }
    default: return { rotKey: 'x+', cssAngle: '', filter: () => false }
  }
}

// ─── Animation ─────────────────────────────────────────────────────────
const animGroupTransform = ref('')
const animTransitioning = ref(false)
const movingIds = ref(new Set<number>())

let currentAnimMove: Move | null = null
let animTimer: ReturnType<typeof setTimeout> | null = null

function startAnimation(move: Move) {
  const { cssAngle, filter } = getMoveInfo(move)
  currentAnimMove = move

  // Mark which cubies are moving
  const ids = new Set<number>()
  for (const c of cubies) {
    if (filter(c.pos)) ids.add(c.id)
  }
  movingIds.value = ids

  // Start group at identity (no rotation)
  animGroupTransform.value = ''
  animTransitioning.value = false

  // Next frame: apply target rotation with CSS transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      animTransitioning.value = true
      animGroupTransform.value = cssAngle
    })
  })

  animTimer = setTimeout(finishAnimation, ANIM_DURATION + 30)
}

function finishAnimation() {
  if (animTimer) { clearTimeout(animTimer); animTimer = null }

  if (currentAnimMove) {
    const move = currentAnimMove
    currentAnimMove = null

    const { rotKey, filter } = getMoveInfo(move)
    const rotMatrix = ROT[rotKey]

    // Update affected cubies' positions and rotations
    for (const c of cubies) {
      if (filter(c.pos)) {
        c.pos = transformPos(c.pos, rotKey)
        c.rot = mulMat(rotMatrix, c.rot)
      }
    }

    // Update logical state
    localState = applyMove(localState, move)
    props.commitMove(move)
  }

  // Clear animation
  movingIds.value = new Set()
  animGroupTransform.value = ''
  animTransitioning.value = false

  requestAnimationFrame(tryDequeue)
}

function tryDequeue() {
  if (currentAnimMove) return
  const move = props.dequeueMove()
  if (move) startAnimation(move)
}

// Poll for new moves
let pollTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  initCubies()
  pollTimer = setInterval(() => {
    if (!currentAnimMove) tryDequeue()
  }, 50)
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (animTimer) clearTimeout(animTimer)
})

// Reset
watch(() => props.sceneVersion, () => {
  if (animTimer) { clearTimeout(animTimer); animTimer = null }
  currentAnimMove = null
  movingIds.value = new Set()
  animGroupTransform.value = ''
  animTransitioning.value = false
  localState = createSolvedState()
  initCubies()
})

// Mouse drag
function onPointerDown(e: PointerEvent) {
  isDragging = true
  lastX = e.clientX; lastY = e.clientY
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!isDragging) return
  rotY.value += (e.clientX - lastX) * 0.5
  rotX.value -= (e.clientY - lastY) * 0.5
  rotX.value = Math.max(-89, Math.min(89, rotX.value))
  lastX = e.clientX; lastY = e.clientY
}
function onPointerUp() { isDragging = false }

// Cubie CSS transform
function cubieTransform(c: Cubie): string {
  const tx = c.pos[0] * 25
  const ty = -c.pos[1] * 25 // CSS Y is inverted
  const tz = c.pos[2] * 25
  return `translate3d(${tx}px,${ty}px,${tz}px) ${matToCSS(c.rot)}`
}
</script>

<template>
  <div
    class="cube-viewport"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      class="cube-scene"
      :style="{ transform: `scale(2.2) rotateX(${rotX}deg) rotateY(${rotY}deg)` }"
    >
      <!-- Static cubies (not being animated) -->
      <div
        v-for="c in cubies"
        :key="'s' + c.id"
        class="cubie"
        :class="{ hidden: movingIds.has(c.id) }"
        :style="{ transform: cubieTransform(c) }"
      >
        <div class="face front" :style="{ background: c.faces.front }" />
        <div class="face back" :style="{ background: c.faces.back }" />
        <div class="face right" :style="{ background: c.faces.right }" />
        <div class="face left" :style="{ background: c.faces.left }" />
        <div class="face top" :style="{ background: c.faces.top }" />
        <div class="face bottom" :style="{ background: c.faces.bottom }" />
      </div>

      <!-- Animated group -->
      <div
        v-if="movingIds.size > 0"
        class="rotation-group"
        :class="{ animating: animTransitioning }"
        :style="{ transform: animGroupTransform }"
      >
        <div
          v-for="c in cubies"
          :key="'a' + c.id"
          class="cubie"
          :class="{ hidden: !movingIds.has(c.id) }"
          :style="{ transform: cubieTransform(c) }"
        >
          <div class="face front" :style="{ background: c.faces.front }" />
          <div class="face back" :style="{ background: c.faces.back }" />
          <div class="face right" :style="{ background: c.faces.right }" />
          <div class="face left" :style="{ background: c.faces.left }" />
          <div class="face top" :style="{ background: c.faces.top }" />
          <div class="face bottom" :style="{ background: c.faces.bottom }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cube-viewport {
  width: 100%;
  height: 100%;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 600px;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.cube-viewport:active { cursor: grabbing; }

.cube-scene {
  width: 0; height: 0;
  position: relative;
  transform-style: preserve-3d;
}

.rotation-group {
  position: absolute;
  transform-style: preserve-3d;
}
.rotation-group.animating {
  transition: transform 350ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.cubie {
  position: absolute;
  width: 48px; height: 48px;
  margin-left: -24px; margin-top: -24px;
  transform-style: preserve-3d;
}
.cubie.hidden { visibility: hidden; }

.face {
  position: absolute;
  width: 48px; height: 48px;
  border: 2px solid #1a1a1a;
  border-radius: 3px;
}
.face.front  { transform: translateZ(24px); }
.face.back   { transform: rotateY(180deg) translateZ(24px); }
.face.right  { transform: rotateY(90deg) translateZ(24px); }
.face.left   { transform: rotateY(-90deg) translateZ(24px); }
.face.top    { transform: rotateX(90deg) translateZ(24px); }
.face.bottom { transform: rotateX(-90deg) translateZ(24px); }
</style>
