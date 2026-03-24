# Rubik's Cube Solver

A 3D interactive Rubik's Cube (2x2 and 3x3) with multiple solving modes, built with Vue 3 and CSS 3D transforms.

**[Live Demo](https://igor-ponso.github.io/rubik-solver-3d/)**

## Features

- **2x2 and 3x3** — switch between puzzle sizes
- **3D CSS Cube** — GPU-accelerated rendering using pure CSS `transform-style: preserve-3d`, no WebGL
- **Drag to rotate** — click and drag to orbit the camera around the cube
- **12 manual move buttons** — R, R', L, L', U, U', D, D', F, F', B, B'
- **Undo / Redo** — step back and forward through your move history
- **Randomize** — continuous scrambling until you click Stop
- **Quick Solve** — optimal solution in milliseconds
- **Random Solve** — applies random moves until solved by pure luck (with pause/resume)
- **Timer** — tracks solve time for Quick Solve and Random Solve
- **Solve detection** — recognizes when you solve the cube manually
- **Dark / Light theme** — toggle with the sun/moon button

## Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Framework | Vue 3 + TypeScript | Reactivity, components |
| Build | Vite | Dev server, bundling |
| 3D Rendering | CSS 3D Transforms | GPU-accelerated cube display |
| Animations | CSS Transitions | Smooth move animations |
| 2x2 Solver | IDA* + pruning tables | Optimal solutions in ~50ms |
| 3x3 Solver | cubejs (Kociemba) | Near-optimal solutions in ≤22 moves |

## Architecture

```
src/
  engine/
    cube.ts          2x2 state engine
    cube3.ts         3x3 state engine
    solver.ts        2x2 IDA* solver with precomputed move + pruning tables
    solver3.ts       3x3 solver wrapper (cubejs / Kociemba two-phase)
  composables/
    useCube.ts       Vue composable: game logic, timer, history, undo/redo
  components/
    RubikCube.vue    CSS 3D cube with rotation tracking and animation
  App.vue            Main layout, controls, status bar
```

### Solvers

**2x2** — The 2x2 cube has 3,674,160 reachable states. On page load, the solver precomputes move tables (40K permutation × 2K orientation indices) and pruning tables via BFS. During solving, IDA* uses `h = max(perm_distance, orient_distance)` as an admissible heuristic. Each node expansion is two typed array lookups — zero allocations.

**3x3** — Uses the [cubejs](https://github.com/ldez/cubejs) library implementing the Kociemba two-phase algorithm. Solutions are guaranteed ≤22 moves. The solver tables are loaded on demand when 3x3 is first selected.

### 3D Rendering

Each cubie is a persistent object with:
- **Fixed colors** — set once based on corner/edge/center identity, never changed
- **Position** — which grid slot (updated after each move via rotation matrix)
- **Accumulated rotation** — `matrix3d()` composed after each move

Animations use CSS transitions on a rotation group. Colors travel physically with the cubies — no rebuilding, no color swapping. Total DOM: 48 face divs (2x2) or 156 face divs (3x3).

## Getting started

```bash
npm install
npm run dev
```

Requires Node.js 20.19+ or 22.12+. If using nvm:

```bash
nvm use
```

## Build

```bash
npm run build
npm run preview
```

Production bundle: 83 KB JS + 7.6 KB CSS (+ 51 KB cubejs loaded on demand for 3x3).
