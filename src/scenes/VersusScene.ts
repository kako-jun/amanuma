/**
 * 対戦シーン (Issue #21)。
 *
 * 同一お題から開始する 2 つの `PlayerBoard` を横並びに配置する。
 * 各プレイヤーは独立に物理・連鎖・スポーンを進め、消去が発生したら
 * `consumePendingGarbage()` 経由で相手にお邪魔ブロックを送信する。
 *
 * MVP 仕様 (Issue #21):
 * - お邪魔送信レート: `floor(消去数 / 3)` (PlayerBoard 側で決定)。
 * - 勝敗判定: 先に cleared または相手が gameover で勝ち。
 * - スコアの集計は本 Issue では行わない (将来の課題)。
 *
 * 入力割り当て:
 * - P1: KeyboardCommand (← → ↓) → 左の盤面
 * - P2: 物理キーが足りないので、本 Issue ではキーボード制御は P1 のみ。
 *   P2 にもタイマー駆動の物理は流すため、操作なしだとブロックは自然落下で
 *   沈み続け、最終的に列が埋まって `gameover` → P1 の不戦勝になる。
 *   2 盤面が並ぶ絵の確認用 MVP であり、ゲームバランスとしては未完成。
 *
 * 将来 (Phase 3 後):
 * - P2 キーバインド (WASD) もしくは CPU AI / ネット対戦
 * - お邪魔バランス調整 (連鎖段数に応じた送信量)
 */
import type { Ticker } from 'pixi.js'
import { Container, Text } from 'pixi.js'
import { PlayerBoard } from './PlayerBoard'
import type { KeyboardCommand, KeyboardManager } from '../input/KeyboardManager'
import type { GameState } from '../types/GameState'
import { UI_TEXT_PRIMARY } from '../constants/colors'
import type { SoundManager } from '../audio/SoundManager'

/** 2 つの盤面の間隔 (px)。 */
const BOARD_GAP_PX = 64

export interface VersusSceneCallbacks {
  /** P1 が勝った直後に呼ばれる。 */
  onP1Win?: () => void
  /** P2 が勝った直後に呼ばれる。 */
  onP2Win?: () => void
  /** 引き分け (両者同時 cleared / gameover) で呼ばれる。 */
  onDraw?: () => void
}

export class VersusScene extends Container {
  readonly p1: PlayerBoard
  readonly p2: PlayerBoard
  private readonly p1Label: Text
  private readonly p2Label: Text
  private readonly callbacks: VersusSceneCallbacks
  /** 勝敗が確定したら true (以後の通知は抑止)。 */
  private settled: boolean = false

  constructor(
    callbacks: VersusSceneCallbacks = {},
    soundManager: SoundManager | null = null
  ) {
    super()
    this.callbacks = callbacks

    // P1 (緑) / P2 (アンバー) のラベル。DESIGN.md 4.5 Player Indicators。
    this.p1Label = new Text({
      text: 'P1',
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 20,
        fontWeight: '700',
        fill: 0x10b981, // p1-color (緑)
      },
    })
    this.p1Label.x = 0
    this.p1Label.y = -28
    this.addChild(this.p1Label)

