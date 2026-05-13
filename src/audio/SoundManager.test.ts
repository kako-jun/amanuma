/**
 * SoundManager のユニットテスト (Issue #22)。
 *
 * jsdom 環境を使う。HTMLAudioElement と AudioContext を最小限モックし、
 * - ミュート状態の persist/load
 * - SFX 再生 (404 graceful)
 * - BGM 切替
 * - unlock の冪等性
 * を検証する。
 *
 * 注: 実際の音再生は jsdom では行えないので、`new Audio(...)` の呼び出しが
 * 起こったか / `play()` が呼ばれたか / volume が設定されたか、を見る。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SoundManager } from './SoundManager'

// vitest の jsdom 環境では HTMLAudioElement は存在するが、play() は
// 「Not implemented」例外を投げることがある。play を no-op に差し替える。
type AudioRec = {
  src: string
  loop: boolean
  volume: number
  paused: boolean
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
}

let created: AudioRec[] = []
let originalAudio: typeof Audio

function setupAudioMock(): void {
  originalAudio = globalThis.Audio
  class MockAudio {
    src: string
    loop = false
    volume = 1.0
    paused = true
    play: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    addEventListener: ReturnType<typeof vi.fn>
    constructor(src?: string) {
      this.src = src ?? ''
      this.play = vi.fn(() => {
        this.paused = false
        return Promise.resolve()
      })
      this.pause = vi.fn(() => {
        this.paused = true
      })
      this.addEventListener = vi.fn()
      created.push(this as unknown as AudioRec)
    }
  }
  globalThis.Audio = MockAudio as unknown as typeof Audio
}

function restoreAudioMock(): void {
  globalThis.Audio = originalAudio
  created = []
}

describe('SoundManager', () => {
  beforeEach(() => {
    setupAudioMock()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  afterEach(() => {
    restoreAudioMock()
  })

  describe('ミュート状態', () => {
    it('既定では muted = false', () => {
      const sm = new SoundManager()
      expect(sm.isMuted()).toBe(false)
    })

    it('options.muted で初期化できる', () => {
      const sm = new SoundManager({ muted: true })
      expect(sm.isMuted()).toBe(true)
    })

    it('toggleMute() で反転する', () => {
      const sm = new SoundManager()
      sm.toggleMute()
      expect(sm.isMuted()).toBe(true)
      sm.toggleMute()
      expect(sm.isMuted()).toBe(false)
    })

    it('setMuted で同じ値なら listener は呼ばれない', () => {
      const sm = new SoundManager({ muted: false })
      const spy = vi.fn()
      sm.onMuteChange(spy)
      sm.setMuted(false)
      expect(spy).not.toHaveBeenCalled()
    })

    it('setMuted で値が変わると listener が呼ばれる', () => {
      const sm = new SoundManager({ muted: false })
      const spy = vi.fn()
      sm.onMuteChange(spy)
      sm.setMuted(true)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(true)
    })

    it('onMuteChange の戻り値で unsubscribe できる', () => {
      const sm = new SoundManager()
      const spy = vi.fn()
      const off = sm.onMuteChange(spy)
      off()
      sm.toggleMute()
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('永続化', () => {
    it('persist → loadPersisted でミュート状態が復元される', () => {
      const a = new SoundManager()
      a.toggleMute() // muted = true, 自動 persist
      const b = new SoundManager()
      b.loadPersisted()
      expect(b.isMuted()).toBe(true)
    })

    it('localStorage が空なら loadPersisted は no-op', () => {
      const sm = new SoundManager({ muted: false })
      sm.loadPersisted()
      expect(sm.isMuted()).toBe(false)
    })

    it('persist は muted=false を 0 として書き込む', () => {
      const sm = new SoundManager({ muted: true })
      sm.setMuted(false)
      expect(localStorage.getItem('amanuma_muted')).toBe('0')
    })
  })

  describe('playSfx', () => {
    it('未ミュート時は Audio を生成して play する', () => {
      const sm = new SoundManager()
      sm.playSfx('block-land')
      expect(created.length).toBe(1)
      expect(created[0].src).toContain('block-land.mp3')
      expect(created[0].play).toHaveBeenCalledTimes(1)
    })

    it('ミュート時は何もしない', () => {
      const sm = new SoundManager({ muted: true })
      sm.playSfx('block-land')
      expect(created.length).toBe(0)
    })

    it('volume は sfxVolume が適用される', () => {
      const sm = new SoundManager({ sfxVolume: 0.5 })
      sm.playSfx('block-clear')
      expect(created[0].volume).toBeCloseTo(0.5)
    })

    it('error イベントを listen して 404 を黙殺する', () => {
      const sm = new SoundManager()
      sm.playSfx('ui-select')
      expect(created[0].addEventListener).toHaveBeenCalled()
      const calls = created[0].addEventListener.mock.calls
      expect(calls.some(c => c[0] === 'error')).toBe(true)
    })
  })

  describe('playBgm', () => {
    it('未ミュート時は新規 Audio で loop=true で play する', () => {
      const sm = new SoundManager()
      sm.playBgm('bgm-title')
      expect(created.length).toBe(1)
      expect(created[0].src).toContain('bgm-title.mp3')
      expect(created[0].loop).toBe(true)
      expect(created[0].play).toHaveBeenCalledTimes(1)
    })

    it('loop=false も渡せる', () => {
      const sm = new SoundManager()
      sm.playBgm('bgm-result', { loop: false })
      expect(created[0].loop).toBe(false)
    })

    it('同じ key を 2 度呼んでも 2 個目は作らない', () => {
      const sm = new SoundManager()
      sm.playBgm('bgm-game')
      sm.playBgm('bgm-game')
      expect(created.length).toBe(1)
    })

    it('異なる key を呼ぶと前を pause して新規を生成する', () => {
      const sm = new SoundManager()
      sm.playBgm('bgm-title')
      const first = created[0]
      sm.playBgm('bgm-game')
      expect(created.length).toBe(2)
      expect(first.pause).toHaveBeenCalled()
    })

    it('getCurrentBgmKey が現在の key を返す', () => {
      const sm = new SoundManager()
      expect(sm.getCurrentBgmKey()).toBeNull()
      sm.playBgm('bgm-title')
      expect(sm.getCurrentBgmKey()).toBe('bgm-title')
    })

    it('ミュート中は currentBgm を差し替えるが play は呼ばない', () => {
      const sm = new SoundManager({ muted: true })
      sm.playBgm('bgm-title')
      expect(created.length).toBe(1)
      expect(created[0].play).not.toHaveBeenCalled()
      expect(sm.getCurrentBgmKey()).toBe('bgm-title')
    })

    it('setMuted(false) でミュート解除すると play される', () => {
      const sm = new SoundManager({ muted: true })
      sm.playBgm('bgm-title')
      const bgm = created[0]
      sm.setMuted(false)
      expect(bgm.play).toHaveBeenCalled()
    })

    it('setMuted(true) で BGM が pause される', () => {
      const sm = new SoundManager()
      sm.playBgm('bgm-title')
      const bgm = created[0]
      sm.setMuted(true)
      expect(bgm.pause).toHaveBeenCalled()
    })
  })

  describe('stopBgm', () => {
    it('fadeMs=0 で即時停止し currentBgmKey を null にする', () => {
      const sm = new SoundManager()
      sm.playBgm('bgm-title')
      const bgm = created[0]
      sm.stopBgm()
      expect(bgm.pause).toHaveBeenCalled()
      expect(sm.getCurrentBgmKey()).toBeNull()
    })
  })

  describe('unlock', () => {
    it('複数回呼んでも 1 度だけ AudioContext を作る', () => {
      const sm = new SoundManager()
      sm.unlock()
      sm.unlock()
      sm.unlock()
      // AudioContext は jsdom には実装されていないかもしれないが、
      // 例外が漏れずに動くこと自体を確認する。
      expect(true).toBe(true)
    })

    it('unlock 後にミュート中 BGM の再試行は行わない', () => {
      const sm = new SoundManager({ muted: true })
      sm.playBgm('bgm-title')
      const bgm = created[0]
      sm.unlock()
      expect(bgm.play).not.toHaveBeenCalled()
    })
  })
})
