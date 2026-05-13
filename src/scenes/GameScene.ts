import type { Application, Ticker } from 'pixi.js'
import { Container } from 'pixi.js'
import type { GameState } from '../types/GameState'
import { BoardRenderer } from './BoardRenderer'

/** BoardRenderer のセルサイズ (DESIGN.md の cell pixel)。 */
const CELL_SIZE = 48

/**
 * ゲーム本編シーン。
 *
 * `initWithState(state)` で任意局面から起動できる設計
 * (デバッグ・テスト容易化が目的)。
 *
 * Issue #15 で `BoardRenderer` を組み込み、Ticker 経由で
 * 毎フレーム再描画する。物理 / 消去 / 入力は別 Issue 担当。
 */
export class GameScene {
  private state: GameState | null = null
  private readonly container: Container
  private readonly app: Application
  private renderer: BoardRenderer | null = null
  /** Ticker に登録した関数の参照 (destroy 時の remove 用)。 */
  private tickerFn: ((ticker: Ticker) => void) | null = null

  constructor(app: Application) {
    this.app = app
    this.container = new Container()
    this.app.stage.addChild(this.container)
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
      this.tickerFn = (): void => {
        this.renderer?.update()
      }
      this.app.ticker.add(this.tickerFn)
    }
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
    this.container.destroy({ children: true })
    this.state = null
    this.renderer = null
  }
}
