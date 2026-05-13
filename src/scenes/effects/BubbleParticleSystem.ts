/**
 * 泡パーティクル (Issue #17)。
 *
 * 着水時 (`'land'`) / Next スポーン時 (`'spawn'`) / 消去時 (`'clear'`, #19 で使用予定)
 * の 3 種類の発生源から、小さな半透明白円が上方へゆっくり立ち上がる。
 *
 * - PIXI v8 の `Graphics.circle().fill()` をパーティクル 1 個ずつに 1 つ持たせる
 *   (5x10 盤面で同時数十個以下を想定。プールするほどではない)。
 * - `update(deltaMS)` を `Application.ticker` から毎フレーム呼ぶ。
 * - `emit({ x, y, kind, count })` で n 個のパーティクルを一気に発生させる。
 * - ライフサイクル末期 (`ageMs >= lifeMs`) に `graphic.destroy()` してリストから外す。
 *
 * 座標は **本 Container ローカル座標 (= 盤面ピクセル座標)**。
 * `GameScene` が `BoardRenderer` と同じ position に重ねて配置する想定。
 */

import { Container, Graphics } from 'pixi.js'

/** パーティクルの発生種別。視覚パラメータは同じだが、呼び出し元の意図を明示する。 */
export type BubbleKind = 'spawn' | 'land' | 'clear'

interface Bubble {
  graphic: Graphics
  /** ローカル x [px]、横揺れで毎フレーム書き換える基準値 */
  baseX: number
  /** ローカル y [px] */
  y: number
  /** 上昇速度 [px/s] (負値で上へ) */
  vy: number
  radius: number
  ageMs: number
  /** 生存時間 [ms]、`ageMs >= lifeMs` で消滅 */
  lifeMs: number
  kind: BubbleKind
}

export interface EmitOptions {
  /** 発生中心の x [px] (Container ローカル) */
  x: number
  /** 発生中心の y [px] (Container ローカル) */
  y: number
  kind: BubbleKind
  /** 発生個数。既定 3 */
  count?: number
}

/** RNG は決定論的テストのため差し替え可能にする (`Math.random` 互換)。 */
export type RandomSource = () => number

const DEFAULT_COUNT = 3

/** パーティクルの寿命範囲 [ms]。 */
const LIFE_MS_MIN = 1500
const LIFE_MS_RANGE = 1000

/** 半径範囲 [px]。 */
const RADIUS_MIN = 2
const RADIUS_RANGE = 4

/** 上昇速度範囲 [px/s] (負値が上)。 */
const VY_MIN = -30
const VY_RANGE = -40

/** 発生位置のジッタ幅 [px] (中心 ±SPREAD/2)。 */
const SPAWN_SPREAD_PX = 12

/** 横揺れ振幅 [px]。`sin(ageMs / 200)` に乗せる。 */
const SWAY_AMPLITUDE_PX = 8

/** 横揺れの周期係数 (ageMs を割る値が大きいほどゆっくり)。 */
const SWAY_PERIOD_DIV = 200

export class BubbleParticleSystem extends Container {
  private readonly bubbles: Bubble[] = []
  private readonly rng: RandomSource

  constructor(rng: RandomSource = Math.random) {
    super()
    this.rng = rng
  }

  /**
   * n 個のパーティクルを発生させる。`count` を 0 以下にすると no-op。
   * `kind` は視覚的には同じ挙動だが、呼び出し元の意図を明示する目的で保持する。
   *
   * 注: PIXI の `Container` は `EventEmitter.emit` を継承するため、
   * 衝突を避けて `emitBubbles` という名前にしている。
   */
  emitBubbles(opts: EmitOptions): void {
    const count = opts.count ?? DEFAULT_COUNT
    for (let i = 0; i < count; i++) {
      this.spawnBubble(opts.x, opts.y, opts.kind)
    }
  }

  /**
   * 全パーティクルを 1 フレーム進める。
   *
   * - `deltaMS` は PIXI の `Ticker.deltaMS` (前フレームからの経過 ms) を想定。
   * - 0 以下・NaN は no-op。
   * - 寿命到達したパーティクルは `destroy()` してリストから外す。
   */
  update(deltaMS: number): void {
    if (!Number.isFinite(deltaMS) || deltaMS <= 0) return
    const dt = deltaMS / 1000

    // 後方から走査して `splice` でも index がずれないようにする。
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]
      b.ageMs += deltaMS
      b.y += b.vy * dt

      // 横揺れ (基準 x からの sin オフセット)。
      const sway = Math.sin(b.ageMs / SWAY_PERIOD_DIV) * SWAY_AMPLITUDE_PX
      b.graphic.x = b.baseX + sway
      b.graphic.y = b.y

      // ライフサイクル末期にフェードアウト (線形)。
      const t = b.ageMs / b.lifeMs
      b.graphic.alpha = Math.max(0, 1 - t)

      if (b.ageMs >= b.lifeMs) {
        b.graphic.destroy()
        this.bubbles.splice(i, 1)
      }
    }
  }

  /** 現在生存中のパーティクル数 (テスト用)。 */
  get activeCount(): number {
    return this.bubbles.length
  }

  /**
   * Container 破棄。生存中の Graphics も明示的に destroy する。
   * Pixi の destroy({ children: true }) でも回収されるが、bubbles 配列を
   * 整合した状態に戻すために自前でクリアする。
   */
  destroy(
    options?:
      | boolean
      | { children?: boolean; texture?: boolean; textureSource?: boolean }
  ): void {
    for (const b of this.bubbles) {
      b.graphic.destroy()
    }
    this.bubbles.length = 0
    super.destroy(options)
  }

  // ----------------------------------------------------------------------
  // private
  // ----------------------------------------------------------------------

  private spawnBubble(x: number, y: number, kind: BubbleKind): void {
    const radius = RADIUS_MIN + this.rng() * RADIUS_RANGE
    const g = new Graphics()
    g.circle(0, 0, radius).fill({ color: 0xffffff, alpha: 0.6 })

    // 発生位置のジッタ (中心 ± SPAWN_SPREAD_PX/2)。
    const baseX = x + (this.rng() - 0.5) * SPAWN_SPREAD_PX
    g.x = baseX
    g.y = y
    this.addChild(g)

    const vy = VY_MIN + this.rng() * VY_RANGE
    const lifeMs = LIFE_MS_MIN + this.rng() * LIFE_MS_RANGE

    this.bubbles.push({
      graphic: g,
      baseX,
      y,
      vy,
      radius,
      ageMs: 0,
      lifeMs,
      kind,
    })
  }
}
