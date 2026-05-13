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
  /** 横揺れ振幅 [px] (バリアント由来、update 時に毎フレーム参照する)。 */
  swayAmplitudePx: number
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

/** 1 種類の発生バリアントの視覚パラメータ。 */
interface BubbleVariantParams {
  /** 寿命の下限 [ms]。 */
  lifeMsMin: number
  /** 寿命のレンジ [ms]、`lifeMsMin + rng() * lifeMsRange` で抽選。 */
  lifeMsRange: number
  /** 半径の下限 [px]。 */
  radiusMin: number
  /** 半径のレンジ [px]、`radiusMin + rng() * radiusRange` で抽選。 */
  radiusRange: number
  /** 上昇速度の下限 [px/s] (負値が上方向)。 */
  vyMin: number
  /** 上昇速度のレンジ [px/s] (負値が上方向に強くなる方向)。 */
  vyRange: number
  /** 発生位置のジッタ幅 [px] (中心 ± SPREAD/2)。 */
  spawnSpreadPx: number
  /** 横揺れの振幅 [px]。 */
  swayAmplitudePx: number
  /** Graphics の塗り alpha (0..1)。 */
  alpha: number
}

/**
 * バリアントごとのパラメータ。
 *
 * - `'spawn'` / `'land'` (#17): 着水点・スポーン点から立ち上がる泡。
 * - `'clear'` (#19): 消去セルから「水中で気泡になってほどける」演出。
 *   寿命長め・半径少しバラつき・ゆっくり上昇。
 */
const VARIANT_PARAMS: Record<BubbleKind, BubbleVariantParams> = {
  spawn: {
    lifeMsMin: 1500,
    lifeMsRange: 1000,
    radiusMin: 2,
    radiusRange: 4,
    vyMin: -30,
    vyRange: -40,
    spawnSpreadPx: 12,
    swayAmplitudePx: 8,
    alpha: 0.6,
  },
  land: {
    lifeMsMin: 1500,
    lifeMsRange: 1000,
    radiusMin: 2,
    radiusRange: 4,
    vyMin: -30,
    vyRange: -40,
    spawnSpreadPx: 12,
    swayAmplitudePx: 8,
    alpha: 0.6,
  },
  clear: {
    // 消去演出は「ほどけて昇る」イメージで寿命を長め (1500..2500ms)。
    lifeMsMin: 1500,
    lifeMsRange: 1000,
    // 半径は 2..5 px (元ブロック 48px 矩形より十分小さい)。
    radiusMin: 2,
    radiusRange: 3,
    // 仕様: -25 〜 -45 px/s (= -1.5 〜 -3 row/s 程度、ゆっくり上昇)。
    vyMin: -25,
    vyRange: -20,
    // 元ブロックのサイズを意識して内側に散らす (±10 px)。
    spawnSpreadPx: 20,
    // 横揺れ振幅 ±10 px。
    swayAmplitudePx: 10,
    // 水中の白い気泡感 (半透明白)。
    alpha: 0.55,
  },
}

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

      // 横揺れ (基準 x からの sin オフセット)、振幅はバリアント依存。
      const sway = Math.sin(b.ageMs / SWAY_PERIOD_DIV) * b.swayAmplitudePx
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
    const params = VARIANT_PARAMS[kind]
    const radius = params.radiusMin + this.rng() * params.radiusRange
    const g = new Graphics()
    g.circle(0, 0, radius).fill({ color: 0xffffff, alpha: params.alpha })

    // 発生位置のジッタ (中心 ± spawnSpreadPx/2)。
    const baseX = x + (this.rng() - 0.5) * params.spawnSpreadPx
    g.x = baseX
    g.y = y
    this.addChild(g)

    const vy = params.vyMin + this.rng() * params.vyRange
    const lifeMs = params.lifeMsMin + this.rng() * params.lifeMsRange

    this.bubbles.push({
      graphic: g,
      baseX,
      y,
      vy,
      radius,
      ageMs: 0,
      lifeMs,
      kind,
      swayAmplitudePx: params.swayAmplitudePx,
    })
  }
}
