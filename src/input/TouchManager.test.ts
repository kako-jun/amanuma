/**
 * TouchManager のユニットテスト (Issue #20)。
 *
 * jsdom 環境で PointerEvent を発火させ、タップ位置とスワイプ距離からの
 * コマンド分類を検証する。
 *
 * canvas の `getBoundingClientRect` は jsdom 既定で {x:0,y:0,width:0,height:0}
 * を返すため、テスト用に上書きする。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TouchManager, type TouchCommand } from './TouchManager'

describe('TouchManager', () => {
  let canvas: HTMLCanvasElement
  let manager: TouchManager
  let received: TouchCommand[]

  /** canvas を 400x600 に「見せる」モックの DOMRect を返す。 */
  function mockRect(
    el: HTMLElement,
    width: number = 400,
    height: number = 600
  ): void {
    el.getBoundingClientRect = (): DOMRect =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON() {
          return {}
        },
      }) as DOMRect
  }

  function fire(
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    options: { pointerId?: number; clientX?: number; clientY?: number } = {}
  ): void {
    const ev = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: options.pointerId ?? 1,
      clientX: options.clientX ?? 0,
      clientY: options.clientY ?? 0,
    })
    canvas.dispatchEvent(ev)
  }

  beforeEach(() => {
    canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 600
    document.body.appendChild(canvas)
    mockRect(canvas)
    manager = new TouchManager()
    received = []
    manager.onCommand(cmd => received.push(cmd))
    manager.attach(canvas)
  })

  afterEach(() => {
    manager.detach()
    canvas.remove()
  })

  it('左半分のタップ → left', () => {
    fire('pointerdown', { clientX: 50, clientY: 100 })
    fire('pointerup', { clientX: 50, clientY: 100 })
    expect(received).toEqual(['left'])
  })

  it('右半分のタップ → right', () => {
    fire('pointerdown', { clientX: 300, clientY: 100 })
    fire('pointerup', { clientX: 300, clientY: 100 })
    expect(received).toEqual(['right'])
  })

  it('中央 (= width/2 ちょうど) は右扱い', () => {
    fire('pointerdown', { clientX: 200, clientY: 100 })
    fire('pointerup', { clientX: 200, clientY: 100 })
    expect(received).toEqual(['right'])
  })

  it('下スワイプ (>= 50px、縦支配) → drop', () => {
    fire('pointerdown', { clientX: 100, clientY: 100 })
    fire('pointermove', { clientX: 100, clientY: 200 })
    fire('pointerup', { clientX: 100, clientY: 200 })
    expect(received).toEqual(['drop'])
  })

  it('縦移動 < 50px はタップ扱い', () => {
    fire('pointerdown', { clientX: 50, clientY: 100 })
    fire('pointermove', { clientX: 50, clientY: 140 })
    fire('pointerup', { clientX: 50, clientY: 140 })
    expect(received).toEqual(['left'])
  })

  it('上スワイプはコマンドなし扱いでタップに倒れる', () => {
    fire('pointerdown', { clientX: 50, clientY: 400 })
    fire('pointermove', { clientX: 50, clientY: 100 })
    fire('pointerup', { clientX: 50, clientY: 100 })
    // dy が負なので drop ではない。タップ扱いで left (開始 x=50 が左半分)。
    expect(received).toEqual(['left'])
  })

  it('横優勢のスワイプは drop にならない (タップ扱いで開始位置の左右で判定)', () => {
    // dx=200 > dy=80。dy は 50 以上だが横優勢。
    fire('pointerdown', { clientX: 50, clientY: 100 })
    fire('pointermove', { clientX: 250, clientY: 180 })
    fire('pointerup', { clientX: 250, clientY: 180 })
    // タップ扱い (left)。
    expect(received).toEqual(['left'])
  })

  it('右側で下スワイプ → drop (開始 x によらず drop)', () => {
    fire('pointerdown', { clientX: 350, clientY: 100 })
    fire('pointermove', { clientX: 350, clientY: 250 })
    fire('pointerup', { clientX: 350, clientY: 250 })
    expect(received).toEqual(['drop'])
  })

  it('閾値ちょうど (50px) は drop', () => {
    fire('pointerdown', { clientX: 100, clientY: 100 })
    fire('pointermove', { clientX: 100, clientY: 150 })
    fire('pointerup', { clientX: 100, clientY: 150 })
    expect(received).toEqual(['drop'])
  })

  it('swipeThresholdPx をカスタマイズできる', () => {
    manager.detach()
    const custom = new TouchManager({ swipeThresholdPx: 200 })
    const got: TouchCommand[] = []
    custom.onCommand(cmd => got.push(cmd))
    custom.attach(canvas)
    // 100px 移動では drop にならない (閾値 200)。
    fire('pointerdown', { clientX: 50, clientY: 100 })
    fire('pointermove', { clientX: 50, clientY: 200 })
    fire('pointerup', { clientX: 50, clientY: 200 })
    expect(got).toEqual(['left'])
    custom.detach()
  })

  it('2 本目のポインタは無視 (1 本目の追跡を維持)', () => {
    fire('pointerdown', { pointerId: 1, clientX: 50, clientY: 100 })
    fire('pointerdown', { pointerId: 2, clientX: 350, clientY: 100 })
    // 1 本目の up でコマンドが出る。
    fire('pointerup', { pointerId: 1, clientX: 50, clientY: 100 })
    expect(received).toEqual(['left'])
    // 2 本目の up は無視される (もう active=null)。
    fire('pointerup', { pointerId: 2, clientX: 350, clientY: 100 })
    expect(received).toEqual(['left'])
  })

  it('pointercancel で追跡解除、その後の up は無視', () => {
    fire('pointerdown', { clientX: 50, clientY: 100 })
    fire('pointercancel', { clientX: 50, clientY: 100 })
    fire('pointerup', { clientX: 50, clientY: 100 })
    expect(received).toEqual([])
  })

  it('detach 後はイベントを購読しない', () => {
    manager.detach()
    fire('pointerdown', { clientX: 50, clientY: 100 })
    fire('pointerup', { clientX: 50, clientY: 100 })
    expect(received).toEqual([])
  })

  it('onCommand の戻り値で unsubscribe できる', () => {
    const extra: TouchCommand[] = []
    const unsub = manager.onCommand(cmd => extra.push(cmd))
    fire('pointerdown', { clientX: 50, clientY: 100 })
    fire('pointerup', { clientX: 50, clientY: 100 })
    expect(extra).toEqual(['left'])
    unsub()
    fire('pointerdown', { clientX: 50, clientY: 100 })
    fire('pointerup', { clientX: 50, clientY: 100 })
    expect(extra).toEqual(['left']) // 増えない
  })

  it('attach を 2 回呼んでも重複しない', () => {
    manager.attach(canvas)
    fire('pointerdown', { clientX: 50, clientY: 100 })
    fire('pointerup', { clientX: 50, clientY: 100 })
    expect(received).toEqual(['left'])
  })

  it('handlerCount にハンドラ数が反映される', () => {
    const m = new TouchManager()
    expect(m.handlerCount).toBe(0)
    const unsub = m.onCommand(() => {})
    expect(m.handlerCount).toBe(1)
    unsub()
    expect(m.handlerCount).toBe(0)
  })
})
