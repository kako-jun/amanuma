/**
 * サウンドマネージャ (Issue #22)。
 *
 * WebAudio API + HTMLAudioElement のシンプルな組み合わせで、
 * SFX (短い効果音) と BGM (ループ再生) を扱う。
 *
 * 設計方針:
 * - 重い音声ライブラリ (Howler / Tone) は導入しない。`HTMLAudioElement` で
 *   足りる範囲を意図的に選ぶ。
 * - **アセットが無くても落ちない**。`Audio` の `error` イベントは黙って無視する。
 *   将来 `public/sounds/` に音ファイルを置けばそのまま鳴り出す。
 * - 各 SFX 再生はクローン (`new Audio(src)`) を毎回作って同時再生に耐える。
 *   再生終了後の片付けはブラウザ側の GC に任せる。
 * - BGM は 1 個の `HTMLAudioElement` を使い回し、`fadeMs` を指定された場合は
 *   `volume` 補間でクロスフェードする。
 * - ミュート状態は `localStorage` (key: `amanuma_muted`) に永続化する。
 *   `loadPersisted()` で復元、`setMuted` / `toggleMute` で更新時に自動保存。
 * - `unlock()` を初回ユーザー操作時に呼ぶと、Safari/iOS 系のオートプレイ
 *   ポリシーを回避できる (空の `AudioContext` を resume するだけ)。
 *
 * 注意: PixiJS の WebAudio とは独立に動く。Pixi 側のリソース管理に
 * 巻き込まれないので、シーン遷移時に勝手に停止されない。
 */

export type SfxKey =
  | 'block-land'
  | 'block-spawn'
  | 'block-clear'
  | 'chain-up'
  | 'puzzle-cleared'
  | 'game-over'
  | 'ui-select'

export type BgmKey = 'bgm-title' | 'bgm-game' | 'bgm-versus' | 'bgm-result'

export interface SoundManagerOptions {
  /** 初期ミュート (loadPersisted で上書きされる)。 */
  muted?: boolean
  /** SFX 音量 0.0 〜 1.0。既定 0.7。 */
  sfxVolume?: number
  /** BGM 音量 0.0 〜 1.0。既定 0.4。 */
  bgmVolume?: number
  /** アセットの配置ルート。既定 `/sounds/`。 */
  basePath?: string
}

/** localStorage キー。 */
const STORAGE_KEY = 'amanuma_muted'

/**
 * BGM のフェード補間で使う最小タイマー間隔 (ms)。
 * 16ms ≒ 60fps。requestAnimationFrame と独立に動かしたいので setInterval を使う。
 */
const FADE_TICK_MS = 16

export class SoundManager {
  private muted: boolean
  private sfxVolume: number
  private bgmVolume: number
  private basePath: string
  /** Safari/iOS のオートプレイ解除用。null のままでも SFX 自体は鳴る (= HTMLAudio で再生)。 */
  private ctx: AudioContext | null = null
  private currentBgm: HTMLAudioElement | null = null
  private currentBgmKey: BgmKey | null = null
  /** 進行中のフェードを止めるためのインターバル ID。 */
  private fadeTimer: ReturnType<typeof setInterval> | null = null
  /** ミュート切替や永続化リスナー (UI 表示更新用)。 */
  private readonly muteListeners: Set<(muted: boolean) => void> = new Set()

  constructor(opts: SoundManagerOptions = {}) {
    this.muted = opts.muted ?? false
    this.sfxVolume = clamp01(opts.sfxVolume ?? 0.7)
    this.bgmVolume = clamp01(opts.bgmVolume ?? 0.4)
    this.basePath = opts.basePath ?? '/sounds/'
  }

  /**
   * 初回ユーザー操作 (pointerdown / keydown) で呼ぶ。
   * - `AudioContext` を作って `resume()` する (オートプレイ解除)。
   * - 既に作成済みなら no-op。
   *
   * SFX/BGM 自体は HTMLAudioElement 経由なので AudioContext は厳密には
   * 必要ない。ただし「ユーザー操作直後」というフラグを作っておくと、
   * 続く HTMLAudio.play() も許可される (主にモバイル Safari 対策)。
   */
  unlock(): void {
    if (this.ctx !== null) return
    try {
      const Ctor =
        typeof window !== 'undefined'
          ? ((
              window as typeof window & {
                AudioContext?: typeof AudioContext
                webkitAudioContext?: typeof AudioContext
              }
            ).AudioContext ??
            (
              window as typeof window & {
                webkitAudioContext?: typeof AudioContext
              }
            ).webkitAudioContext)
          : undefined
      if (Ctor !== undefined) {
        this.ctx = new Ctor()
        // resume は Promise だが、await 不要 (失敗時の処理は無し)。
        const r = this.ctx.resume()
        if (r && typeof r.then === 'function') {
          r.catch(() => {
            /* 失敗しても致命的ではないので無視 */
          })
        }
      }
    } catch {
      // AudioContext 作成失敗。SFX/BGM は HTMLAudio で動くので致命的ではない。
      this.ctx = null
    }
    // unlock 直後に BGM の play() が許可される可能性があるので、
    // currentBgm が pause 状態 (= 前回 play 失敗) なら再度試す。
    if (this.currentBgm && this.currentBgm.paused && !this.muted) {
      const p = this.currentBgm.play()
      if (p && typeof p.then === 'function') {
        p.catch(() => {
          /* still blocked: 無視 */
        })
      }
    }
  }

  // ----------------------------------------------------------------------
  // SFX
  // ----------------------------------------------------------------------

