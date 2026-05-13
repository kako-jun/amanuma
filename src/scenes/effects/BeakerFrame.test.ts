/**
 * BeakerFrame の単体テスト (Issue #31)。
 *
 * Pixi の Graphics 描画は jsdom で完全には走らないが、
 * コンストラクタ・getBackLayer / getFrontLayer の取得・
 * オプションのデフォルト適用・destroy 後の状態は jsdom で検証できる。
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { BeakerFrame } from './BeakerFrame'

describe('BeakerFrame', () => {
  it('boardWidth / boardHeight 指定で生成でき、back / front レイヤーが取得できる', () => {
    const b = new BeakerFrame({ boardWidth: 240, boardHeight: 480 })
    expect(b.getBackLayer()).toBeInstanceOf(Graphics)
    expect(b.getFrontLayer()).toBeInstanceOf(Graphics)
    // back と front は別インスタンス。
    expect(b.getBackLayer()).not.toBe(b.getFrontLayer())
  })

  it('オプション省略時にはデフォルト値が適用される', () => {
    const b = new BeakerFrame({ boardWidth: 240, boardHeight: 480 })
    const opts = b.getOptions()
    expect(opts.wallThickness).toBe(6)
    expect(opts.taperPx).toBe(6)
    expect(opts.lipExtensionPx).toBe(12)
    expect(opts.lipHeightPx).toBe(8)
  })

  it('オプションを明示指定した場合はその値が使われる', () => {
    const b = new BeakerFrame({
      boardWidth: 200,
      boardHeight: 400,
      wallThickness: 10,
      taperPx: 12,
      lipExtensionPx: 20,
      lipHeightPx: 14,
    })
    const opts = b.getOptions()
    expect(opts.boardWidth).toBe(200)
    expect(opts.boardHeight).toBe(400)
    expect(opts.wallThickness).toBe(10)
    expect(opts.taperPx).toBe(12)
    expect(opts.lipExtensionPx).toBe(20)
    expect(opts.lipHeightPx).toBe(14)
  })

  it('destroy 後は back / front の Graphics が destroyed 状態になる', () => {
    const b = new BeakerFrame({ boardWidth: 240, boardHeight: 480 })
    const back = b.getBackLayer()
    const front = b.getFrontLayer()
    expect(back.destroyed).toBe(false)
    expect(front.destroyed).toBe(false)
    b.destroy()
    expect(back.destroyed).toBe(true)
    expect(front.destroyed).toBe(true)
  })

  it('back / front は親に独立して addChild できる (Container 派生だが直接の親子関係を持たない)', () => {
    const b = new BeakerFrame({ boardWidth: 240, boardHeight: 480 })
    // BeakerFrame 自身は単なるホルダで、back / front を内部 child に持たない。
    // 呼び出し側がレイヤー順を制御するためにこの設計を採っている。
    expect(b.children.length).toBe(0)
  })
})
