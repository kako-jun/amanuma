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
   *
   * 再初期化時の描画 child の破棄・再生成責任は呼び出し側ではなく、
   * 描画を実装する側 (Issue #15) が `this.container` をクリアする責任を持つ。
   * 本 Issue #13 時点ではまだ描画 child が存在しないため何もしない。
   */
  initWithState(state: GameState): void {
    this.state = state
    // 描画は Issue #15 で実装する。
    // 再初期化時は this.container.removeChildren() 相当の処理を #15 で追加する。
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
    this.container.destroy({ children: true })
    this.state = null
  }
}
