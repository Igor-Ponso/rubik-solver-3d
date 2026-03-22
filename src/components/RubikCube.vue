<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted, computed } from 'vue'
import { COLORS } from '../engine/cube'

const props = defineProps<{
  dequeueMove: () => string | null
  commitMove: (move: string) => void
  isAnimating: boolean
  sceneVersion: number
  puzzleSize: number
}>()

// Camera rotation via mouse drag
const rotX = ref(-25)
const rotY = ref(35)
let isDragging = false
let lastX = 0
let lastY = 0

const ANIM_DURATION = 250

// ─── Sizing ────────────────────────────────────────────────────────────
const cubieSize = computed(() => props.puzzleSize === 2 ? 48 : 34)
// 2x2: positions are [-1,1], gap between = 2*spacing, so spacing = (cubie+gap)/2
// 3x3: positions are [-1,0,1], gap between = 1*spacing, so spacing = cubie+gap
const spacing = computed(() => props.puzzleSize === 2 ? 25 : 36)
const halfCubie = computed(() => cubieSize.value / 2)
const sceneScale = computed(() => props.puzzleSize === 2 ? 2.2 : 1.8)

// ─── 3x3 rotation matrix helpers ───────────────────────────────────────
type Mat3 = number[]
const IDENTITY: Mat3 = [1,0,0, 0,1,0, 0,0,1]

function mulMat(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0]*b[0]+a[1]*b[3]+a[2]*b[6], a[0]*b[1]+a[1]*b[4]+a[2]*b[7], a[0]*b[2]+a[1]*b[5]+a[2]*b[8],
    a[3]*b[0]+a[4]*b[3]+a[5]*b[6], a[3]*b[1]+a[4]*b[4]+a[5]*b[7], a[3]*b[2]+a[4]*b[5]+a[5]*b[8],
    a[6]*b[0]+a[7]*b[3]+a[8]*b[6], a[6]*b[1]+a[7]*b[4]+a[8]*b[7], a[6]*b[2]+a[7]*b[5]+a[8]*b[8],
  ]
}

function matToCSS(m: Mat3): string {
  const c = [m[0],-m[1],m[2], -m[3],m[4],-m[5], m[6],-m[7],m[8]]
  return `matrix3d(${c[0]},${c[3]},${c[6]},0,${c[1]},${c[4]},${c[7]},0,${c[2]},${c[5]},${c[8]},0,0,0,0,1)`
}

const ROT: Record<string, Mat3> = {
  'x+': [1,0,0, 0,0,-1, 0,1,0],
  'x-': [1,0,0, 0,0,1, 0,-1,0],
  'y+': [0,0,1, 0,1,0, -1,0,0],
  'y-': [0,0,-1, 0,1,0, 1,0,0],
  'z+': [0,-1,0, 1,0,0, 0,0,1],
  'z-': [0,1,0, -1,0,0, 0,0,1],
  'x2': [1,0,0, 0,-1,0, 0,0,-1],
  'y2': [-1,0,0, 0,1,0, 0,0,-1],
  'z2': [-1,0,0, 0,-1,0, 0,0,1],
}

function transformPos(pos: [number,number,number], rotKey: string): [number,number,number] {
  const m = ROT[rotKey]
  return [
    Math.round(m[0]*pos[0]+m[1]*pos[1]+m[2]*pos[2]),
    Math.round(m[3]*pos[0]+m[4]*pos[1]+m[5]*pos[2]),
    Math.round(m[6]*pos[0]+m[7]*pos[1]+m[8]*pos[2]),
  ]
}

// ─── Cubie definitions ─────────────────────────────────────────────────
const C = COLORS
const D = '#111'

interface CubieDef {
  pos: [number,number,number]
  faces: { right:string; left:string; top:string; bottom:string; front:string; back:string }
}

