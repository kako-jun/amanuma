import type { Application, Ticker } from 'pixi.js'
import { Container } from 'pixi.js'
import type { GameState } from '../types/GameState'
import { CELL_SIZE } from '../constants/colors'
import { BoardRenderer } from './BoardRenderer'
import { stepUnderwaterPhysics } from '../physics/UnderwaterPhysics'
import {
  canMoveFallingTo,
  countSevens,
  findLandingRow,
  lockFallingBlock,
} from '../game/board'
import { runChain } from '../game/ChainRunner'
import { generateBlockValue } from '../game/randomBlocks'
import { KeyboardManager, type KeyboardCommand } from '../input/KeyboardManager'
import { TouchManager, type TouchCommand } from '../input/TouchManager'
import { DROP_BOOST_VELOCITY } from '../input/constants'

/**
 * リスタート時に「現在のお題」を取得するための最小インタフェース。
 * `PuzzleRotation` を直接型として受けると loadPuzzle に依存するため、
 * 必要な API だけを構造的に切り出す。
 */
export interface RestartSource {
  build(): GameState | null
}

/**
 * ゲーム本編シーン。
 *
 * `initWithState(state)` で任意局面から起動できる設計
 * (デバッグ・テスト容易化が目的)。
 *
 * Issue #15 で `BoardRenderer` を組み込み、Ticker 経由で
 * 毎フレーム再描画する。Issue #16 で水中物理を組み込み、
 * Issue #18 で着水 → 連鎖 → 新規スポーンのフローを統合した。
 */
export class GameScene {
  private state: GameState | null = null
  private readonly container: Container
  private readonly app: Application
  private renderer: BoardRenderer | null = null
  /** Ticker に登録した関数の参照 (destroy 時の remove 用)。 */
  private tickerFn: ((ticker: Ticker) => void) | null = null
  /**
   * 連鎖処理 (runChain) 実行中フラグ。
   * - true の間は物理ステップを停止して fallingBlock の固定済みが
   *   再度動かないようにする (= runChain 実行中はそもそも fallingBlock は null)。
   * - runChain 完了後に false に戻して、次のブロックをスポーンする。
   */
  private isChaining: boolean = false

  // 入力 (Issue #20)
  private readonly keyboard: KeyboardManager = new KeyboardManager()
  private readonly touch: TouchManager = new TouchManager()
  /** リスタート用のお題ソース。未設定なら R キー / restart コマンドは no-op。 */
  private restartSource: RestartSource | null = null
  private inputUnsubscribers: (() => void)[] = []

  constructor(app: Application) {
    this.app = app
    this.container = new Container()
    this.app.stage.addChild(this.container)
  }

  /**
   * R キー / restart コマンドで「現在のお題」から再構築するためのソースを設定する。
   * 未設定の場合は restart コマンドは no-op になる (タイトル画面未実装の今 Issue では
   * これで十分)。
   */
  setRestartSource(source: RestartSource | null): void {
    this.restartSource = source
  }

  /**
   * 任意の GameState で初期化または再初期化する。
   *
   * state は参照保持される。呼び出し側は state を immutable に扱うこと
   * (= 一度渡したオブジェクトを外部から書き換えない)。
   *
   * 再初期化時は既存の `BoardRenderer` を破棄して新しい renderer を生成する。
   * cols/rows が変わるお題切替に対応するため、`setState` の使い回しではなく
   * renderer 自体を作り直す方針 (生成コストは無視できる範囲)。
   */
  initWithState(state: GameState): void {
    this.state = state
    this.isChaining = false

    if (this.renderer) {
      this.renderer.destroy({ children: true })
      this.renderer = null
    }

    const renderer = new BoardRenderer(state, { cellSize: CELL_SIZE })
    // 中央寄せ (Canvas の幅・高さは Application で 800x650)。
    const boardWidthPx = state.cols * CELL_SIZE
    const boardHeightPx = state.rows * CELL_SIZE
    renderer.x = (this.app.screen.width - boardWidthPx) / 2
    renderer.y = (this.app.screen.height - boardHeightPx) / 2
    this.container.addChild(renderer)
    this.renderer = renderer

    // Ticker は最初の initWithState で一度だけ登録する (重複登録防止)。
    if (!this.tickerFn) {
      this.tickerFn = (ticker: Ticker): void => {
        this.tick(ticker)
      }
      this.app.ticker.add(this.tickerFn)
    }

    // 入力ハンドラも一度だけ登録する。再初期化時はそのまま使い回す。
    this.setupInput()
  }

  /** 現在保持している state を返す (デバッグ・テスト用、参照を返す)。 */
  getState(): GameState | null {
    return this.state
  }

  /**
   * シーンを破棄する。
   *
   * 破棄後は本インスタンスを再利用しないこと
   * (`this.container` は destroyed 済みになる)。
   */
  destroy(): void {
    if (this.tickerFn) {
      this.app.ticker.remove(this.tickerFn)
      this.tickerFn = null
    }
    // 入力ハンドラ解除。
    for (const unsub of this.inputUnsubscribers) unsub()
    this.inputUnsubscribers = []
    this.keyboard.detach()
    this.touch.detach()

    this.container.destroy({ children: true })
    this.state = null
    this.renderer = null
  }

  // ----------------------------------------------------------------------
  // private
  // ----------------------------------------------------------------------

