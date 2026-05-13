/**
 * BubbleParticleSystem の単体テスト (Issue #17)。
 *
 * PIXI.Graphics 内部の WebGL/Canvas は jsdom では走らないが、
 * 本クラスのライフサイクル管理 (emit / update / 寿命) は
 * Graphics の幾何状態に踏み込まないため、jsdom で十分検証できる。
 */
import { describe, expect, it } from 'vitest'
import { BubbleParticleSystem } from './BubbleParticleSystem'

/** 決定論的 RNG (0..1 の固定列を順番に返す)。 */
function makeRng(values: number[]): () => number {
  let i = 0
  return () => {
    const v = values[i % values.length]
    i++
    return v
  }
}

describe('BubbleParticleSystem', () => {
  it('emitBubbles で指定 count のパーティクルを生成する', () => {
    const sys = new BubbleParticleSystem(makeRng([0.5]))
    expect(sys.activeCount).toBe(0)
    sys.emitBubbles({ x: 100, y: 50, kind: 'land', count: 5 })
    expect(sys.activeCount).toBe(5)
  })

  it('count を省略すると既定値 (=3) で発生する', () => {
    const sys = new BubbleParticleSystem(makeRng([0.5]))
    sys.emitBubbles({ x: 0, y: 0, kind: 'spawn' })
    expect(sys.activeCount).toBe(3)
  })

  it('update(deltaMS) でパーティクルが上方向に移動する', () => {
    // RNG を 0.5 固定にすると vy = -30 + 0.5 * -40 = -50 px/s。
    const sys = new BubbleParticleSystem(makeRng([0.5]))
    sys.emitBubbles({ x: 0, y: 100, kind: 'land', count: 1 })

    // 100ms 後: y = 100 + (-50) * 0.1 = 95
    sys.update(100)
    const bubble = sys.children[0] as { y: number }
    expect(bubble.y).toBeCloseTo(95, 1)
  })

  it('寿命到達したパーティクルは destroy される', () => {
    // 最短寿命 (rng=0 で lifeMs = 1500ms) を選ぶ。
    const sys = new BubbleParticleSystem(makeRng([0]))
    sys.emitBubbles({ x: 0, y: 0, kind: 'spawn', count: 1 })
    expect(sys.activeCount).toBe(1)
    sys.update(1499)
    expect(sys.activeCount).toBe(1)
    sys.update(2)
    expect(sys.activeCount).toBe(0)
  })

  it('deltaMS が 0 または負値の場合は no-op', () => {
    const sys = new BubbleParticleSystem(makeRng([0.5]))
    sys.emitBubbles({ x: 0, y: 0, kind: 'spawn', count: 2 })
    sys.update(0)
    sys.update(-50)
    expect(sys.activeCount).toBe(2)
  })

  it('destroy() でパーティクル配列がクリアされる', () => {
    const sys = new BubbleParticleSystem(makeRng([0.5]))
    sys.emitBubbles({ x: 0, y: 0, kind: 'land', count: 4 })
    expect(sys.activeCount).toBe(4)
    sys.destroy({ children: true })
    expect(sys.activeCount).toBe(0)
  })
})
