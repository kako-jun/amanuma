/**
 * GameState 型定義。
 *
 * 任意の盤面状態を `GameScene.initWithState(state)` に渡して起動できる前提で
 * 設計している (デバッグ・テスト容易化のため)。
 *
 * GameScene は state を参照保持する。呼び出し側は state を immutable に扱うこと
 * (= 一度 initWithState に渡したオブジェクトを外部から書き換えない)。
 */

export type BlockValue = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** 盤面の各セル。null = 空、1〜7 = ブロック値 */
export type BoardCell = BlockValue | null

/**
 * 落下中のブロック。
 *
 * 水中物理 (Issue #16) で `row` が浮力により浮動小数で揺れる想定のため、
 * `row` は number、`col` は整数 (0..cols-1) で保持する。
 */
export interface FallingBlock {
  value: BlockValue
  /** 列インデックス (整数、0..cols-1) */
  col: number
  /** 行位置 (浮動小数、0..rows-1、0 が最上段) */
  row: number
  /** 縦方向の速度。水中減衰振動用、初期 0 */
  velocity: number
}

export type GameStatus = 'playing' | 'paused' | 'cleared' | 'gameover'

/**
 * シングル/対戦双方で1プレイヤー分の状態を表す。
 *
 * `board[row][col]` のインデックス順。`row=0` が最上段。
 */
export interface GameState {
  cols: number
  rows: number
  board: BoardCell[][]
  fallingBlock: FallingBlock | null
  nextBlock: BlockValue
  score: number
  chainCount: number
  status: GameStatus
}

export const DEFAULT_COLS = 5
export const DEFAULT_ROWS = 10

/** 空の盤面を生成 (board[row][col] = null) */
export function createEmptyBoard(
  rows: number = DEFAULT_ROWS,
  cols: number = DEFAULT_COLS
): BoardCell[][] {
  const board: BoardCell[][] = []
  for (let r = 0; r < rows; r++) {
    const row: BoardCell[] = []
    for (let c = 0; c < cols; c++) {
      row.push(null)
    }
    board.push(row)
  }
  return board
}

/**
 * デフォルトの初期 GameState (テスト・デバッグ用)。
 * 空盤面 + fallingBlock=null + nextBlock=1 + score=0 + chainCount=0 + status='playing'。
 * 実際のお題データ読込は Issue #14 で別途実装する。
 */
export function createInitialGameState(): GameState {
  return {
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
    board: createEmptyBoard(),
    fallingBlock: null,
    nextBlock: 1,
    score: 0,
    chainCount: 0,
    status: 'playing',
  }
}
