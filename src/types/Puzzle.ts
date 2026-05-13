/**
 * お題 (初期盤面) 定義の型。
 *
 * - JSON ファイルが直接 conform する構造にしている。
 * - `board` は文字列の行配列で表記する (JSON で人間が編集しやすいため):
 *   - `"."` = 空セル
 *   - `"1"` 〜 `"7"` = ブロック値
 *   例: `["..7..", "11211", ".2.2.", "22122", "11211"]`
 * - 行順は **JSON の最後の行が盤面の最下段** にマッピングされる
 *   (スプレッドシート的な「下が地面」見た目に合わせる)。
 *   読み込み時に `board[rows-1-i]` の順で `GameState.board` に変換する。
 */

import type { BlockValue, GameState } from './GameState'

/** 初期盤面 1 つ分の定義 (お題)。 */
export interface PuzzleDefinition {
  id: string
  title: string
  cols: number
  rows: number
  /** 行配列 (最下段が最後)。各文字は `.` / `1` 〜 `7`。長さは `cols` と一致。 */
  board: string[]
  /** 最初に降ってくるブロックのキュー (任意)。空なら呼び出し側で 1〜6 のランダム生成する想定。 */
  nextBlocks?: BlockValue[]
  /**
   * 「クリアに必要な 7 ブロックの位置」を明示できる任意フィールド。
   * 現時点では情報用途のみ (将来 #21 でターゲット表示に使う想定)。
   */
  targetBlocks?: { row: number; col: number }[]
}

/** お題コレクション (JSON ファイルが取りうる構造)。 */
export interface PuzzleCollection {
  version: number
  puzzles: PuzzleDefinition[]
}

/** お題 → GameState 変換結果。失敗時は throw せず error を返す。 */
export type PuzzleLoadResult =
  | { ok: true; state: GameState; puzzle: PuzzleDefinition }
  | { ok: false; error: string }
