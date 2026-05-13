/**
 * randomBlocks.ts のテスト (Issue #18)。
 *
 * RNG を差し替えて分布・境界条件を検証する。
 */
import { describe, expect, it } from 'vitest'
import { SEVEN_PROBABILITY, generateBlockValue } from './randomBlocks'

describe('generateBlockValue', () => {
  it('rng = 0 は 7 を返す (7 帯の左端)', () => {
    expect(generateBlockValue(() => 0)).toBe(7)
  })

  it('rng < SEVEN_PROBABILITY は 7 を返す', () => {
    expect(generateBlockValue(() => SEVEN_PROBABILITY - 1e-9)).toBe(7)
  })

  it('rng = SEVEN_PROBABILITY は 1 を返す (7 帯の右端 = 1 帯の左端)', () => {
    expect(generateBlockValue(() => SEVEN_PROBABILITY)).toBe(1)
  })

  it('rng → 1 の極限で 6 を返す', () => {
    expect(generateBlockValue(() => 1 - 1e-12)).toBe(6)
  })

  it('rng = 0.5 は 1〜6 のいずれか (= 7 ではない)', () => {
    const v = generateBlockValue(() => 0.5)
    expect(v).toBeGreaterThanOrEqual(1)
    expect(v).toBeLessThanOrEqual(6)
  })

  it('分布: 100000 試行で 7 の割合が 2% に近い', () => {
    let count = 0
    let sevens = 0
    // mulberry32 ベースの簡易 PRNG (再現性確保)。
    let seed = 0x12345678
    const rng = (): number => {
      seed |= 0
      seed = (seed + 0x6d2b79f5) | 0
      let t = seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    for (let i = 0; i < 100000; i++) {
      const v = generateBlockValue(rng)
      count++
      if (v === 7) sevens++
    }
    const ratio = sevens / count
    // 標準偏差 sqrt(0.02 * 0.98 / 100000) ≈ 0.00044、5σ ≈ 0.0022 の余裕を取る。
    expect(Math.abs(ratio - 0.02)).toBeLessThan(0.003)
  })

  it('分布: 1〜6 がほぼ均等に出る', () => {
    const counts: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    }
    let seed = 0xa5a5a5a5
    const rng = (): number => {
      seed |= 0
      seed = (seed + 0x6d2b79f5) | 0
      let t = seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    let total = 0
    for (let i = 0; i < 60000; i++) {
      const v = generateBlockValue(rng)
      if (v !== 7) {
        counts[v]++
        total++
      }
    }
    const expected = total / 6
    for (const k of [1, 2, 3, 4, 5, 6]) {
      expect(Math.abs(counts[k] - expected) / expected).toBeLessThan(0.05)
    }
  })
})
