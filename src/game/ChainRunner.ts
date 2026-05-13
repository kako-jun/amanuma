/**
 * 消去・連鎖の Promise チェーン実行 (Issue #18)。
 *
 * 旧 Phaser 版は `time.delayedCall(50ms)` でコールバック再帰していたが、
 * PixiJS 移植では `await delay(ms)` で素直なループにする。`runChain` 1 回の
 * 呼び出し中は state を mutate して消去・重力・再判定を繰り返し、消去が
 * なくなったら解決する。
 *
 * 各ステップの間に `stepDelayMs` の wait を挟むのは UI 側で
 * 着水エフェクト (Issue #17) / 水中爆発 (Issue #19) を後付けする際の
 * タイミング合わせのため。本 Issue では描画は変更しないので wait の効果は
 * 見えないが、後続 Issue ですぐ意味を持つ。
 */
import type { GameState } from '../types/GameState'
import { applyGravity, clearCells, findClearablePositions } from './board'

/** 連鎖 1 ステップごとのデフォルト待機時間 (ms)。 */
export const CHAIN_STEP_DELAY_MS = 250

export interface ChainResult {
  /** 連鎖中に消えたセルの総数。 */
  totalClears: number
  /** 連鎖段数 (1 = 単発、2 = 2 連鎖、...、0 = 何も消えなかった)。 */
  chainLevel: number
}

export interface RunChainOptions {
  /** 1 ステップごとの待機時間 (ms)。テスト時に 0 にするためのフック。 */
  stepDelayMs?: number
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 着水確定後の処理: 消去 → 重力 → 再判定をループ。
 *
 * - state を mutate する (`state.board`, `state.score`, `state.chainCount`)。
 * - 連鎖段数を `state.chainCount` に書き込む。最終値は最後に成立した連鎖の段数。
 *   何も消えなければ 0 にリセット。
 * - スコアリングは旧スリーセブン準拠: `消去数 * 10 + 連鎖段数 * 50`。
 * - 各ステップ間で `stepDelayMs` 待機する (デフォルト {@link CHAIN_STEP_DELAY_MS})。
 */
export async function runChain(
  state: GameState,
  opts: RunChainOptions = {}
): Promise<ChainResult> {
  const stepDelayMs = opts.stepDelayMs ?? CHAIN_STEP_DELAY_MS

  let chainLevel = 0
  let totalClears = 0

  // 連鎖外: chainCount は 0 から開始。最終的に消去なしなら 0 のまま。
  state.chainCount = 0

  while (true) {
    const positions = findClearablePositions(state)
    if (positions.size === 0) break

    chainLevel++

    // 消去の直前に 1 ステップ wait (= 着水エフェクト → 爆発の溜め)。
    await delay(stepDelayMs)

    const cleared = clearCells(state, positions)
    totalClears += cleared
    state.score += cleared * 10 + chainLevel * 50
    state.chainCount = chainLevel

    // 重力の直前に 1 ステップ wait (= 爆発演出の見せ場)。
    await delay(stepDelayMs)

    applyGravity(state)
  }

  return { totalClears, chainLevel }
}
