/**
 * Loads cubejs via script tag (avoids ESM/CJS compatibility issues).
 * The script sets `globalThis.Cube` which we then use.
 */

let ready = false
let initPromise: Promise<void> | null = null

function getCube(): any {
  return (globalThis as any).Cube
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

export async function initSolver3(): Promise<void> {
  if (ready) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (!getCube()) {
      await loadScript('/cubejs.js')
    }
    const Cube = getCube()
    if (!Cube) throw new Error('cubejs failed to load')
    Cube.initSolver()
    ready = true
  })()

  return initPromise
}

export function solve3Sync(faceletString: string): string[] {
  const Cube = getCube()
  if (!Cube) throw new Error('Solver not initialized')
  const cube = Cube.fromString(faceletString)
  const solution = cube.solve()
  if (!solution || !solution.trim()) return []
  return solution.trim().split(/\s+/)
}
