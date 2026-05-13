/**
 * タッチ / マウス入力マネージャ (Issue #20)。
 *
 * 親 Issue #10 の方針:
 *   - バーチャルパッドは採用しない (kako-jun 明示拒否)
 *   - 画面エリアに意味を持たせる
 *     - 右半分タップ → 'right'
 *     - 左半分タップ → 'left'
 *     - 下スワイプ (>= 50px) → 'drop'
 *
 * PointerEvent (pointerdown / pointermove / pointerup) を購読し、
 * touchstart / mousedown を統一して扱う。
 *
 * 判定アルゴリズム (pointerup 時):
 *   - 縦移動 dy >= swipeThresholdPx かつ |dy| > |dx| → 'drop'
 *   - それ以外 (移動量が小さい or 横優勢) → 開始時の x で左右判定
 *     - x < (canvas.clientWidth / 2) → 'left'
 *     - else → 'right'
 *
 * 注: pointerup を見て判定するため、長押しで指を離した時点で発火する。
 * ドラッグ中の予測発火はしない (誤動作回避)。
 */

export type TouchCommand = 'left' | 'right' | 'drop'

export interface TouchManagerOptions {
  /** 下スワイプ判定の最小縦距離 (px)。既定 50。 */
  swipeThresholdPx?: number
}

interface ActivePointer {
  id: number
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export class TouchManager {
  private readonly handlers: Set<(cmd: TouchCommand) => void> = new Set()
  private canvas: HTMLCanvasElement | null = null
  private active: ActivePointer | null = null
  private readonly swipeThresholdPx: number

  constructor(options: TouchManagerOptions = {}) {
    this.swipeThresholdPx = options.swipeThresholdPx ?? 50
  }

  // ---- ハンドラ群 ----

  private readonly onPointerDown = (event: Event): void => {
    const e = event as PointerEvent
    // 既に追跡中のポインタがあれば 2 本目以降は無視 (ピンチ等を解釈しない)。
    if (this.active !== null) return
    const rect = this.getRect()
    if (rect === null) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    this.active = {
      id: e.pointerId,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    }
    // canvas が pointer capture 対応してれば取得 (テスト環境では未定義の場合がある)。
    if (
      this.canvas !== null &&
      typeof this.canvas.setPointerCapture === 'function'
    ) {
      try {
        this.canvas.setPointerCapture(e.pointerId)
      } catch {
        // capture 不可な環境では無視。
      }
    }
  }

  private readonly onPointerMove = (event: Event): void => {
    const e = event as PointerEvent
    if (this.active === null || this.active.id !== e.pointerId) return
    const rect = this.getRect()
    if (rect === null) return
    this.active.currentX = e.clientX - rect.left
    this.active.currentY = e.clientY - rect.top
  }

  private readonly onPointerUp = (event: Event): void => {
    const e = event as PointerEvent
    const active = this.active
    if (active === null || active.id !== e.pointerId) return
    // capture 解放 (失敗しても気にしない)。
    if (
      this.canvas !== null &&
      typeof this.canvas.releasePointerCapture === 'function'
    ) {
      try {
        this.canvas.releasePointerCapture(e.pointerId)
      } catch {
        // 無視。
      }
    }

    const dx = active.currentX - active.startX
    const dy = active.currentY - active.startY

    this.active = null

    const cmd = this.classifyGesture(active.startX, dx, dy)
    if (cmd === null) return
    for (const h of [...this.handlers]) {
      h(cmd)
    }
  }

  private readonly onPointerCancel = (event: Event): void => {
    const e = event as PointerEvent
    if (this.active !== null && this.active.id === e.pointerId) {
      this.active = null
    }
  }

  // ---- public API ----

  attach(canvas: HTMLCanvasElement): void {
    if (this.canvas !== null) {
      this.detach()
    }
    this.canvas = canvas
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerCancel)
  }

  detach(): void {
    const canvas = this.canvas
    if (canvas === null) return
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerCancel)
    this.canvas = null
    this.active = null
  }

  onCommand(handler: (cmd: TouchCommand) => void): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  /** テスト用フック。 */
  get handlerCount(): number {
    return this.handlers.size
  }

  // ---- private ----

  /**
   * ジェスチャ分類。
   *
   * - 下スワイプ判定: dy >= threshold かつ |dy| > |dx|
   *   (上スワイプはコマンドなし。横優勢ならタップ扱いに倒す。)
   * - それ以外: 開始 x の左右でタップ方向を決める。
   *   - x が左半分 (canvas 幅の半分未満) → 'left'
   *   - 右半分 → 'right'
   *
   * canvas 幅が取れない場合 (rect 未取得) は null を返す。
   */
  private classifyGesture(
    startX: number,
    dx: number,
    dy: number
  ): TouchCommand | null {
    if (dy >= this.swipeThresholdPx && Math.abs(dy) > Math.abs(dx)) {
      return 'drop'
    }
    const rect = this.getRect()
    if (rect === null) return null
    const halfWidth = rect.width / 2
    return startX < halfWidth ? 'left' : 'right'
  }

  /** canvas の表示矩形を取得。canvas 未 attach なら null。 */
  private getRect(): DOMRect | null {
    if (this.canvas === null) return null
    return this.canvas.getBoundingClientRect()
  }
}
