/**
 * board.ts のユニットテスト (Issue #18)。
 *
 * 消去判定 (合計 = 7、7+7+7 のみ消える)、重力、着地計算、消去実行を検証する。
 */
import { describe, expect, it } from 'vitest'
import type { BlockValue, BoardCell, GameState } from '../types/GameState'
import {
  applyGravity,
  clearCells,
  countSevens,
  findClearablePositions,
  findLandingRow,
  lockFallingBlock,
} from './board'

/** 文字列ボードから GameState を作る。 `.` = null、`1`〜`7` = ブロック。 */
function makeState(
  rows: string[],
  options?: { fallingBlock?: GameState['fallingBlock'] }
): GameState {
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
    fallingBlock: options?.fallingBlock ?? null,
    nextBlock: 1,
    score: 0,
    chainCount: 0,
    status: 'playing',
  }
}

/** Set<number> を `{row, col}[]` に変換 (アサート用)。 */
function decodePositions(
  positions: Set<number>,
  cols: number
): { row: number; col: number }[] {
  return [...positions]
    .map(key => ({ row: Math.floor(key / cols), col: key % cols }))
    .sort((a, b) => a.row - b.row || a.col - b.col)
}

describe('findClearablePositions', () => {
  it('横の 3+4 = 7 を消す', () => {
    const state = makeState(['.....', '.....', '.34..'])
    const positions = decodePositions(findClearablePositions(state), state.cols)
    expect(positions).toEqual([
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ])
  })

  it('横の 2+5 = 7 を消す', () => {
    const state = makeState(['.....', '25...'])
    const positions = decodePositions(findClearablePositions(state), state.cols)
    expect(positions).toEqual([
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ])
  })

  it('横の 1+2+4 = 7 を消す', () => {
    const state = makeState(['.....', '.124.'])
    const positions = decodePositions(findClearablePositions(state), state.cols)
    expect(positions).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
    ])
  })

  it('縦の 3+4 = 7 を消す', () => {
    const state = makeState(['..3..', '..4..', '.....'])
    const positions = decodePositions(findClearablePositions(state), state.cols)
    expect(positions).toEqual([
      { row: 0, col: 2 },
      { row: 1, col: 2 },
    ])
  })

  it('1 が 7 個並んだら消える', () => {
    const state = makeState(['1111111'])
    const positions = decodePositions(findClearablePositions(state), state.cols)
    expect(positions).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
      { row: 0, col: 5 },
      { row: 0, col: 6 },
    ])
  })

  it('7+7 は消えない', () => {
    const state = makeState(['.77..'])
    const positions = findClearablePositions(state)
    expect(positions.size).toBe(0)
  })

  it('7+7+7 は消える', () => {
    const state = makeState(['.777.'])
    const positions = decodePositions(findClearablePositions(state), state.cols)
    expect(positions).toEqual([
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ])
  })

  it('単独の 7 は消えない (特別ルールが優先)', () => {
    const state = makeState(['..7..'])
    const positions = findClearablePositions(state)
    expect(positions.size).toBe(0)
  })

  it('縦の 7+7+7 も消える', () => {
    const state = makeState(['..7..', '..7..', '..7..'])
    const positions = decodePositions(findClearablePositions(state), state.cols)
    expect(positions).toEqual([
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
    ])
  })

  it('縦横同時で消えるセルは 1 つに統合される', () => {
    // 中央セル (1,2) = 3 が縦 (3+4) と横 (3+4) の両方に属する。
    // 縦: (0,2)=3, (1,2)=4 → 横ルールで 3+4 はマッチしない (上 3 段は別行)。
    // ここでは横 (1,1)=3, (1,2)=4 と縦 (1,2)=4, (2,2)=3 が両方マッチする盤面にする。
    const state = makeState(['.....', '.34..', '..3..', '..4..'])
    const positions = decodePositions(findClearablePositions(state), state.cols)
    // 横 (1,1)+(1,2) と縦 (1,2)+(2,2) は 4+3 = 7 だけど (2,2)+(3,2) = 7 が
    // 縦のマッチ。整理して期待値:
    // - 横: (1,1)=3, (1,2)=4 → match
    // - 縦 (col=2): 3, 4, 3, 4 → 部分列 (3,4) = 7 が複数。
    //   (0,2)+(1,2) はないので skip (0,2 は null)。
    //   実際は (1,2)..(3,2) = [4,3,4]
    //   - [4] = 4 ×
    //   - [4,3] = 7 → (1,2),(2,2) を追加
    //   - [4,3,4] = 11 break
    //   - [3] = 3 ×
    //   - [3,4] = 7 → (2,2),(3,2) を追加
    //   - [4] = 4 ×
    expect(positions).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 3, col: 2 },
    ])
  })

  it('null セルを跨いでは合計しない', () => {
    const state = makeState(['3.4..'])
    const positions = findClearablePositions(state)
    expect(positions.size).toBe(0)
  })

  it('合計 = 7 の部分列が複数あれば全部追加', () => {
    // 行: 1 2 4 . 1 2 4 → 左の [1,2,4] と右の [1,2,4] が両方マッチ。
    const state = makeState(['124.124'])
    const positions = decodePositions(findClearablePositions(state), state.cols)
    expect(positions).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 4 },
      { row: 0, col: 5 },
      { row: 0, col: 6 },
    ])
  })
})

