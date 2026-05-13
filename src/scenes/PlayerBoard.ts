/**
 * プレイヤー単位の盤面 (Issue #21)。
 *
 * 旧 `GameScene` の「物理ステップ → 着水検知 → 連鎖 → スポーン」フローを
 * **1 プレイヤー分** のロジックに切り出したもの。シングル (`GameScene`) と
 * 対戦 (`VersusScene`) の両方で再利用するのが目的。
 *
 * 責務:
 * - GameState の保持と毎フレームの物理/連鎖進行
 * - BoardRenderer / WaterSurface / BubbleParticleSystem の生成・破棄
 * - 着水時の演出発火 (波紋・泡・横揺れ)
 * - 連鎖時の clear 演出フックと、(対戦用) 消去数の通知
 * - cleared / gameover への遷移検知
 *
 * 外部 (`GameScene` / `VersusScene`) は次を行う:
 * - `update(deltaMS)` を毎フレーム呼ぶ
 * - `attachInputs` で 1 プレイヤー分の入力 (left/right/drop) を流す
 * - `onCleared` / `onGameOver` / `onChain` でゲーム進行を観測する
 * - `destroy()` で後片付け
 *
 * `Container` を継承するのは BoardRenderer / WaterSurface / BubbleParticleSystem を
 * 1 つの座標系にまとめてシーン (= world ローカル) に置きやすくするため。
 */
import type { Ticker } from 'pixi.js'
import { Container } from 'pixi.js'
import type { GameState } from '../types/GameState'
import { CELL_SIZE } from '../constants/colors'
import { BoardRenderer } from './BoardRenderer'
import { BeakerFrame } from './effects/BeakerFrame'
import { BubbleParticleSystem } from './effects/BubbleParticleSystem'
import { WaterSurface } from './effects/WaterSurface'
import { stepUnderwaterPhysics } from '../physics/UnderwaterPhysics'
import {
  canMoveFallingTo,
  countSevens,
  findLandingRow,
  lockFallingBlock,
} from '../game/board'
import { runChain } from '../game/ChainRunner'
import { generateBlockValue } from '../game/randomBlocks'
import { DROP_BOOST_VELOCITY } from '../input/constants'
import type { SoundManager } from '../audio/SoundManager'

export interface PlayerBoardCallbacks {
  /**
   * 1 連鎖ステップで消去が発生した際に呼ばれる。
   * 引数は消去数 (= clearCells の戻り値ではなく positions.size。
   * 着水演出側で十分な精度。対戦のお邪魔送信に使う)。
   */
  onChain?: (clearedCount: number, chainLevel: number) => void
  /** 残 7 が 0 になり cleared 遷移した直後に呼ばれる。 */
  onCleared?: () => void
  /**
   * gameover (= 列が満杯でスポーン不能) 遷移した直後に呼ばれる。
   * 本 Issue では gameover 判定は明示しないが、外部から `setGameOver()` で
   * トリガーできるよう用意する (対戦の敗北通知用)。
   */
  onGameOver?: () => void
}

/**
 * プレイヤー単位の盤面シーン。
 *
 * `addChild()` で BoardRenderer などを直接子に持つため、外部からの座標は
 * 「盤面の左上 = (0, 0)」を基準にすれば良い。
 */
export class PlayerBoard extends Container {
  private state: GameState | null = null
  private renderer: BoardRenderer | null = null
  private water: WaterSurface | null = null
  private bubbles: BubbleParticleSystem | null = null
  private beaker: BeakerFrame | null = null
  private isChaining: boolean = false
  /** 連鎖中に「あとで送るお邪魔」のキュー。対戦時に相手に伝えるための一時バッファ。 */
  private pendingGarbageOut: number = 0

  /**
   * 音マネージャ (Issue #22)。任意注入。null の場合は音呼出を完全にスキップする。
   * テストや音不要のモードで PlayerBoard を使うために optional にしている。
   */
  private soundManager: SoundManager | null

  constructor(
    private readonly callbacks: PlayerBoardCallbacks = {},
    soundManager: SoundManager | null = null
  ) {
    super()
    this.soundManager = soundManager
  }

  /** SoundManager を後から差し替える。null で音呼出を無効化。 */
  setSoundManager(sm: SoundManager | null): void {
    this.soundManager = sm
  }

