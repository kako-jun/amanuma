/**
 * キーボード入力マネージャ (Issue #20)。
 *
 * - キーコードをゲームコマンドに変換し、登録されたハンドラへ通知する。
 * - ゲーム状態 (`status` / `isChaining`) は参照しない。入力封じは呼び出し側で行う。
 * - `attach()` でイベントを登録し、`detach()` で解除する。
 *
 * マッピング:
 *   ArrowLeft  → 'left'
 *   ArrowRight → 'right'
 *   ArrowDown  → 'drop'           (押すたびに 1 回通知、長押しの連続落下は呼び出し側が解釈)
 *   p / P      → 'togglePause'
 *   r / R      → 'restart'
 *
 * 長押し対応: keydown のイベントは OS のオートリピートで連発されるため、
 * 'drop' は事実上「押している間に連続発火」する形になる。明示的な keyup
 * との対管理は本 Issue では実装しない (将来の高速落下強化で必要なら拡張)。
 */

export type KeyboardCommand =
  | 'left'
  | 'right'
  | 'drop'
  | 'togglePause'
  | 'restart'

/** Window / HTMLElement のどちらでも attach できるよう緩く受ける。 */
type KeyboardTarget = Window | HTMLElement

export class KeyboardManager {
  private readonly handlers: Set<(cmd: KeyboardCommand) => void> = new Set()
  private attachedTarget: KeyboardTarget | null = null

  /**
   * keydown ハンドラ。
   *
   * - キーがコマンドに対応していない場合は何もせず、preventDefault も呼ばない
   *   (= 既存のフォーカス移動などを邪魔しない)。
   * - 対応キーは preventDefault してスクロール等を抑制する。
   */
  private readonly onKeyDown = (event: Event): void => {
    // attach 先によって event の具象型が KeyboardEvent ではない可能性があるため
    // 最小限のダックタイピングで判定する。
    const e = event as KeyboardEvent
    const cmd = this.mapKeyToCommand(e.key)
    if (cmd === null) return
    e.preventDefault()
    // ハンドラのスナップショットで反復 (呼び出し中に subscribe/unsubscribe されても安全)。
    for (const h of [...this.handlers]) {
      h(cmd)
    }
  }

  /** イベントリスナを target に登録する。既に attach 済みなら一度 detach してから貼り直す。 */
  attach(target: KeyboardTarget = window): void {
    if (this.attachedTarget !== null) {
      this.detach()
    }
    target.addEventListener('keydown', this.onKeyDown)
    this.attachedTarget = target
  }

  /** イベントリスナを解除する。未 attach なら no-op。 */
  detach(): void {
    if (this.attachedTarget === null) return
    this.attachedTarget.removeEventListener('keydown', this.onKeyDown)
    this.attachedTarget = null
  }

  /**
   * コマンドハンドラを登録し、登録解除用の関数を返す。
   * 同じハンドラ参照を複数回 onCommand しても Set なので重複しない。
   */
  onCommand(handler: (cmd: KeyboardCommand) => void): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  /** テスト用フック: 現在登録されているハンドラ数。 */
  get handlerCount(): number {
    return this.handlers.size
  }

  private mapKeyToCommand(key: string): KeyboardCommand | null {
    switch (key) {
      case 'ArrowLeft':
        return 'left'
      case 'ArrowRight':
        return 'right'
      case 'ArrowDown':
        return 'drop'
      case 'p':
      case 'P':
        return 'togglePause'
      case 'r':
      case 'R':
        return 'restart'
      default:
        return null
    }
  }
}
