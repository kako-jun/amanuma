import Phaser from 'phaser'
import { GameBoard } from './GameBoard'
import { COLS, ROWS, BLOCK_SIZE, COLORS, CHAIN_BONUS, SEVEN_PROBABILITY, LINES_PER_LEVEL, MIN_DROP_INTERVAL, BASE_DROP_INTERVAL, SCORE_PER_BLOCK, UI_COLORS, GAME_WIDTH, GAME_HEIGHT } from './constants'
import { BlockEffects } from './BlockEffects'

/**
 * 2人対戦モードのシーン
 * 横画面で左右にフィールドを配置
 */
export class VersusScene extends Phaser.Scene {
  private player1!: GameBoard
  private player2!: GameBoard
  private p1Effects!: BlockEffects
  private p2Effects!: BlockEffects
  private graphics!: Phaser.GameObjects.Graphics

  // Player 1 UI
  private p1ScoreText!: Phaser.GameObjects.Text
  private p1LevelText!: Phaser.GameObjects.Text
  private p1ChainText!: Phaser.GameObjects.Text

  // Player 2 UI
  private p2ScoreText!: Phaser.GameObjects.Text
  private p2LevelText!: Phaser.GameObjects.Text
  private p2ChainText!: Phaser.GameObjects.Text

  // Text object pool
  private textPool: Phaser.GameObjects.Text[]
  private textPoolIndex: number

  // Controls
  private wasd!: {
    w: Phaser.Input.Keyboard.Key
    a: Phaser.Input.Keyboard.Key
    s: Phaser.Input.Keyboard.Key
    d: Phaser.Input.Keyboard.Key
  }
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private rKey!: Phaser.Input.Keyboard.Key
  private escKey!: Phaser.Input.Keyboard.Key

  private paused: boolean
  private pauseText!: Phaser.GameObjects.Text
  private winner: number // 0=進行中, 1=P1勝利, 2=P2勝利

  // デバウンス用
  private p1LastMoveTime: number
  private p2LastMoveTime: number
  private moveDebounceMs: number

  // 共有ブロックキュー
  private sharedBlockQueue: number[]
  private p1BlockIndex: number // P1が次に使うブロックのインデックス
  private p2BlockIndex: number // P2が次に使うブロックのインデックス

  constructor() {
    super({ key: 'VersusScene' })
    this.textPool = []
    this.textPoolIndex = 0
    this.paused = false
    this.winner = 0
    this.p1LastMoveTime = 0
    this.p2LastMoveTime = 0
    this.moveDebounceMs = 150
    this.sharedBlockQueue = []
    this.p1BlockIndex = 0
    this.p2BlockIndex = 0
  }

