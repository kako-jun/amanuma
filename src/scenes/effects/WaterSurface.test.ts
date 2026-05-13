/**
 * WaterSurface の単体テスト (Issue #17)。
 *
 * Pixi の Graphics 描画自体は jsdom で full に動かないが、
 * `splashes` 配列の寿命管理は now ソースの差し替えで十分検証できる。
 */
import { describe, expect, it } from 'vitest'
import { WaterSurface } from './WaterSurface'

/** テスト用に時刻を進める手動クロック。 */
function makeClock(initial: number = 0): {
  now: () => number
  advance: (ms: number) => void
} {
  let t = initial
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
  }
}

describe('WaterSurface', () => {
  it('初期状態では splash 数が 0', () => {
    const clock = makeClock()
    const w = new WaterSurface(240, clock.now)
    expect(w.activeSplashCount).toBe(0)
  })

  it('splash() で splashes 配列に 1 件追加される', () => {
    const clock = makeClock()
    const w = new WaterSurface(240, clock.now)
    w.splash(100, 1.0)
    expect(w.activeSplashCount).toBe(1)
  })

  it('500ms 経過後の update() で splash が消える', () => {
    const clock = makeClock()
    const w = new WaterSurface(240, clock.now)
    w.splash(120, 0.7)
    expect(w.activeSplashCount).toBe(1)

    // 499ms 経過: まだ生存。
    clock.advance(499)
    w.update()
    expect(w.activeSplashCount).toBe(1)

    // 500ms 経過: 消える。
    clock.advance(1)
    w.update()
    expect(w.activeSplashCount).toBe(0)
  })

  it('複数 splash を時間差で発火しても、それぞれの寿命で消える', () => {
    const clock = makeClock()
    const w = new WaterSurface(240, clock.now)
    w.splash(50, 1.0)
    clock.advance(200)
    w.splash(150, 0.5)
    expect(w.activeSplashCount).toBe(2)

    // 1 個目だけ寿命到達 (200 + 300 = 500ms 経過)。
    clock.advance(300)
    w.update()
    expect(w.activeSplashCount).toBe(1)

    // 2 個目も寿命到達 (合計 200 + 300 + 200 = 700ms)。
    clock.advance(200)
    w.update()
    expect(w.activeSplashCount).toBe(0)
  })

  it('intensity の既定値は 1', () => {
    const clock = makeClock()
    const w = new WaterSurface(240, clock.now)
    // 値そのものは内部状態だが、splash() が intensity 指定なしで追加できることを確認。
    w.splash(100)
    expect(w.activeSplashCount).toBe(1)
  })
})
