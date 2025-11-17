import Phaser from 'phaser'
import { GameBoard, COLS, ROWS, BLOCK_SIZE, COLORS } from './GameBoard'

/**
 * 2人対戦モードのシーン
 * 横画面で左右にフィールドを配置
 */
export class VersusScene extends Phaser.Scene {
  private player1!: GameBoard
  private player2!: GameBoard
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

  constructor() {
    super({ key: 'VersusScene' })
    this.textPool = []
    this.textPoolIndex = 0
    this.paused = false
    this.winner = 0
  }

  create() {
    // Player 1 のボード（左側）
    this.player1 = new GameBoard(this, 50, 80)

    // Player 2 のボード（右側）
    this.player2 = new GameBoard(this, 450, 80)

    // Graphics
    this.graphics = this.add.graphics()

    // Title
    this.add.text(400, 20, 'VS MODE', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    // Player 1 UI (左上)
    this.add.text(50, 10, 'Player 1', {
      fontSize: '20px',
      color: '#00ff00',
      fontStyle: 'bold',
    })
    this.p1ScoreText = this.add.text(50, 35, 'Score: 0', {
      fontSize: '16px',
      color: '#ffffff',
    })
    this.p1LevelText = this.add.text(50, 55, 'Level: 1', {
      fontSize: '14px',
      color: '#aaaaaa',
    })
    this.p1ChainText = this.add.text(150, 35, '', {
      fontSize: '16px',
      color: '#ffff00',
    })

    // Next display for P1
    this.add.text(320, 10, 'Next', {
      fontSize: '14px',
      color: '#888888',
    })

    // Player 2 UI (右上)
    this.add.text(450, 10, 'Player 2', {
      fontSize: '20px',
      color: '#ff6600',
      fontStyle: 'bold',
    })
    this.p2ScoreText = this.add.text(450, 35, 'Score: 0', {
      fontSize: '16px',
      color: '#ffffff',
    })
    this.p2LevelText = this.add.text(450, 55, 'Level: 1', {
      fontSize: '14px',
      color: '#aaaaaa',
    })
    this.p2ChainText = this.add.text(550, 35, '', {
      fontSize: '16px',
      color: '#ffff00',
    })

    // Next display for P2
    this.add.text(720, 10, 'Next', {
      fontSize: '14px',
      color: '#888888',
    })

    // Controls info
    this.add.text(400, 590, 'P1: WASD | P2: Arrow Keys | P: Pause | R: Restart | ESC: Title', {
      fontSize: '12px',
      color: '#666666',
    }).setOrigin(0.5)

    // Pause text
    this.pauseText = this.add
      .text(400, 300, 'PAUSED\n\nPress P to Resume', {
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#000000cc',
        padding: { x: 30, y: 20 },
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

    // Spawn initial blocks
    this.player1.spawnBlock()
    this.player2.spawnBlock()

    // Draw background
    this.drawBackground()
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

    // Player 1 controls (WASD)
    if (Phaser.Input.Keyboard.JustDown(this.wasd.a)) {
      this.player1.move(-1)
    }
    if (Phaser.Input.Keyboard.JustDown(this.wasd.d)) {
      this.player1.move(1)
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

    // Player 2 controls (Arrow keys)
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
      this.player2.move(-1)
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
      this.player2.move(1)
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
    this.p1ScoreText.setText(`Score: ${this.player1.score}`)
    this.p1LevelText.setText(`Level: ${this.player1.level}`)
    this.p2ScoreText.setText(`Score: ${this.player2.score}`)
    this.p2LevelText.setText(`Level: ${this.player2.level}`)

    this.draw()
  }

  private togglePause() {
    this.paused = !this.paused
    this.pauseText.setVisible(this.paused)
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

      // Spawn new block
      const isGameOver = player.spawnBlock()

      if (isGameOver) {
        this.handleGameOver(playerNum === 1 ? 2 : 1)
      }
    }
  }

  /**
   * 連鎖チェックと攻撃処理
   */
  private checkAndClearWithChain(
    player: GameBoard,
    opponent: GameBoard,
    playerNum: number
  ) {
    const cleared = player.checkAndClearSevens()

    if (cleared > 0) {
      player.chainCount++

      // Update chain text
      const chainText = playerNum === 1 ? this.p1ChainText : this.p2ChainText
      if (player.chainCount > 1) {
        chainText.setText(`${player.chainCount} Chain!`)
        this.time.delayedCall(3000, () => {
          chainText.setText('')
        })

        // Chain bonus
        const bonus = player.chainCount * 50
        player.score += bonus
      }

      // Attack: send garbage blocks to opponent
      if (player.chainCount > 0) {
        const garbageCount = Math.max(1, Math.floor(cleared / 3))
        opponent.addGarbageBlocks(garbageCount)
      }

      // Continue chain check
      this.time.delayedCall(300, () => {
        this.checkAndClearWithChain(player, opponent, playerNum)
      })
    }
  }

  /**
   * ゲーム終了処理
   */
  private handleGameOver(winnerNum: number) {
    this.winner = winnerNum

    const winnerText = winnerNum === 1 ? 'Player 1 WINS!' : 'Player 2 WINS!'
    const color = winnerNum === 1 ? '#00ff00' : '#ff6600'

    this.add
      .text(400, 250, winnerText, {
        fontSize: '48px',
        color: color,
        fontStyle: 'bold',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)

    this.add
      .text(400, 320, 'R: Restart  ESC: Title', {
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
  }

  /**
   * 背景とグリッドを描画
   */
  private drawBackground() {
    this.graphics.lineStyle(2, 0x444444, 1)

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

    // Next block frames
    this.graphics.lineStyle(2, 0x666666, 1)
    this.graphics.strokeRect(310, 30, 60, 60) // P1 next
    this.graphics.strokeRect(710, 30, 60, 60) // P2 next

    // Center divider
    this.graphics.lineStyle(3, 0x666666, 1)
    this.graphics.lineBetween(400, 60, 400, 580)
  }

  /**
   * ゲームボードを描画
   */
  private draw() {
    this.graphics.clear()
    this.drawBackground()

    // Reset text pool
    this.textPoolIndex = 0
    this.textPool.forEach(text => text.setVisible(false))

    // Draw Player 1
    this.drawBoard(this.player1)
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
    this.drawBoard(this.player2)
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
  }

  private drawBoard(board: GameBoard) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board.board[y][x] !== 0) {
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
    // Block background
    this.graphics.fillStyle(COLORS[value], 1)
    this.graphics.fillRect(
      offsetX + x * BLOCK_SIZE + 2,
      offsetY + y * BLOCK_SIZE + 2,
      BLOCK_SIZE - 4,
      BLOCK_SIZE - 4
    )

    // Number text
    if (this.textPoolIndex < this.textPool.length) {
      const text = this.textPool[this.textPoolIndex++]
      text.setText(value.toString())
      text.setPosition(
        offsetX + x * BLOCK_SIZE + BLOCK_SIZE / 2,
        offsetY + y * BLOCK_SIZE + BLOCK_SIZE / 2
      )
      text.setVisible(true)
    }
  }

  private drawNextBlock(value: number, x: number, y: number) {
    // Background
    this.graphics.fillStyle(COLORS[value], 1)
    this.graphics.fillRect(x - 20, y - 20, 40, 40)

    // Number
    if (this.textPoolIndex < this.textPool.length) {
      const text = this.textPool[this.textPoolIndex++]
      text.setText(value.toString())
      text.setPosition(x, y)
      text.setVisible(true)
    }
  }
}
