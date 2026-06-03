/**
 * BoardEffects のユニットテスト (Issue #57)。
 *
 * 旧 PlayerBoard が直叩きしていた演出発火 (splash / emitBubbles / shake) を
 * 切り出した統括モジュール。意味のあるイベント API が、下位サブシステムを
 * **挙動不変の引数** で呼ぶことを縛る (= リファクタの安全網)。
 *
 * 下位 (WaterSurface / BubbleParticleSystem) は spy で差し替え、座標変換
 * (col → ピクセル) と固定パラメータ (intensity / count / kind) を検証する。
 * CELL_SIZE 依存はテスト内で再計算して期待値を作る (定数変更に追従)。
 */
import { describe, expect, it, vi } from 'vitest'
import { BoardEffects, type ShakeTarget } from './BoardEffects'
import type { BubbleParticleSystem, EmitOptions } from './BubbleParticleSystem'
import type { WaterSurface } from './WaterSurface'
import { CELL_SIZE } from '../../constants/colors'

/** col の中心ピクセル x。 */
function cx(col: number): number {
  return col * CELL_SIZE + CELL_SIZE / 2
}
/** row の中心ピクセル y。 */
function cy(row: number): number {
  return row * CELL_SIZE + CELL_SIZE / 2
}

interface Harness {
  effects: BoardEffects
  splash: ReturnType<typeof vi.fn>
  waterUpdate: ReturnType<typeof vi.fn>
  emitBubbles: ReturnType<typeof vi.fn>
  bubblesUpdate: ReturnType<typeof vi.fn>
  shake: ReturnType<typeof vi.fn>
}

function makeHarness(cols = 5): Harness {
  const splash = vi.fn()
  const waterUpdate = vi.fn()
  const emitBubbles = vi.fn()
  const bubblesUpdate = vi.fn()
  const shake = vi.fn()

  const water = {
    splash,
    update: waterUpdate,
  } as unknown as WaterSurface
  const bubbles = {
    emitBubbles,
    update: bubblesUpdate,
  } as unknown as BubbleParticleSystem
  const shakeTarget: ShakeTarget = { shake }

  const effects = new BoardEffects(water, bubbles, shakeTarget, cols)
  return { effects, splash, waterUpdate, emitBubbles, bubblesUpdate, shake }
}

describe('BoardEffects.onSpawn', () => {
  it('控えめ波紋 (0.7) + spawn 泡 3 個を col 中心 y=0 で発火する', () => {
    const h = makeHarness()
    h.effects.onSpawn(2)

    expect(h.splash).toHaveBeenCalledTimes(1)
    expect(h.splash).toHaveBeenCalledWith(cx(2), 0.7)

    expect(h.emitBubbles).toHaveBeenCalledTimes(1)
    expect(h.emitBubbles).toHaveBeenCalledWith({
      x: cx(2),
      y: 0,
      kind: 'spawn',
      count: 3,
    } satisfies EmitOptions)

    // spawn ではシェイクしない。
    expect(h.shake).not.toHaveBeenCalled()
  })
})

describe('BoardEffects.onLand', () => {
  it('強め波紋 (1.0) + land 泡 4 個 + 着水セルのシェイクを発火する', () => {
    const h = makeHarness()
    h.effects.onLand(7, 3)

    expect(h.splash).toHaveBeenCalledTimes(1)
    expect(h.splash).toHaveBeenCalledWith(cx(3), 1.0)

    expect(h.emitBubbles).toHaveBeenCalledTimes(1)
    expect(h.emitBubbles).toHaveBeenCalledWith({
      x: cx(3),
      y: cy(7),
      kind: 'land',
      count: 4,
    } satisfies EmitOptions)

    expect(h.shake).toHaveBeenCalledTimes(1)
    expect(h.shake).toHaveBeenCalledWith(7, 3)
  })
})

describe('BoardEffects.onClear', () => {
  it('消去セル (key=row*cols+col) ごとに clear 泡 4 個を中心座標で発火する', () => {
    const cols = 5
    const h = makeHarness(cols)
    // (row=1, col=2) → key=7、(row=0, col=4) → key=4。
    const positions = new Set<number>([1 * cols + 2, 0 * cols + 4])
    h.effects.onClear(positions)

    expect(h.emitBubbles).toHaveBeenCalledTimes(2)
    expect(h.emitBubbles).toHaveBeenCalledWith({
      x: cx(2),
      y: cy(1),
      kind: 'clear',
      count: 4,
    } satisfies EmitOptions)
    expect(h.emitBubbles).toHaveBeenCalledWith({
      x: cx(4),
      y: cy(0),
      kind: 'clear',
      count: 4,
    } satisfies EmitOptions)

    // clear では波紋・シェイクは出さない (泡のみ)。
    expect(h.splash).not.toHaveBeenCalled()
    expect(h.shake).not.toHaveBeenCalled()
  })

  it('空 positions では何も発火しない', () => {
    const h = makeHarness()
    h.effects.onClear(new Set())
    expect(h.emitBubbles).not.toHaveBeenCalled()
  })
})

describe('BoardEffects.update', () => {
  it('毎フレーム water.update() と bubbles.update(deltaMS) を呼ぶ', () => {
    const h = makeHarness()
    h.effects.update(16.6)
    expect(h.waterUpdate).toHaveBeenCalledTimes(1)
    expect(h.bubblesUpdate).toHaveBeenCalledTimes(1)
    expect(h.bubblesUpdate).toHaveBeenCalledWith(16.6)
  })
})

describe('BoardEffects.destroy', () => {
  it('所有する water / bubbles を破棄し、shakeTarget は破棄しない', () => {
    const waterDestroy = vi.fn()
    const bubblesDestroy = vi.fn()
    const water = {
      update: vi.fn(),
      splash: vi.fn(),
      destroy: waterDestroy,
    } as unknown as WaterSurface
    const bubbles = {
      update: vi.fn(),
      emitBubbles: vi.fn(),
      destroy: bubblesDestroy,
    } as unknown as BubbleParticleSystem
    const shake = vi.fn()
    // shakeTarget は destroy を持たない (= 所有しない) ことを型レベルで示す。
    const effects = new BoardEffects(water, bubbles, { shake }, 5)

    effects.destroy({ children: true })
    expect(waterDestroy).toHaveBeenCalledTimes(1)
    expect(waterDestroy).toHaveBeenCalledWith({ children: true })
    expect(bubblesDestroy).toHaveBeenCalledTimes(1)
    expect(bubblesDestroy).toHaveBeenCalledWith({ children: true })
  })
})
