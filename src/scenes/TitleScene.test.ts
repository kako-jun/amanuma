/**
 * TitleScene のユニットテスト (Issue #21)。
 *
 * jsdom + KeyboardEvent ベースで「キーボード経由のシーン選択」を検証する。
 * Graphics の描画自体は jsdom では動かないが、コンストラクタ後の構造と
 * `attachInputs` 経由のコールバック発火だけは確認できる。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TitleScene, type TitleAction } from './TitleScene'
import { KeyboardManager } from '../input/KeyboardManager'

describe('TitleScene', () => {
  let keyboard: KeyboardManager
  let scene: TitleScene
  let selected: TitleAction[]
  let unsub: () => void

  beforeEach(() => {
    selected = []
    scene = new TitleScene(action => selected.push(action))
    keyboard = new KeyboardManager()
    keyboard.attach(window)
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

  it('コンストラクタで child が複数追加されている', () => {
    // ロゴ + 副題 + ボタン 3 つ (Graphics + Text 各 1) = 2 + 6 = 8 個。
    // 厳密な内訳は実装詳細なので「3 個以上」までで満足する。
    expect(scene.children.length).toBeGreaterThanOrEqual(3)
  })

  it('1 キーで "single" が選択される', () => {
    fire('1')
    expect(selected).toEqual(['single'])
  })

  it('2 キーで "versus" が選択される', () => {
    fire('2')
    expect(selected).toEqual(['versus'])
  })

  it('Escape で "exit" が選択される', () => {
    fire('Escape')
    expect(selected).toEqual(['exit'])
  })

  it('Enter (confirm) で "single" にフォールバックする', () => {
    fire('Enter')
    expect(selected).toEqual(['single'])
  })

  it('未対応キーは発火しない', () => {
    fire('a')
    fire('3')
    fire('p')
    expect(selected).toEqual([])
  })

  it('attachInputs の戻り値で unsubscribe できる', () => {
    unsub()
    fire('1')
    expect(selected).toEqual([])
  })

  it('複数キー連続 → 複数回コールバック', () => {
    fire('1')
    fire('2')
    fire('Escape')
    expect(selected).toEqual(['single', 'versus', 'exit'])
  })

  it('vi spy で発火順を確認できる', () => {
    unsub()
    const spy = vi.fn<(action: TitleAction) => void>()
    const s2 = new TitleScene(spy)
    const u2 = s2.attachInputs(keyboard)
    fire('1')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('single')
    u2()
    s2.destroy()
  })
})
