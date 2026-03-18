import { SEVEN_PROBABILITY } from './constants'

/**
 * ゲーム用の確率調整済み乱数生成
 * - 2% の確率で 7 を返す（特別ブロック）
 * - 残り 98% で 1-6 を均等に返す（公平なダイスロール）
 */
export function generateBlockValue(): number {
  const rand = Math.random()
  if (rand < SEVEN_PROBABILITY) {
    return 7
  }
  // 1-6 の均等分布（公平なダイスロール）
  return Math.floor(Math.random() * 6) + 1
}
