/**
 * 水面の波打ち (Issue #17)。
 *
 * - 常時 sin 波で「ゆらゆら」揺れる水面ラインを描画する (常駐アニメ)。
 * - `splash(localX, intensity)` で局所的な波紋を 500ms 発生させる。
 *   波紋は距離減衰した sin 波として既存ラインに加算される。
 *
 * 座標は **本 Container ローカル座標**。
 * `GameScene` が `BoardRenderer` と同じ position に重ねて配置し、
 * `y = 0` (= 盤面最上段) を水面とみなす想定。
 *
 * DESIGN.md 準拠で水面色には `UI_SECONDARY` (Cyan) を使う。
 */

import { Container, Graphics } from 'pixi.js'
import { UI_SECONDARY } from '../../constants/colors'

interface Splash {
  /** 中心 x [px] (Container ローカル) */
  x: number
  /** 発生時刻 [ms] (`performance.now()` 系) */
  startMs: number
  /** 強度倍率 (0..1 想定) */
  intensity: number
}

/** 波紋の生存時間 [ms]。 */
const SPLASH_DURATION_MS = 500

/** 常駐 sin 波の振幅 [px]。 */
const BASE_AMPLITUDE_PX = 1.5

/** 常駐 sin 波の時間係数。値が大きいほど速く揺れる。 */
const BASE_TIME_FREQ = 1.5

/** 常駐 sin 波の空間係数。`i * THIS` を sin に乗せる。 */
const BASE_SPATIAL_FREQ = 0.4

/** 波紋の最大振幅 [px] (intensity=1 のとき発生直後)。 */
const SPLASH_AMPLITUDE_PX = 6

/** 波紋の空間減衰スケール [px]。値が大きいほど遠くまで波が伝わる。 */
const SPLASH_DECAY_PX = 60

/** サンプリング間隔 [px]。`widthPx` をこれで割って点数を決める。 */
const SAMPLE_STEP_PX = 4

/** ラインの太さ [px]。 */
const LINE_WIDTH_PX = 1.5

/** ラインの不透明度 (0..1)。 */
const LINE_ALPHA = 0.6

/** 時刻ソース。テストで差し替え可能 (既定 `performance.now`)。 */
export type NowSource = () => number

export class WaterSurface extends Container {
  private readonly graphics: Graphics
  private readonly widthPx: number
  private readonly now: NowSource
  private readonly startMs: number
  private splashes: Splash[] = []

  constructor(widthPx: number, now: NowSource = () => performance.now()) {
    super()
    this.widthPx = widthPx
    this.now = now
    this.startMs = now()
    this.graphics = new Graphics()
    this.addChild(this.graphics)
  }

  /**
   * 波紋を発生させる。
   *
   * - `localX` は本 Container ローカル座標 [px]。
   * - `intensity` は波紋の振幅倍率 (既定 1)。`spawn` 時は 0.7、`land` 時は 1.0 を推奨。
   */
  splash(localX: number, intensity: number = 1): void {
    this.splashes.push({
      x: localX,
      startMs: this.now(),
      intensity,
    })
  }

  /** 現在生存中の波紋数 (テスト用)。 */
  get activeSplashCount(): number {
    return this.splashes.length
  }

  /**
   * 水面ラインを描き直す。`Application.ticker` から毎フレーム呼ぶ。
   *
   * - 寿命切れの波紋 (`now - startMs >= SPLASH_DURATION_MS`) は除去する。
   * - 常駐 sin 波 + 全 splash の合成を 1 本のポリラインとして描画。
   */
  update(): void {
    const now = this.now()
    const tSec = (now - this.startMs) / 1000

    // 寿命切れの splash を除去 (新しい配列を作る)。
    this.splashes = this.splashes.filter(
      s => now - s.startMs < SPLASH_DURATION_MS
    )

    const g = this.graphics
    g.clear()

    const samples = Math.max(2, Math.floor(this.widthPx / SAMPLE_STEP_PX))
    const points: number[] = []
    for (let i = 0; i <= samples; i++) {
      const x = (i / samples) * this.widthPx
      // 常駐 sin 波。
      let y =
        Math.sin(tSec * BASE_TIME_FREQ + i * BASE_SPATIAL_FREQ) *
        BASE_AMPLITUDE_PX

      // 各 splash の影響を加算 (距離 & 時間で減衰する sin 波)。
      for (const s of this.splashes) {
        const age = (now - s.startMs) / SPLASH_DURATION_MS // 0..1
        const dist = Math.abs(x - s.x)
        const wave = Math.sin((dist / 8 - age * 4) * Math.PI)
        const envelope =
          Math.exp(-dist / SPLASH_DECAY_PX) * Math.max(0, 1 - age) * s.intensity
        y += wave * envelope * SPLASH_AMPLITUDE_PX
      }
      points.push(x, y)
    }

    // ポリラインで描画 (Pixi v8: moveTo + lineTo の連結を stroke で確定)。
    g.moveTo(points[0], points[1])
    for (let i = 2; i < points.length; i += 2) {
      g.lineTo(points[i], points[i + 1])
    }
    g.stroke({
      color: UI_SECONDARY,
      alpha: LINE_ALPHA,
      width: LINE_WIDTH_PX,
    })
  }
}
