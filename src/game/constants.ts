/**
 * ゲーム定数
 */

// フィールドサイズ
export const COLS = 5
export const ROWS = 10
export const BLOCK_SIZE = 50

// 画面サイズ（基準）
export const GAME_WIDTH = 800
export const GAME_HEIGHT = 650

// シングルプレイ用オフセット
export const SINGLE_OFFSET_X = 250
export const SINGLE_OFFSET_Y = 50

// 対戦モード用オフセット
export const VS_P1_OFFSET_X = 50
export const VS_P2_OFFSET_X = 450
export const VS_OFFSET_Y = 130

// 数字ごとの色定義（虹色）
export const COLORS: readonly number[] = [
  0x808080, // 0 (使用しない)
  0xff0000, // 1 赤
  0xff7f00, // 2 オレンジ
  0xffff00, // 3 黄色
  0x00ff00, // 4 緑
  0x0000ff, // 5 青
  0x4b0082, // 6 藍色
  0x9400d3, // 7 紫
] as const

// ゲームバランス
export const BASE_DROP_INTERVAL = 1000
export const MIN_DROP_INTERVAL = 500
export const LINES_PER_LEVEL = 10
export const SCORE_PER_BLOCK = 10
export const CHAIN_BONUS = 50

// 確率
export const SEVEN_PROBABILITY = 0.02

// localStorage キー
export const STORAGE_KEY_HIGHSCORE = 'threeseven-highscore'
