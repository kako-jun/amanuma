// @vitest-environment jsdom
/**
 * saveStorage のユニットテスト (不純アダプタ、Issue #56)。
 *
 * jsdom 環境を使う (localStorage / URLSearchParams を実物で動かす)。
 * 観点:
 * - localStorage 単一スロットの save / load / clear 往復
 * - キー名 (`amanuma:save:v1`) が mute キー (`amanuma_muted`) と衝突しない
 * - 例外 (SecurityError / QuotaExceededError) を握りつぶす
 * - readGameStateFromUrl の抽出
 * - toStateQueryParam (二重 encode していないこと)
 *
 * localStorage 例外は SoundManager.test の作法に倣い
 * `vi.spyOn(Storage.prototype, ...)` で throw 注入する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardCell, GameState } from '../types/GameState'
import { serializeGameState } from './gameStateCodec'
import {
  SAVE_STORAGE_KEY,
  STATE_QUERY_PARAM,
  saveGameState,
  loadGameState,
  clearGameState,
  readGameStateFromUrl,
  toStateQueryParam,
} from './saveStorage'

function emptyBoard(rows: number, cols: number): BoardCell[][] {
  const board: BoardCell[][] = []
  for (let r = 0; r < rows; r++) {
    const row: BoardCell[] = []
    for (let c = 0; c < cols; c++) row.push(null)
    board.push(row)
  }
  return board
}

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

describe('saveStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  describe('localStorage 往復', () => {
    it('save → load で deep-equal、save の戻りは true', () => {
      const state = makeState({ score: 50, nextBlock: 4 })
      expect(saveGameState(state)).toBe(true)
      expect(loadGameState()).toEqual(state)
    })

    it('保存キーは amanuma:save:v1 で、mute キー amanuma_muted と衝突しない', () => {
      expect(SAVE_STORAGE_KEY).toBe('amanuma:save:v1')
      saveGameState(makeState())
      expect(localStorage.getItem(SAVE_STORAGE_KEY)).not.toBeNull()
      expect(localStorage.getItem('amanuma_muted')).toBeNull()
    })

    it('空スロットなら load は null', () => {
      expect(loadGameState()).toBeNull()
    })

    it('壊れたスロットを直書きすると load は null', () => {
      localStorage.setItem(SAVE_STORAGE_KEY, 'not-a-valid-payload')
      expect(loadGameState()).toBeNull()
    })

    it('検証 NG のスロットを直書きすると load は null', () => {
      // 妥当なエンベロープだが cols=0 で本体検証に落ちる。
      const badEnvelope = encodeURIComponent(
        JSON.stringify({ v: 1, state: { ...makeState(), cols: 0 } })
      )
      localStorage.setItem(SAVE_STORAGE_KEY, badEnvelope)
      expect(loadGameState()).toBeNull()
    })

    it('clear 後は load が null', () => {
      saveGameState(makeState())
      clearGameState()
      expect(loadGameState()).toBeNull()
    })

    it('save を 2 回すると最後の state が読める (上書き)', () => {
      saveGameState(makeState({ score: 1 }))
      const last = makeState({ score: 999, status: 'paused' })
      saveGameState(last)
      expect(loadGameState()).toEqual(last)
    })
  })

  describe('例外の握りつぶし', () => {
    it('setItem が SecurityError を投げても save は false で例外を伝播しない', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
      expect(saveGameState(makeState())).toBe(false)
    })

    it('getItem が throw しても load は null', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
      expect(loadGameState()).toBeNull()
    })

    it('removeItem が throw しても clear は例外を投げない', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
      expect(() => clearGameState()).not.toThrow()
    })

    it('setItem が QuotaExceededError を投げると save は false', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError')
      })
      expect(saveGameState(makeState())).toBe(false)
    })
  })

  describe('readGameStateFromUrl', () => {
    it('?state=<出力> から抽出して復元する', () => {
      const state = makeState({ score: 7 })
      const search = `?state=${serializeGameState(state)}`
      expect(readGameStateFromUrl(search)).toEqual(state)
    })

    it('周辺 param 込み ?foo=1&state=...&bar=2 でも抽出する', () => {
      const state = makeState({ score: 7, status: 'cleared' })
      const search = `?foo=1&state=${serializeGameState(state)}&bar=2`
      expect(readGameStateFromUrl(search)).toEqual(state)
    })

    it('state param が無ければ null', () => {
      expect(readGameStateFromUrl('?foo=1&bar=2')).toBeNull()
    })

    it('?state= が空なら null', () => {
      expect(readGameStateFromUrl('?state=')).toBeNull()
    })

    it('検証 NG 値なら null', () => {
      const bad = encodeURIComponent(
        JSON.stringify({ v: 1, state: { ...makeState(), rows: 0 } })
      )
      expect(readGameStateFromUrl(`?state=${bad}`)).toBeNull()
    })

    it('先頭 ? の有無どちらでも動く', () => {
      const state = makeState({ score: 11 })
      const encoded = serializeGameState(state)
      expect(readGameStateFromUrl(`?state=${encoded}`)).toEqual(state)
      expect(readGameStateFromUrl(`state=${encoded}`)).toEqual(state)
    })
  })

  describe('toStateQueryParam', () => {
    it('state= プレフィクス付き文字列を返す', () => {
      const out = toStateQueryParam(makeState())
      expect(out.startsWith(`${STATE_QUERY_PARAM}=`)).toBe(true)
    })

    it('?付きURL化 → readGameStateFromUrl で round-trip 一致 (二重 encode していない)', () => {
      const state = makeState({ score: 321, status: 'paused' })
      const param = toStateQueryParam(state)
      expect(readGameStateFromUrl(`?${param}`)).toEqual(state)
    })

    it('出力 (state= 以降) に生の { } " および空白を含まない', () => {
      const out = toStateQueryParam(makeState({ status: 'gameover' }))
      const valuePart = out.slice(`${STATE_QUERY_PARAM}=`.length)
      expect(valuePart).not.toMatch(/[{}"\s]/)
    })
  })
})
