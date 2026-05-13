import type { Application } from 'pixi.js'
import { Container } from 'pixi.js'
import type { GameState } from '../types/GameState'

/**
 * ゲーム本編シーン。
 *
 * `initWithState(state)` で任意局面から起動できる設計
 * (デバッグ・テスト容易化が目的)。
 *
 * 本 Issue #13 では state 保持のみ。
 * - 描画は Issue #15 で実装する
 * - お題ロードは Issue #14
 * - ゲームループ / 物理 / 入力は Issue #16 / #18 / #20
 */
export class GameScene {
  private state: GameState | null = null
  private readonly container: Container
  private readonly app: Application

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
   */
  initWithState(state: GameState): void {
    this.state = state
    // 描画は Issue #15 で実装する
  }

  /** 現在保持している state を返す (デバッグ・テスト用、参照を返す)。 */
  getState(): GameState | null {
    return this.state
  }

  /** シーンを破棄する。 */
  destroy(): void {
    this.container.destroy({ children: true })
    this.state = null
  }
}
