/**
 * カラー定数。
 *
 * DESIGN.md セクション 2 (Block Colors) / セクション 4 (UI Colors) を
 * PixiJS で扱える 0x 表記の数値に変換したもの。
 *
 * Hex 値は DESIGN.md と完全一致させること (1 文字でも変えない)。
 * 「dark background 上で互いに識別可能 / violet glow 下でも区別可能」
 * という DESIGN.md の制約を満たすために選ばれたパレットなので、
 * 個別の色を「もう少し明るく」「もう少し暖色寄りに」といった変更は禁止。
 */

import type { BlockValue } from '../types/GameState'

/**
 * ブロック値 (1..7) → 色 (0x...) のマッピング。
 *
 * 値の順序自体はゲームバランス上の意味を持たないが、
 * `7` はクリア対象 (ターゲット) ブロックなので、
 * もっとも目立つ Magenta を割り当てている。
 */
export const BLOCK_COLORS: Record<BlockValue, number> = {
  1: 0xff6b9d, // Rose
  2: 0xffa06b, // Coral
  3: 0xffd93d, // Gold
  4: 0x6bffb8, // Mint
  5: 0x6bb3ff, // Sky
  6: 0xa06bff, // Purple
  7: 0xff6bff, // Magenta (= ターゲット)
} as const

/** 画面背景 (`bg`)。`PIXI.Application` の background と一致させる。 */
export const UI_BG = 0x0f0f1a

/** ボード枠線などに使う Violet (`primary`)。 */
export const UI_PRIMARY = 0x7c3aed

/** ハイライト用 Cyan (`secondary`)。現状は未使用、後続 Issue で利用予定。 */
export const UI_SECONDARY = 0x06b6d4

/** 本文・ブロック上の数字テキストに使う白 (`text-primary`)。 */
export const UI_TEXT_PRIMARY = 0xffffff

/**
 * プレイヤー識別色 (DESIGN.md セクション 4.5 Player Indicators)。
 *
 * - UI_P1 (= `p1-color`): 緑 (`#10b981`)。VersusScene の P1 ラベル等で使用。
 * - UI_P2 (= `p2-color`): アンバー (`#f59e0b`)。同 P2 ラベル等で使用。
 *
 * DESIGN.md の Hex 値と一致させること。
 */
export const UI_P1 = 0x10b981
export const UI_P2 = 0xf59e0b

/**
 * 描画レイアウト定数。
 *
 * DESIGN.md セクション 4 (Game Canvas) の border 2px を遵守する。
 * Issue #15 時点の固定値。物理 (#16) やシーン (#21) でも参照する。
 */
export const CELL_SIZE = 48
export const BOARD_BORDER_WIDTH = 2
export const BOARD_BG_ALPHA = 0.25