  /**
   * 単発の効果音を再生する。
   * - ミュート時は何もしない。
   * - ファイル未配置 (404) や再生失敗は黙って無視する。
   * - 毎回 `new Audio()` するので複数同時再生も可。
   */
  playSfx(key: SfxKey): void {
    if (this.muted) return
    if (typeof Audio === 'undefined') return
    let audio: HTMLAudioElement
    try {
      audio = new Audio(`${this.basePath}${key}.mp3`)
    } catch {
      return
    }
    audio.volume = this.sfxVolume
    // 404 や decode 失敗で error が飛んでくる。listener を貼って黙殺。
    audio.addEventListener('error', () => {
      /* asset missing: 無視 */
    })
    const p = audio.play()
    if (p && typeof p.then === 'function') {
      p.catch(() => {
        /* オートプレイ拒否や 404: 無視 */
      })
    }
  }

  // ----------------------------------------------------------------------
  // BGM
  // ----------------------------------------------------------------------

  /**
   * BGM を再生する。
   * - 同じ key が既に再生中なら no-op。
   * - 異なる key なら、前の BGM をフェードアウトしながら新しい BGM をフェードインする。
   * - ミュート中は currentBgm を差し替えるが play() は呼ばない。setMuted(false) 時に再開。
   */
  playBgm(key: BgmKey, opts: { loop?: boolean; fadeMs?: number } = {}): void {
    if (typeof Audio === 'undefined') return
    if (this.currentBgmKey === key && this.currentBgm) {
      // 同じトラックは何もしない (上書き fade で音量が暴れるのを防ぐ)。
      return
    }

    const loop = opts.loop ?? true
    const fadeMs = opts.fadeMs ?? 0

    // 前の BGM のフェードを停止。
    this.stopFadeTimer()

    const prev = this.currentBgm
    let next: HTMLAudioElement
    try {
      next = new Audio(`${this.basePath}${key}.mp3`)
    } catch {
      return
    }
    next.loop = loop
    next.volume = fadeMs > 0 ? 0 : this.bgmVolume
    next.addEventListener('error', () => {
      /* asset missing: 無視 */
    })

    this.currentBgm = next
    this.currentBgmKey = key

    if (!this.muted) {
      const p = next.play()
      if (p && typeof p.then === 'function') {
        p.catch(() => {
          /* オートプレイ拒否は unlock 後に再試行 */
        })
      }
    }

    if (fadeMs <= 0) {
      // 即時切替。
      if (prev) {
        prev.pause()
        prev.src = ''
      }
      return
    }

    // クロスフェード。
    const steps = Math.max(1, Math.floor(fadeMs / FADE_TICK_MS))
    let i = 0
    const prevStartVol = prev ? prev.volume : 0
    const target = this.bgmVolume
    this.fadeTimer = setInterval(() => {
      i++
      const t = Math.min(1, i / steps)
      next.volume = target * t
      if (prev) prev.volume = prevStartVol * (1 - t)
      if (t >= 1) {
        if (prev) {
          prev.pause()
          prev.src = ''
        }
        this.stopFadeTimer()
      }
    }, FADE_TICK_MS)
  }

  /** 現在の BGM を止める。fadeMs > 0 ならフェードアウト。 */
  stopBgm(fadeMs: number = 0): void {
    const cur = this.currentBgm
    if (!cur) return
    this.stopFadeTimer()

    if (fadeMs <= 0) {
      cur.pause()
      cur.src = ''
      this.currentBgm = null
      this.currentBgmKey = null
      return
    }

    const steps = Math.max(1, Math.floor(fadeMs / FADE_TICK_MS))
    const startVol = cur.volume
    let i = 0
    this.fadeTimer = setInterval(() => {
      i++
      const t = Math.min(1, i / steps)
      cur.volume = startVol * (1 - t)
      if (t >= 1) {
        cur.pause()
        cur.src = ''
        if (this.currentBgm === cur) {
          this.currentBgm = null
          this.currentBgmKey = null
        }
        this.stopFadeTimer()
      }
    }, FADE_TICK_MS)
  }

  /** 現在再生中の BGM キー (デバッグ・テスト用)。 */
  getCurrentBgmKey(): BgmKey | null {
    return this.currentBgmKey
  }

  // ----------------------------------------------------------------------
  // ミュート / 永続化
  // ----------------------------------------------------------------------

  setMuted(muted: boolean): void {
    if (this.muted === muted) return
    this.muted = muted
    if (this.currentBgm) {
      if (muted) {
        this.currentBgm.pause()
      } else {
        const p = this.currentBgm.play()
        if (p && typeof p.then === 'function') {
          p.catch(() => {
            /* 無視 */
          })
        }
      }
    }
    this.persist()
    for (const l of [...this.muteListeners]) l(muted)
  }

  isMuted(): boolean {
    return this.muted
  }

  toggleMute(): void {
    this.setMuted(!this.muted)
  }

  /** ミュート切替の通知を受け取る (MuteButton 等の UI 用)。 */
  onMuteChange(listener: (muted: boolean) => void): () => void {
    this.muteListeners.add(listener)
    return () => {
      this.muteListeners.delete(listener)
    }
  }

  /**
   * localStorage からミュート状態を復元する。
   * localStorage 自体が無い環境 (SSR, テスト, プライベートモード) では no-op。
   */
  loadPersisted(): void {
    try {
      if (typeof localStorage === 'undefined') return
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === '1') this.muted = true
      else if (v === '0') this.muted = false
    } catch {
      /* SecurityError 等は無視 */
    }
  }

  /** 現在のミュート状態を localStorage に保存する。 */
  persist(): void {
    try {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0')
    } catch {
      /* QuotaExceededError 等は無視 */
    }
  }

  // ----------------------------------------------------------------------
  // 内部ヘルパ
  // ----------------------------------------------------------------------

  private stopFadeTimer(): void {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer)
      this.fadeTimer = null
    }
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}
