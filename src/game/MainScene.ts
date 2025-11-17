import Phaser from 'phaser'

// ゲームの定数
const COLS = 5
const ROWS = 10
const BLOCK_SIZE = 50
const OFFSET_X = 50
const OFFSET_Y = 50

// 数字ごとの色定義
const COLORS = [
  0x808080, // 0 (使用しない)
  0xff0000, // 1 赤
  0xff7f00, // 2 オレンジ
  0xffff00, // 3 黄色
  0x00ff00, // 4 緑
  0x0000ff, // 5 青
  0x4b0082, // 6 藍色
  0x9400d3, // 7 紫
]

export class MainScene extends Phaser.Scene {
  private board: number[][] // 0=空, 1-7=数字ブロック
  private currentBlock: {
    value: number
    x: number
    y: number
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
    this.currentBlock = null
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

    // 最初のブロックを生成
    this.spawnBlock()

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
    if (this.cursors.down?.isDown) {
      if (this.dropTimer > 100) {
        this.drop()
        this.dropTimer = 0
      }
    }

    this.draw()
  }

  private spawnBlock() {
    // 1〜7のランダムな数字を生成
    const value = Math.floor(Math.random() * 7) + 1
    this.currentBlock = {
      value: value,
      x: Math.floor(COLS / 2),
      y: 0,
    }

    // ゲームオーバー判定
    if (this.board[0][this.currentBlock.x] !== 0) {
      this.gameOver = true
      this.add
        .text(
          OFFSET_X + (COLS * BLOCK_SIZE) / 2,
          OFFSET_Y + (ROWS * BLOCK_SIZE) / 2,
          'GAME OVER',
          {
            fontSize: '48px',
            color: '#ff0000',
          }
        )
        .setOrigin(0.5)
    }
  }

  private collision(offsetX: number, offsetY: number): boolean {
    if (!this.currentBlock) return false

    const newX = this.currentBlock.x + offsetX
    const newY = this.currentBlock.y + offsetY

    if (newX < 0 || newX >= COLS || newY >= ROWS) {
      return true
    }

    if (newY >= 0 && this.board[newY][newX] !== 0) {
      return true
    }

    return false
  }

  private merge() {
    if (!this.currentBlock) return

    const { x, y, value } = this.currentBlock
    if (y >= 0 && y < ROWS) {
      this.board[y][x] = value
    }
  }

  private move(dir: number) {
    if (!this.collision(dir, 0)) {
      this.currentBlock!.x += dir
    }
  }

  private drop() {
    if (this.gameOver) return

    if (!this.collision(0, 1)) {
      this.currentBlock!.y++
    } else {
      this.merge()
      this.checkAndClearSevens()
      this.spawnBlock()
    }
  }

  private checkAndClearSevens() {
    const toRemove: Set<string> = new Set()

    // 横方向のチェック
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.board[y][x] === 0) continue

        // 右方向への連続をチェック
        const sequence: { x: number; y: number; value: number }[] = []
        let sum = 0
        for (let dx = 0; x + dx < COLS && this.board[y][x + dx] !== 0; dx++) {
          const value = this.board[y][x + dx]
          sequence.push({ x: x + dx, y, value })
          sum += value

          // 合計が7になったかチェック
          if (sum === 7) {
            // 全て7の場合、3つ以上かチェック
            if (sequence.every(s => s.value === 7)) {
              if (sequence.length >= 3) {
                sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
              }
            } else {
              // 7以外が含まれる場合は通常通り消去
              sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
            }
            break
          } else if (sum > 7) {
            // 7を超えたら終了
            break
          }
        }
      }
    }

    // 縦方向のチェック
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (this.board[y][x] === 0) continue

        // 下方向への連続をチェック
        const sequence: { x: number; y: number; value: number }[] = []
        let sum = 0
        for (let dy = 0; y + dy < ROWS && this.board[y + dy][x] !== 0; dy++) {
          const value = this.board[y + dy][x]
          sequence.push({ x, y: y + dy, value })
          sum += value

          // 合計が7になったかチェック
          if (sum === 7) {
            // 全て7の場合、3つ以上かチェック
            if (sequence.every(s => s.value === 7)) {
              if (sequence.length >= 3) {
                sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
              }
            } else {
              // 7以外が含まれる場合は通常通り消去
              sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
            }
            break
          } else if (sum > 7) {
            // 7を超えたら終了
            break
          }
        }
      }
    }

    // ブロックを消去
    if (toRemove.size > 0) {
      toRemove.forEach(key => {
        const [x, y] = key.split(',').map(Number)
        this.board[y][x] = 0
      })

      // スコア加算
      this.score += toRemove.size * 10
      this.scoreText.setText(`Score: ${this.score}`)

      // 重力を適用
      this.applyGravity()
    }
  }

  private applyGravity() {
    // 各列ごとに下から詰める
    for (let x = 0; x < COLS; x++) {
      const column: number[] = []
      for (let y = ROWS - 1; y >= 0; y--) {
        if (this.board[y][x] !== 0) {
          column.push(this.board[y][x])
        }
      }

      // 列を再構築
      for (let y = 0; y < ROWS; y++) {
        this.board[y][x] = 0
      }
      for (let i = 0; i < column.length; i++) {
        this.board[ROWS - 1 - i][x] = column[i]
      }
    }
  }

  private drawBackground() {
    this.graphics.lineStyle(2, 0x444444, 1)

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
        if (this.board[y][x] !== 0) {
          const value = this.board[y][x]
          this.drawBlock(x, y, value)
        }
      }
    }

    // 現在のブロックを描画
    if (this.currentBlock) {
      this.drawBlock(
        this.currentBlock.x,
        this.currentBlock.y,
        this.currentBlock.value
      )
    }
  }

  private drawBlock(x: number, y: number, value: number) {
    // ブロックの背景を描画
    this.graphics.fillStyle(COLORS[value], 1)
    this.graphics.fillRect(
      OFFSET_X + x * BLOCK_SIZE + 2,
      OFFSET_Y + y * BLOCK_SIZE + 2,
      BLOCK_SIZE - 4,
      BLOCK_SIZE - 4
    )

    // 数字を描画
    const text = this.add.text(
      OFFSET_X + x * BLOCK_SIZE + BLOCK_SIZE / 2,
      OFFSET_Y + y * BLOCK_SIZE + BLOCK_SIZE / 2,
      value.toString(),
      {
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      }
    )
    text.setOrigin(0.5)
    text.setStroke('#000000', 4)
  }
}
