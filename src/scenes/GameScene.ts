/**
 * シングルプレイ用のゲームシーン (Issue #21 で PlayerBoard 抽出後の薄いラッパ)。
 *
 * - 1 個の `PlayerBoard` を持ち、誌面 (= SceneManager の world) に
 *   配置できる `Container` (`board` 経由でアクセス) を提供する。
 * - Ticker は `attachTicker()` で外部から登録する。`SceneManager` の Ticker と
 *   統一して 1 ループにする狙い。
 * - 入力は `attachInputs(keyboard, touch)` で外部の Manager を受け取り、
 *   1 プレイヤー分のコマンドを `PlayerBoard` に流す。
 *
 * Issue #20 以前の API (`setRestartSource` / `initWithState`) は互換のため残す。
 */
import type { Application, Ticker } from 'pixi.js'
import type { GameState } from '../types/GameState'
import { PlayerBoard } from './PlayerBoard'
import type { KeyboardCommand, KeyboardManager } from '../input/KeyboardManager'
import type { TouchCommand, TouchManager } from '../input/TouchManager'
import { generateBlockValue } from '../game/randomBlocks'
import type { SoundManager } from '../audio/SoundManager'

export interface RestartSource {
  build(): GameState | null
}

/**
 * シングルプレイのシーン (誌面上のページ)。
 *
 * `board` (`PlayerBoard` = `Container` 派生) を外部に公開し、SceneManager の
 * world に `addChild(scene.board)` する想定。`SceneManager` 登場前の旧 main.ts
 * 互換のため、`Application` を受け取ったときは `app.stage` に board を直接
 * 追加し、Ticker / 入力も従来通り内部で attach する (= 後方互換モード)。
 */
export class GameScene {
  readonly board: PlayerBoard
  private readonly app: Application | null
  private tickerFn: ((ticker: Ticker) => void) | null = null
  private restartSource: RestartSource | null = null
  private inputUnsubscribers: (() => void)[] = []
  private onExitToTitle: (() => void) | null = null
  /** クリア / ゲームオーバー通知 (Issue #21、ResultScene 遷移用)。 */
  onCleared: (() => void) | null = null
  onGameOver: (() => void) | null = null

  /**
   * @param app `Application` を渡すと旧 API 互換モード (Ticker と stage 追加を自動でやる)。
   *            null を渡すと外部統合モード (Ticker / 入力 / 追加は呼び出し側の責任)。
   */
  constructor(
    app: Application | null = null,
    soundManager: SoundManager | null = null
  ) {
    this.app = app
    this.board = new PlayerBoard(
      {
        onCleared: () => this.onCleared?.(),
        onGameOver: () => this.onGameOver?.(),
      },
      soundManager
    )
    if (app !== null) {
      app.stage.addChild(this.board)
    }
  }

  setRestartSource(source: RestartSource | null): void {
    this.restartSource = source
  }

  /**
   * 任意の GameState で初期化する。
   *
   * 旧 API 互換モード (`app` あり) では PlayerBoard を再配置し、
   * `Application.screen.{width,height}` に対して中央寄せする。
   * 外部統合モードでは PlayerBoard 自身の (0,0) を起点に置くだけで、
   * 親 (誌面 Container) 側で配置を決める。
   */
  initWithState(state: GameState): void {
    this.board.initWithState(state)

    if (this.app !== null) {
      // 旧 API: Canvas 中央寄せ。
      const { width, height } = this.board.getBoardSize()
      this.board.x = (this.app.screen.width - width) / 2
      this.board.y = (this.app.screen.height - height) / 2

      // Ticker は最初の一度だけ登録。
      if (!this.tickerFn) {
        this.tickerFn = (ticker: Ticker): void => {
          this.board.update(ticker)
        }
        this.app.ticker.add(this.tickerFn)
      }
    }
  }

  /** 現在の state (デバッグ・テスト用、参照を返す)。 */
  getState(): GameState | null {
    return this.board.getState()
  }

  /**
   * SceneManager 統合モード用: 外部からの Ticker で 1 フレーム進める。
   * 旧 API 互換モードでは内部 Ticker と二重に進めないこと。
   */
  update(ticker: Ticker): void {
    this.board.update(ticker)
  }

  /**
   * KeyboardManager / TouchManager のコマンドを subscribe する。
   * Issue #21: 入力は外部で 1 個共有する設計に変更。Manager 自体の attach/detach は
   * 呼び出し側の責任で、本メソッドは `onCommand` の購読だけを行う。
   *
   * 戻り値: unsubscribe 関数。
   */
  /**
   * 入力 Manager を購読する。
   *
   * @param keyboard キーボード入力 (null で無効化)。
   * @param touch タッチ入力 (省略可、null で無効化)。
   * @param onExitToTitle Esc (`cancel` コマンド) でタイトルに戻すコールバック (S5/S6)。
   *                     未指定なら Esc はゲーム中は無視される (既定の挙動)。
   */
  attachInputs(
    keyboard: KeyboardManager | null,
    touch?: TouchManager | null,
    onExitToTitle?: () => void
  ): () => void {
    this.onExitToTitle = onExitToTitle ?? null
    const unsubs: (() => void)[] = []
    if (keyboard) {
      unsubs.push(keyboard.onCommand(cmd => this.handleKeyboard(cmd)))
    }
    if (touch) {
      unsubs.push(touch.onCommand(cmd => this.handleTouch(cmd)))
    }
    const unsubAll = (): void => {
      for (const u of unsubs) u()
    }
    this.inputUnsubscribers.push(unsubAll)
    return unsubAll
  }

  /**
   * シーンを破棄する。
   * 互換モードでは Ticker / 入力 / Container を全部クリーンアップする。
   */
  destroy(): void {
    if (this.app !== null && this.tickerFn) {
      this.app.ticker.remove(this.tickerFn)
      this.tickerFn = null
    }
    for (const unsub of this.inputUnsubscribers) unsub()
    this.inputUnsubscribers = []
    if (!this.board.destroyed) {
      this.board.destroy({ children: true })
    }
  }

  // ----------------------------------------------------------------------
  // 入力ハンドリング (PlayerBoard へ転送)
  // ----------------------------------------------------------------------

  private handleKeyboard(cmd: KeyboardCommand): void {
    switch (cmd) {
      case 'left':
        this.board.tryMove(-1)
        break
      case 'right':
        this.board.tryMove(+1)
        break
      case 'drop':
        this.board.tryDrop()
        break
      case 'togglePause':
        this.board.togglePause()
        break
      case 'restart':
        this.restart()
        break
      case 'cancel':
        // S5/S6: Esc でタイトルへ戻る。onExitToTitle 未注入時のみ無視。
        this.onExitToTitle?.()
        break
      default:
        // select1 / select2 / confirm はゲーム中は無視。
        break
    }
  }

  private handleTouch(cmd: TouchCommand): void {
    switch (cmd) {
      case 'left':
        this.board.tryMove(-1)
        break
      case 'right':
        this.board.tryMove(+1)
        break
      case 'drop':
        this.board.tryDrop()
        break
    }
  }

  /**
   * R: 現在のお題で再スタート (タイトル画面実装後は別ソースに差し替え可)。
   */
  private restart(): void {
    const source = this.restartSource
    if (source === null) return
    const nextState = source.build()
    if (nextState === null) return
    if (nextState.fallingBlock === null) {
      nextState.fallingBlock = {
        value: nextState.nextBlock,
        col: Math.floor(nextState.cols / 2),
        row: 0,
        velocity: 0,
      }
      nextState.nextBlock = generateBlockValue()
    }
    this.initWithState(nextState)
  }
}
