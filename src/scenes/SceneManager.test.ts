/**
 * SceneManager のユニットテスト (Issue #21)。
 *
 * tween の進行は `update(deltaMS)` を手動で呼ぶことで決定論的に検証できる。
 */
import { describe, expect, it } from 'vitest'
import {
  SceneManager,
  cubicInOut,
  DEFAULT_TRANSITION_MS,
  type SceneTransform,
} from './SceneManager'

const VIEW_W = 800
const VIEW_H = 650

describe('cubicInOut', () => {
  it('境界値は 0 / 1', () => {
    expect(cubicInOut(0)).toBe(0)
    expect(cubicInOut(1)).toBe(1)
  })

  it('範囲外は飽和する', () => {
    expect(cubicInOut(-0.5)).toBe(0)
    expect(cubicInOut(1.5)).toBe(1)
  })

  it('中点 0.5 を通る', () => {
    expect(cubicInOut(0.5)).toBeCloseTo(0.5, 5)
  })

  it('単調増加 (区間内)', () => {
    let prev = -Infinity
    for (let i = 0; i <= 10; i++) {
      const v = cubicInOut(i / 10)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('SceneManager', () => {
  function makeSm(): SceneManager {
    const sm = new SceneManager(VIEW_W, VIEW_H)
    sm.registerScene('title', { x: 400, y: 325, scale: 1 })
    sm.registerScene('single', { x: 1500, y: 325, scale: 1 })
    sm.registerScene('versus', { x: 2700, y: 325, scale: 1 })
    sm.registerScene('result', { x: 2000, y: 1200, scale: 1 })
    return sm
  }

  it('初期カメラは (0,0,1)', () => {
    const sm = new SceneManager(VIEW_W, VIEW_H)
    expect(sm.getCamera()).toEqual({ x: 0, y: 0, scale: 1 })
  })

  it('current は初期 title', () => {
    const sm = new SceneManager(VIEW_W, VIEW_H)
    expect(sm.current).toBe('title')
  })

  it('durationMs=0 で navigateTo すると即時スナップ', async () => {
    const sm = makeSm()
    await sm.navigateTo('single', 0)
    expect(sm.getCamera()).toEqual({ x: 1500, y: 325, scale: 1 })
    expect(sm.current).toBe('single')
  })

  it('未登録の key へ navigateTo しても throw しない (即解決)', async () => {
    const sm = new SceneManager(VIEW_W, VIEW_H)
    await sm.navigateTo('single', 100)
    // カメラは動かない (初期 (0,0,1) のまま)。
    expect(sm.getCamera()).toEqual({ x: 0, y: 0, scale: 1 })
  })

  it('tween: 中間で from と to の中点を通る', async () => {
    const sm = makeSm()
    // 起点を title (400, 325) にスナップ。
    await sm.navigateTo('title', 0)
    // title (400, 325) → single (1500, 325)、duration=1000ms。
    const promise = sm.navigateTo('single', 1000)
    expect(sm.isTweening).toBe(true)

    // t=0.5 まで進める。
    sm.update(500)
    const cam = sm.getCamera()
    // cubicInOut(0.5) = 0.5 → x = lerp(400, 1500, 0.5) = 950
    expect(cam.x).toBeCloseTo(950, 5)
    expect(cam.y).toBeCloseTo(325, 5)

    // 完了。
    sm.update(500)
    await promise
    expect(sm.getCamera()).toEqual({ x: 1500, y: 325, scale: 1 })
    expect(sm.isTweening).toBe(false)
    expect(sm.current).toBe('single')
  })

  it('tween 完了で Promise が解決する', async () => {
    const sm = makeSm()
    const p = sm.navigateTo('versus', 200)
    sm.update(200)
    await expect(p).resolves.toBeUndefined()
  })

  it('tween 中に別の navigateTo を呼ぶと現在位置から新しい目的地へ繋がる', async () => {
    const sm = makeSm()
    await sm.navigateTo('title', 0)
    // title (400) → single (1500) の途中。
    void sm.navigateTo('single', 1000)
    sm.update(500) // x = 950 付近
    const mid = sm.getCamera()
    expect(mid.x).toBeCloseTo(950, 5)

    // 途中で versus (2700) に向かう。新しい tween の起点は 950。
    const p2 = sm.navigateTo('versus', 500)
    sm.update(250) // t=0.5、cubic=0.5 → x = lerp(950, 2700, 0.5) = 1825
    expect(sm.getCamera().x).toBeCloseTo(1825, 5)

    sm.update(250)
    await p2
    expect(sm.getCamera()).toEqual({ x: 2700, y: 325, scale: 1 })
    expect(sm.current).toBe('versus')
  })

  it('既定の duration は DEFAULT_TRANSITION_MS', async () => {
    const sm = makeSm()
    const p = sm.navigateTo('single')
    sm.update(DEFAULT_TRANSITION_MS)
    await p
    expect(sm.getCamera().x).toBeCloseTo(1500, 5)
  })

  it('applyCamera: ビューポート中心にカメラ位置が来る', async () => {
    const sm = makeSm()
    await sm.navigateTo('single', 0)
    // single (1500, 325) → world.x = 400 - 1500*1 = -1100
    expect(sm.world.x).toBeCloseTo(VIEW_W / 2 - 1500, 5)
    expect(sm.world.y).toBeCloseTo(VIEW_H / 2 - 325, 5)
    expect(sm.world.scale.x).toBeCloseTo(1, 5)
  })

  it('scale を含む遷移でも補間される', async () => {
    const sm = new SceneManager(VIEW_W, VIEW_H)
    const a: SceneTransform = { x: 0, y: 0, scale: 1 }
    const b: SceneTransform = { x: 100, y: 50, scale: 2 }
    sm.registerScene('title', a)
    sm.registerScene('single', b)
    await sm.navigateTo('title', 0)

    const p = sm.navigateTo('single', 1000)
    sm.update(500)
    const cam = sm.getCamera()
    // cubic(0.5)=0.5
    expect(cam.x).toBeCloseTo(50, 5)
    expect(cam.y).toBeCloseTo(25, 5)
    expect(cam.scale).toBeCloseTo(1.5, 5)
    sm.update(500)
    await p
    expect(sm.getCamera().scale).toBeCloseTo(2, 5)
  })

  it('progress 終端 t>=1 で tween がクリアされる', async () => {
    const sm = makeSm()
    const p = sm.navigateTo('single', 100)
    sm.update(200) // duration を超える
    await p
    expect(sm.isTweening).toBe(false)
  })
})
