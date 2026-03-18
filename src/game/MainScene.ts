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
  STORAGE_KEY_HIGHSCORE,
  UI_COLORS,
  GAME_WIDTH,
  GAME_HEIGHT,
} from './constants'
import { BlockEffects } from './BlockEffects'
import { generateBlockValue } from './random'

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
  private blockEffects!: BlockEffects // 演出管理
  private lastMoveTime: number // 最後の移動時間（デバウンス用）
  private moveDebounceMs: number // デバウンス時間

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
    this.lastMoveTime = 0
    this.moveDebounceMs = 150 // 150msのデバウンス
  }

  create() {
    // フェードイン効果
    this.cameras.main.fadeIn(300, 15, 15, 26)

    // ボードの初期化
    this.board = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0))

    // ハイスコアを読み込み
    const savedHighScore = localStorage.getItem(STORAGE_KEY_HIGHSCORE)
    this.highScore = savedHighScore ? parseInt(savedHighScore, 10) : 0

    // 背景を描画
    this.drawModernBackground()

    // グラフィックスの作成
    this.graphics = this.add.graphics()

    // UIパネル（左側）
    this.createLeftPanel()

    // スコア表示
    this.scoreText = this.add
      .text(80, 80, '0', {
        fontSize: '32px',
        color: '#f8fafc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // ハイスコア表示
    this.highScoreText = this.add
      .text(80, 140, `${this.highScore}`, {
        fontSize: '20px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // レベル表示
    this.levelText = this.add
      .text(80, 200, '1', {
        fontSize: '28px',
        color: '#10b981',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // 連鎖表示
    this.chainText = this.add
      .text(
        SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2,
        SINGLE_OFFSET_Y - 30,
        '',
        {
          fontSize: '24px',
          color: '#fbbf24',
          fontStyle: 'bold',
        }
      )
      .setOrigin(0.5)

    // 一時停止表示（非表示で作成）
    this.pauseText = this.add
      .text(
        SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2,
        SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2,
        '⏸ PAUSED',
        {
          fontSize: '36px',
          color: '#f8fafc',
          align: 'center',
          fontStyle: 'bold',
        }
      )
      .setOrigin(0.5)
      .setVisible(false)

    // ネクストパネル（右側）
    this.createRightPanel()

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
    this.rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    this.pKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P)

    // 最初のネクストブロックを生成（確率調整版）
    this.nextBlock = this.generateRandomNumber()

    // 最初のブロックを生成
    this.spawnBlock()

    // 演出管理クラスの初期化
    this.blockEffects = new BlockEffects(this, SINGLE_OFFSET_X, SINGLE_OFFSET_Y)

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

    // キーボード入力の処理（デバウンス付き）
    const now = this.time.now
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
      if (now - this.lastMoveTime >= this.moveDebounceMs) {
        this.move(-1)
        this.lastMoveTime = now
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
      if (now - this.lastMoveTime >= this.moveDebounceMs) {
        this.move(1)
        this.lastMoveTime = now
      }
    }
    if (this.cursors.down?.isDown) {
      // 下キー押下時は高速落下
      if (this.dropTimer > 100) {
        this.drop()
        this.dropTimer = 0
      }
    } else {
      // 通常の自動落下（dropIntervalに基づく）
      if (this.dropTimer >= this.dropInterval) {
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
    return generateBlockValue()
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
        this.highScoreText.setText(`${this.highScore}`)

        // 新記録バッジ
        const newRecordBg = this.add.graphics()
        newRecordBg.fillStyle(UI_COLORS.warning, 0.2)
        newRecordBg.fillRoundedRect(
          SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2 - 100,
          SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2 - 100,
          200,
          40,
          8
        )
        newRecordBg.lineStyle(2, UI_COLORS.warning, 0.8)
        newRecordBg.strokeRoundedRect(
          SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2 - 100,
          SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2 - 100,
          200,
          40,
          8
        )

        this.add
          .text(
            SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2,
            SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2 - 80,
            '🎉 NEW RECORD!',
            {
              fontSize: '20px',
              color: '#fbbf24',
              fontStyle: 'bold',
              align: 'center',
            }
          )
          .setOrigin(0.5)
      }

      // ゲームオーバーパネル
      const gameOverBg = this.add.graphics()
      gameOverBg.fillStyle(UI_COLORS.backgroundCard, 0.95)
      gameOverBg.fillRoundedRect(
        SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2 - 120,
        SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2 - 50,
        240,
        120,
        12
      )
      gameOverBg.lineStyle(2, UI_COLORS.danger, 0.8)
      gameOverBg.strokeRoundedRect(
        SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2 - 120,
        SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2 - 50,
        240,
        120,
        12
      )

      this.add
        .text(
          SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2,
          SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2 - 20,
          'GAME OVER',
          {
            fontSize: '28px',
            color: '#ef4444',
            fontStyle: 'bold',
            align: 'center',
          }
        )
        .setOrigin(0.5)

      this.add
        .text(
          SINGLE_OFFSET_X + (COLS * BLOCK_SIZE) / 2,
          SINGLE_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2 + 30,
          'R: Retry  |  ESC: Title',
          {
            fontSize: '14px',
            color: '#94a3b8',
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
    const result = this.blockEffects.findBlocksToRemove(this.board)

    if (result.toRemove.size > 0) {
      this.chainCount++

      // 連鎖表示
      if (this.chainCount > 1) {
        this.chainText.setText(`${this.chainCount} Chain!`)
        this.time.delayedCall(3000, () => {
          this.chainText.setText('')
        })
      }

      // 連鎖ボーナス
      if (this.chainCount > 1) {
        const bonus = this.chainCount * CHAIN_BONUS
        this.score += bonus
        this.scoreText.setText(`${this.score}`)
      }

      // 演出を再生してから消去
      this.blockEffects.playRemoveAnimation(
        this.board,
        result.toRemove,
        result.hasTripleSeven,
        this.chainCount > 1,
        () => {
          // 実際に消去
          result.toRemove.forEach(key => {
            const [x, y] = key.split(',').map(Number)
            this.board[y][x] = 0
          })

          // スコア加算
          this.score += result.toRemove.size * SCORE_PER_BLOCK
          this.scoreText.setText(`${this.score}`)

          // ライン消去数をカウント
          this.linesCleared++

          // レベルアップ
          const newLevel = Math.floor(this.linesCleared / LINES_PER_LEVEL) + 1
          if (newLevel > this.level) {
            this.level = newLevel
            this.levelText.setText(`${this.level}`)
            this.dropInterval = Math.max(
              this.baseDropInterval / (1 + (this.level - 1) * 0.1),
              MIN_DROP_INTERVAL
            )
          }

          // 重力を適用（アニメーション付き）
          this.blockEffects.applyGravityWithAnimation(this.board, () => {
            // 連鎖チェック
            this.time.delayedCall(50, () => {
              this.checkAndClearSevensWithChain()
            })
          })
        }
      )
    }
  }

  private drawModernBackground() {
    const bg = this.add.graphics()

    // 全体背景
    bg.fillStyle(UI_COLORS.background, 1)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // ゲームボード背景
    bg.fillStyle(UI_COLORS.backgroundLight, 1)
    bg.fillRoundedRect(
      SINGLE_OFFSET_X - 10,
      SINGLE_OFFSET_Y - 10,
      COLS * BLOCK_SIZE + 20,
      ROWS * BLOCK_SIZE + 20,
      12
    )

    // ボード内部の暗い背景
    bg.fillStyle(UI_COLORS.background, 0.8)
    bg.fillRect(
      SINGLE_OFFSET_X,
      SINGLE_OFFSET_Y,
      COLS * BLOCK_SIZE,
      ROWS * BLOCK_SIZE
    )
  }

  private createLeftPanel() {
    const panelX = 20
    const panelY = 50
    const panelWidth = 120
    const panelHeight = 200

    const panel = this.add.graphics()

    // パネル背景
    panel.fillStyle(UI_COLORS.backgroundCard, 0.9)
    panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 12)
    panel.lineStyle(1, UI_COLORS.border, 0.5)
    panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 12)

    // ラベル
    this.add
      .text(80, 55, 'SCORE', {
        fontSize: '11px',
        color: '#64748b',
      })
      .setOrigin(0.5)

    this.add
      .text(80, 115, '🏆 BEST', {
        fontSize: '11px',
        color: '#64748b',
      })
      .setOrigin(0.5)

    this.add
      .text(80, 175, 'LEVEL', {
        fontSize: '11px',
        color: '#64748b',
      })
      .setOrigin(0.5)

    // 操作ヒント
    this.add
      .text(80, 270, '← → ↓', {
        fontSize: '14px',
        color: '#64748b',
      })
      .setOrigin(0.5)

    this.add
      .text(80, 290, 'P: Pause', {
        fontSize: '11px',
        color: '#475569',
      })
      .setOrigin(0.5)
  }

  private createRightPanel() {
    const panelX = 560
    const panelY = 50
    const panelWidth = 120
    const panelHeight = 120

    const panel = this.add.graphics()

    // パネル背景
    panel.fillStyle(UI_COLORS.backgroundCard, 0.9)
    panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 12)
    panel.lineStyle(1, UI_COLORS.border, 0.5)
    panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 12)

    // NEXT ラベル
    this.add
      .text(620, 60, 'NEXT', {
        fontSize: '12px',
        color: '#64748b',
      })
      .setOrigin(0.5)
  }

  private drawBackground() {
    // グリッド線を描画（より繊細に）
    this.graphics.lineStyle(1, UI_COLORS.border, 0.3)

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

    // ボード枠
    this.graphics.lineStyle(2, UI_COLORS.primary, 0.5)
    this.graphics.strokeRoundedRect(
      SINGLE_OFFSET_X - 2,
      SINGLE_OFFSET_Y - 2,
      COLS * BLOCK_SIZE + 4,
      ROWS * BLOCK_SIZE + 4,
      4
    )
  }

  private draw() {
    this.graphics.clear()
    this.drawBackground()

    // Textプールをリセット（全て非表示にする）
    this.textPoolIndex = 0
    this.textPool.forEach(text => {
      text.setVisible(false)
      text.setScale(1)
      text.setAlpha(1)
    })

    // 演出中・落下中のブロックのキーを取得
    const excludedKeys = this.blockEffects.getExcludedKeys()

    // ボードを描画（演出中・落下中のブロックは除く）
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.board[y][x] !== 0 && !excludedKeys.has(`${x},${y}`)) {
          const value = this.board[y][x]
          this.drawBlock(x, y, value)
        }
      }
    }

    // 演出中のブロックを描画
    const textPoolIndex = { value: this.textPoolIndex }
    this.blockEffects.drawAnimatingBlocks(
      this.graphics,
      this.textPool,
      textPoolIndex
    )
    this.textPoolIndex = textPoolIndex.value

    // 落下中のブロックを描画
    this.blockEffects.drawFallingBlocks(
      this.graphics,
      this.textPool,
      textPoolIndex
    )
    this.textPoolIndex = textPoolIndex.value

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
    this.drawBlockWithScale(x, y, value, 1, 1)
  }

  private drawBlockWithScale(
    x: number,
    y: number,
    value: number,
    scale: number,
    alpha: number
  ) {
    if (scale <= 0 || alpha <= 0) return

    const centerX = SINGLE_OFFSET_X + x * BLOCK_SIZE + BLOCK_SIZE / 2
    const centerY = SINGLE_OFFSET_Y + y * BLOCK_SIZE + BLOCK_SIZE / 2
    const size = (BLOCK_SIZE - 4) * scale
    const halfSize = size / 2
    const radius = 6 * scale

    // ブロックのグロー効果（7の場合は強調）
    if (value === 7 && alpha > 0.5) {
      this.graphics.fillStyle(COLORS[value], alpha * 0.3)
      this.graphics.fillRoundedRect(
        centerX - halfSize - 3,
        centerY - halfSize - 3,
        size + 6,
        size + 6,
        radius + 2
      )
    }

    // ブロックの背景を描画（角丸）
    this.graphics.fillStyle(COLORS[value], alpha)
    this.graphics.fillRoundedRect(
      centerX - halfSize,
      centerY - halfSize,
      size,
      size,
      radius
    )

    // ハイライト（上部）
    this.graphics.fillStyle(0xffffff, alpha * 0.15)
    this.graphics.fillRoundedRect(
      centerX - halfSize + 2,
      centerY - halfSize + 2,
      size - 4,
      size * 0.3,
      { tl: radius - 1, tr: radius - 1, bl: 0, br: 0 }
    )

    // プールからTextオブジェクトを取得して再利用
    if (this.textPoolIndex < this.textPool.length && scale > 0.3) {
      const text = this.textPool[this.textPoolIndex++]
      text.setText(value.toString())
      text.setPosition(centerX, centerY)
      text.setScale(scale)
      text.setAlpha(alpha)
      text.setVisible(true)
    }
  }

  private drawNextBlock() {
    const nextX = 620
    const nextY = 110
    const blockSize = 50

    // ネクストブロックの背景（グロー効果）
    this.graphics.fillStyle(COLORS[this.nextBlock], 0.2)
    this.graphics.fillRoundedRect(
      nextX - blockSize / 2 - 5,
      nextY - blockSize / 2 - 5,
      blockSize + 10,
      blockSize + 10,
      8
    )

    // ネクストブロック
    this.graphics.fillStyle(COLORS[this.nextBlock], 1)
    this.graphics.fillRoundedRect(
      nextX - blockSize / 2,
      nextY - blockSize / 2,
      blockSize,
      blockSize,
      6
    )

    // ネクストブロックの数字
    if (this.textPoolIndex < this.textPool.length) {
      const text = this.textPool[this.textPoolIndex++]
      text.setText(this.nextBlock.toString())
      text.setPosition(nextX, nextY)
      text.setVisible(true)
    }
  }
}
