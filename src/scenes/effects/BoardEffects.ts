/**
 * 盤面演出の統括 (Issue #57)。
 *
 * 旧 `PlayerBoard` が直接抱えていた「気泡 emit / 着水波紋 / 盤面シェイク」の
 * 発火責務を 1 モジュールに集約する。`PlayerBoard` は物理・連鎖・スポーン・入力の
 * 進行を司り、演出が要る局面では意味のあるイベント API
 * (`onSpawn` / `onLand` / `onClear`) を呼ぶだけにする (規律3: 単一責務)。
 *
 * 責務:
 * - `WaterSurface` / `BubbleParticleSystem` の所有・生成・破棄
 * - ゲームイベント (spawn / land / clear) → セル座標 → ピクセル座標変換 → 下位演出発火
 * - 盤面セルのシェイク発火 (`ShakeTarget` 経由で `BoardRenderer.shake` に委譲)
 * - 毎フレームの常駐アニメ更新 (`water.update()` / `bubbles.update(deltaMS)`)
 *
 * 設計判断 (docs/architecture.md「盤面演出の統括 (Issue #57)」):
 * - `BoardRenderer` は「盤面・ブロックの描画」という別責務なので BoardEffects は所有しない。
 *   シェイクだけが演出なので `ShakeTarget` インターフェース越しに `shake(row, col)` を委譲する。
 * - SFX (`SoundManager`) はゲームイベント音であり視覚演出層とは別概念のため BoardEffects に含めない
 *   (Issue #57 スコープ外。`PlayerBoard` が引き続き保持する)。
 * - 座標は本 Container ローカル (= 盤面左上 (0,0))。`WaterSurface` / `BubbleParticleSystem` は
 *   従来通り `PlayerBoard` の子レイヤー (盤面と同レイヤー) として addChild される。
 *
 * 注: 演出レイヤーの addChild 順 (盤面 → 水面 → 泡) は `PlayerBoard.initWithState` が
 * レイヤー統括の責務として制御する。BoardEffects は「いつ・どの引数で発火するか」のみを担う。
 */

import { CELL_SIZE } from '../../constants/colors'
import type { BubbleParticleSystem } from './BubbleParticleSystem'
import type { WaterSurface } from './WaterSurface'

/**
 * シェイク委譲先 (= `BoardRenderer`)。
 *
 * BoardEffects は盤面描画そのものは扱わないが、着水セルの横揺れだけは演出なので、
 * 描画レイヤーに対して `shake(row, col)` を投げるための最小インターフェースを受け取る。
 */
export interface ShakeTarget {
  shake(row: number, col: number): void
}

/** spawn 時の波紋強度 (控えめ)。 */
const SPAWN_SPLASH_INTENSITY = 0.7
/** land 時の波紋強度 (強め)。 */
const LAND_SPLASH_INTENSITY = 1.0
/** spawn 時の泡個数。 */
const SPAWN_BUBBLE_COUNT = 3
/** land 時の泡個数。 */
const LAND_BUBBLE_COUNT = 4
/** clear 1 セルあたりの泡個数。 */
const CLEAR_BUBBLE_COUNT_PER_CELL = 4

export class BoardEffects {
  private readonly water: WaterSurface
  private readonly bubbles: BubbleParticleSystem
  private readonly shakeTarget: ShakeTarget
  /** clear イベントで key (= row*cols+col) を (row, col) に戻すための列数。 */
  private readonly cols: number

  /**
   * @param water     水面演出 (PlayerBoard が生成・addChild 済みのものを渡す)。
   * @param bubbles   泡演出 (同上)。
   * @param shakeTarget セルシェイクの委譲先 (= BoardRenderer)。
   * @param cols      盤面の列数。clear positions の key 復元に使う。
   */
  constructor(
    water: WaterSurface,
    bubbles: BubbleParticleSystem,
    shakeTarget: ShakeTarget,
    cols: number
  ) {
    this.water = water
    this.bubbles = bubbles
    this.shakeTarget = shakeTarget
    this.cols = cols
  }

  /**
   * 常駐アニメ更新。Ticker から毎フレーム呼ぶ。
   * `state.status` に関わらず水面・泡の更新は続ける (PlayerBoard 側の判断と一致)。
   */
  update(deltaMS: number): void {
    this.water.update()
    this.bubbles.update(deltaMS)
  }

  /**
   * Next からブロック投入時 (= スポーン)。
   * - 控えめな波紋 (intensity 0.7)。
   * - spawn 泡 3 個 (盤面最上段 y=0 から)。
   */
  onSpawn(col: number): void {
    const xPx = col * CELL_SIZE + CELL_SIZE / 2
    this.water.splash(xPx, SPAWN_SPLASH_INTENSITY)
    this.bubbles.emitBubbles({
      x: xPx,
      y: 0,
      kind: 'spawn',
      count: SPAWN_BUBBLE_COUNT,
    })
  }

  /**
   * ブロックが盤面下部 (積層) に着水したとき。
   * - 強めの波紋 (intensity 1.0)。
   * - land 泡 4 個 (着水セル中心から)。
   * - 着水セルの横揺れ。
   */
  onLand(row: number, col: number): void {
    const xPx = col * CELL_SIZE + CELL_SIZE / 2
    const yPx = row * CELL_SIZE + CELL_SIZE / 2
    this.water.splash(xPx, LAND_SPLASH_INTENSITY)
    this.bubbles.emitBubbles({
      x: xPx,
      y: yPx,
      kind: 'land',
      count: LAND_BUBBLE_COUNT,
    })
    this.shakeTarget.shake(row, col)
  }

  /**
   * 所有する演出サブシステム (水面・泡) を破棄する。
   *
   * `PlayerBoard.destroy` から呼ばれる。`WaterSurface` / `BubbleParticleSystem` は
   * PlayerBoard の子に addChild されているが、所有権 (生成・破棄) は BoardEffects に
   * あるため、破棄もここで明示的に行う (Issue #57)。PIXI の child destroy は
   * removeFromParent するため、続く `super.destroy` の children カスケードと二重破棄に
   * ならない。`shakeTarget` (= BoardRenderer) は所有物ではないので破棄しない。
   */
  destroy(
    options?:
      | boolean
      | { children?: boolean; texture?: boolean; textureSource?: boolean }
  ): void {
    this.water.destroy(options)
    this.bubbles.destroy(options)
  }

  /**
   * 連鎖 1 ステップで消去が発生したとき。
   * - 消去対象セル (`positions`: key = row*cols+col) ごとに clear 泡 4 個。
   */
  onClear(positions: Set<number>): void {
    for (const key of positions) {
      const row = Math.floor(key / this.cols)
      const col = key % this.cols
      const xPx = col * CELL_SIZE + CELL_SIZE / 2
      const yPx = row * CELL_SIZE + CELL_SIZE / 2
      this.bubbles.emitBubbles({
        x: xPx,
        y: yPx,
        kind: 'clear',
        count: CLEAR_BUBBLE_COUNT_PER_CELL,
      })
    }
  }
}