describe('applyGravity', () => {
  it('空セルの上にあるブロックが下に詰まる', () => {
    const state = makeState(['..1..', '.....', '..2..', '.....'])
    const moved = applyGravity(state)
    expect(moved).toBe(true)
    expect(state.board[3][2]).toBe(2)
    expect(state.board[2][2]).toBe(1)
    expect(state.board[1][2]).toBeNull()
    expect(state.board[0][2]).toBeNull()
  })

  it('何も動かないなら false', () => {
    const state = makeState(['.....', '.....', '.....', '..1..'])
    const moved = applyGravity(state)
    expect(moved).toBe(false)
    expect(state.board[3][2]).toBe(1)
  })

  it('複数列を独立して詰める', () => {
    const state = makeState(['1.2', '...', '..3'])
    const moved = applyGravity(state)
    expect(moved).toBe(true)
    expect(state.board[2][0]).toBe(1)
    expect(state.board[2][1]).toBeNull()
    expect(state.board[2][2]).toBe(3)
    expect(state.board[1][2]).toBe(2)
  })
})

describe('findLandingRow', () => {
  it('列にブロックが無ければ最下段', () => {
    const state = makeState(['.....', '.....', '.....'], {
      fallingBlock: { value: 1, col: 2, row: 0.5, velocity: 0 },
    })
    expect(findLandingRow(state)).toBe(2)
  })

  it('直下のブロックの 1 つ上に着地', () => {
    const state = makeState(['.....', '.....', '..2..'], {
      fallingBlock: { value: 1, col: 2, row: 0.5, velocity: 0 },
    })
    expect(findLandingRow(state)).toBe(1)
  })

  it('列が満杯なら 0 を返す (gameover 判定は別所)', () => {
    const state = makeState(['..2..', '..3..', '..4..'], {
      fallingBlock: { value: 1, col: 2, row: 0, velocity: 0 },
    })
    expect(findLandingRow(state)).toBe(0)
  })

  it('fallingBlock が null なら null', () => {
    const state = makeState(['.....'])
    expect(findLandingRow(state)).toBeNull()
  })
})

describe('lockFallingBlock', () => {
  it('fallingBlock を board に書き込み null にする', () => {
    const state = makeState(['.....', '.....', '.....'], {
      fallingBlock: { value: 3, col: 2, row: 1.6, velocity: 0 },
    })
    lockFallingBlock(state)
    expect(state.fallingBlock).toBeNull()
    expect(state.board[2][2]).toBe(3) // Math.round(1.6) = 2
  })

  it('範囲外なら no-op', () => {
    const state = makeState(['.....'], {
      fallingBlock: { value: 3, col: 99, row: 0, velocity: 0 },
    })
    lockFallingBlock(state)
    expect(state.fallingBlock).not.toBeNull()
  })
})

describe('clearCells', () => {
  it('指定セルを null にして数を返す', () => {
    const state = makeState(['.34..', '.....'])
    const positions = new Set<number>()
    positions.add(0 * state.cols + 1) // (0,1)
    positions.add(0 * state.cols + 2) // (0,2)
    const cleared = clearCells(state, positions)
    expect(cleared).toBe(2)
    expect(state.board[0][1]).toBeNull()
    expect(state.board[0][2]).toBeNull()
  })

  it('既に null のセルはカウントしない', () => {
    const state = makeState(['.....'])
    const positions = new Set([0])
    expect(clearCells(state, positions)).toBe(0)
  })
})

describe('countSevens', () => {
  it('盤面上の 7 を数える', () => {
    const state = makeState(['..7..', '7.7..', '.....'])
    expect(countSevens(state)).toBe(3)
  })

  it('7 がなければ 0', () => {
    const state = makeState(['123', '456'])
    expect(countSevens(state)).toBe(0)
  })
})
