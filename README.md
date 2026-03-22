# Rubik's Cube 2x2 Solver

A 3D interactive 2x2 Rubik's Cube with multiple solving modes, built with Vue 3 and CSS 3D transforms.

## Features

- **3D CSS Cube** — GPU-accelerated rendering using pure CSS `transform-style: preserve-3d`, no WebGL needed
- **Drag to rotate** — click and drag to orbit the camera around the cube
- **12 manual move buttons** — R, R', L, L', U, U', D, D', F, F', B, B'
- **Undo / Redo** — step back and forward through your move history
- **Randomize** — continuous scrambling until you click Stop
- **Quick Solve** — finds the optimal solution using IDA* with precomputed pruning tables (~50ms avg)
- **Random Solve** — applies random moves until solved by pure luck
- **Timer** — tracks solve time for Quick Solve and Random Solve
- **Solve detection** — recognizes when you solve the cube manually

## Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Framework | Vue 3 + TypeScript | Reactivity, components |
| Build | Vite | Dev server, bundling |
| 3D Rendering | CSS 3D Transforms | GPU-accelerated cube display |
| Animations | CSS Transitions | Smooth 350ms move animations |
| Solver | IDA* + pruning tables | Optimal solutions in <100ms |
| Utilities | @vueuse/core | Composable helpers |

## Architecture

```
src/
  engine/
    cube.ts       State engine: moves, scramble, validation
    solver.ts     IDA* solver with precomputed move + pruning tables
  composables/
    useCube.ts    Vue composable: game logic, timer, history, undo/redo
  components/
    RubikCube.vue CSS 3D cube with rotation tracking and animation
  App.vue         Main layout, controls, status bar
```

### How the solver works

The 2x2 cube has 3,674,160 reachable states. On page load, the solver precomputes:

1. **Move tables** — for each of 40,320 permutation indices and 2,187 orientation indices, precompute the result of each of the 12 moves as typed array lookups
2. **Pruning tables** — BFS from solved state to fill exact-distance tables for permutation (40K entries) and orientation (2K entries)

During solving, IDA* uses `h = max(perm_distance, orient_distance)` as an admissible heuristic. Each node expansion is two integer lookups — zero allocations.

### How the 3D rendering works

Each cubie is a persistent object with:
- **Fixed colors** — set once based on corner identity, never changed
- **Position** — which grid slot (updated after each move via rotation matrix)
- **Accumulated rotation** — `matrix3d()` composed after each move

Animations use CSS transitions on a rotation group. Colors travel physically with the cubies — no rebuilding, no color swapping.

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

Production bundle: ~77 KB JS, ~6 KB CSS.
