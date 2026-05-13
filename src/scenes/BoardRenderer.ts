/**
 * ボード描画専用クラス (Issue #15)。
 *
 * 旧 Phaser 版で `add.graphics()` を毎フレーム `clear()` → 再描画する
 * シンプルな方針を採っていたため、PixiJS 移行後もそれを踏襲する。
 * `PIXI.Graphics` は v8 で内部的に再生成コストが下がっており、
 * 「毎フレーム clear() して再構築する」前提でも 5x10 程度の盤面なら
 * 十分軽量。アニメーション (Issue #16 物理 / #17 着水 / #18-19 消去) を
 * 後付けする際にもこの方針が一番素直になる。
 *
 * 数字テキストは `Text` の再生成コストが (Graphics に比べて) 重いため、
 * `textPool` に保持して使い回す (毎フレームの new を避ける)。
 *
 * 描画責任のみを持ち、状態の更新は行わない。state は外部 (GameScene 経由で
 * 物理ループ / 入力ハンドラなど) が更新するもので、本クラスは
 * `setState()` で再ターゲットされるか、`update()` で同じ参照を再描画する。
 */

import { Container, Graphics, Text } from 'pixi.js'
import type { BlockValue, GameState } from '../types/GameState'
import {
  BLOCK_COLORS,
  BOARD_BG_ALPHA,
  BOARD_BORDER_WIDTH,
  CELL_SIZE,
  UI_PRIMARY,
  UI_TEXT_PRIMARY,
} from '../constants/colors'

export interface BoardRendererOptions {
  /** 1 セルのピクセルサイズ */
  cellSize: number
  /** ボード枠線の太さ */
  borderWidth: number
}

const DEFAULT_OPTIONS: BoardRendererOptions = {
  cellSize: CELL_SIZE,
  borderWidth: BOARD_BORDER_WIDTH,
}

export class BoardRenderer extends Container {
  /** 矩形・枠線などのプリミティブ描画用 (毎フレーム clear → 再構築)。 */
  private readonly graphics: Graphics
  /** ブロック上の数字テキスト用プール (使い回し)。 */
  private readonly textPool: Text[]
  private readonly options: BoardRendererOptions
  private state: GameState | null = null

  constructor(state: GameState, opts?: Partial<BoardRendererOptions>) {
    super()
    this.options = { ...DEFAULT_OPTIONS, ...opts }
    this.graphics = new Graphics()
    this.addChild(this.graphics)
    this.textPool = []
    this.setState(state)
  }

  /** 別の state に切り替える (再ターゲット)。プール容量も合わせて拡張する。 */
  setState(state: GameState): void {
    this.state = state
    // 盤面セル数 + fallingBlock 1 個ぶん。お邪魔ブロック等が増えても
    // 上限が読みやすいように board セル数を基準にしている。
    this.ensureTextPool(state.cols * state.rows + 1)
    this.draw()
  }

  /**
   * 毎フレーム呼ばれる。state は外部から更新される前提。
   * state を持っていなければ no-op。
   */
  update(): void {
    if (!this.state) return
    this.draw()
  }

  // ----------------------------------------------------------------------
  // private
  // ----------------------------------------------------------------------

  private draw(): void {
    const state = this.state
    if (!state) return

    const { cellSize, borderWidth } = this.options
    const boardWidth = state.cols * cellSize
    const boardHeight = state.rows * cellSize

    const g = this.graphics
    g.clear()

    // ボード背景 (極薄い半透明黒) + 枠線 (Violet)。
    // 背景はあってもなくても良いが、ブロックがない空セルが背景色と
    // 完全に一致して「枠線だけが浮いて見える」のを避けるために置く。
    g.rect(0, 0, boardWidth, boardHeight)
      .fill({ color: 0x000000, alpha: BOARD_BG_ALPHA })
      .stroke({ color: UI_PRIMARY, width: borderWidth, alignment: 1 })

    // 描画したテキストインデックス。残りは visible=false で隠す。
    let textIndex = 0

    // 盤面のブロック描画。
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.board[r][c]
        if (cell === null) continue
        this.drawBlock(c * cellSize, r * cellSize, cell, textIndex)
        textIndex++
      }
    }

    // 落下中ブロック (浮動小数 row をそのまま使う)。
    const falling = state.fallingBlock
    if (falling) {
      this.drawBlock(
        falling.col * cellSize,
        falling.row * cellSize,
        falling.value,
        textIndex
      )
      textIndex++
    }

    // 使わなかったテキストは隠す。
    for (let i = textIndex; i < this.textPool.length; i++) {
      this.textPool[i].visible = false
    }
  }

  /** 単一ブロックを (x, y) に描画する。textIndex は textPool のスロット。 */
  private drawBlock(
    x: number,
    y: number,
    value: BlockValue,
    textIndex: number
  ): void {
    const { cellSize } = this.options
    const color = BLOCK_COLORS[value]

    // ブロック本体。セル境界から内側に 2px 余白を取って、隣接ブロック同士の
    // 境界が DESIGN.md の「マスの粒立ち」を保てるようにする。
    const pad = 2
    const radius = 6
    this.graphics
      .roundRect(
        x + pad,
        y + pad,
        cellSize - pad * 2,
        cellSize - pad * 2,
        radius
      )
      .fill({ color })

    // 数字テキスト (中央寄せ)。
    const text = this.textPool[textIndex]
    text.text = String(value)
    text.x = x + cellSize / 2
    text.y = y + cellSize / 2
    text.visible = true
  }

  private ensureTextPool(needed: number): void {
    while (this.textPool.length < needed) {
      const t = new Text({
        text: '',
        style: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 20,
          fontWeight: '700',
          fill: UI_TEXT_PRIMARY,
          align: 'center',
        },
      })
      t.anchor.set(0.5)
      t.visible = false
      this.addChild(t)
      this.textPool.push(t)
    }
  }
}