    this.p2Label = new Text({
      text: 'P2',
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 20,
        fontWeight: '700',
        fill: 0xf59e0b, // p2-color (アンバー)
      },
    })
    this.p2Label.y = -28
    this.addChild(this.p2Label)

    this.p1 = new PlayerBoard(
      {
        onChain: () => this.transferGarbage(this.p1, this.p2),
        onCleared: () => this.handleEnd('p1', 'cleared'),
        onGameOver: () => this.handleEnd('p1', 'gameover'),
      },
      soundManager
    )
    this.p2 = new PlayerBoard(
      {
        onChain: () => this.transferGarbage(this.p2, this.p1),
        onCleared: () => this.handleEnd('p2', 'cleared'),
        onGameOver: () => this.handleEnd('p2', 'gameover'),
      },
      soundManager
    )

    // 仮配置 (initWithStates で再配置する)。
    this.p1.x = 0
    this.p1.y = 0
    this.p2.x = 300
    this.p2.y = 0
    this.addChild(this.p1)
    this.addChild(this.p2)

    // テキスト色は UI_TEXT_PRIMARY も参照可能だが、ここではプレイヤー色を直接指定。
    // 未使用警告を防ぐ参照。
    void UI_TEXT_PRIMARY
  }

  /**
   * 両プレイヤーを同じお題で初期化する。
   *
   * 注意: state は 2 つとも **独立した参照** であること。
   * 同一参照を渡すと両者の盤面が同期して動いてしまう。
   * 呼び出し側 (`main.ts`) は `buildGameStateFromPuzzle` を 2 回呼ぶか、
   * 構造化クローンで複製する。
   */
  initWithStates(p1State: GameState, p2State: GameState): void {
    this.settled = false
    this.p1.initWithState(p1State)
    this.p2.initWithState(p2State)

    const { width: boardW } = this.p1.getBoardSize()
    // 中央寄せ: 全体幅 = 2*boardW + GAP、左右対称に配置。
    const totalWidth = boardW * 2 + BOARD_GAP_PX
    const baseX = -totalWidth / 2
    this.p1.x = baseX
    this.p2.x = baseX + boardW + BOARD_GAP_PX
    this.p1.y = 0
    this.p2.y = 0

    // ラベルは各盤面の左上に。
    this.p1Label.x = this.p1.x
    this.p2Label.x = this.p2.x
  }

  /** 1 フレームぶんの更新。両プレイヤーを進める。 */
  update(ticker: Ticker): void {
    this.p1.update(ticker)
    this.p2.update(ticker)
  }

  /**
   * KeyboardManager の購読。
   *
   * 本 Issue では P1 のみ操作可能 (キーボード ← → ↓)。
   * P2 はオートプレイなしで待機する (= 1 個目を落とすところまでは見える)。
   *
   * S5/S6: Esc (`cancel`) はゲーム中タイトルへ戻すフックを叩く。
   *
   * @param keyboard キーボード入力 Manager。
   * @param onExitToTitle Esc でタイトルへ戻すコールバック。未指定なら Esc は無視。
   */
  attachInputs(
    keyboard: KeyboardManager,
    onExitToTitle?: () => void
  ): () => void {
    const handler = (cmd: KeyboardCommand): void => {
      switch (cmd) {
        case 'left':
          this.p1.tryMove(-1)
          break
        case 'right':
          this.p1.tryMove(+1)
          break
        case 'drop':
          this.p1.tryDrop()
          break
        case 'togglePause':
          this.p1.togglePause()
          this.p2.togglePause()
          break
        case 'cancel':
          onExitToTitle?.()
          break
        default:
          break
      }
    }
    return keyboard.onCommand(handler)
  }

  // ----------------------------------------------------------------------
  // private
  // ----------------------------------------------------------------------

  /**
   * `from` が溜めたお邪魔を `to` に流す。
   * onChain は連鎖の各ステップで呼ばれるが、毎ステップごとに送る方が
   * 「連鎖中じわじわ降ってくる」絵になるので 1 段ずつ即時転送する。
   */
  private transferGarbage(from: PlayerBoard, to: PlayerBoard): void {
    const n = from.consumePendingGarbage()
    if (n > 0) to.garbageReceived(n)
  }

  /**
   * 片方の終了 (cleared / gameover) を受けて勝敗を確定する。
   *
   * - cleared: その側の勝ち (相手の状態に関わらず先に消し切った方の勝利)。
   * - gameover: 相手の勝ち。
   *
   * 既に確定済みなら no-op。
   */
  private handleEnd(side: 'p1' | 'p2', kind: 'cleared' | 'gameover'): void {
    if (this.settled) return
    this.settled = true
    const winner = kind === 'cleared' ? side : side === 'p1' ? 'p2' : 'p1'
    if (winner === 'p1') this.callbacks.onP1Win?.()
    else this.callbacks.onP2Win?.()
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    super.destroy(options ?? { children: true })
  }
}
