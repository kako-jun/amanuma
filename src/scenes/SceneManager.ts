/**
 * シーン管理 (Issue #21)。
 *
 * 全シーンは 1 枚の巨大「宇宙誌面」コンテナ (`world`) の中に配置される。
 * 各シーンは誌面上の **異なる絶対座標** に置かれ、`navigateTo(key)` で
 * カメラを easeInOut で tween してパン＆ズーム遷移する演出を実現する。
 *
 * 設計メモ:
 * - GSAP のような重い tween ライブラリは再導入しない。`cubicInOut` の自前実装で十分。
 * - `update(deltaMS)` は Ticker から呼ばれる。tween 中でなければ no-op。
 * - 時刻は `deltaMS` の累積で扱い、`now` 依存にはしない (テストで進めやすくするため)。
 * - `viewport*` は Application の canvas サイズ。誌面 → 画面への変換に使う。
 * - 「カメラが向く座標」は誌面ローカル座標。`applyCamera()` で `world.x/y/scale` を計算する。
 */
import { Container } from 'pixi.js'

export interface SceneTransform {
  /** 誌面ローカル座標 (camera が指すべき中心)。 */
  x: number
  y: number
  /** ズーム倍率 (1.0 = 等倍)。 */
  scale: number
}

export type SceneKey = 'title' | 'single' | 'versus' | 'result'

/** デフォルトの tween 持続時間 (ms)。 */
export const DEFAULT_TRANSITION_MS = 1000

/**
 * cubic easeInOut。
 *
 * `t ∈ [0, 1]`。t=0 で 0、t=1 で 1、t=0.5 で 0.5 を通る S 字。
 */
export function cubicInOut(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** 進行中の tween 情報。 */
interface TweenState {
  fromKey: SceneKey
  toKey: SceneKey
  from: SceneTransform
  to: SceneTransform
  elapsedMs: number
  durationMs: number
  resolve: () => void
}

export class SceneManager {
  /** 巨大誌面コンテナ。各シーンの親。 */
  readonly world: Container
  private currentKey: SceneKey = 'title'
  private camera: SceneTransform = { x: 0, y: 0, scale: 1 }
  private tween: TweenState | null = null
  private readonly transforms: Map<SceneKey, SceneTransform> = new Map()

  constructor(
    private readonly viewportWidth: number,
    private readonly viewportHeight: number
  ) {
    this.world = new Container()
    this.applyCamera()
  }

  /** 各シーンの誌面上の絶対位置を登録する。 */
  registerScene(key: SceneKey, transform: SceneTransform): void {
    this.transforms.set(key, { ...transform })
  }

  /**
   * 現在のシーンキー。
   * navigateTo の途中は「行き先」を返す (= 目的地のシーンへ向かっている)。
   */
  get current(): SceneKey {
    return this.currentKey
  }

  /** 現在のカメラ状態 (テスト用にコピーを返す)。 */
  getCamera(): SceneTransform {
    return { ...this.camera }
  }

  /** 進行中の tween があれば true。 */
  get isTweening(): boolean {
    return this.tween !== null
  }

  /**
   * カメラを `key` の位置まで tween で移動する。
   *
   * - 未登録の key なら何もせず即解決する (エラーは throw しない。
   *   呼び出し順 (registerScene → navigateTo) を守れば起きない)。
   * - 進行中の tween があれば「現在のカメラ位置」から新しい目的地へ繋ぎ直す。
   * - duration <= 0 のときは即座にスナップする (テスト用)。
   */
  navigateTo(
    key: SceneKey,
    durationMs: number = DEFAULT_TRANSITION_MS
  ): Promise<void> {
    const target = this.transforms.get(key)
    if (target === undefined) {
      this.currentKey = key
      return Promise.resolve()
    }

    // 即時スナップ。
    if (durationMs <= 0) {
      // 既存 tween があれば中断する (resolve は今の resolve に統合)。
      const oldResolve = this.tween?.resolve
      this.tween = null
      this.camera = { ...target }
      this.currentKey = key
      this.applyCamera()
      oldResolve?.()
      return Promise.resolve()
    }

    // 進行中 tween は中断 (resolve を解放) し、現在地から新しい目的地へ。
    const oldResolve = this.tween?.resolve
    const from = { ...this.camera }

    return new Promise<void>(resolve => {
      this.tween = {
        fromKey: this.currentKey,
        toKey: key,
        from,
        to: { ...target },
        elapsedMs: 0,
        durationMs,
        resolve,
      }
      this.currentKey = key
      oldResolve?.()
    })
  }

  /**
   * Ticker から呼ばれる更新。
   * tween が進行中ならカメラを補間する。
   */
  update(deltaMS: number): void {
    const tween = this.tween
    if (tween === null) return
    tween.elapsedMs += deltaMS
    const t = Math.min(1, tween.elapsedMs / tween.durationMs)
    const eased = cubicInOut(t)
    this.camera = {
      x: lerp(tween.from.x, tween.to.x, eased),
      y: lerp(tween.from.y, tween.to.y, eased),
      scale: lerp(tween.from.scale, tween.to.scale, eased),
    }
    this.applyCamera()
    if (t >= 1) {
      const resolve = tween.resolve
      this.tween = null
      resolve()
    }
  }

  /**
   * 現在のカメラ状態から `world` の x/y/scale を再計算する。
   *
   * カメラ中心 (`camera.x`, `camera.y`) がビューポート中心に来るように
   * `world` を平行移動 + スケールする。
   *
   * ```
   * world.scale = camera.scale
   * world.x = viewportWidth/2 - camera.x * camera.scale
   * world.y = viewportHeight/2 - camera.y * camera.scale
   * ```
   */
  private applyCamera(): void {
    this.world.scale.set(this.camera.scale)
    this.world.x = this.viewportWidth / 2 - this.camera.x * this.camera.scale
    this.world.y = this.viewportHeight / 2 - this.camera.y * this.camera.scale
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