const CUBIES_2X2: CubieDef[] = [
  { pos:[-1, 1,-1], faces:{ top:C.U, bottom:D, front:D, back:C.B, left:C.L, right:D } },
  { pos:[ 1, 1,-1], faces:{ top:C.U, bottom:D, front:D, back:C.B, left:D, right:C.R } },
  { pos:[ 1, 1, 1], faces:{ top:C.U, bottom:D, front:C.F, back:D, left:D, right:C.R } },
  { pos:[-1, 1, 1], faces:{ top:C.U, bottom:D, front:C.F, back:D, left:C.L, right:D } },
  { pos:[-1,-1, 1], faces:{ top:D, bottom:C.D, front:C.F, back:D, left:C.L, right:D } },
  { pos:[ 1,-1, 1], faces:{ top:D, bottom:C.D, front:C.F, back:D, left:D, right:C.R } },
  { pos:[ 1,-1,-1], faces:{ top:D, bottom:C.D, front:D, back:C.B, left:D, right:C.R } },
  { pos:[-1,-1,-1], faces:{ top:D, bottom:C.D, front:D, back:C.B, left:C.L, right:D } },
]

function makeFaces(r:string,l:string,t:string,b:string,f:string,bk:string) {
  return { right:r, left:l, top:t, bottom:b, front:f, back:bk }
}

const CUBIES_3X3: CubieDef[] = [
  // 8 corners
  { pos:[-1, 1,-1], faces: makeFaces(D,C.L,C.U,D,D,C.B) },
  { pos:[ 1, 1,-1], faces: makeFaces(C.R,D,C.U,D,D,C.B) },
  { pos:[ 1, 1, 1], faces: makeFaces(C.R,D,C.U,D,C.F,D) },
  { pos:[-1, 1, 1], faces: makeFaces(D,C.L,C.U,D,C.F,D) },
  { pos:[-1,-1, 1], faces: makeFaces(D,C.L,D,C.D,C.F,D) },
  { pos:[ 1,-1, 1], faces: makeFaces(C.R,D,D,C.D,C.F,D) },
  { pos:[ 1,-1,-1], faces: makeFaces(C.R,D,D,C.D,D,C.B) },
  { pos:[-1,-1,-1], faces: makeFaces(D,C.L,D,C.D,D,C.B) },
  // 12 edges
  { pos:[ 0, 1,-1], faces: makeFaces(D,D,C.U,D,D,C.B) },   // UB
  { pos:[ 0, 1, 1], faces: makeFaces(D,D,C.U,D,C.F,D) },   // UF
  { pos:[-1, 1, 0], faces: makeFaces(D,C.L,C.U,D,D,D) },   // UL
  { pos:[ 1, 1, 0], faces: makeFaces(C.R,D,C.U,D,D,D) },   // UR
  { pos:[ 0,-1,-1], faces: makeFaces(D,D,D,C.D,D,C.B) },   // DB
  { pos:[ 0,-1, 1], faces: makeFaces(D,D,D,C.D,C.F,D) },   // DF
  { pos:[-1,-1, 0], faces: makeFaces(D,C.L,D,C.D,D,D) },   // DL
  { pos:[ 1,-1, 0], faces: makeFaces(C.R,D,D,C.D,D,D) },   // DR
  { pos:[-1, 0, 1], faces: makeFaces(D,C.L,D,D,C.F,D) },   // FL
  { pos:[ 1, 0, 1], faces: makeFaces(C.R,D,D,D,C.F,D) },   // FR
  { pos:[-1, 0,-1], faces: makeFaces(D,C.L,D,D,D,C.B) },   // BL
  { pos:[ 1, 0,-1], faces: makeFaces(C.R,D,D,D,D,C.B) },   // BR
  // 6 centers
  { pos:[ 0, 1, 0], faces: makeFaces(D,D,C.U,D,D,D) },     // U
  { pos:[ 0,-1, 0], faces: makeFaces(D,D,D,C.D,D,D) },     // D
  { pos:[ 0, 0, 1], faces: makeFaces(D,D,D,D,C.F,D) },     // F
  { pos:[ 0, 0,-1], faces: makeFaces(D,D,D,D,D,C.B) },     // B
  { pos:[-1, 0, 0], faces: makeFaces(D,C.L,D,D,D,D) },     // L
  { pos:[ 1, 0, 0], faces: makeFaces(C.R,D,D,D,D,D) },     // R
]

const cubieDefs = computed(() => props.puzzleSize === 2 ? CUBIES_2X2 : CUBIES_3X3)

// ─── Cubie state ───────────────────────────────────────────────────────
interface Cubie {
  id: number
  pos: [number,number,number]
  rot: Mat3
  faces: CubieDef['faces']
}

const cubies = reactive<Cubie[]>([])

