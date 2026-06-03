/**
 * PlayerBoard のお邪魔ブロック授受テスト (Issue #54 / レビュー指摘 S12)。
 *
 * 対象 (S7 で RNG を constructor DI 済み):
 * - `garbageReceived(count)`: 上から null セルに 1..6 のブロックを最大 count 個詰める。
 *   - status が playing 以外 / 連鎖中 / count<=0 では何もしない。
 *   - 空きが足りなければ詰められるだけで打ち切る。
 *   - 値は `floor(rng() * 6) + 1` で決まる (rng DI で決定論化)。
 * - `consumePendingGarbage()`: 保留量を返し 0 にリセットする。
 *
 * jsdom 環境。PIXI.Container/Text は canvas 無しでも構築できる。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { PlayerBoard } from './PlayerBoard'
import {
  createInitialGameState,
  type BlockValue,
  type GameState,
} from '../types/GameState'

function freshState(): GameState {
  return createInitialGameState()
}

/** private pendingGarbageOut を直接読み書きする補助。 */
function getPending(pb: PlayerBoard): number {
  return (pb as unknown as { pendingGarbageOut: number }).pendingGarbageOut
}
function setPending(pb: PlayerBoard, n: number): void {
  ;(pb as unknown as { pendingGarbageOut: number }).pendingGarbageOut = n
}
/** private isChaining を立てる補助 (連鎖中ガードの検証用)。 */
function setChaining(pb: PlayerBoard, v: boolean): void {
  ;(pb as unknown as { isChaining: boolean }).isChaining = v
}

describe('PlayerBoard.garbageReceived (S7 RNG DI)', () => {
  let pb: PlayerBoard | null = null
  afterEach(() => {
    if (pb && !pb.destroyed) pb.destroy()
    pb = null
  })

  it('空盤面に count 個を上から詰める。値は rng で決まる', () => {
    // rng=0 → floor(0*6)+1 = 1。
    pb = new PlayerBoard({}, null, { rng: () => 0 })
    pb.initWithState(freshState())
    pb.garbageReceived(3)

    const board = pb.getState()!.board
    // cols=5。上段から左→右の順で詰まる: (0,0),(0,1),(0,2)。
    expect(board[0][0]).toBe(1)
    expect(board[0][1]).toBe(1)
    expect(board[0][2]).toBe(1)
    expect(board[0][3]).toBeNull()
    // 合計 3 個だけ。
    expect(board.flat().filter(c => c !== null).length).toBe(3)
  })

  it('rng の値で詰めるブロック値が変わる (1..6 にマップ)', () => {
    // rng を順に返すスタブ。floor(v*6)+1 を確認。
    const seq = [0, 0.99, 0.5, 0.16, 0.34, 0.83]
    let i = 0
    pb = new PlayerBoard({}, null, { rng: () => seq[i++ % seq.length] })
    pb.initWithState(freshState())
    pb.garbageReceived(6)

    const flat = pb
      .getState()!
      .board.flat()
      .filter((c): c is BlockValue => c !== null)
    // floor(0*6)+1=1, floor(0.99*6)+1=6, floor(0.5*6)+1=4,
    // floor(0.16*6)+1=1, floor(0.34*6)+1=3, floor(0.83*6)+1=5
    expect(flat).toEqual([1, 6, 4, 1, 3, 5])
    // お邪魔は 7 にならない (1..6 のみ)。
    expect(flat.every(v => v >= 1 && v <= 6)).toBe(true)
  })

  it('count <= 0 では何もしない', () => {
    pb = new PlayerBoard({}, null, { rng: () => 0 })
    pb.initWithState(freshState())
    pb.garbageReceived(0)
    pb.garbageReceived(-3)
    expect(
      pb
        .getState()!
        .board.flat()
        .every(c => c === null)
    ).toBe(true)
  })

  it('既存ブロックがある盤面では空きセルだけ上から埋める', () => {
    pb = new PlayerBoard({}, null, { rng: () => 0 })
    const state = freshState()
    // (0,0) を埋めておく → garbage は (0,1) から詰まるはず。
    state.board[0][0] = 7
    pb.initWithState(state)
    pb.garbageReceived(2)

    const board = pb.getState()!.board
    expect(board[0][0]).toBe(7) // 既存は不変。
    expect(board[0][1]).toBe(1)
    expect(board[0][2]).toBe(1)
    expect(board[0][3]).toBeNull()
  })

  it('空きが count より少なければ詰められるだけで打ち切る', () => {
    pb = new PlayerBoard({}, null, { rng: () => 0 })
    const state = freshState() // 5 x 10 = 50 セル。
    // 49 セルを埋め、残り 1 セル (最後の (9,4)) だけ空ける。
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        state.board[r][c] = 1
      }
    }
    state.board[state.rows - 1][state.cols - 1] = null
    pb.initWithState(state)

    pb.garbageReceived(10) // 10 要求だが空きは 1 個だけ。
    const board = pb.getState()!.board
    expect(board[state.rows - 1][state.cols - 1]).toBe(1) // 1 個詰まった。
    // 盤面は満杯 (null なし)。
    expect(board.flat().every(c => c !== null)).toBe(true)
  })

  it('status が playing 以外なら捨てる (paused)', () => {
    pb = new PlayerBoard({}, null, { rng: () => 0 })
    const state = freshState()
    state.status = 'paused'
    pb.initWithState(state)
    pb.garbageReceived(3)
    expect(
      pb
        .getState()!
        .board.flat()
        .every(c => c === null)
    ).toBe(true)
  })

  it('連鎖中 (isChaining) なら捨てる', () => {
    pb = new PlayerBoard({}, null, { rng: () => 0 })
    pb.initWithState(freshState())
    setChaining(pb, true)
    pb.garbageReceived(3)
    expect(
      pb
        .getState()!
        .board.flat()
        .every(c => c === null)
    ).toBe(true)
  })

  it('state 未初期化なら no-op (throw しない)', () => {
    pb = new PlayerBoard({}, null, { rng: () => 0 })
    expect(() => pb!.garbageReceived(3)).not.toThrow()
  })
})

describe('PlayerBoard.consumePendingGarbage', () => {
  let pb: PlayerBoard | null = null
  afterEach(() => {
    if (pb && !pb.destroyed) pb.destroy()
    pb = null
  })

  it('保留量を返して 0 にリセットする', () => {
    pb = new PlayerBoard({}, null, { rng: () => 0 })
    pb.initWithState(freshState())
    setPending(pb, 5)
    expect(pb.consumePendingGarbage()).toBe(5)
    // 消費後は 0。
    expect(getPending(pb)).toBe(0)
    expect(pb.consumePendingGarbage()).toBe(0)
  })

  it('初期状態 (保留なし) は 0 を返す', () => {
    pb = new PlayerBoard({}, null, { rng: () => 0 })
    pb.initWithState(freshState())
    expect(pb.consumePendingGarbage()).toBe(0)
  })

  it('initWithState で保留がリセットされる', () => {
    pb = new PlayerBoard({}, null, { rng: () => 0 })
    pb.initWithState(freshState())
    setPending(pb, 7)
    // 再初期化すると pendingGarbageOut=0 に戻る。
    pb.initWithState(freshState())
    expect(pb.consumePendingGarbage()).toBe(0)
  })
})
