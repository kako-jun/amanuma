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
  private animatingBlocks: { x: number; y: number; value: number; scale: number; alpha: number }[] // 演出中のブロック
  private fallingBlocks: { x: number; fromY: number; toY: number; currentY: number; value: number }[] // 落下中のブロック

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
    this.animatingBlocks = []
    this.fallingBlocks = []
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
    const result = this.findBlocksToRemove()

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
        this.scoreText.setText(`Score: ${this.score}`)
      }

      // 演出を再生してから消去
      this.playRemoveAnimation(result.toRemove, result.hasTripleSeven, this.chainCount > 1, () => {
        // 実際に消去
        result.toRemove.forEach(key => {
          const [x, y] = key.split(',').map(Number)
          this.board[y][x] = 0
        })

        // スコア加算
        this.score += result.toRemove.size * SCORE_PER_BLOCK
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

        // 重力を適用（アニメーション付き）
        this.applyGravityWithAnimation(() => {
          // 連鎖チェック
          this.time.delayedCall(50, () => {
            this.checkAndClearSevensWithChain()
          })
        })
      })
    }
  }

  private findBlocksToRemove(): { toRemove: Set<string>; hasTripleSeven: boolean } {
    const toRemove: Set<string> = new Set()
    let hasTripleSeven = false

    // 横方向のチェック
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.board[y][x] === 0) continue

        const sequence: { x: number; y: number; value: number }[] = []
        let sum = 0
        for (let dx = 0; x + dx < COLS && this.board[y][x + dx] !== 0; dx++) {
          const value = this.board[y][x + dx]
          sequence.push({ x: x + dx, y, value })
          sum += value

          if (sequence.every(s => s.value === 7)) {
            if (sequence.length >= 3) {
              sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
              hasTripleSeven = true
            }
            continue
          }

          if (sum === 7) {
            sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
            break
          } else if (sum > 7) {
            break
          }
        }
      }
    }

    // 縦方向のチェック
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (this.board[y][x] === 0) continue

        const sequence: { x: number; y: number; value: number }[] = []
        let sum = 0
        for (let dy = 0; y + dy < ROWS && this.board[y + dy][x] !== 0; dy++) {
          const value = this.board[y + dy][x]
          sequence.push({ x, y: y + dy, value })
          sum += value

          if (sequence.every(s => s.value === 7)) {
            if (sequence.length >= 3) {
              sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
              hasTripleSeven = true
            }
            continue
          }

          if (sum === 7) {
            sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
            break
          } else if (sum > 7) {
            break
          }
        }
      }
    }

    return { toRemove, hasTripleSeven }
  }

  private playRemoveAnimation(
    toRemove: Set<string>,
    hasTripleSeven: boolean,
    isChain: boolean,
    onComplete: () => void
  ) {
    this.animatingBlocks = []

    // 消去対象のブロック情報を保存
    toRemove.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const value = this.board[y][x]
      this.animatingBlocks.push({ x, y, value, scale: 1, alpha: 1 })
    })

    const animDuration = hasTripleSeven ? 400 : 300

    // 点滅アニメーション（3回点滅）
    let blinkCount = 0
    const blinkInterval = setInterval(() => {
      blinkCount++
      this.animatingBlocks.forEach(block => {
        block.alpha = block.alpha === 1 ? 0.3 : 1
      })
      if (blinkCount >= 6) {
        clearInterval(blinkInterval)
      }
    }, 50)

    // 縮小アニメーション
    this.tweens.addCounter({
      from: 1,
      to: 0,
      duration: animDuration,
      delay: 150,
      ease: 'Power2',
      onUpdate: (tween) => {
        const scale = tween.getValue() ?? 1
        this.animatingBlocks.forEach(block => {
          block.scale = scale
          block.alpha = scale
        })
      },
      onComplete: () => {
        // 爆発エフェクト（7×3の場合）
        if (hasTripleSeven) {
          this.playExplosionEffect(toRemove)
        }

        // 連鎖時はパーティクル追加
        if (isChain) {
          this.playChainParticles(toRemove)
        }

        this.animatingBlocks = []
        onComplete()
      }
    })
  }

  private playExplosionEffect(toRemove: Set<string>) {
    toRemove.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const centerX = SINGLE_OFFSET_X + x * BLOCK_SIZE + BLOCK_SIZE / 2
      const centerY = SINGLE_OFFSET_Y + y * BLOCK_SIZE + BLOCK_SIZE / 2

      // 爆発リング（scaleでサイズを変化）
      const ring = this.add.circle(centerX, centerY, BLOCK_SIZE / 2, 0x9400d3, 0.8)
      ring.setScale(0.2)
      this.tweens.add({
        targets: ring,
        scale: 2,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => ring.destroy()
      })

      // 放射状のパーティクル
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        const particle = this.add.circle(centerX, centerY, 4, 0xffffff, 1)
        this.tweens.add({
          targets: particle,
          x: centerX + Math.cos(angle) * BLOCK_SIZE,
          y: centerY + Math.sin(angle) * BLOCK_SIZE,
          alpha: 0,
          scale: 0.5,
          duration: 250,
          ease: 'Power2',
          onComplete: () => particle.destroy()
        })
      }
    })
  }

  private playChainParticles(toRemove: Set<string>) {
    toRemove.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const centerX = SINGLE_OFFSET_X + x * BLOCK_SIZE + BLOCK_SIZE / 2
      const centerY = SINGLE_OFFSET_Y + y * BLOCK_SIZE + BLOCK_SIZE / 2

      // 上昇するキラキラパーティクル
      for (let i = 0; i < 3; i++) {
        const offsetX = (Math.random() - 0.5) * BLOCK_SIZE
        const particle = this.add.star(
          centerX + offsetX,
          centerY,
          5,
          3,
          6,
          0xffff00,
          1
        )
        particle.setScale(0.5)
        this.tweens.add({
          targets: particle,
          y: centerY - BLOCK_SIZE * 1.5,
          alpha: 0,
          rotation: Math.PI,
          duration: 400 + Math.random() * 200,
          delay: i * 50,
          ease: 'Power1',
          onComplete: () => particle.destroy()
        })
      }
    })
  }

  private applyGravityWithAnimation(onComplete: () => void) {
    this.fallingBlocks = []

    // 各列ごとに落下情報を計算
    for (let x = 0; x < COLS; x++) {
      // 下から上にスキャンして、空きマスと落下するブロックを特定
      let writeY = ROWS - 1 // 書き込み位置

      for (let readY = ROWS - 1; readY >= 0; readY--) {
        if (this.board[readY][x] !== 0) {
          if (readY !== writeY) {
            // 落下アニメーション対象
            this.fallingBlocks.push({
              x,
              fromY: readY,
              toY: writeY,
              currentY: readY,
              value: this.board[readY][x]
            })
          }
          writeY--
        }
      }
    }

    // 落下するブロックがない場合は即座に完了
    if (this.fallingBlocks.length === 0) {
      onComplete()
      return
    }

    // ボードから落下するブロックを一時的に削除
    this.fallingBlocks.forEach(block => {
      this.board[block.fromY][block.x] = 0
    })

    // 落下アニメーション
    const fallDuration = 150
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: fallDuration,
      ease: 'Bounce.easeOut',
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0
        this.fallingBlocks.forEach(block => {
          block.currentY = block.fromY + (block.toY - block.fromY) * progress
        })
      },
      onComplete: () => {
        // ボードに反映
        this.fallingBlocks.forEach(block => {
          this.board[block.toY][block.x] = block.value
        })
        this.fallingBlocks = []
        onComplete()
      }
    })
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
    this.textPool.forEach(text => {
      text.setVisible(false)
      text.setScale(1)
      text.setAlpha(1)
    })

    // 演出中のブロックのキーを作成
    const animatingKeys = new Set(
      this.animatingBlocks.map(b => `${b.x},${b.y}`)
    )

    // 落下中のブロックのキーを作成
    const fallingKeys = new Set(
      this.fallingBlocks.map(b => `${b.x},${b.fromY}`)
    )

    // ボードを描画（演出中・落下中のブロックは除く）
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.board[y][x] !== 0 && !animatingKeys.has(`${x},${y}`) && !fallingKeys.has(`${x},${y}`)) {
          const value = this.board[y][x]
          this.drawBlock(x, y, value)
        }
      }
    }

    // 演出中のブロックを描画
    this.animatingBlocks.forEach(block => {
      this.drawBlockWithScale(block.x, block.y, block.value, block.scale, block.alpha)
    })

    // 落下中のブロックを描画
    this.fallingBlocks.forEach(block => {
      this.drawBlockAtY(block.x, block.currentY, block.value)
    })

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

  private drawBlockAtY(x: number, y: number, value: number) {
    const centerX = SINGLE_OFFSET_X + x * BLOCK_SIZE + BLOCK_SIZE / 2
    const centerY = SINGLE_OFFSET_Y + y * BLOCK_SIZE + BLOCK_SIZE / 2
    const halfSize = (BLOCK_SIZE - 4) / 2

    this.graphics.fillStyle(COLORS[value], 1)
    this.graphics.fillRect(
      centerX - halfSize,
      centerY - halfSize,
      BLOCK_SIZE - 4,
      BLOCK_SIZE - 4
    )

    if (this.textPoolIndex < this.textPool.length) {
      const text = this.textPool[this.textPoolIndex++]
      text.setText(value.toString())
      text.setPosition(centerX, centerY)
      text.setVisible(true)
    }
  }

  private drawBlockWithScale(x: number, y: number, value: number, scale: number, alpha: number) {
    if (scale <= 0 || alpha <= 0) return

    const centerX = SINGLE_OFFSET_X + x * BLOCK_SIZE + BLOCK_SIZE / 2
    const centerY = SINGLE_OFFSET_Y + y * BLOCK_SIZE + BLOCK_SIZE / 2
    const size = (BLOCK_SIZE - 4) * scale
    const halfSize = size / 2

    // ブロックの背景を描画
    this.graphics.fillStyle(COLORS[value], alpha)
    this.graphics.fillRect(
      centerX - halfSize,
      centerY - halfSize,
      size,
      size
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
