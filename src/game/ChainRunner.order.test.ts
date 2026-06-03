/**
 * ChainRunner のステップ順序テスト (Issue #55 / レビュー指摘 S14)。
 *
 * `runChain` は各ステップで
 *   await delay(stepDelayMs) → onClear(positions, level) → clearCells
 *   → (score/chainCount 更新) → await delay(stepDelayMs) → applyGravity
 * の順に進む。stepDelayMs:0 では delay が即解決するため「どのコールバックが
 * どの delay の前後か」を縛れず、順序検証が薄かった (S14)。
 *
 * 本テストは vitest のフェイクタイマーで `setTimeout` を止め、
 * `advanceTimersByTimeAsync` で 1 ステップずつ手送りしながら、各イベント
 * (delay 解決 / onClear / clear 反映 / gravity 反映) の発火順序を
 * イベントログに記録して deterministic に検証する。
 *
 * runChain は内部 delay を `setTimeout` で実装しているため (opts.delay の
 * 注入口は無い)、フェイクタイマー化が順序を縛る正攻法になる。
 * プロダクションコードは未変更。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlockValue, BoardCell, GameState } from '../types/GameState'
import { runChain } from './ChainRunner'

function makeState(rows: string[]): GameState {
  const cols = rows[0]?.length ?? 0
  const board: BoardCell[][] = rows.map(line => {
    const row: BoardCell[] = []
    for (let i = 0; i < cols; i++) {
      const ch = line[i]
      if (ch === '.') row.push(null)
      else row.push(parseInt(ch, 10) as BlockValue)
    }
    return row
  })
  return {
    cols,
    rows: rows.length,
    board,
    fallingBlock: null,
    nextBlock: 1,
    score: 0,
    chainCount: 0,
    status: 'playing',
  }
}

const STEP_MS = 250

describe('runChain ステップ順序 (S14, フェイクタイマー)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('単発消去: delay → onClear → clear反映 → delay → gravity反映 の順', async () => {
    // 横 3+4=7 が 1 回だけ消える。重力で動くものは無い (単発)。
    const state = makeState(['.....', '.....', '.34..'])
    const log: string[] = []

    let cleared = false
    let gravityChecked = false
    const promise = runChain(state, {
      stepDelayMs: STEP_MS,
      onClear: (positions, level) => {
        log.push(`onClear:level=${level}:size=${positions.size}`)
        // onClear 時点では board はまだ消えていない (clear はこの後)。
        expect(state.board[2][1]).toBe(3)
        expect(state.board[2][2]).toBe(4)
      },
    })

    // --- まだ何も進んでいない (最初の await delay でブロック) ---
    // マイクロタスクだけ流しても setTimeout は解決しないので onClear は未発火。
    await Promise.resolve()
    expect(log).toEqual([])

    // --- 1 本目の delay を解決 → onClear 発火 → clearCells 実行 ---
    await vi.advanceTimersByTimeAsync(STEP_MS)
    expect(log).toEqual(['onClear:level=1:size=2'])
    // onClear 後に clearCells が走り board が消えているはず。
    cleared = state.board[2][1] === null && state.board[2][2] === null
    expect(cleared).toBe(true)
    log.push('clearApplied')

    // この時点では 2 本目の delay (gravity 前) でブロック中。gravity はまだ。
    // 単発なので board に動くものは無いが、applyGravity 自体はこの後呼ばれる。

    // --- 2 本目の delay を解決 → applyGravity → 次ループで消去無し → 終了 ---
    await vi.advanceTimersByTimeAsync(STEP_MS)
    gravityChecked = true
    log.push('gravityApplied')

    const result = await promise
    expect(result.chainLevel).toBe(1)
    expect(result.totalClears).toBe(2)
    expect(gravityChecked).toBe(true)

    // 最終的なイベント順序。
    expect(log).toEqual([
      'onClear:level=1:size=2',
      'clearApplied',
      'gravityApplied',
    ])
  })

  it('1 ステップ目の delay 完了前は onClear が発火しない (delay が clear をゲートしている)', async () => {
    const state = makeState(['.....', '.....', '.34..'])
    let onClearCalls = 0
    const promise = runChain(state, {
      stepDelayMs: STEP_MS,
      onClear: () => {
        onClearCalls++
      },
    })

    // delay の半分しか進めない → まだ解決しない → onClear 未発火 & board 不変。
    await vi.advanceTimersByTimeAsync(STEP_MS - 1)
    expect(onClearCalls).toBe(0)
    expect(state.board[2][1]).toBe(3)

    // 残り 1ms で解決 → onClear 発火 → clear。
    await vi.advanceTimersByTimeAsync(1)
    expect(onClearCalls).toBe(1)
    expect(state.board[2][1]).toBeNull()

    // 残りの gravity delay を流して完走。
    await vi.advanceTimersByTimeAsync(STEP_MS)
    await promise
  })

  it('2 連鎖: 各段で onClear → clear → gravity が段順に並ぶ', async () => {
    // 既存 ChainRunner.test.ts の 2 連鎖盤面と同じ。
    // 1 段目: 縦 (0,2)+(1,2)、2 段目: 横 (3,1)+(3,2)。
    const state = makeState(['..3..', '..4..', '..2..', '.5...'])
    const events: string[] = []

    const promise = runChain(state, {
      stepDelayMs: STEP_MS,
      onClear: (_positions, level) => {
        events.push(`onClear#${level}`)
        // 1 段目 onClear の時点では 2 段目の 5 はまだ (3,1) に居る。
        if (level === 1) {
          expect(state.board[0][2]).toBe(3) // まだ消えていない。
          expect(state.board[3][1]).toBe(5)
        }
      },
    })

    // 各 advance で「次の setTimeout 1 本ぶん」を解決していく。
    // 段1: delay(clear前) → onClear#1 → clearCells
    await vi.advanceTimersByTimeAsync(STEP_MS)
    expect(events).toEqual(['onClear#1'])
    expect(state.board[0][2]).toBeNull() // 1 段目 clear 済。
    events.push('clear#1')

    // 段1: delay(gravity前) → applyGravity (5 が (3,1) のまま、2 が (3,2) に落ちて 5+2=7 が成立する盤面に)
    await vi.advanceTimersByTimeAsync(STEP_MS)
    events.push('gravity#1')
    // gravity 後、2 段目の onClear はまだ (次ループの delay 待ち)。
    expect(events).toEqual(['onClear#1', 'clear#1', 'gravity#1'])

    // 段2: delay(clear前) → onClear#2 → clearCells
    await vi.advanceTimersByTimeAsync(STEP_MS)
    expect(events).toEqual(['onClear#1', 'clear#1', 'gravity#1', 'onClear#2'])
    events.push('clear#2')

    // 段2: delay(gravity前) → applyGravity → 次ループ消去無し → 終了
    await vi.advanceTimersByTimeAsync(STEP_MS)
    events.push('gravity#2')

    const result = await promise
    expect(result.chainLevel).toBe(2)
    expect(result.totalClears).toBe(4)
    expect(events).toEqual([
      'onClear#1',
      'clear#1',
      'gravity#1',
      'onClear#2',
      'clear#2',
      'gravity#2',
    ])
  })

  it('消去 0 件: delay も onClear も発火せず即解決する', async () => {
    const state = makeState(['.....', '.1.1.', '..2..'])
    let onClearCalls = 0
    const promise = runChain(state, {
      stepDelayMs: STEP_MS,
      onClear: () => {
        onClearCalls++
      },
    })
    // ループ冒頭で positions.size===0 → break。await delay に到達しない。
    // タイマーを進めなくても解決するはず。
    const result = await promise
    expect(result.chainLevel).toBe(0)
    expect(onClearCalls).toBe(0)
    // 保留中のタイマーが無いこと (delay が一度も張られていない)。
    expect(vi.getTimerCount()).toBe(0)
  })

  it('各消去ステップごとに setTimeout が 2 本 (clear 前 + gravity 前) 張られる', async () => {
    const state = makeState(['.....', '.....', '.34..'])
    const promise = runChain(state, { stepDelayMs: STEP_MS })

    // 1 段目開始直後: clear 前 delay の 1 本が pending。
    await Promise.resolve()
    expect(vi.getTimerCount()).toBe(1)

    // clear 前 delay 解決 → clearCells → gravity 前 delay の 1 本が新たに pending。
    await vi.advanceTimersByTimeAsync(STEP_MS)
    expect(vi.getTimerCount()).toBe(1)

    // gravity 前 delay 解決 → 次ループは消去無し → タイマー無し。
    await vi.advanceTimersByTimeAsync(STEP_MS)
    expect(vi.getTimerCount()).toBe(0)
    await promise
  })
})
