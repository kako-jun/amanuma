import Phaser from 'phaser'
import {
  COLS,
  ROWS,
  BLOCK_SIZE,
  SINGLE_OFFSET_X,
  SINGLE_OFFSET_Y,
  COLORS,
  BASE_DROP_INTERVAL,
  MIN_DROP_INTERVAL,
  LINES_PER_LEVEL,
  SCORE_PER_BLOCK,
  CHAIN_BONUS,
  SEVEN_PROBABILITY,
  STORAGE_KEY_HIGHSCORE,
} from './constants'

export class MainScene extends Phaser.Scene {
  private board: number[][] // 0=空, 1-7=数字ブロック
  private currentBlock: {
    value: number
    x: number
    y: number
  } | null
  private graphics!: Phaser.GameObjects.Graphics
  private scoreText!: Phaser.GameObjects.Text
  private highScoreText!: Phaser.GameObjects.Text
  private levelText!: Phaser.GameObjects.Text
  private chainText!: Phaser.GameObjects.Text
  private pauseText!: Phaser.GameObjects.Text
  private score: number
  private highScore: number
  private level: number
  private linesCleared: number
  private chainCount: number
  private dropTimer: number
  private dropInterval: number
  private baseDropInterval: number
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private rKey!: Phaser.Input.Keyboard.Key
  private pKey!: Phaser.Input.Keyboard.Key
  private gameOver: boolean
  private paused: boolean
  private textPool: Phaser.GameObjects.Text[] // Textオブジェクトのプール
  private textPoolIndex: number // 現在使用中のプールインデックス
  private nextBlock: number // 次のブロック

  constructor() {
    super({ key: 'MainScene' })
    this.board = []
    this.currentBlock = null
    this.score = 0
    this.highScore = 0
    this.level = 1
    this.linesCleared = 0
    this.chainCount = 0
    this.dropTimer = 0
    this.baseDropInterval = BASE_DROP_INTERVAL
    this.dropInterval = BASE_DROP_INTERVAL
    this.gameOver = false
    this.paused = false
    this.textPool = []
    this.textPoolIndex = 0
    this.nextBlock = 0
  }

