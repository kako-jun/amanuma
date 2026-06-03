/**
 * GameState のシリアライズ / デシリアライズ (純粋関数モジュール、Issue #56)。
 *
 * dev-doctrine 規律3・4: 本モジュールは DOM / localStorage / window に一切依存しない
 * 純粋コアである。永続化アダプタ (`saveStorage.ts`) はこの関数を薄く包むだけで、
 * 検証ロジックを再実装してはならない。
 *
 * シリアライズ形式はバージョンフィールド付きエンベロープ:
 *   `{ v: 1, state: GameState }` を JSON 化したもの。
 * 将来 GameState の形式が変わってもバージョンで弾けるようにしている。
 *
 * URL クエリ (`?state=...`) に載せる前提のため、出力は `encodeURIComponent` 済みの
 * URL セーフな文字列にする。`deserializeGameState` は対称に `decodeURIComponent` する。
 *
 * 検証パターンは `src/data/loadPuzzle.ts` の `buildGameStateFromPuzzle` に倣う:
 * - cols / rows が正の整数か
 * - board の行数が rows、各行長が cols と一致するか
 * - 各セルが null または BlockValue (1〜7) か
 * - nextBlock / fallingBlock.value が BlockValue か
 * - fallingBlock の col / row / velocity が妥当か
 * - status が GameStatus のいずれかか
 * - score / chainCount が非負の有限数か
 * 不正なら throw せず null を返す。
 */

import type {
  BlockValue,
  BoardCell,
  FallingBlock,
  GameState,
  GameStatus,
} from '../types/GameState'

/** 現行のシリアライズ形式バージョン。形式を破壊的に変えたら上げる。 */
export const GAME_STATE_FORMAT_VERSION = 1 as const

/** 永続化エンベロープ (JSON 化対象)。 */
interface GameStateEnvelope {
  v: number
  state: GameState
}

const VALID_STATUSES: readonly GameStatus[] = [
  'playing',
  'paused',
  'cleared',
  'gameover',
]

/**
 * その status から「続きを遊べる」か (= 復元・自動セーブの対象として妥当か) を判定する純粋述語。
 *
 * `'playing'` / `'paused'` は中断局面として再開可能なので true。
 * `'cleared'` / `'gameover'` は終端状態であり、復元しても fallingBlock が落ちず
 * onCleared / onGameOver も再発火しないため操作不能に固まる (Issue #56 の must#1)。
 * よって false を返し、呼び出し側 (自動セーブ・復元起動) が終端を除外できるようにする。
 *
 * DOM / localStorage / window に一切依存しない純粋関数。
 */
export function isResumableStatus(status: GameStatus): boolean {
  return status === 'playing' || status === 'paused'
}

/**
 * 復元候補 (URL 由来・localStorage 由来) から実際に復元起動すべき GameState を選ぶ純粋関数。
 *
 * 優先順位と棄却ルール (Issue #56):
 * 1. URL `?state=` 候補を最優先する。ただし終端状態 (`isResumableStatus` false) なら採用しない。
 * 2. URL 候補が無い / 終端で棄却された場合は localStorage 候補にフォールバックする。
 *    こちらも終端状態なら採用しない。
 * 3. どちらも採用不可なら null を返し、呼び出し側は通常のお題ロードへ進む。
 *
 * 終端状態 (cleared / gameover) を復元するとゲームが操作不能に固まるため、
 * URL 経由で終端が来ても安全に弾く (must#1)。I/O を含まないので単体テストできる。
 *
 * @param urlState URL クエリから読んだ候補 (不在なら null)。
 * @param localState localStorage から読んだ候補 (不在なら null)。
 * @returns 復元起動に使う GameState、または採用候補が無ければ null。
 */
export function pickResumableState(
  urlState: GameState | null,
  localState: GameState | null
): GameState | null {
  if (urlState !== null && isResumableStatus(urlState.status)) return urlState
  if (localState !== null && isResumableStatus(localState.status))
    return localState
  return null
}

/** 値が BlockValue (1〜7 の整数) か。 */
function isBlockValue(v: unknown): v is BlockValue {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7
}

/** 値が BoardCell (null または BlockValue) か。 */
function isBoardCell(v: unknown): v is BoardCell {
  return v === null || isBlockValue(v)
}

/**
 * GameState を URL セーフな文字列にシリアライズする。
 *
 * @param state プレーンな GameState (PixiJS オブジェクトや関数を含まないこと)。
 * @returns `encodeURIComponent` 済みの JSON 文字列。URL クエリ・localStorage の双方で使える。
 */
export function serializeGameState(state: GameState): string {
  const envelope: GameStateEnvelope = {
    v: GAME_STATE_FORMAT_VERSION,
    state,
  }
  return encodeURIComponent(JSON.stringify(envelope))
}

