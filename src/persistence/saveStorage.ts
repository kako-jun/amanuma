/**
 * GameState の永続化アダプタ (不純層、Issue #56)。
 *
 * dev-doctrine 規律3・4: 本モジュールは localStorage / window / URL に依存する
 * 「不純アダプタ」である。検証・シリアライズの本体は純粋コア
 * (`gameStateCodec.ts`) に委ねており、ここでは I/O を薄く包むだけで
 * 検証ロジックを再実装しない。
 *
 * 提供する出入口:
 * - localStorage 単一スロット save/load (キー `amanuma:save:v1`)
 *   既存の mute キー (`amanuma_muted`) とは衝突しない名前にしている。
 * - URL クエリ `?state=...` の読み取り
 *
 * localStorage が無い環境 (SSR / テスト / プライベートモード) や
 * SecurityError / QuotaExceededError は SoundManager に倣って握りつぶす。
 */

import type { GameState } from '../types/GameState'
import { serializeGameState, deserializeGameState } from './gameStateCodec'

/** GameState セーブスロットの localStorage キー (単一スロット)。 */
export const SAVE_STORAGE_KEY = 'amanuma:save:v1'

/** URL クエリで GameState を渡すときのパラメータ名 (`?state=...`)。 */
export const STATE_QUERY_PARAM = 'state'

/**
 * GameState を localStorage の単一スロットに保存する。
 * localStorage が使えない環境では no-op (false を返す)。
 *
 * @returns 保存に成功したら true、そうでなければ false。
 */
export function saveGameState(state: GameState): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(SAVE_STORAGE_KEY, serializeGameState(state))
    return true
  } catch {
    /* QuotaExceededError / SecurityError 等は無視 */
    return false
  }
}

/**
 * localStorage の単一スロットから GameState を復元する。
 * スロットが空・localStorage 不在・検証 NG のいずれでも null を返す。
 * 検証は純粋コアの `deserializeGameState` に委譲する。
 */
export function loadGameState(): GameState | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(SAVE_STORAGE_KEY)
    if (raw === null) return null
    return deserializeGameState(raw)
  } catch {
    /* SecurityError 等は無視 */
    return null
  }
}

/** localStorage のセーブスロットを消去する。 */
export function clearGameState(): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(SAVE_STORAGE_KEY)
  } catch {
    /* 無視 */
  }
}

/**
 * URL クエリ `?state=...` から GameState を読み取る。
 *
 * @param search `location.search` 相当の文字列 (例 `"?state=..."`)。
 *               省略時は `window.location.search` を参照する (不在環境では null)。
 * @returns 妥当な GameState、または不在 / 検証 NG なら null。
 *          検証は純粋コアの `deserializeGameState` に委譲する。
 */
export function readGameStateFromUrl(search?: string): GameState | null {
  let query = search
  if (query === undefined) {
    if (typeof window === 'undefined' || !window.location) return null
    query = window.location.search
  }
  let params: URLSearchParams
  try {
    params = new URLSearchParams(query)
  } catch {
    return null
  }
  const encoded = params.get(STATE_QUERY_PARAM)
  if (encoded === null || encoded.length === 0) return null
  return deserializeGameState(encoded)
}

/**
 * GameState を URL クエリ文字列断片 (`state=...`) に変換する。
 * 共有 URL 生成などに使う想定。`?` や他パラメータの結合は呼び出し側の責任。
 */
export function toStateQueryParam(state: GameState): string {
  // serializeGameState は既に encodeURIComponent 済みなので二重 encode しない。
  return `${STATE_QUERY_PARAM}=${serializeGameState(state)}`
}