function initCubies() {
  cubies.length = 0
  const defs = cubieDefs.value
  for (let i = 0; i < defs.length; i++) {
    cubies.push({
      id: i,
      pos: [...defs[i].pos] as [number,number,number],
      rot: [...IDENTITY],
      faces: defs[i].faces,
    })
  }
}

// ─── Move info ─────────────────────────────────────────────────────────
function getMoveInfo(move: string): { rotKey: string; cssAngle: string; filter: (p: [number,number,number]) => boolean } {
  const base = move[0]
  const mod = move.slice(1)
  const prime = mod === "'"
  const double = mod === '2'
  const is3 = props.puzzleSize === 3

  // Determine the cube-space rotation key
  let rotKey: string
  let filter: (p: [number,number,number]) => boolean

  // F and B cycle directions differ between cube.ts (2x2) and cube3.ts (3x3)
  switch (base) {
    case 'R': rotKey = prime?'x+':double?'x2':'x-'; filter = p => p[0] > 0; break
    case 'L': rotKey = prime?'x-':double?'x2':'x+'; filter = p => p[0] < 0; break
    case 'U': rotKey = prime?'y+':double?'y2':'y-'; filter = p => p[1] > 0; break
    case 'D': rotKey = prime?'y-':double?'y2':'y+'; filter = p => p[1] < 0; break
    case 'F': {
      const fwd = is3 ? 'z-' : 'z+'
      const rev = is3 ? 'z+' : 'z-'
      rotKey = prime ? rev : double ? 'z2' : fwd
      filter = p => p[2] > 0; break
    }
    case 'B': {
      const fwd = is3 ? 'z+' : 'z-'
      const rev = is3 ? 'z-' : 'z+'
      rotKey = prime ? rev : double ? 'z2' : fwd
      filter = p => p[2] < 0; break
    }
    default: rotKey = 'x+'; filter = () => false
  }

  // Derive CSS angle from rotKey:
  // CSS Y is inverted → X and Z rotations need negated angles, Y stays same
  const axis = rotKey[0]
  const dir = rotKey.substring(1)
  let cssDeg: number
  if (dir === '2') {
    cssDeg = 180
  } else if (dir === '+') {
    cssDeg = axis === 'y' ? 90 : -90
  } else {
    cssDeg = axis === 'y' ? -90 : 90
  }
  const cssAngle = `rotate${axis.toUpperCase()}(${cssDeg}deg)`

  return { rotKey, cssAngle, filter }
}

// ─── Animation ─────────────────────────────────────────────────────────
const animGroupTransform = ref('')
const animTransitioning = ref(false)
const movingIds = ref(new Set<number>())

let currentAnimMove: string | null = null
let animTimer: ReturnType<typeof setTimeout> | null = null

function startAnimation(move: string) {
  const { cssAngle, filter } = getMoveInfo(move)
  currentAnimMove = move

  const ids = new Set<number>()
  for (const c of cubies) {
    if (filter(c.pos)) ids.add(c.id)
  }
  movingIds.value = ids

  animGroupTransform.value = ''
  animTransitioning.value = false

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      animTransitioning.value = true
      animGroupTransform.value = cssAngle
    })
  })

  const dur = move.endsWith('2') ? ANIM_DURATION * 1.3 : ANIM_DURATION
  animTimer = setTimeout(finishAnimation, dur + 30)
}

