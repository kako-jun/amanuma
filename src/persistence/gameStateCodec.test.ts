/**
 * gameStateCodec のユニットテスト (純粋コア、Issue #56)。
 *
 * Node 環境で実行する (DOM / localStorage / window に一切依存しない)。
 * 観点:
 * - serialize → deserialize の往復同一性 (各種盤面 / 浮動小数 / status / 最小盤)
 * - 出力の URL セーフ性
 * - 異常系エンベロープ → null
 * - 異常系 GameState 本体 (境界値) → null
 * - fallingBlock サブ分岐 (境界 -1 / 境界 / +1)
 * - score / chainCount / status の検証
 * - 冪等・純粋 (入力を破壊しない)
 */
import { describe, expect, it } from 'vitest'
import type { BoardCell, GameState } from '../types/GameState'
import {
  GAME_STATE_FORMAT_VERSION,
  serializeGameState,
  deserializeGameState,
} from './gameStateCodec'

/** 全セル null の rows×cols 盤面。 */
function emptyBoard(rows: number, cols: number): BoardCell[][] {
  const board: BoardCell[][] = []
  for (let r = 0; r < rows; r++) {
    const row: BoardCell[] = []
    for (let c = 0; c < cols; c++) row.push(null)
    board.push(row)
  }
  return board
}

/** テスト用の妥当な GameState を組み立てる (上書きを部分適用)。 */
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    cols: 3,
    rows: 4,
    board: emptyBoard(4, 3),
    fallingBlock: null,
    nextBlock: 1,
    score: 0,
    chainCount: 0,
    status: 'playing',
    ...overrides,
  }
}

/**
 * 妥当な GameState を一度シリアライズして得た文字列の中身を改竄するためのヘルパ。
 * deserialize が「エンベロープ」「本体」のどの分岐で弾くかを直接突くために、
 * `{ v, state }` の生 JSON を encodeURIComponent して返す。
 */
function encodeRaw(envelope: unknown): string {
  return encodeURIComponent(JSON.stringify(envelope))
}