  /**
   * 1 フレームぶんの更新。
   *
   * - 連鎖中 (`isChaining`) は物理を進めず、描画だけ続ける。
   * - fallingBlock があれば物理を進め、着水なら board に固定して連鎖を起動。
   * - 連鎖完了後はクリア判定 → 次ブロックのスポーン → 再開。
   */
  private tick(ticker: Ticker): void {
    const state = this.state
    if (state === null) {
      this.renderer?.update()
      return
    }

    // クリア / ゲームオーバー中は物理停止。
    if (state.status !== 'playing') {
      this.renderer?.update()
      return
    }

    if (!this.isChaining && state.fallingBlock !== null) {
      stepUnderwaterPhysics(state, ticker.deltaMS)

      const landingRow = findLandingRow(state)
      if (
        landingRow !== null &&
        state.fallingBlock !== null &&
        state.fallingBlock.row >= landingRow
      ) {
        // 着地: row をスナップして board に固定。
        state.fallingBlock.row = landingRow
        lockFallingBlock(state)
        this.startChainSequence()
      }
    }

    this.renderer?.update()
  }

  /**
   * 着水後の連鎖を非同期で実行する。
   *
   * `runChain` が解決したらクリア判定 → 次ブロックのスポーンを行う。
   * 連鎖中は `isChaining = true` で物理を停止する。
   */
  private startChainSequence(): void {
    const state = this.state
    if (state === null) return

    this.isChaining = true
    void runChain(state).then(() => {
      // state が変わっている (destroy or 別お題ロード) なら何もしない。
      if (this.state !== state) {
        this.isChaining = false
        return
      }

      // クリア判定: 残った 7 が 0 個ならクリア。
      // (お題に targetBlocks が無い場合でも、盤面に 7 が一つも無い状態は
      //  すべての 7 を消した= クリアと等価なので同じ条件で判定する。)
      if (countSevens(state) === 0) {
        state.status = 'cleared'
        this.isChaining = false
        return
      }

      // 次の fallingBlock をスポーン。
      state.fallingBlock = {
        value: state.nextBlock,
        col: Math.floor(state.cols / 2),
        row: 0,
        velocity: 0,
      }
      state.nextBlock = generateBlockValue()
      this.isChaining = false
    })
  }

  // ----------------------------------------------------------------------
  // 入力ハンドリング (Issue #20)
  // ----------------------------------------------------------------------

  /**
   * KeyboardManager / TouchManager を初期化し、コマンドを購読する。
   * 二重呼び出し時は no-op (`inputUnsubscribers` が空でない場合)。
   *
   * canvas は `app.canvas` を使うが、テスト等で canvas 未生成のケースは
   * try/catch で握りつぶす (本番では起きない想定だが防御的に書く)。
   */
  private setupInput(): void {
    if (this.inputUnsubscribers.length > 0) return

    this.keyboard.attach(window)
    try {
      // app.canvas は PIXI.Application 初期化済みなら HTMLCanvasElement。
      const canvas = this.app.canvas
      if (canvas instanceof HTMLCanvasElement) {
        this.touch.attach(canvas)
      }
    } catch {
      // canvas 取得に失敗してもキーボードだけは生かす。
    }

    const unsubKb = this.keyboard.onCommand(cmd => this.handleKeyboard(cmd))
    const unsubTouch = this.touch.onCommand(cmd => this.handleTouch(cmd))
    this.inputUnsubscribers.push(unsubKb, unsubTouch)
  }

  /**
   * KeyboardCommand を game state 操作に変換する。
   *
   * 入力封じ条件:
   *   - 状態が 'playing' でない (paused/cleared/gameover) 場合、move/drop は無視。
   *   - 連鎖中 (`isChaining` = true) も move/drop は無視。
   *   - togglePause: paused ↔ playing のみ。cleared / gameover では無視。
   *   - restart: 常時有効 (cleared / gameover からの復帰に必要)。
   */
  private handleKeyboard(cmd: KeyboardCommand): void {
    switch (cmd) {
      case 'left':
        this.tryMove(-1)
        break
      case 'right':
        this.tryMove(+1)
        break
      case 'drop':
        this.tryDrop()
        break
      case 'togglePause':
        this.togglePause()
        break
      case 'restart':
        this.restart()
        break
    }
  }

  /** TouchCommand を game state 操作に変換する。キーボードと同じ封じ条件。 */
  private handleTouch(cmd: TouchCommand): void {
    switch (cmd) {
      case 'left':
        this.tryMove(-1)
        break
      case 'right':
        this.tryMove(+1)
        break
      case 'drop':
        this.tryDrop()
        break
    }
  }

  /** 左右移動を試みる。封じ条件 / 衝突判定をまとめてチェック。 */
  private tryMove(deltaCol: number): void {
    const state = this.state
    if (state === null) return
    if (state.status !== 'playing') return
    if (this.isChaining) return
    const falling = state.fallingBlock
    if (falling === null) return
    const newCol = falling.col + deltaCol
    if (!canMoveFallingTo(state, newCol)) return
    falling.col = newCol
  }

  /** ↓ / 下スワイプ: velocity を加速して高速落下。 */
  private tryDrop(): void {
    const state = this.state
    if (state === null) return
    if (state.status !== 'playing') return
    if (this.isChaining) return
    const falling = state.fallingBlock
    if (falling === null) return
    falling.velocity += DROP_BOOST_VELOCITY
  }

  /**
   * P: playing ↔ paused 切替。
   *
   * cleared / gameover は終端状態のため切替の意味が無く、無視する。
   */
  private togglePause(): void {
    const state = this.state
    if (state === null) return
    if (state.status === 'playing') {
      state.status = 'paused'
    } else if (state.status === 'paused') {
      state.status = 'playing'
    }
  }

  /**
   * R: 現在のお題で再スタート。
   *
   * `setRestartSource()` で渡された source から GameState を再生成する。
   * source 未設定または build 失敗時は何もしない。
   * fallingBlock 未設定なら main.ts と同じく Next ベースで補充する。
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
