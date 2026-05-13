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

  // --------------------------------------------------------------------
  // Issue #19: 'clear' バリアントの特性
  // --------------------------------------------------------------------

  describe("kind: 'clear' (Issue #19)", () => {
    it("'clear' は 'land' / 'spawn' より遅い上昇速度", () => {
      // RNG=0.5 固定で比較する。
      // 'land':  vy = -30 + 0.5 * -40 = -50 px/s
      // 'clear': vy = -25 + 0.5 * -20 = -35 px/s (絶対値が小さい = 遅い)
      const landSys = new BubbleParticleSystem(makeRng([0.5]))
      landSys.emitBubbles({ x: 0, y: 100, kind: 'land', count: 1 })
      landSys.update(1000)
      const landY = (landSys.children[0] as { y: number }).y
      // 100 + (-50) * 1.0 = 50
      expect(landY).toBeCloseTo(50, 0)

      const clearSys = new BubbleParticleSystem(makeRng([0.5]))
      clearSys.emitBubbles({ x: 0, y: 100, kind: 'clear', count: 1 })
      clearSys.update(1000)
      const clearY = (clearSys.children[0] as { y: number }).y
      // 100 + (-35) * 1.0 = 65 → 'land' (=50) より下に残っている = 上昇が遅い
      expect(clearY).toBeCloseTo(65, 0)
      expect(clearY).toBeGreaterThan(landY)
    })

    it("'clear' の上昇速度は -25..-45 px/s の範囲内", () => {
      // rng=0 で vy = vyMin = -25, rng=1 (近似) で vy = -25 + -20 = -45。
      const minSys = new BubbleParticleSystem(makeRng([0]))
      minSys.emitBubbles({ x: 0, y: 100, kind: 'clear', count: 1 })
      minSys.update(1000)
      // y = 100 + (-25) = 75 (最も遅いケース)
      const yMin = (minSys.children[0] as { y: number }).y
      expect(yMin).toBeCloseTo(75, 0)

      // rng=0.999 ≈ 1 で vy ≈ -25 + -20 ≈ -45。
      const maxSys = new BubbleParticleSystem(makeRng([0.999]))
      maxSys.emitBubbles({ x: 0, y: 100, kind: 'clear', count: 1 })
      maxSys.update(1000)
      // y ≈ 100 + (-45) = 55
      const yMax = (maxSys.children[0] as { y: number }).y
      expect(yMax).toBeCloseTo(55, 0)
    })

    it("'clear' は寿命 1500..2500ms でフェードして消える", () => {
      // rng=0 で lifeMs = 1500 (最短)。
      const minSys = new BubbleParticleSystem(makeRng([0]))
      minSys.emitBubbles({ x: 0, y: 0, kind: 'clear', count: 1 })
      minSys.update(1499)
      expect(minSys.activeCount).toBe(1)
      minSys.update(2)
      expect(minSys.activeCount).toBe(0)

      // rng=0.999 で lifeMs ≈ 2499 (最長付近)。
      const maxSys = new BubbleParticleSystem(makeRng([0.999]))
      maxSys.emitBubbles({ x: 0, y: 0, kind: 'clear', count: 1 })
      maxSys.update(1500)
      // まだ生きている (max 寿命なので)。
      expect(maxSys.activeCount).toBe(1)
      maxSys.update(1100)
      expect(maxSys.activeCount).toBe(0)
    })

    it("'clear' の count を指定するとその個数だけ発生する", () => {
      const sys = new BubbleParticleSystem(makeRng([0.5]))
      sys.emitBubbles({ x: 0, y: 0, kind: 'clear', count: 5 })
      expect(sys.activeCount).toBe(5)
    })
  })
})