describe('gameStateCodec', () => {
  describe('往復同一性 (round-trip)', () => {
    it('空 board + fallingBlock=null + playing を往復復元する', () => {
      const state = makeState()
      const restored = deserializeGameState(serializeGameState(state))
      expect(restored).toEqual(state)
    })

    it('全セルを 1〜7 で埋めた盤面を往復復元する', () => {
      const board: BoardCell[][] = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 1, 2],
        [3, 4, 5],
      ]
      const state = makeState({ board, nextBlock: 7 })
      const restored = deserializeGameState(serializeGameState(state))
      expect(restored).toEqual(state)
    })

    it('fallingBlock.row が浮動小数 (3.456) でも往復復元する', () => {
      const state = makeState({
        rows: 5,
        board: emptyBoard(5, 3),
        fallingBlock: { value: 2, col: 1, row: 3.456, velocity: 0 },
      })
      const restored = deserializeGameState(serializeGameState(state))
      expect(restored).toEqual(state)
      expect(restored?.fallingBlock?.row).toBeCloseTo(3.456)
    })

    it('fallingBlock.velocity が負小数 (-1.5) でも往復復元する', () => {
      const state = makeState({
        fallingBlock: { value: 4, col: 0, row: 1, velocity: -1.5 },
      })
      const restored = deserializeGameState(serializeGameState(state))
      expect(restored).toEqual(state)
    })

    it('status=paused を往復復元する', () => {
      const state = makeState({ status: 'paused' })
      expect(deserializeGameState(serializeGameState(state))).toEqual(state)
    })

    it('status=cleared を往復復元する', () => {
      const state = makeState({ status: 'cleared' })
      expect(deserializeGameState(serializeGameState(state))).toEqual(state)
    })

    it('status=gameover を往復復元する', () => {
      const state = makeState({ status: 'gameover' })
      expect(deserializeGameState(serializeGameState(state))).toEqual(state)
    })

    it('score 大値 + chainCount>0 を往復復元する', () => {
      const state = makeState({ score: 9_999_999, chainCount: 12 })
      expect(deserializeGameState(serializeGameState(state))).toEqual(state)
    })

    it('最小盤 (cols=1, rows=1) を往復復元する', () => {
      const state = makeState({ cols: 1, rows: 1, board: [[5]] })
      expect(deserializeGameState(serializeGameState(state))).toEqual(state)
    })

    it('往復結果は入力と参照を共有しない (別オブジェクト)', () => {
      const state = makeState({
        board: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 1, 2],
          [3, 4, 5],
        ],
        fallingBlock: { value: 1, col: 0, row: 0, velocity: 0 },
      })
      const restored = deserializeGameState(serializeGameState(state))
      expect(restored).not.toBe(state)
      expect(restored?.board).not.toBe(state.board)
      expect(restored?.board[0]).not.toBe(state.board[0])
      expect(restored?.fallingBlock).not.toBe(state.fallingBlock)
    })
  })

  describe('URL セーフ性', () => {
    it('出力に生の { } " および空白を含まない', () => {
      const out = serializeGameState(makeState({ status: 'paused' }))
      expect(out).not.toMatch(/[{}"\s]/)
    })

    it('?state= に連結 → URLSearchParams で抜き戻して deserialize が一致する', () => {
      const state = makeState({ score: 42, nextBlock: 3 })
      const encoded = serializeGameState(state)
      const params = new URLSearchParams(`?state=${encoded}`)
      const back = params.get('state')
      expect(back).not.toBeNull()
      expect(deserializeGameState(back as string)).toEqual(state)
    })

    it('出力は decodeURIComponent 可能 (例外を投げない)', () => {
      const out = serializeGameState(makeState())
      expect(() => decodeURIComponent(out)).not.toThrow()
    })
  })

  describe('異常系エンベロープ → null', () => {
    it('空文字列 → null', () => {
      expect(deserializeGameState('')).toBeNull()
    })

    it('非文字列 (null) → null', () => {
      expect(deserializeGameState(null as unknown as string)).toBeNull()
    })

    it('非文字列 (undefined) → null', () => {
      expect(deserializeGameState(undefined as unknown as string)).toBeNull()
    })

    it('非文字列 (数値) → null', () => {
      expect(deserializeGameState(5 as unknown as string)).toBeNull()
    })

    it('壊れた JSON → null', () => {
      expect(deserializeGameState(encodeURIComponent('{not json'))).toBeNull()
    })

    it('不正な % エスケープ (decode 失敗) → null', () => {
      // '%E0%A4%A' は不正なシーケンス。decode 失敗後の生 parse でも JSON にならず null。
      expect(deserializeGameState('%E0%A4%A')).toBeNull()
    })

    it('encode 前の生 JSON エンベロープも受理する', () => {
      const state = makeState({ status: 'paused' })
      const rawJson = JSON.stringify({ v: GAME_STATE_FORMAT_VERSION, state })
      // encodeURIComponent していない生 JSON。decode は通る (記号はそのまま) ので受理される。
      expect(deserializeGameState(rawJson)).toEqual(state)
    })

    it("'null' (JSON の null) → null", () => {
      expect(deserializeGameState(encodeURIComponent('null'))).toBeNull()
    })

    it("プリミティブ '5' → null", () => {
      expect(deserializeGameState(encodeURIComponent('5'))).toBeNull()
    })

    it('env.v=2 (バージョン不一致) → null', () => {
      expect(
        deserializeGameState(encodeRaw({ v: 2, state: makeState() }))
      ).toBeNull()
    })

    it('env.v 欠落 → null', () => {
      expect(deserializeGameState(encodeRaw({ state: makeState() }))).toBeNull()
    })

    it('env.state=null → null', () => {
      expect(
        deserializeGameState(
          encodeRaw({ v: GAME_STATE_FORMAT_VERSION, state: null })
        )
      ).toBeNull()
    })

    it('env.state が非 object (数値) → null', () => {
      expect(
        deserializeGameState(
          encodeRaw({ v: GAME_STATE_FORMAT_VERSION, state: 5 })
        )
      ).toBeNull()
    })

    it('env.state 欠落 → null', () => {
      expect(
        deserializeGameState(encodeRaw({ v: GAME_STATE_FORMAT_VERSION }))
      ).toBeNull()
    })
  })

  describe('異常系 GameState 本体 (境界値) → null', () => {
    /** state を上書きして「壊れた」エンベロープを encode する。 */
    function badState(stateOverride: Record<string, unknown>): string {
      return encodeRaw({
        v: GAME_STATE_FORMAT_VERSION,
        state: { ...makeState(), ...stateOverride },
      })
    }

    it('cols=0 → null', () => {
      expect(deserializeGameState(badState({ cols: 0 }))).toBeNull()
    })

    it('cols=-1 → null', () => {
      expect(deserializeGameState(badState({ cols: -1 }))).toBeNull()
    })

    it('cols=1.5 (非整数) → null', () => {
      expect(deserializeGameState(badState({ cols: 1.5 }))).toBeNull()
    })

    it('cols 欠落 → null', () => {
      const env = encodeRaw({
        v: GAME_STATE_FORMAT_VERSION,
        state: {
          rows: 4,
          board: emptyBoard(4, 3),
          fallingBlock: null,
          nextBlock: 1,
          score: 0,
          chainCount: 0,
          status: 'playing',
        },
      })
      expect(deserializeGameState(env)).toBeNull()
    })

    it('rows=0 → null', () => {
      expect(deserializeGameState(badState({ rows: 0 }))).toBeNull()
    })

    it('board が非配列 → null', () => {
      expect(deserializeGameState(badState({ board: 'nope' }))).toBeNull()
    })

    it('board.length=rows+1 → null', () => {
      expect(
        deserializeGameState(badState({ board: emptyBoard(5, 3) }))
      ).toBeNull()
    })

    it('board.length=rows-1 → null', () => {
      expect(
        deserializeGameState(badState({ board: emptyBoard(3, 3) }))
      ).toBeNull()
    })

    it('行が非配列 → null', () => {
      const board: unknown[] = emptyBoard(4, 3)
      board[1] = 'row'
      expect(deserializeGameState(badState({ board }))).toBeNull()
    })

    it('行長=cols+1 → null', () => {
      const board = emptyBoard(4, 3)
      board[2] = [null, null, null, null]
      expect(deserializeGameState(badState({ board }))).toBeNull()
    })

    it('行長=cols-1 → null', () => {
      const board = emptyBoard(4, 3)
      board[2] = [null, null]
      expect(deserializeGameState(badState({ board }))).toBeNull()
    })

    it('セル値=0 → null', () => {
      const board = emptyBoard(4, 3)
      board[0][0] = 0 as unknown as BoardCell
      expect(deserializeGameState(badState({ board }))).toBeNull()
    })

    it('セル値=8 → null', () => {
      const board = emptyBoard(4, 3)
      board[0][0] = 8 as unknown as BoardCell
      expect(deserializeGameState(badState({ board }))).toBeNull()
    })

    it('セル値=2.5 (非整数) → null', () => {
      const board = emptyBoard(4, 3)
      board[0][0] = 2.5 as unknown as BoardCell
      expect(deserializeGameState(badState({ board }))).toBeNull()
    })

    it('セル値="3" (文字列) → null', () => {
      const board = emptyBoard(4, 3)
      board[0][0] = '3' as unknown as BoardCell
      expect(deserializeGameState(badState({ board }))).toBeNull()
    })

    it('セル値 1 と 7 は受理される (境界 OK)', () => {
      const board = emptyBoard(4, 3)
      board[0][0] = 1
      board[3][2] = 7
      const restored = deserializeGameState(badState({ board }))
      expect(restored).not.toBeNull()
      expect(restored?.board[0][0]).toBe(1)
      expect(restored?.board[3][2]).toBe(7)
    })

    it('nextBlock=0 → null', () => {
      expect(deserializeGameState(badState({ nextBlock: 0 }))).toBeNull()
    })

    it('nextBlock=8 → null', () => {
      expect(deserializeGameState(badState({ nextBlock: 8 }))).toBeNull()
    })

    it('nextBlock=null → null', () => {
      expect(deserializeGameState(badState({ nextBlock: null }))).toBeNull()
    })

    it('nextBlock 欠落 → null', () => {
      const env = encodeRaw({
        v: GAME_STATE_FORMAT_VERSION,
        state: {
          cols: 3,
          rows: 4,
          board: emptyBoard(4, 3),
          fallingBlock: null,
          score: 0,
          chainCount: 0,
          status: 'playing',
        },
      })
      expect(deserializeGameState(env)).toBeNull()
    })
  })

  describe('fallingBlock サブ分岐 (境界 -1 / 境界 / +1)', () => {
    function withFalling(fb: unknown): string {
      return encodeRaw({
        v: GAME_STATE_FORMAT_VERSION,
        state: { ...makeState(), fallingBlock: fb },
      })
    }

    it('fallingBlock=null は受理される', () => {
      const restored = deserializeGameState(withFalling(null))
      expect(restored).not.toBeNull()
      expect(restored?.fallingBlock).toBeNull()
    })

    it('fallingBlock が非 object (数値) → null', () => {
      expect(deserializeGameState(withFalling(5))).toBeNull()
    })

    it('value=0 → null', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 0, col: 0, row: 0, velocity: 0 })
        )
      ).toBeNull()
    })

    it('value=8 → null', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 8, col: 0, row: 0, velocity: 0 })
        )
      ).toBeNull()
    })

    it('value 欠落 → null', () => {
      expect(
        deserializeGameState(withFalling({ col: 0, row: 0, velocity: 0 }))
      ).toBeNull()
    })

    it('col=-1 → null', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 1, col: -1, row: 0, velocity: 0 })
        )
      ).toBeNull()
    })

    it('col=0 は受理される (下限境界)', () => {
      const restored = deserializeGameState(
        withFalling({ value: 1, col: 0, row: 0, velocity: 0 })
      )
      expect(restored?.fallingBlock?.col).toBe(0)
    })

    it('col=cols-1 は受理される (上限境界)', () => {
      const restored = deserializeGameState(
        withFalling({ value: 1, col: 2, row: 0, velocity: 0 })
      )
      expect(restored?.fallingBlock?.col).toBe(2)
    })

    it('col=cols → null (上限超過)', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 1, col: 3, row: 0, velocity: 0 })
        )
      ).toBeNull()
    })

    it('col=1.5 (非整数) → null', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 1, col: 1.5, row: 0, velocity: 0 })
        )
      ).toBeNull()
    })

    it('row=-0.0001 → null (下限境界未満)', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 1, col: 0, row: -0.0001, velocity: 0 })
        )
      ).toBeNull()
    })

    it('row=0 は受理される (下限境界)', () => {
      const restored = deserializeGameState(
        withFalling({ value: 1, col: 0, row: 0, velocity: 0 })
      )
      expect(restored?.fallingBlock?.row).toBe(0)
    })

    it('row=rows-0.0001 は受理される (上限境界内)', () => {
      const restored = deserializeGameState(
        withFalling({ value: 1, col: 0, row: 3.9999, velocity: 0 })
      )
      expect(restored?.fallingBlock?.row).toBeCloseTo(3.9999)
    })

    it('row=rows → null (上限境界)', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 1, col: 0, row: 4, velocity: 0 })
        )
      ).toBeNull()
    })

    it('row=NaN → null', () => {
      // NaN は JSON.stringify で null になるため、生エンベロープを直接渡す。
      expect(
        deserializeGameState(
          withFalling({ value: 1, col: 0, row: NaN, velocity: 0 })
        )
      ).toBeNull()
    })

    it('row=Infinity → null', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 1, col: 0, row: Infinity, velocity: 0 })
        )
      ).toBeNull()
    })

    it('row=文字列 → null', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 1, col: 0, row: '2', velocity: 0 })
        )
      ).toBeNull()
    })

    it('velocity=NaN → null', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 1, col: 0, row: 0, velocity: NaN })
        )
      ).toBeNull()
    })

    it('velocity=Infinity → null', () => {
      expect(
        deserializeGameState(
          withFalling({ value: 1, col: 0, row: 0, velocity: Infinity })
        )
      ).toBeNull()
    })

    it('velocity=-2.5 は受理される (過剰検証していないこと)', () => {
      const restored = deserializeGameState(
        withFalling({ value: 1, col: 0, row: 0, velocity: -2.5 })
      )
      expect(restored?.fallingBlock?.velocity).toBeCloseTo(-2.5)
    })

    it('velocity 欠落 → null', () => {
      expect(
        deserializeGameState(withFalling({ value: 1, col: 0, row: 0 }))
      ).toBeNull()
    })
  })

  describe('score / chainCount / status の検証', () => {
    function badState(stateOverride: Record<string, unknown>): string {
      return encodeRaw({
        v: GAME_STATE_FORMAT_VERSION,
        state: { ...makeState(), ...stateOverride },
      })
    }

    it('score=-1 → null', () => {
      expect(deserializeGameState(badState({ score: -1 }))).toBeNull()
    })

    it('score=0 は受理される', () => {
      expect(deserializeGameState(badState({ score: 0 }))).not.toBeNull()
    })

    it('score=NaN → null', () => {
      expect(deserializeGameState(badState({ score: NaN }))).toBeNull()
    })

    it('score=文字列 → null', () => {
      expect(deserializeGameState(badState({ score: '10' }))).toBeNull()
    })

    it('chainCount=-1 → null', () => {
      expect(deserializeGameState(badState({ chainCount: -1 }))).toBeNull()
    })

    it('chainCount=0 は受理される', () => {
      expect(deserializeGameState(badState({ chainCount: 0 }))).not.toBeNull()
    })

    it('chainCount=Infinity → null', () => {
      expect(
        deserializeGameState(badState({ chainCount: Infinity }))
      ).toBeNull()
    })

    it("status='unknown' → null", () => {
      expect(deserializeGameState(badState({ status: 'unknown' }))).toBeNull()
    })

    it("status='' → null", () => {
      expect(deserializeGameState(badState({ status: '' }))).toBeNull()
    })

    it('status=数値 → null', () => {
      expect(deserializeGameState(badState({ status: 1 }))).toBeNull()
    })

    it('status 欠落 → null', () => {
      const env = encodeRaw({
        v: GAME_STATE_FORMAT_VERSION,
        state: {
          cols: 3,
          rows: 4,
          board: emptyBoard(4, 3),
          fallingBlock: null,
          nextBlock: 1,
          score: 0,
          chainCount: 0,
        },
      })
      expect(deserializeGameState(env)).toBeNull()
    })
  })

  describe('冪等・純粋', () => {
    it('同一 state を 2 回 serialize すると文字列が一致する', () => {
      const state = makeState({
        board: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 1, 2],
          [3, 4, 5],
        ],
        fallingBlock: { value: 2, col: 1, row: 1.25, velocity: -0.5 },
        score: 100,
        chainCount: 3,
        status: 'paused',
      })
      expect(serializeGameState(state)).toBe(serializeGameState(state))
    })

    it('serialize は入力オブジェクトを変更しない', () => {
      const state = makeState({
        board: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 1, 2],
          [3, 4, 5],
        ],
        fallingBlock: { value: 2, col: 1, row: 1.25, velocity: -0.5 },
      })
      const snapshot = JSON.parse(JSON.stringify(state))
      serializeGameState(state)
      expect(state).toEqual(snapshot)
    })
  })
})