  create() {
    // ボードの初期化
    this.board = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0))

    // ハイスコアを読み込み
    const savedHighScore = localStorage.getItem(STORAGE_KEY_HIGHSCORE)
    this.highScore = savedHighScore ? parseInt(savedHighScore, 10) : 0

    // グラフィックスの作成
    this.graphics = this.add.graphics()

    // スコア表示（中央配置用に調整）
    this.scoreText = this.add.text(216, 16, 'Score: 0', {
      fontSize: '24px',
      color: '#ffffff',
    })

    // ハイスコア表示
    this.highScoreText = this.add.text(216, 45, `High: ${this.highScore}`, {
      fontSize: '18px',
      color: '#aaaaaa',
    })

    // レベル表示
    this.levelText = this.add.text(216, 70, 'Level: 1', {
      fontSize: '18px',
      color: '#00ff00',
    })

    // 連鎖表示
    this.chainText = this.add.text(216, 95, '', {
      fontSize: '20px',
      color: '#ffff00',
    })

    // 一時停止表示（非表示で作成）
    this.pauseText = this.add
      .text(
        SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2,
        SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2,
        'PAUSED\n\nPress P to Resume',
        {
          fontSize: '32px',
          color: '#ffffff',
          align: 'center',
          backgroundColor: '#000000aa',
          padding: { x: 20, y: 20 },
        }
      )
      .setOrigin(0.5)
      .setVisible(false)

    // ネクスト表示（中央配置用に調整）
    this.add.text(520, 16, 'Next:', {
      fontSize: '20px',
      color: '#ffffff',
    })

    // Textオブジェクトのプールを作成（最大ROWS * COLS + 1個）
    const poolSize = ROWS * COLS + 1
    for (let i = 0; i < poolSize; i++) {
      const text = this.add.text(0, 0, '', {
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      text.setOrigin(0.5)
      text.setStroke('#000000', 4)
      text.setVisible(false)
      this.textPool.push(text)
    }

    // キーボード入力の設定
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.rKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.R
    )
    this.pKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.P
    )

    // 最初のネクストブロックを生成（確率調整版）
    this.nextBlock = this.generateRandomNumber()

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
    // 一時停止のトグル
    if (Phaser.Input.Keyboard.JustDown(this.pKey)) {
      this.togglePause()
      return
    }

    // リスタート処理（Rキーでゲーム再開、ESCキーでタイトルに戻る）
    if (this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
        this.scene.restart()
        return
      }
      // ESCキーでタイトルに戻る
      const escKey = this.input.keyboard!.addKey(
        Phaser.Input.Keyboard.KeyCodes.ESC
      )
      if (Phaser.Input.Keyboard.JustDown(escKey)) {
        this.scene.start('TitleScene')
        return
      }
    }

    if (this.gameOver || this.paused) {
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

  private togglePause() {
    this.paused = !this.paused
    this.pauseText.setVisible(this.paused)
  }

  // タッチ入力用の公開メソッド
  public touchLeft() {
    if (!this.gameOver && !this.paused) {
      this.move(-1)
    }
  }

  public touchRight() {
    if (!this.gameOver && !this.paused) {
      this.move(1)
    }
  }

  public touchDown() {
    if (!this.gameOver && !this.paused) {
      this.drop()
      this.dropTimer = 0
    }
  }

  private generateRandomNumber(): number {
    const rand = Math.random()
    if (rand < SEVEN_PROBABILITY) {
      return 7
    }
    return Math.floor(rand * 6.12) + 1
  }

  private spawnBlock() {
    // ネクストブロックを使用
    const value = this.nextBlock
    // 次のネクストブロックを生成（確率調整版）
    this.nextBlock = this.generateRandomNumber()

    this.currentBlock = {
      value: value,
      x: Math.floor(COLS / 2),
      y: 0,
    }

    // ゲームオーバー判定
    if (this.board[0][this.currentBlock.x] !== 0) {
      this.gameOver = true

      // ハイスコア更新
      if (this.score > this.highScore) {
        this.highScore = this.score
        localStorage.setItem(STORAGE_KEY_HIGHSCORE, this.highScore.toString())
        this.highScoreText.setText(`High: ${this.highScore}`)
        this.add
          .text(
            SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2,
            SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2 - 80,
            'NEW HIGH SCORE!',
            {
              fontSize: '24px',
              color: '#ffff00',
              align: 'center',
            }
          )
          .setOrigin(0.5)
      }

      this.add
        .text(
          SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2,
          SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2,
          'GAME OVER\n\nR: Restart  ESC: Title',
          {
            fontSize: '28px',
            color: '#ff0000',
            align: 'center',
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
      // 連鎖カウントをリセットして消去開始
      this.chainCount = 0
      this.checkAndClearSevensWithChain()
      this.spawnBlock()
    }
  }

  private checkAndClearSevensWithChain() {
    const cleared = this.checkAndClearSevens()

    if (cleared) {
      this.chainCount++

      // 連鎖表示
      if (this.chainCount > 1) {
        this.chainText.setText(`${this.chainCount} Chain!`)
        // 3秒後に連鎖表示をクリア
        this.time.delayedCall(3000, () => {
          this.chainText.setText('')
        })
      }

      // 連鎖ボーナス
      if (this.chainCount > 1) {
        const bonus = this.chainCount * CHAIN_BONUS
        this.score += bonus
        this.scoreText.setText(`Score: ${this.score}`)
      }

      // 少し待ってから再度チェック（連鎖）
      this.time.delayedCall(300, () => {
        this.checkAndClearSevensWithChain()
      })
    }
  }

  private checkAndClearSevens(): boolean {
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
      this.score += toRemove.size * SCORE_PER_BLOCK
      this.scoreText.setText(`Score: ${this.score}`)

      // ライン消去数をカウント
      this.linesCleared++

      // レベルアップ
      const newLevel = Math.floor(this.linesCleared / LINES_PER_LEVEL) + 1
      if (newLevel > this.level) {
        this.level = newLevel
        this.levelText.setText(`Level: ${this.level}`)
        this.dropInterval = Math.max(
          this.baseDropInterval / (1 + (this.level - 1) * 0.1),
          MIN_DROP_INTERVAL
        )
      }

      // 重力を適用
      this.applyGravity()

      return true // 消去したことを返す
    }

    return false // 何も消去しなかった
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
        SINGLE_OFFSET_X + x * BLOCK_SIZE,
        SINGLE_OFFSET_Y,
        SINGLE_OFFSET_X + x * BLOCK_SIZE,
        SINGLE_OFFSET_Y + ROWS * BLOCK_SIZE
      )
    }
    for (let y = 0; y <= ROWS; y++) {
      this.graphics.lineBetween(
        SINGLE_OFFSET_X,
        SINGLE_OFFSET_Y + y * BLOCK_SIZE,
        SINGLE_OFFSET_X + COLS * BLOCK_SIZE,
        SINGLE_OFFSET_Y + y * BLOCK_SIZE
      )
    }

    // ネクストブロック表示エリアの枠
    this.graphics.lineStyle(2, 0x666666, 1)
    this.graphics.strokeRect(510, 40, 70, 70)
  }

  private draw() {
    this.graphics.clear()
    this.drawBackground()

    // Textプールをリセット（全て非表示にする）
    this.textPoolIndex = 0
    this.textPool.forEach(text => text.setVisible(false))

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

    // ネクストブロックを描画
    this.drawNextBlock()
  }

  private drawBlock(x: number, y: number, value: number) {
    // ブロックの背景を描画
    this.graphics.fillStyle(COLORS[value], 1)
    this.graphics.fillRect(
      SINGLE_OFFSET_X + x * BLOCK_SIZE + 2,
      SINGLE_OFFSET_Y + y * BLOCK_SIZE + 2,
      BLOCK_SIZE - 4,
      BLOCK_SIZE - 4
    )

    // プールからTextオブジェクトを取得して再利用
    if (this.textPoolIndex < this.textPool.length) {
      const text = this.textPool[this.textPoolIndex++]
      text.setText(value.toString())
      text.setPosition(
        SINGLE_OFFSET_X + x * BLOCK_SIZE + BLOCK_SIZE / 2,
        SINGLE_OFFSET_Y + y * BLOCK_SIZE + BLOCK_SIZE / 2
      )
      text.setVisible(true)
    }
  }

  private drawNextBlock() {
    // ネクストブロックの背景（中央配置用に調整）
    this.graphics.fillStyle(COLORS[this.nextBlock], 1)
    this.graphics.fillRect(520, 50, 50, 50)

    // ネクストブロックの数字
    if (this.textPoolIndex < this.textPool.length) {
      const text = this.textPool[this.textPoolIndex++]
      text.setText(this.nextBlock.toString())
      text.setPosition(545, 75)
      text.setVisible(true)
    }
  }
}