  create() {
    // フェードイン効果
    this.cameras.main.fadeIn(300, 15, 15, 26)

    // 背景を描画
    this.drawModernBackground()

    // Player 1 のボード（左側）
    this.player1 = new GameBoard(50, 100)
    this.p1Effects = new BlockEffects(this, 50, 100)

    // Player 2 のボード（右側）
    this.player2 = new GameBoard(500, 100)
    this.p2Effects = new BlockEffects(this, 500, 100)

    // Graphics
    this.graphics = this.add.graphics()

    // Title
    this.add.text(400, 25, 'VS MODE', {
      fontSize: '28px',
      color: '#a855f7',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    // Player 1 パネル
    this.createPlayerPanel(1, 50, 55)
    this.p1ScoreText = this.add.text(130, 70, '0', {
      fontSize: '20px',
      color: '#f8fafc',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.p1LevelText = this.add.text(200, 70, 'Lv.1', {
      fontSize: '14px',
      color: '#10b981',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.p1ChainText = this.add.text(175, 85, '', {
      fontSize: '14px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    // Next display for P1
    this.createNextPanel(320, 55)

    // Player 2 パネル
    this.createPlayerPanel(2, 500, 55)
    this.p2ScoreText = this.add.text(580, 70, '0', {
      fontSize: '20px',
      color: '#f8fafc',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.p2LevelText = this.add.text(650, 70, 'Lv.1', {
      fontSize: '14px',
      color: '#10b981',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.p2ChainText = this.add.text(625, 85, '', {
      fontSize: '14px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    // Next display for P2
    this.createNextPanel(770, 55)

    // Controls info
    const controlsBg = this.add.graphics()
    controlsBg.fillStyle(UI_COLORS.backgroundCard, 0.7)
    controlsBg.fillRoundedRect(150, 615, 500, 24, 4)

    this.add.text(400, 627, '🎮 P1: A S D  |  P2: ← ↓ →  |  P: Pause', {
      fontSize: '12px',
      color: '#64748b',
    }).setOrigin(0.5)

    // Pause text
    this.pauseText = this.add
      .text(400, 350, '⏸ PAUSED', {
        fontSize: '36px',
        color: '#f8fafc',
        align: 'center',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setVisible(false)

    // Text object pool (2 fields + 2 next blocks)
    const poolSize = (ROWS * COLS + 1) * 2
    for (let i = 0; i < poolSize; i++) {
      const text = this.add.text(0, 0, '', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      text.setOrigin(0.5)
      text.setStroke('#000000', 3)
      text.setVisible(false)
      this.textPool.push(text)
    }

    // Keyboard setup
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

    // 共有ブロックキューを初期化
    this.sharedBlockQueue = []
    for (let i = 0; i < 100; i++) {
      this.sharedBlockQueue.push(this.generateSharedBlock())
    }

    // 両プレイヤーに同じブロックを設定
    const firstBlock = this.sharedBlockQueue[0]
    const secondBlock = this.sharedBlockQueue[1]
    this.p1BlockIndex = 2
    this.p2BlockIndex = 2

    // P1のブロックを設定
    this.player1.nextBlock = secondBlock
    this.player1.currentBlock = {
      value: firstBlock,
      x: Math.floor(COLS / 2),
      y: 0,
    }

    // P2のブロックを設定（同じブロック）
    this.player2.nextBlock = secondBlock
    this.player2.currentBlock = {
      value: firstBlock,
      x: Math.floor(COLS / 2),
      y: 0,
    }

    // Draw background
    this.drawBackground()
  }

  /** 共有ブロック生成（確率調整） */
  private generateSharedBlock(): number {
    const rand = Math.random()
    if (rand < SEVEN_PROBABILITY) {
      return 7
    }
    return Math.floor(rand * 6.12) + 1
  }

  /** 共有キューから次のブロックを取得 */
  private getNextSharedBlock(playerNum: number): number {
    const index = playerNum === 1 ? this.p1BlockIndex : this.p2BlockIndex

    // キューが足りなくなったら追加
    while (index >= this.sharedBlockQueue.length) {
      for (let i = 0; i < 50; i++) {
        this.sharedBlockQueue.push(this.generateSharedBlock())
      }
    }

    const block = this.sharedBlockQueue[index]
    if (playerNum === 1) {
      this.p1BlockIndex++
    } else {
      this.p2BlockIndex++
    }
    return block
  }

  update(_time: number, delta: number) {
    // Pause toggle
    if (Phaser.Input.Keyboard.JustDown(this.input.keyboard!.addKey('P'))) {
      this.togglePause()
      return
    }

    // Restart or return to title
    if (this.winner !== 0) {
      if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
        this.scene.restart()
        return
      }
      if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
        this.scene.start('TitleScene')
        return
      }
    }

    if (this.paused || this.winner !== 0) {
      return
    }

    // Update drop timers
    this.player1.dropTimer += delta
    this.player2.dropTimer += delta

    // Player 1 controls (WASD) - デバウンス付き
    const now = this.time.now
    if (Phaser.Input.Keyboard.JustDown(this.wasd.a)) {
      if (now - this.p1LastMoveTime >= this.moveDebounceMs) {
        this.player1.move(-1)
        this.p1LastMoveTime = now
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.wasd.d)) {
      if (now - this.p1LastMoveTime >= this.moveDebounceMs) {
        this.player1.move(1)
        this.p1LastMoveTime = now
      }
    }
    if (this.wasd.s.isDown) {
      if (this.player1.dropTimer > 100) {
        this.handleDrop(this.player1, this.player2, 1)
        this.player1.dropTimer = 0
      }
    } else if (this.player1.dropTimer >= this.player1.dropInterval) {
      this.handleDrop(this.player1, this.player2, 1)
      this.player1.dropTimer = 0
    }

    // Player 2 controls (Arrow keys) - デバウンス付き
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
      if (now - this.p2LastMoveTime >= this.moveDebounceMs) {
        this.player2.move(-1)
        this.p2LastMoveTime = now
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
      if (now - this.p2LastMoveTime >= this.moveDebounceMs) {
        this.player2.move(1)
        this.p2LastMoveTime = now
      }
    }
    if (this.cursors.down?.isDown) {
      if (this.player2.dropTimer > 100) {
        this.handleDrop(this.player2, this.player1, 2)
        this.player2.dropTimer = 0
      }
    } else if (this.player2.dropTimer >= this.player2.dropInterval) {
      this.handleDrop(this.player2, this.player1, 2)
      this.player2.dropTimer = 0
    }

    // Update UI
    this.p1ScoreText.setText(`${this.player1.score}`)
    this.p1LevelText.setText(`Lv.${this.player1.level}`)
    this.p2ScoreText.setText(`${this.player2.score}`)
    this.p2LevelText.setText(`Lv.${this.player2.level}`)

    this.draw()
  }

  private togglePause() {
    this.paused = !this.paused
    this.pauseText.setVisible(this.paused)
  }

  // タッチ入力用の公開メソッド（Player 1）
  public p1TouchLeft() {
    if (!this.paused && this.winner === 0) {
      this.player1.move(-1)
    }
  }

  public p1TouchRight() {
    if (!this.paused && this.winner === 0) {
      this.player1.move(1)
    }
  }

  public p1TouchDown() {
    if (!this.paused && this.winner === 0) {
      this.handleDrop(this.player1, this.player2, 1)
      this.player1.dropTimer = 0
    }
  }

  // タッチ入力用の公開メソッド（Player 2）
  public p2TouchLeft() {
    if (!this.paused && this.winner === 0) {
      this.player2.move(-1)
    }
  }

  public p2TouchRight() {
    if (!this.paused && this.winner === 0) {
      this.player2.move(1)
    }
  }

  public p2TouchDown() {
    if (!this.paused && this.winner === 0) {
      this.handleDrop(this.player2, this.player1, 2)
      this.player2.dropTimer = 0
    }
  }

  /**
   * ブロック落下処理と攻撃システム
   */
  private handleDrop(player: GameBoard, opponent: GameBoard, playerNum: number) {
    const landed = player.drop()

    if (landed) {
      // Reset chain count
      player.chainCount = 0

      // Check and clear with chain
      this.checkAndClearWithChain(player, opponent, playerNum)

      // Spawn new block using shared queue
      const isGameOver = this.spawnSharedBlock(player, playerNum)

      if (isGameOver) {
        this.handleGameOver(playerNum === 1 ? 2 : 1)
      }
    }
  }

  /**
   * 共有キューからブロックを生成
   */
  private spawnSharedBlock(player: GameBoard, playerNum: number): boolean {
    const value = player.nextBlock
    // 共有キューから次のブロックを取得
    player.nextBlock = this.getNextSharedBlock(playerNum)

    player.currentBlock = {
      value: value,
      x: Math.floor(COLS / 2),
      y: 0,
    }

    // ゲームオーバー判定
    if (player.board[0][player.currentBlock.x] !== 0) {
      player.gameOver = true
      return true
    }

    return false
  }

  /**
   * 連鎖チェックと攻撃処理（アニメーション付き）
   */
  private checkAndClearWithChain(
    player: GameBoard,
    opponent: GameBoard,
    playerNum: number
  ) {
    const effects = playerNum === 1 ? this.p1Effects : this.p2Effects
    const result = effects.findBlocksToRemove(player.board)

    if (result.toRemove.size > 0) {
      player.chainCount++

      // Update chain text
      const chainText = playerNum === 1 ? this.p1ChainText : this.p2ChainText
      if (player.chainCount > 1) {
        chainText.setText(`${player.chainCount} Chain!`)
        this.time.delayedCall(3000, () => {
          chainText.setText('')
        })

        // Chain bonus
        const bonus = player.chainCount * CHAIN_BONUS
        player.score += bonus
      }

      // 演出を再生してから消去
      effects.playRemoveAnimation(player.board, result.toRemove, result.hasTripleSeven, player.chainCount > 1, () => {
        // 実際に消去
        result.toRemove.forEach(key => {
          const [x, y] = key.split(',').map(Number)
          player.board[y][x] = 0
        })

        // スコア加算
        player.score += result.toRemove.size * SCORE_PER_BLOCK
        player.linesCleared++

        // レベルアップ処理
        const newLevel = Math.floor(player.linesCleared / LINES_PER_LEVEL) + 1
        if (newLevel > player.level) {
          player.level = newLevel
          player.dropInterval = Math.max(
            BASE_DROP_INTERVAL / (1 + (player.level - 1) * 0.1),
            MIN_DROP_INTERVAL
          )
        }

        // Attack: send garbage blocks to opponent
        if (player.chainCount > 0) {
          const garbageCount = Math.max(1, Math.floor(result.toRemove.size / 3))
          opponent.addGarbageBlocks(garbageCount)
        }

        // 重力を適用（アニメーション付き）
        effects.applyGravityWithAnimation(player.board, () => {
          // Continue chain check
          this.time.delayedCall(50, () => {
            this.checkAndClearWithChain(player, opponent, playerNum)
          })
        })
      })
    }
  }

  /**
   * ゲーム終了処理
   */
  private handleGameOver(winnerNum: number) {
    this.winner = winnerNum

    const winnerText = winnerNum === 1 ? 'Player 1 WINS!' : 'Player 2 WINS!'
    const color = winnerNum === 1 ? '#10b981' : '#f59e0b'
    const borderColor = winnerNum === 1 ? UI_COLORS.success : UI_COLORS.warning

    // 勝利パネル背景
    const winBg = this.add.graphics()
    winBg.fillStyle(UI_COLORS.backgroundCard, 0.95)
    winBg.fillRoundedRect(200, 250, 400, 140, 16)
    winBg.lineStyle(3, borderColor, 0.8)
    winBg.strokeRoundedRect(200, 250, 400, 140, 16)

    this.add
      .text(400, 290, '🏆', {
        fontSize: '32px',
      })
      .setOrigin(0.5)

    this.add
      .text(400, 330, winnerText, {
        fontSize: '32px',
        color: color,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)

    this.add
      .text(400, 370, 'R: Restart  |  ESC: Title', {
        fontSize: '14px',
        color: '#94a3b8',
        align: 'center',
      })
      .setOrigin(0.5)
  }

  /**
   * モダン背景を描画（create時に1回だけ）
   */
  private drawModernBackground() {
    const bg = this.add.graphics()

    // 全体背景
    bg.fillStyle(UI_COLORS.background, 1)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Player 1 ボード背景
    bg.fillStyle(UI_COLORS.backgroundLight, 1)
    bg.fillRoundedRect(
      this.player1?.offsetX ?? 50 - 10,
      100 - 10,
      COLS * BLOCK_SIZE + 20,
      ROWS * BLOCK_SIZE + 20,
      12
    )
    bg.fillStyle(UI_COLORS.background, 0.8)
    bg.fillRect(this.player1?.offsetX ?? 50, 100, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE)

    // Player 2 ボード背景
    bg.fillStyle(UI_COLORS.backgroundLight, 1)
    bg.fillRoundedRect(
      500 - 10,
      100 - 10,
      COLS * BLOCK_SIZE + 20,
      ROWS * BLOCK_SIZE + 20,
      12
    )
    bg.fillStyle(UI_COLORS.background, 0.8)
    bg.fillRect(500, 100, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE)

    // 中央の「VS」
    bg.fillStyle(UI_COLORS.primary, 0.1)
    bg.fillCircle(400, 350, 40)

    this.add.text(400, 350, 'VS', {
      fontSize: '24px',
      color: '#7c3aed',
      fontStyle: 'bold',
    }).setOrigin(0.5)
  }

  /**
   * プレイヤーパネルを作成
   */
  private createPlayerPanel(playerNum: number, x: number, y: number) {
    const panel = this.add.graphics()
    const color = playerNum === 1 ? UI_COLORS.success : UI_COLORS.warning
    const labelColor = playerNum === 1 ? '#10b981' : '#f59e0b'

    // パネル背景
    panel.fillStyle(UI_COLORS.backgroundCard, 0.9)
    panel.fillRoundedRect(x, y, 200, 40, 8)
    panel.lineStyle(1, color, 0.5)
    panel.strokeRoundedRect(x, y, 200, 40, 8)

    // プレイヤーラベル
    this.add.text(x + 10, y + 20, `P${playerNum}`, {
      fontSize: '16px',
      color: labelColor,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5)
  }

  /**
   * ネクストパネルを作成
   */
  private createNextPanel(x: number, y: number) {
    const panel = this.add.graphics()
    panel.fillStyle(UI_COLORS.backgroundCard, 0.9)
    panel.fillRoundedRect(x - 35, y, 70, 70, 8)
    panel.lineStyle(1, UI_COLORS.border, 0.5)
    panel.strokeRoundedRect(x - 35, y, 70, 70, 8)

    this.add.text(x, y + 8, 'NEXT', {
      fontSize: '10px',
      color: '#64748b',
    }).setOrigin(0.5)
  }

  /**
   * 背景とグリッドを描画
   */
  private drawBackground() {
    // グリッド線（より繊細に）
    this.graphics.lineStyle(1, UI_COLORS.border, 0.3)

    // Player 1 grid
    for (let x = 0; x <= COLS; x++) {
      this.graphics.lineBetween(
        this.player1.offsetX + x * BLOCK_SIZE,
        this.player1.offsetY,
        this.player1.offsetX + x * BLOCK_SIZE,
        this.player1.offsetY + ROWS * BLOCK_SIZE
      )
    }
    for (let y = 0; y <= ROWS; y++) {
      this.graphics.lineBetween(
        this.player1.offsetX,
        this.player1.offsetY + y * BLOCK_SIZE,
        this.player1.offsetX + COLS * BLOCK_SIZE,
        this.player1.offsetY + y * BLOCK_SIZE
      )
    }

    // Player 2 grid
    for (let x = 0; x <= COLS; x++) {
      this.graphics.lineBetween(
        this.player2.offsetX + x * BLOCK_SIZE,
        this.player2.offsetY,
        this.player2.offsetX + x * BLOCK_SIZE,
        this.player2.offsetY + ROWS * BLOCK_SIZE
      )
    }
    for (let y = 0; y <= ROWS; y++) {
      this.graphics.lineBetween(
        this.player2.offsetX,
        this.player2.offsetY + y * BLOCK_SIZE,
        this.player2.offsetX + COLS * BLOCK_SIZE,
        this.player2.offsetY + y * BLOCK_SIZE
      )
    }

    // ボード枠
    this.graphics.lineStyle(2, UI_COLORS.success, 0.5)
    this.graphics.strokeRoundedRect(
      this.player1.offsetX - 2,
      this.player1.offsetY - 2,
      COLS * BLOCK_SIZE + 4,
      ROWS * BLOCK_SIZE + 4,
      4
    )

    this.graphics.lineStyle(2, UI_COLORS.warning, 0.5)
    this.graphics.strokeRoundedRect(
      this.player2.offsetX - 2,
      this.player2.offsetY - 2,
      COLS * BLOCK_SIZE + 4,
      ROWS * BLOCK_SIZE + 4,
      4
    )
  }

  /**
   * ゲームボードを描画
   */
  private draw() {
    this.graphics.clear()
    this.drawBackground()

    // Reset text pool
    this.textPoolIndex = 0
    this.textPool.forEach(text => {
      text.setVisible(false)
      text.setScale(1)
      text.setAlpha(1)
    })

    const textPoolIndex = { value: this.textPoolIndex }

    // Draw Player 1
    this.drawBoard(this.player1, this.p1Effects)
    this.p1Effects.drawAnimatingBlocks(this.graphics, this.textPool, textPoolIndex)
    this.p1Effects.drawFallingBlocks(this.graphics, this.textPool, textPoolIndex)
    if (this.player1.currentBlock) {
      this.drawBlock(
        this.player1.offsetX,
        this.player1.offsetY,
        this.player1.currentBlock.x,
        this.player1.currentBlock.y,
        this.player1.currentBlock.value
      )
    }
    this.drawNextBlock(this.player1.nextBlock, 340, 60)

    // Draw Player 2
    this.drawBoard(this.player2, this.p2Effects)
    this.p2Effects.drawAnimatingBlocks(this.graphics, this.textPool, textPoolIndex)
    this.p2Effects.drawFallingBlocks(this.graphics, this.textPool, textPoolIndex)
    if (this.player2.currentBlock) {
      this.drawBlock(
        this.player2.offsetX,
        this.player2.offsetY,
        this.player2.currentBlock.x,
        this.player2.currentBlock.y,
        this.player2.currentBlock.value
      )
    }
    this.drawNextBlock(this.player2.nextBlock, 740, 60)

    this.textPoolIndex = textPoolIndex.value
  }

  private drawBoard(board: GameBoard, effects: BlockEffects) {
    const excludedKeys = effects.getExcludedKeys()
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board.board[y][x] !== 0 && !excludedKeys.has(`${x},${y}`)) {
          this.drawBlock(
            board.offsetX,
            board.offsetY,
            x,
            y,
            board.board[y][x]
          )
        }
      }
    }
  }

  private drawBlock(
    offsetX: number,
    offsetY: number,
    x: number,
    y: number,
    value: number
  ) {
    const centerX = offsetX + x * BLOCK_SIZE + BLOCK_SIZE / 2
    const centerY = offsetY + y * BLOCK_SIZE + BLOCK_SIZE / 2
    const size = BLOCK_SIZE - 4
    const halfSize = size / 2
    const radius = 6

    // 7の場合はグロー効果
    if (value === 7) {
      this.graphics.fillStyle(COLORS[value], 0.3)
      this.graphics.fillRoundedRect(
        centerX - halfSize - 3,
        centerY - halfSize - 3,
        size + 6,
        size + 6,
        radius + 2
      )
    }

    // Block background (角丸)
    this.graphics.fillStyle(COLORS[value], 1)
    this.graphics.fillRoundedRect(
      centerX - halfSize,
      centerY - halfSize,
      size,
      size,
      radius
    )

    // ハイライト（上部）
    this.graphics.fillStyle(0xffffff, 0.15)
    this.graphics.fillRoundedRect(
      centerX - halfSize + 2,
      centerY - halfSize + 2,
      size - 4,
      size * 0.3,
      { tl: radius - 1, tr: radius - 1, bl: 0, br: 0 }
    )

    // Number text
    if (this.textPoolIndex < this.textPool.length) {
      const text = this.textPool[this.textPoolIndex++]
      text.setText(value.toString())
      text.setPosition(centerX, centerY)
      text.setVisible(true)
    }
  }

  private drawNextBlock(value: number, x: number, y: number) {
    const blockSize = 40
    const actualY = y + 35

    // グロー効果
    this.graphics.fillStyle(COLORS[value], 0.2)
    this.graphics.fillRoundedRect(x - blockSize / 2 - 3, actualY - blockSize / 2 - 3, blockSize + 6, blockSize + 6, 8)

    // Background
    this.graphics.fillStyle(COLORS[value], 1)
    this.graphics.fillRoundedRect(x - blockSize / 2, actualY - blockSize / 2, blockSize, blockSize, 6)

    // Number
    if (this.textPoolIndex < this.textPool.length) {
      const text = this.textPool[this.textPoolIndex++]
      text.setText(value.toString())
      text.setPosition(x, actualY)
      text.setVisible(true)
    }
  }
}
