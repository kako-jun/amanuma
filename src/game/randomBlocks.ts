/**
 * ブロック生成 (Issue #18)。
 *
 * 旧スリーセブン仕様: 1〜6 を各 17%、7 を 2% (= 計 104% に揺らぐが、
 * 内部実装では 1〜6 は累積閾値で振り分け、7 だけ別判定で正確に 2% にする)。
 *
 * テスタビリティのため `rng` を引数で差し替えられる。デフォルトは Math.random。
 */
import type { BlockValue } from '../types/GameState'

/** 7 の出現確率 (= 2%)。 */
export const SEVEN_PROBABILITY = 0.02

/**
 * 1〜7 のブロックを生成する。
 *
 * 出現確率:
 * - `7`: `SEVEN_PROBABILITY` (= 2%)
 * - `1`〜`6`: 残り 98% を 6 等分 (各約 16.33%)
 *
 * 旧仕様 (1〜6 各 17%、7 が 2%) は合計が 104% で歪なため、本実装では
 * 「7 を 2% で抜き出し、残りを 1〜6 で等分」する形に正規化する。
 *
 * @param rng `() => number` で `[0, 1)` を返す。テスト時に差し替え可。
 */
export function generateBlockValue(
  rng: () => number = Math.random
): BlockValue {
  const r = rng()
  if (r < SEVEN_PROBABILITY) return 7

  // 残り [SEVEN_PROBABILITY, 1.0) を 6 等分。
  const remaining = r - SEVEN_PROBABILITY
  const span = (1 - SEVEN_PROBABILITY) / 6
  const idx = Math.min(5, Math.floor(remaining / span))
  return (idx + 1) as BlockValue
}
