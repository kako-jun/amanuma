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

/**
 * 着水時セル横揺れ (Issue #17)。
 *
 * `shake(row, col)` で記録されたセルは、`SHAKE_DURATION_MS` の間だけ
 * `sin(t * ω) * decay` の x オフセットを乗せて揺れる。GameState を汚さず、
 * 描画レイヤーだけで完結させる。
 */
interface ShakeEntry {
  row: number
  col: number
  startMs: number
}

const SHAKE_DURATION_MS = 600
const SHAKE_AMPLITUDE_PX = 3
const SHAKE_FREQ_HZ = 12 // 12Hz ≈ 0.6 秒で 7 周期、減衰と相まって「揺れて止まる」

export class BoardRenderer extends Container {
  /** 矩形・枠線などのプリミティブ描画用 (毎フレーム clear → 再構築)。 */
  private readonly graphics: Graphics
  /** ブロック上の数字テキスト用プール (使い回し)。 */
  private readonly textPool: Text[]
  private readonly options: BoardRendererOptions
  private state: GameState | null = null
  /** 着水セル横揺れの登録テーブル (Issue #17)。`update()` 内で時刻フィルタする。 */
  private shakes: ShakeEntry[] = []
  /**
   * 時刻ソース。テストで差し替え可能。
   * 既定は `performance.now`。SSR / Node 環境などでも fallback 可能なように
   * 関数として保持する。
   */
  private readonly now: () => number

  constructor(
    state: GameState,
    opts?: Partial<BoardRendererOptions>,
    now: () => number = () => performance.now()
  ) {
    super()
    this.options = { ...DEFAULT_OPTIONS, ...opts }
    this.graphics = new Graphics()
    this.addChild(this.graphics)
    this.textPool = []
    this.now = now
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

  /**
   * 指定セルを「着水的に」揺らす (Issue #17)。
   *
   * 約 0.6 秒で減衰する横揺れを描画レイヤーで重ねる。
   * GameState は触らず、`BoardRenderer` 内の `shakes` 配列に時刻を
   * 記録するのみ。同じ (row, col) を多重登録しても重ね合わせ動作になる
   * (短時間に複数着水が起きるケースは現状想定していないため許容)。
   */
  shake(row: number, col: number): void {
    this.shakes.push({ row, col, startMs: this.now() })
  }

  /** テスト用: 現在生存中の shake 数。 */
  get activeShakeCount(): number {
    return this.shakes.length
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

    // 着水セル横揺れの時刻フィルタ (Issue #17)。
    const nowMs = this.now()
    this.shakes = this.shakes.filter(s => nowMs - s.startMs < SHAKE_DURATION_MS)

    // 描画したテキストインデックス。残りは visible=false で隠す。
    let textIndex = 0

    // 盤面のブロック描画。
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.board[r][c]
        if (cell === null) continue
        const xOffset = this.computeShakeOffset(r, c, nowMs)
        this.drawBlock(c * cellSize + xOffset, r * cellSize, cell, textIndex)
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

  /**
   * (row, col) セルの横揺れオフセット [px] を返す。
   *
   * 全 shake エントリを線形に走査し、対象セルにマッチするものを
   * `sin(2π * f * t) * (1 - age) * amplitude` で合算する。
   * 同セルへの多重登録は重ね合わせる (短時間に複数着水するケースは
   * 現状想定外なので問題視しない)。
   */
  private computeShakeOffset(row: number, col: number, nowMs: number): number {
    let offset = 0
    for (const s of this.shakes) {
      if (s.row !== row || s.col !== col) continue
      const ageMs = nowMs - s.startMs
      if (ageMs < 0 || ageMs >= SHAKE_DURATION_MS) continue
      const tSec = ageMs / 1000
      const decay = 1 - ageMs / SHAKE_DURATION_MS
      offset +=
        Math.sin(2 * Math.PI * SHAKE_FREQ_HZ * tSec) *
        decay *
        SHAKE_AMPLITUDE_PX
    }
    return offset
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