  /** 任意の GameState で (再) 初期化する。 */
  initWithState(state: GameState): void {
    this.state = state
    this.isChaining = false
    this.pendingGarbageOut = 0

    if (this.renderer) {
      this.renderer.destroy({ children: true })
      this.renderer = null
    }
    if (this.water) {
      this.water.destroy({ children: true })
      this.water = null
    }
    if (this.bubbles) {
      this.bubbles.destroy({ children: true })
      this.bubbles = null
    }
    if (this.beaker) {
      this.beaker.destroy({ children: true })
      this.beaker = null
    }

    const boardWidthPx = state.cols * CELL_SIZE
    const boardHeightPx = state.rows * CELL_SIZE

    // ビーカー (Issue #31)。盤面の前後にレイヤーを挟むため、
    // back → 盤面 → 水面 → 泡 → front の順で addChild する。
    const beaker = new BeakerFrame({
      boardWidth: boardWidthPx,
      boardHeight: boardHeightPx,
    })
    const beakerBack = beaker.getBackLayer()
    beakerBack.x = 0
    beakerBack.y = 0
    this.addChild(beakerBack)
    this.beaker = beaker

    const renderer = new BoardRenderer(state, { cellSize: CELL_SIZE })
    // 盤面の左上 (0,0) に置く。配置 (中央寄せなど) は外部の親 Container に任せる。
    renderer.x = 0
    renderer.y = 0
    this.addChild(renderer)
    this.renderer = renderer

    const water = new WaterSurface(boardWidthPx)
    water.x = 0
    water.y = 0
    this.addChild(water)
    this.water = water

    const bubbles = new BubbleParticleSystem()
    bubbles.x = 0
    bubbles.y = 0
    this.addChild(bubbles)
    this.bubbles = bubbles

    // ガラスの輪郭・ハイライトは最前面に。盤面・水面・泡の上に乗せる。
    const beakerFront = beaker.getFrontLayer()
    beakerFront.x = 0
    beakerFront.y = 0
    this.addChild(beakerFront)

    if (state.fallingBlock !== null) {
      this.emitSpawnEffect(state.fallingBlock.col)
    }
  }

  /** 現在の state (参照)。 */
  getState(): GameState | null {
    return this.state
  }

  /** 盤面サイズ (px)。外部 (VersusScene 等) の配置計算で使う。 */
  getBoardSize(): { width: number; height: number } {
    const state = this.state
    if (state === null) return { width: 0, height: 0 }
    return {
      width: state.cols * CELL_SIZE,
      height: state.rows * CELL_SIZE,
    }
  }

  /** 1 フレームぶんの更新。Ticker から呼ばれる。 */
  update(ticker: Ticker): void {
    const state = this.state
    if (state === null) {
      this.renderer?.update()
      this.water?.update()
      this.bubbles?.update(ticker.deltaMS)
      return
    }

    if (state.status !== 'playing') {
      this.renderer?.update()
      this.water?.update()
      this.bubbles?.update(ticker.deltaMS)
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
        const landedCol = state.fallingBlock.col
        state.fallingBlock.row = landingRow
        lockFallingBlock(state)
        this.emitLandEffect(landingRow, landedCol)
        this.startChainSequence()
      }
    }