function finishAnimation() {
  if (animTimer) { clearTimeout(animTimer); animTimer = null }

  if (currentAnimMove) {
    const move = currentAnimMove
    currentAnimMove = null

    const { rotKey, filter } = getMoveInfo(move)
    const rotMatrix = ROT[rotKey]

    for (const c of cubies) {
      if (filter(c.pos)) {
        c.pos = transformPos(c.pos, rotKey)
        c.rot = mulMat(rotMatrix, c.rot)
      }
    }

    props.commitMove(move)
  }

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

// Reset / puzzle size change
watch([() => props.sceneVersion, () => props.puzzleSize], () => {
  if (animTimer) { clearTimeout(animTimer); animTimer = null }
  currentAnimMove = null
  movingIds.value = new Set()
  animGroupTransform.value = ''
  animTransitioning.value = false
  initCubies()
})

// Mouse drag
function onPointerDown(e: PointerEvent) {
  isDragging = true; lastX = e.clientX; lastY = e.clientY
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

function cubieTransform(c: Cubie): string {
  const sp = spacing.value
  return `translate3d(${c.pos[0]*sp}px,${-c.pos[1]*sp}px,${c.pos[2]*sp}px) ${matToCSS(c.rot)}`
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
      :style="{ transform: `scale(${sceneScale}) rotateX(${rotX}deg) rotateY(${rotY}deg)` }"
    >
      <div
        v-for="c in cubies" :key="'s'+c.id"
        class="cubie"
        :class="{ hidden: movingIds.has(c.id) }"
        :style="{ transform: cubieTransform(c), width: cubieSize+'px', height: cubieSize+'px', marginLeft: -halfCubie+'px', marginTop: -halfCubie+'px' }"
      >
        <div class="face front"  :style="{ background: c.faces.front,  width: cubieSize+'px', height: cubieSize+'px', transform: `translateZ(${halfCubie}px)` }" />
        <div class="face back"   :style="{ background: c.faces.back,   width: cubieSize+'px', height: cubieSize+'px', transform: `rotateY(180deg) translateZ(${halfCubie}px)` }" />
        <div class="face right"  :style="{ background: c.faces.right,  width: cubieSize+'px', height: cubieSize+'px', transform: `rotateY(90deg) translateZ(${halfCubie}px)` }" />
        <div class="face left"   :style="{ background: c.faces.left,   width: cubieSize+'px', height: cubieSize+'px', transform: `rotateY(-90deg) translateZ(${halfCubie}px)` }" />
        <div class="face top"    :style="{ background: c.faces.top,    width: cubieSize+'px', height: cubieSize+'px', transform: `rotateX(90deg) translateZ(${halfCubie}px)` }" />
        <div class="face bottom" :style="{ background: c.faces.bottom, width: cubieSize+'px', height: cubieSize+'px', transform: `rotateX(-90deg) translateZ(${halfCubie}px)` }" />
      </div>

      <div
        v-if="movingIds.size > 0"
        class="rotation-group"
        :class="{ animating: animTransitioning }"
        :style="{ transform: animGroupTransform }"
      >
        <div
          v-for="c in cubies" :key="'a'+c.id"
          class="cubie"
          :class="{ hidden: !movingIds.has(c.id) }"
          :style="{ transform: cubieTransform(c), width: cubieSize+'px', height: cubieSize+'px', marginLeft: -halfCubie+'px', marginTop: -halfCubie+'px' }"
        >
          <div class="face front"  :style="{ background: c.faces.front,  width: cubieSize+'px', height: cubieSize+'px', transform: `translateZ(${halfCubie}px)` }" />
          <div class="face back"   :style="{ background: c.faces.back,   width: cubieSize+'px', height: cubieSize+'px', transform: `rotateY(180deg) translateZ(${halfCubie}px)` }" />
          <div class="face right"  :style="{ background: c.faces.right,  width: cubieSize+'px', height: cubieSize+'px', transform: `rotateY(90deg) translateZ(${halfCubie}px)` }" />
          <div class="face left"   :style="{ background: c.faces.left,   width: cubieSize+'px', height: cubieSize+'px', transform: `rotateY(-90deg) translateZ(${halfCubie}px)` }" />
          <div class="face top"    :style="{ background: c.faces.top,    width: cubieSize+'px', height: cubieSize+'px', transform: `rotateX(90deg) translateZ(${halfCubie}px)` }" />
          <div class="face bottom" :style="{ background: c.faces.bottom, width: cubieSize+'px', height: cubieSize+'px', transform: `rotateX(-90deg) translateZ(${halfCubie}px)` }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cube-viewport {
  width: 100%; height: 100%; min-height: 280px;
  display: flex; align-items: center; justify-content: center;
  perspective: 600px; cursor: grab; user-select: none; touch-action: none;
}
.cube-viewport:active { cursor: grabbing; }
.cube-scene { width: 0; height: 0; position: relative; transform-style: preserve-3d; }
.rotation-group { position: absolute; transform-style: preserve-3d; }
.rotation-group.animating { transition: transform 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.cubie { position: absolute; transform-style: preserve-3d; }
.cubie.hidden { visibility: hidden; }
.face { position: absolute; border: 2px solid #1a1a1a; border-radius: 3px; }
</style>
