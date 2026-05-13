/**
 * ResultScene のユニットテスト (Issue #21)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResultScene, type ResultKind } from './ResultScene'
import { KeyboardManager } from '../input/KeyboardManager'

describe('ResultScene', () => {
  let keyboard: KeyboardManager
  let scene: ResultScene
  let onRestart: ReturnType<typeof vi.fn>
  let onTitle: ReturnType<typeof vi.fn>
  let unsub: () => void

  function build(kind: ResultKind = 'cleared', score?: number): ResultScene {
    onRestart = vi.fn()
    onTitle = vi.fn()
    const s = new ResultScene({ kind, score, onRestart, onTitle })
    return s
  }

  beforeEach(() => {
    keyboard = new KeyboardManager()
    keyboard.attach(window)
    scene = build('cleared', 1200)
    unsub = scene.attachInputs(keyboard)
  })

  afterEach(() => {
    unsub()
    keyboard.detach()
    if (!scene.destroyed) scene.destroy()
  })

  function fire(key: string): void {
    const ev = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(ev)
  }

  it('R で onRestart が呼ばれる', () => {
    fire('R')
    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(onTitle).not.toHaveBeenCalled()
  })

  it('Enter (confirm) で onRestart が呼ばれる', () => {
    fire('Enter')
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('Escape (cancel) で onTitle が呼ばれる', () => {
    fire('Escape')
    expect(onTitle).toHaveBeenCalledTimes(1)
    expect(onRestart).not.toHaveBeenCalled()
  })

  it('未対応キーは何も呼ばれない', () => {
    fire('1')
    fire('a')
    expect(onRestart).not.toHaveBeenCalled()
    expect(onTitle).not.toHaveBeenCalled()
  })

  it('score 省略でもコンストラクタが通る', () => {
    unsub()
    scene.destroy()
    scene = build('gameover')
    unsub = scene.attachInputs(keyboard)
    expect(scene.children.length).toBeGreaterThanOrEqual(1)
  })

  it('全 kind でコンストラクタが通る', () => {
    const kinds: ResultKind[] = ['cleared', 'gameover', 'win', 'lose']
    for (const k of kinds) {
      const s = new ResultScene({
        kind: k,
        score: 0,
        onRestart: () => {},
        onTitle: () => {},
      })
      expect(s.children.length).toBeGreaterThanOrEqual(1)
      s.destroy()
    }
  })

  it('unsubscribe 後はキーが効かない', () => {
    unsub()
    fire('R')
    fire('Escape')
    expect(onRestart).not.toHaveBeenCalled()
    expect(onTitle).not.toHaveBeenCalled()
  })
})