    this.renderer?.update()
    this.water?.update()
    this.bubbles?.update(ticker.deltaMS)
  }

  /**
   * 着水後の連鎖を起動 (mutate)。
   * 連鎖完了後にクリア判定 → 次ブロックスポーン。
   */
  private startChainSequence(): void {
    const state = this.state
    if (state === null) return

    this.isChaining = true
    void runChain(state, {
      onClear: positions => {
        this.emitClearBubbles(positions)
        const cleared = positions.size
        const chainLevel = state.chainCount + 1
        // chainCount は runChain 内で更新されるが、onClear は clearCells の直前。
        // chainLevel を独自に推定するのは難しいので chainCount を使う近似に留める。
        this.callbacks.onChain?.(cleared, chainLevel)
        // お邪魔送信 MVP: floor(clearedCount / 3)。
        this.pendingGarbageOut += Math.floor(cleared / 3)
        // 音 (Issue #22):
        //   - 各消去ステップで block-clear。
        //   - 2 連鎖目以降は chain-up を重ねる (盛り上げ用)。
        this.soundManager?.playSfx('block-clear')
        if (chainLevel >= 2) this.soundManager?.playSfx('chain-up')
      },
    }).then(() => {
      if (this.state !== state) {
        this.isChaining = false
        return
      }

      if (countSevens(state) === 0) {
        state.status = 'cleared'
        this.isChaining = false
        this.soundManager?.playSfx('puzzle-cleared')
        this.callbacks.onCleared?.()
        return
      }

      const spawnCol = Math.floor(state.cols / 2)
      // スポーン位置に既にブロックがあれば gameover。
      if (state.board[0][spawnCol] !== null) {
        state.status = 'gameover'
        this.isChaining = false
        this.soundManager?.playSfx('game-over')
        this.callbacks.onGameOver?.()
        return
      }
      state.fallingBlock = {
        value: state.nextBlock,
        col: spawnCol,
        row: 0,
        velocity: 0,
      }
      state.nextBlock = generateBlockValue()
      this.emitSpawnEffect(spawnCol)
      this.isChaining = false
    })
  }

  // ----------------------------------------------------------------------
  // 入力 API (左右移動・ドロップ)
  // ----------------------------------------------------------------------

  /** 左右移動。封じ条件 (status / 連鎖) は内部で見る。 */
  tryMove(deltaCol: number): void {
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

  /** ↓ 高速落下。velocity を加速する。 */
  tryDrop(): void {
    const state = this.state
    if (state === null) return
    if (state.status !== 'playing') return
    if (this.isChaining) return
    const falling = state.fallingBlock
    if (falling === null) return
    falling.velocity += DROP_BOOST_VELOCITY
  }

  /** P: playing ↔ paused 切替。cleared / gameover では無視。 */
  togglePause(): void {
    const state = this.state
    if (state === null) return
    if (state.status === 'playing') state.status = 'paused'
    else if (state.status === 'paused') state.status = 'playing'
  }

  // ----------------------------------------------------------------------
  // 対戦用 (お邪魔ブロックのやり取り)
  // ----------------------------------------------------------------------

  /**
   * 1 連鎖完結後に「これだけ相手に送る」量を消費して返す。
   *
   * 呼び出し側 (`VersusScene`) は本値を相手の `garbageReceived(n)` に流し込む。
   */
  consumePendingGarbage(): number {
    const n = this.pendingGarbageOut
    this.pendingGarbageOut = 0
    return n
  }

  /**
   * 相手から送られたお邪魔ブロックを受け取る (MVP)。
   *
   * MVP 仕様 (Issue #21):
   * - 最上段から下に向かって null セルを探し、ランダム値 1..6 のブロックを最大 `count` 個入れる。
   * - 上が詰まったらそこで打ち切り (gameover にはしない、本実装では妥協)。
   * - 連鎖中・cleared/gameover では消費せず捨てる (本 Issue では簡易化)。
   *
   * バランスは後続 Issue で調整する。
   */
  garbageReceived(count: number): void {
    const state = this.state
    if (state === null) return
    if (state.status !== 'playing') return
    if (this.isChaining) return
    if (count <= 0) return

    const { cols, rows, board } = state
    let placed = 0
    // 上から走査して null セルに詰める (上から積まれる絵)。
    outer: for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c] === null) {
          // 1..6 の中からランダム (お邪魔は 7 にはならない、テンポを崩さない範囲)。
          const v = (Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6
          board[r][c] = v
          placed++
          if (placed >= count) break outer
        }
      }
    }
  }

  // ----------------------------------------------------------------------
  // 演出 (旧 GameScene と同じ実装)
  // ----------------------------------------------------------------------

  private emitSpawnEffect(col: number): void {
    const state = this.state
    if (state === null) return
    const xPx = col * CELL_SIZE + CELL_SIZE / 2
    this.water?.splash(xPx, 0.7)
    this.bubbles?.emitBubbles({ x: xPx, y: 0, kind: 'spawn', count: 3 })
    this.soundManager?.playSfx('block-spawn')
  }

  private emitClearBubbles(positions: Set<number>): void {
    const state = this.state
    if (state === null || this.bubbles === null) return
    const cols = state.cols
    const COUNT_PER_CELL = 4
    for (const key of positions) {
      const row = Math.floor(key / cols)
      const col = key % cols
      const xPx = col * CELL_SIZE + CELL_SIZE / 2
      const yPx = row * CELL_SIZE + CELL_SIZE / 2
      this.bubbles.emitBubbles({
        x: xPx,
        y: yPx,
        kind: 'clear',
        count: COUNT_PER_CELL,
      })
    }
  }

  private emitLandEffect(row: number, col: number): void {
    const xPx = col * CELL_SIZE + CELL_SIZE / 2
    this.water?.splash(xPx, 1.0)
    const landY = row * CELL_SIZE + CELL_SIZE / 2
    this.bubbles?.emitBubbles({ x: xPx, y: landY, kind: 'land', count: 4 })
    this.renderer?.shake(row, col)
    this.soundManager?.playSfx('block-land')
  }

  /** PIXI の destroy をオーバーライドして state を解放する。 */
  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    super.destroy(options)
    this.state = null
    this.renderer = null
    this.water = null
    this.bubbles = null
    this.beaker = null
  }
}
