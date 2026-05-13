/**
 * お題 (初期盤面) 定義の型。
 *
 * - JSON ファイルが直接 conform する構造にしている。
 * - `board` は文字列の行配列で表記する (JSON で人間が編集しやすいため):
 *   - `"."` = 空セル
 *   - `"1"` 〜 `"7"` = ブロック値
 *   例: `["..7..", "11211", ".2.2.", "22122", "11211"]`
 * - 行順は **JSON の 0 行目 = 盤面の最上段、最後の行 = 最下段**。
 *   `GameState.board` と同じインデックスでそのまま格納される (反転なし)。
 *   お題作成者は「上が空・下が詰まる」見た目で書ける。
 */

import type { BlockValue, GameState } from './GameState'

/** 初期盤面 1 つ分の定義 (お題)。 */
export interface PuzzleDefinition {
  id: string
  title: string
  cols: number
  rows: number
  /** 行配列 (0 行目=最上段、最後の行=最下段)。各文字は `.` / `1` 〜 `7`。長さは `cols` と一致。 */
  board: string[]
  /**
   * 最初に降ってくるブロックのキュー (任意)。
   * 空なら呼び出し側で 1〜6 のランダム生成する想定 (TODO #18: 実装は連鎖ロジック側で)。
   */
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
