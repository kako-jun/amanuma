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

// 数字ごとの色定義（洗練されたネオン風パレット）
export const COLORS: readonly number[] = [
  0x2a2a3e, // 0 (使用しない - 背景色)
  0xff6b9d, // 1 ローズピンク
  0xffa06b, // 2 コーラルオレンジ
  0xffd93d, // 3 ゴールデンイエロー
  0x6bffb8, // 4 ミントグリーン
  0x6bb3ff, // 5 スカイブルー
  0xa06bff, // 6 パープル
  0xff6bff, // 7 マゼンタ（特別）
] as const

// UI カラー定義
export const UI_COLORS = {
  // 背景
  background: 0x0f0f1a,
  backgroundLight: 0x1a1a2e,
  backgroundCard: 0x16213e,

  // アクセント
  primary: 0x7c3aed,      // バイオレット
  primaryGlow: 0xa855f7,
  secondary: 0x06b6d4,    // シアン
  secondaryGlow: 0x22d3ee,

  // 状態
  success: 0x10b981,
  warning: 0xf59e0b,
  danger: 0xef4444,

  // テキスト
  textPrimary: 0xf8fafc,
  textSecondary: 0x94a3b8,
  textMuted: 0x64748b,

  // ボーダー
  border: 0x334155,
  borderGlow: 0x7c3aed,
} as const

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