/**
 * シリアライズ済み文字列を GameState に復元する。
 *
 * `serializeGameState` の出力 (encodeURIComponent 済み) を渡す前提。なお
 * `decodeURIComponent` は `{` `}` `"` といった JSON 記号をエスケープ対象とせず
 * 素通しするため、encode していない生 JSON エンベロープも decode 成功経路で
 * そのまま受理される。`decodeURIComponent` 自体が throw するのは不正な `%`
 * シーケンスを含むときだけで、その場合は生入力を JSON.parse 試行する保険を置く。
 *
 * 検証に通らない入力 (parse 失敗 / バージョン不一致 / 盤面寸法不整合 /
 * 不正なセル値 / 不正な status 等) では throw せず null を返す。
 *
 * @returns 妥当な GameState、または検証に通らなければ null。
 */
export function deserializeGameState(input: string): GameState | null {
  if (typeof input !== 'string' || input.length === 0) return null

  // 1) URL デコード → JSON parse。どちらの失敗も null に丸める。
  let raw: unknown
  try {
    let decoded: string
    try {
      decoded = decodeURIComponent(input)
    } catch {
      // decodeURIComponent が throw するのは不正な % シーケンスのときのみ。
      // その場合は生入力をそのまま JSON.parse 試行する (記号は素通しなので
      // 正常な生 JSON は上の decode 経路で既に受理されている)。
      decoded = input
    }
    raw = JSON.parse(decoded)
  } catch {
    return null
  }

  // 2) エンベロープ構造とバージョン検証。
  if (raw === null || typeof raw !== 'object') return null
  const env = raw as Record<string, unknown>
  if (env.v !== GAME_STATE_FORMAT_VERSION) return null
  if (env.state === null || typeof env.state !== 'object') return null

  // 3) GameState 本体の検証。
  return validateGameState(env.state as Record<string, unknown>)
}

/**
 * プレーンオブジェクトが妥当な GameState か検証し、妥当なら正規化した GameState を返す。
 * 不正なら null。`buildGameStateFromPuzzle` の検証パターンに倣う。
 */
function validateGameState(obj: Record<string, unknown>): GameState | null {
  const {
    cols,
    rows,
    board,
    fallingBlock,
    nextBlock,
    score,
    chainCount,
    status,
  } = obj

  // cols / rows: 正の整数。
  if (!Number.isInteger(cols) || (cols as number) <= 0) return null
  if (!Number.isInteger(rows) || (rows as number) <= 0) return null
  const colsN = cols as number
  const rowsN = rows as number

  // board: rows × cols の BoardCell 二次元配列。
  if (!Array.isArray(board) || board.length !== rowsN) return null
  const validatedBoard: BoardCell[][] = []
  for (let r = 0; r < rowsN; r++) {
    const row = board[r]
    if (!Array.isArray(row) || row.length !== colsN) return null
    const validatedRow: BoardCell[] = []
    for (let c = 0; c < colsN; c++) {
      const cell = row[c]
      if (!isBoardCell(cell)) return null
      validatedRow.push(cell)
    }
    validatedBoard.push(validatedRow)
  }

  // nextBlock: BlockValue。
  if (!isBlockValue(nextBlock)) return null

  // fallingBlock: null または妥当な FallingBlock。
  let validatedFalling: FallingBlock | null = null
  if (fallingBlock !== null) {
    if (typeof fallingBlock !== 'object') return null
    const fb = fallingBlock as Record<string, unknown>
    if (!isBlockValue(fb.value)) return null
    // col: 整数かつ 0..cols-1。
    if (
      !Number.isInteger(fb.col) ||
      (fb.col as number) < 0 ||
      (fb.col as number) >= colsN
    ) {
      return null
    }
    // row: 有限の数 (浮力で浮動小数になりうる) かつ妥当範囲。
    if (
      typeof fb.row !== 'number' ||
      !Number.isFinite(fb.row) ||
      fb.row < 0 ||
      fb.row >= rowsN
    ) {
      return null
    }
    // velocity: 有限の数。
    if (typeof fb.velocity !== 'number' || !Number.isFinite(fb.velocity)) {
      return null
    }
    validatedFalling = {
      value: fb.value,
      col: fb.col as number,
      row: fb.row,
      velocity: fb.velocity,
    }
  }

  // score / chainCount: 非負の有限数。
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0)
    return null
  if (
    typeof chainCount !== 'number' ||
    !Number.isFinite(chainCount) ||
    chainCount < 0
  ) {
    return null
  }

  // status: GameStatus のいずれか。
  if (
    typeof status !== 'string' ||
    !VALID_STATUSES.includes(status as GameStatus)
  ) {
    return null
  }

  return {
    cols: colsN,
    rows: rowsN,
    board: validatedBoard,
    fallingBlock: validatedFalling,
    nextBlock,
    score,
    chainCount,
    status: status as GameStatus,
  }
}
