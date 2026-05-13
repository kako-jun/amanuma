/**
 * KeyboardManager のユニットテスト (Issue #20)。
 *
 * jsdom 環境で KeyboardEvent を発火させ、コマンド変換とハンドラ通知を検証する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KeyboardManager, type KeyboardCommand } from './KeyboardManager'

describe('KeyboardManager', () => {
  let manager: KeyboardManager
  let received: KeyboardCommand[]

  beforeEach(() => {
    manager = new KeyboardManager()
    received = []
    manager.onCommand(cmd => received.push(cmd))
    manager.attach(window)
  })

  afterEach(() => {
    manager.detach()
  })

  function fire(key: string): KeyboardEvent {
    const ev = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(ev)
    return ev
  }

  it('ArrowLeft → left', () => {
    fire('ArrowLeft')
    expect(received).toEqual(['left'])
  })

  it('ArrowRight → right', () => {
    fire('ArrowRight')
    expect(received).toEqual(['right'])
  })

  it('ArrowDown → drop', () => {
    fire('ArrowDown')
    expect(received).toEqual(['drop'])
  })

  it('p / P → togglePause', () => {
    fire('p')
    fire('P')
    expect(received).toEqual(['togglePause', 'togglePause'])
  })

  it('r / R → restart', () => {
    fire('r')
    fire('R')
    expect(received).toEqual(['restart', 'restart'])
  })

  it('未対応キーは通知されない', () => {
    fire('a')
    fire('Enter')
    fire('Escape')
    expect(received).toEqual([])
  })

  it('対応キーは preventDefault される', () => {
    const ev = fire('ArrowLeft')
    expect(ev.defaultPrevented).toBe(true)
  })

  it('未対応キーは preventDefault されない', () => {
    const ev = fire('a')
    expect(ev.defaultPrevented).toBe(false)
  })

  it('detach 後はハンドラに通知されない', () => {
    manager.detach()
    fire('ArrowLeft')
    expect(received).toEqual([])
  })

  it('onCommand の戻り値で unsubscribe できる', () => {
    const extra: KeyboardCommand[] = []
    const unsub = manager.onCommand(cmd => extra.push(cmd))
    fire('ArrowLeft')
    expect(extra).toEqual(['left'])
    unsub()
    fire('ArrowLeft')
    expect(extra).toEqual(['left']) // 増えない
    // ベースのハンドラは引き続き動く。
    expect(received).toEqual(['left', 'left'])
  })

  it('複数のハンドラ全部に通知される', () => {
    const a: KeyboardCommand[] = []
    const b: KeyboardCommand[] = []
    manager.onCommand(cmd => a.push(cmd))
    manager.onCommand(cmd => b.push(cmd))
    fire('ArrowRight')
    expect(a).toEqual(['right'])
    expect(b).toEqual(['right'])
  })

  it('attach を 2 回呼んでも重複登録されない', () => {
    // 既存 manager は beforeEach で attach 済み。もう一度 attach。
    manager.attach(window)
    fire('ArrowLeft')
    // 同じハンドラへ 1 回だけ通知される。
    expect(received).toEqual(['left'])
  })

  it('detach を未 attach のまま呼んでも例外にならない', () => {
    const m = new KeyboardManager()
    expect(() => m.detach()).not.toThrow()
  })

  it('handlerCount にハンドラ数が反映される', () => {
    const m = new KeyboardManager()
    expect(m.handlerCount).toBe(0)
    const unsub = m.onCommand(() => {})
    expect(m.handlerCount).toBe(1)
    m.onCommand(() => {})
    expect(m.handlerCount).toBe(2)
    unsub()
    expect(m.handlerCount).toBe(1)
  })

  it('vi spy で通知回数を確認できる', () => {
    const spy = vi.fn()
    const m = new KeyboardManager()
    m.onCommand(spy)
    m.attach(window)
    fire('ArrowDown')
    fire('ArrowDown')
    m.detach()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenNthCalledWith(1, 'drop')
  })
})
