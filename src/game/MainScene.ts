import Phaser from 'phaser'

// ゲームの定数
const COLS = 10
const ROWS = 20
const BLOCK_SIZE = 30
const OFFSET_X = 50
const OFFSET_Y = 50

// テトロミノの形状定義
const SHAPES = [
  // I型
  [
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // O型
  [
    [1, 1, 0, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // T型
  [
    [0, 1, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // S型
  [
    [0, 1, 1, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // Z型
  [
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // J型
  [
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // L型
  [
    [0, 0, 1, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
]

const COLORS = [
  0x00ffff, // シアン (I)
  0xffff00, // 黄色 (O)
  0xff00ff, // マゼンタ (T)
  0x00ff00, // 緑 (S)
  0xff0000, // 赤 (Z)
  0x0000ff, // 青 (J)
  0xffa500, // オレンジ (L)
]

export class MainScene extends Phaser.Scene {
  private board: number[][]
  private currentPiece: {
    shape: number[][]
    x: number
    y: number
    color: number
  } | null
  private graphics!: Phaser.GameObjects.Graphics
  private scoreText!: Phaser.GameObjects.Text
  private score: number
  private dropTimer: number
  private dropInterval: number
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private gameOver: boolean

  constructor() {
    super({ key: 'MainScene' })
    this.board = []
    this.currentPiece = null
    this.score = 0
    this.dropTimer = 0
    this.dropInterval = 1000
    this.gameOver = false
  }

  create() {
    // ボードの初期化
    this.board = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0))

    // グラフィックスの作成
    this.graphics = this.add.graphics()

    // スコア表示
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '24px',
      color: '#ffffff',
    })

    // キーボード入力の設定
    this.cursors = this.input.keyboard!.createCursorKeys()

    // 最初のピースを生成
    this.spawnPiece()

    // ゲームループの開始
    this.time.addEvent({
      delay: this.dropInterval,
      callback: this.drop,
      callbackScope: this,
      loop: true,
    })

    // 背景を描画
    this.drawBackground()
  }

  update(_time: number, delta: number) {
    if (this.gameOver) {
      return
    }

    this.dropTimer += delta

    // キーボード入力の処理
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
      this.move(-1)
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
      this.move(1)
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      this.rotate()
    }
    if (this.cursors.down?.isDown) {
      if (this.dropTimer > 100) {
        this.drop()
        this.dropTimer = 0
      }
    }

    this.draw()
  }

  private spawnPiece() {
    const shapeIndex = Math.floor(Math.random() * SHAPES.length)
    this.currentPiece = {
      shape: SHAPES[shapeIndex],
      x: Math.floor(COLS / 2) - 2,
      y: 0,
      color: COLORS[shapeIndex],
    }

    // ゲームオーバー判定
    if (this.collision(0, 0)) {
      this.gameOver = true
      this.add
        .text(200, 300, 'GAME OVER', {
          fontSize: '48px',
          color: '#ff0000',
        })
        .setOrigin(0.5)
    }
  }

  private collision(offsetX: number, offsetY: number): boolean {
    if (!this.currentPiece) return false

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (this.currentPiece.shape[y][x]) {
          const newX = this.currentPiece.x + x + offsetX
          const newY = this.currentPiece.y + y + offsetY

          if (
            newX < 0 ||
            newX >= COLS ||
            newY >= ROWS ||
            (newY >= 0 && this.board[newY][newX])
          ) {
            return true
          }
        }
      }
    }
    return false
  }

  private merge() {
    if (!this.currentPiece) return

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (this.currentPiece.shape[y][x]) {
          const boardY = this.currentPiece.y + y
          const boardX = this.currentPiece.x + x
          if (boardY >= 0) {
            this.board[boardY][boardX] = this.currentPiece.color
          }
        }
      }
    }
  }

  private move(dir: number) {
    if (!this.collision(dir, 0)) {
      this.currentPiece!.x += dir
    }
  }

  private drop() {
    if (this.gameOver) return

    if (!this.collision(0, 1)) {
      this.currentPiece!.y++
    } else {
      this.merge()
      this.clearLines()
      this.spawnPiece()
    }
  }

  private rotate() {
    if (!this.currentPiece) return

    const rotated = this.currentPiece.shape[0].map((_, i) =>
      this.currentPiece!.shape.map(row => row[i]).reverse()
    )

    const previousShape = this.currentPiece.shape
    this.currentPiece.shape = rotated

    if (this.collision(0, 0)) {
      this.currentPiece.shape = previousShape
    }
  }

  private clearLines() {
    let linesCleared = 0

    for (let y = ROWS - 1; y >= 0; y--) {
      if (this.board[y].every(cell => cell !== 0)) {
        this.board.splice(y, 1)
        this.board.unshift(Array(COLS).fill(0))
        linesCleared++
        y++ // 同じ行を再チェック
      }
    }

    if (linesCleared > 0) {
      this.score += linesCleared * 100
      this.scoreText.setText(`Score: ${this.score}`)
    }
  }

  private drawBackground() {
    this.graphics.lineStyle(1, 0x444444, 1)

    // グリッド線を描画
    for (let x = 0; x <= COLS; x++) {
      this.graphics.lineBetween(
        OFFSET_X + x * BLOCK_SIZE,
        OFFSET_Y,
        OFFSET_X + x * BLOCK_SIZE,
        OFFSET_Y + ROWS * BLOCK_SIZE
      )
    }
    for (let y = 0; y <= ROWS; y++) {
      this.graphics.lineBetween(
        OFFSET_X,
        OFFSET_Y + y * BLOCK_SIZE,
        OFFSET_X + COLS * BLOCK_SIZE,
        OFFSET_Y + y * BLOCK_SIZE
      )
    }
  }

  private draw() {
    this.graphics.clear()
    this.drawBackground()

    // ボードを描画
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.board[y][x]) {
          this.graphics.fillStyle(this.board[y][x], 1)
          this.graphics.fillRect(
            OFFSET_X + x * BLOCK_SIZE + 1,
            OFFSET_Y + y * BLOCK_SIZE + 1,
            BLOCK_SIZE - 2,
            BLOCK_SIZE - 2
          )
        }
      }
    }

    // 現在のピースを描画
    if (this.currentPiece) {
      this.graphics.fillStyle(this.currentPiece.color, 1)
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          if (this.currentPiece.shape[y][x]) {
            this.graphics.fillRect(
              OFFSET_X + (this.currentPiece.x + x) * BLOCK_SIZE + 1,
              OFFSET_Y + (this.currentPiece.y + y) * BLOCK_SIZE + 1,
              BLOCK_SIZE - 2,
              BLOCK_SIZE - 2
            )
          }
        }
      }
    }
  }
}
