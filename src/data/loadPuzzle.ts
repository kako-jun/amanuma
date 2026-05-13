/**
 * お題 (PuzzleDefinition) の管理とローダー。
 *
 * - `listPuzzles()` / `getPuzzleById()`: コレクション参照
 * - `buildGameStateFromPuzzle()`: PuzzleDefinition → GameState 変換 (検証つき)
 * - `PuzzleRotation`: お題ローテーション (順送り / ランダム)
 *
 * 文字列 board の解釈は `src/types/Puzzle.ts` の規約に従う:
 *   `.` = 空、`1` 〜 `7` = ブロック値、JSON の行順 = GameState の行順 (0 = 最上段)。
 */

import puzzlesData from './puzzles.json'
import type { BlockValue, BoardCell, GameState } from '../types/GameState'
import { createEmptyBoard } from '../types/GameState'
import type {
  PuzzleCollection,
  PuzzleDefinition,
  PuzzleLoadResult,
} from '../types/Puzzle'

const collection = puzzlesData as PuzzleCollection

/** 全お題を宣言順で返す。 */
export function listPuzzles(): readonly PuzzleDefinition[] {
  return collection.puzzles
}

/** id を指定して お題を取得。見つからない場合は undefined。 */
export function getPuzzleById(id: string): PuzzleDefinition | undefined {
  return collection.puzzles.find((p) => p.id === id)
}

/**
 * 文字 1 つを BoardCell に変換。
 * `.` → null、`1`〜`7` → BlockValue、それ以外 → undefined (= 不正)。
 */
function parseCellChar(ch: string): BoardCell | undefined {
  if (ch === '.') return null
  if (ch >= '1' && ch <= '7') {
    return parseInt(ch, 10) as BlockValue
  }
  return undefined
}

/**
 * お題定義から GameState を構築する。
 *
 * 検証内容:
 * - cols / rows が正の整数か
 * - board の行数が rows と一致するか
 * - 各行の長さが cols と一致するか
 * - 各文字が `.` または `1`〜`7` か
 * - nextBlocks (もしあれば) の各値が 1〜7 か
 *
 * 不正な場合は `{ ok: false, error }` を返す (throw しない)。
 */
export function buildGameStateFromPuzzle(
  puzzle: PuzzleDefinition
): PuzzleLoadResult {
  if (!Number.isInteger(puzzle.cols) || puzzle.cols <= 0) {
    return { ok: false, error: `puzzle "${puzzle.id}": cols must be positive integer` }
  }
  if (!Number.isInteger(puzzle.rows) || puzzle.rows <= 0) {
    return { ok: false, error: `puzzle "${puzzle.id}": rows must be positive integer` }
  }
  if (puzzle.board.length !== puzzle.rows) {
    return {
      ok: false,
      error: `puzzle "${puzzle.id}": board has ${puzzle.board.length} rows, expected ${puzzle.rows}`,
    }
  }

  const board: BoardCell[][] = createEmptyBoard(puzzle.rows, puzzle.cols)

  for (let r = 0; r < puzzle.rows; r++) {
    const rowStr = puzzle.board[r]
    if (rowStr.length !== puzzle.cols) {
      return {
        ok: false,
        error: `puzzle "${puzzle.id}": row ${r} has length ${rowStr.length}, expected ${puzzle.cols}`,
      }
    }
    for (let c = 0; c < puzzle.cols; c++) {
      const cell = parseCellChar(rowStr[c])
      if (cell === undefined) {
        return {
          ok: false,
          error: `puzzle "${puzzle.id}": invalid char "${rowStr[c]}" at row=${r} col=${c}`,
        }
      }
      board[r][c] = cell
    }
  }

  if (puzzle.nextBlocks) {
    for (let i = 0; i < puzzle.nextBlocks.length; i++) {
      const v = puzzle.nextBlocks[i]
      if (!Number.isInteger(v) || v < 1 || v > 7) {
        return {
          ok: false,
          error: `puzzle "${puzzle.id}": invalid nextBlocks[${i}] = ${v}`,
        }
      }
    }
  }

  const nextBlock: BlockValue = puzzle.nextBlocks?.[0] ?? 1

  const state: GameState = {
    cols: puzzle.cols,
    rows: puzzle.rows,
    board,
    fallingBlock: null,
    nextBlock,
    score: 0,
    chainCount: 0,
    status: 'playing',
  }

  return { ok: true, state, puzzle }
}

/**
 * お題ローテーション管理。
 *
 * - シングルプレイ: `next()` で順送り、`random()` でランダム選択
 * - 対戦: `current()` で現在のお題 ID を保持し、両者に同じお題を渡せる
 * - 内部 RNG は引数で差し替え可能 (テスタビリティ)
 */
export class PuzzleRotation {
  private readonly puzzles: readonly PuzzleDefinition[]
  private readonly rng: () => number
  private index: number = 0

  constructor(
    puzzles: readonly PuzzleDefinition[] = listPuzzles(),
    rng: () => number = Math.random
  ) {
    if (puzzles.length === 0) {
      throw new Error('PuzzleRotation: puzzles must not be empty')
    }
    this.puzzles = puzzles
    this.rng = rng
  }

  /** 現在のお題。 */
  current(): PuzzleDefinition {
    return this.puzzles[this.index]
  }

  /** 順送り。末尾の次は先頭に戻る。返り値は新しい current。 */
  next(): PuzzleDefinition {
    this.index = (this.index + 1) % this.puzzles.length
    return this.current()
  }

  /** ランダム選択 (rng を使用)。現在の index を更新する。返り値は新しい current。 */
  random(): PuzzleDefinition {
    const r = this.rng()
    const i = Math.min(this.puzzles.length - 1, Math.max(0, Math.floor(r * this.puzzles.length)))
    this.index = i
    return this.current()
  }

  /** index を 0 に戻す。 */
  reset(): void {
    this.index = 0
  }
}
