declare module 'cubejs' {
  class Cube {
    static initSolver(): void
    static fromString(faceletString: string): Cube
    static random(): Cube
    solve(): string
    asString(): string
    move(moveString: string): void
  }
  export default Cube
}
