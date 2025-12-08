import Phaser from 'phaser'
import { COLS, ROWS, BLOCK_SIZE, COLORS } from './constants'

/**
 * ブロック消去・落下の演出を管理する共通クラス
 */
export class BlockEffects {
  private scene: Phaser.Scene
  private offsetX: number
  private offsetY: number

  // 演出中のブロック
  public animatingBlocks: { x: number; y: number; value: number; scale: number; alpha: number }[] = []
  // 落下中のブロック
  public fallingBlocks: { x: number; fromY: number; toY: number; currentY: number; value: number }[] = []

  constructor(scene: Phaser.Scene, offsetX: number, offsetY: number) {
    this.scene = scene
    this.offsetX = offsetX
    this.offsetY = offsetY
  }

  /**
   * ボードから消去対象のブロックを検索
   */
  findBlocksToRemove(board: number[][]): { toRemove: Set<string>; hasTripleSeven: boolean } {
    const toRemove: Set<string> = new Set()
    let hasTripleSeven = false

    // 横方向のチェック
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x] === 0) continue

        const sequence: { x: number; y: number; value: number }[] = []
        let sum = 0
        for (let dx = 0; x + dx < COLS && board[y][x + dx] !== 0; dx++) {
          const value = board[y][x + dx]
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
        if (board[y][x] === 0) continue

        const sequence: { x: number; y: number; value: number }[] = []
        let sum = 0
        for (let dy = 0; y + dy < ROWS && board[y + dy][x] !== 0; dy++) {
          const value = board[y + dy][x]
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

  /**
   * 消去アニメーション（点滅→縮小）を再生
   */
  playRemoveAnimation(
    board: number[][],
    toRemove: Set<string>,
    hasTripleSeven: boolean,
    isChain: boolean,
    onComplete: () => void
  ) {
    this.animatingBlocks = []

    // 消去対象のブロック情報を保存
    toRemove.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const value = board[y][x]
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
    this.scene.tweens.addCounter({
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

  /**
   * 爆発エフェクト（7×3消去時）
   */
  private playExplosionEffect(toRemove: Set<string>) {
    toRemove.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const centerX = this.offsetX + x * BLOCK_SIZE + BLOCK_SIZE / 2
      const centerY = this.offsetY + y * BLOCK_SIZE + BLOCK_SIZE / 2

      // 爆発リング
      const ring = this.scene.add.circle(centerX, centerY, BLOCK_SIZE / 2, 0x9400d3, 0.8)
      ring.setScale(0.2)
      this.scene.tweens.add({
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
        const particle = this.scene.add.circle(centerX, centerY, 4, 0xffffff, 1)
        this.scene.tweens.add({
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

  /**
   * 連鎖パーティクル
   */
  private playChainParticles(toRemove: Set<string>) {
    toRemove.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const centerX = this.offsetX + x * BLOCK_SIZE + BLOCK_SIZE / 2
      const centerY = this.offsetY + y * BLOCK_SIZE + BLOCK_SIZE / 2

      // 上昇するキラキラパーティクル
      for (let i = 0; i < 3; i++) {
        const particleOffsetX = (Math.random() - 0.5) * BLOCK_SIZE
        const particle = this.scene.add.star(
          centerX + particleOffsetX,
          centerY,
          5,
          3,
          6,
          0xffff00,
          1
        )
        particle.setScale(0.5)
        this.scene.tweens.add({
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

  /**
   * 重力適用（落下アニメーション付き）
   */
  applyGravityWithAnimation(board: number[][], onComplete: () => void) {
    this.fallingBlocks = []

    // 各列ごとに落下情報を計算
    for (let x = 0; x < COLS; x++) {
      let writeY = ROWS - 1

      for (let readY = ROWS - 1; readY >= 0; readY--) {
        if (board[readY][x] !== 0) {
          if (readY !== writeY) {
            this.fallingBlocks.push({
              x,
              fromY: readY,
              toY: writeY,
              currentY: readY,
              value: board[readY][x]
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
      board[block.fromY][block.x] = 0
    })

    // 落下アニメーション
    const fallDuration = 150
    this.scene.tweens.addCounter({
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
          board[block.toY][block.x] = block.value
        })
        this.fallingBlocks = []
        onComplete()
      }
    })
  }

  /**
   * 演出中のブロックを描画
   */
  drawAnimatingBlocks(graphics: Phaser.GameObjects.Graphics, textPool: Phaser.GameObjects.Text[], textPoolIndex: { value: number }) {
    this.animatingBlocks.forEach(block => {
      this.drawBlockWithScale(graphics, textPool, textPoolIndex, block.x, block.y, block.value, block.scale, block.alpha)
    })
  }

  /**
   * 落下中のブロックを描画
   */
  drawFallingBlocks(graphics: Phaser.GameObjects.Graphics, textPool: Phaser.GameObjects.Text[], textPoolIndex: { value: number }) {
    this.fallingBlocks.forEach(block => {
      const centerX = this.offsetX + block.x * BLOCK_SIZE + BLOCK_SIZE / 2
      const centerY = this.offsetY + block.currentY * BLOCK_SIZE + BLOCK_SIZE / 2
      const halfSize = (BLOCK_SIZE - 4) / 2

      graphics.fillStyle(COLORS[block.value], 1)
      graphics.fillRect(centerX - halfSize, centerY - halfSize, BLOCK_SIZE - 4, BLOCK_SIZE - 4)

      if (textPoolIndex.value < textPool.length) {
        const text = textPool[textPoolIndex.value++]
        text.setText(block.value.toString())
        text.setPosition(centerX, centerY)
        text.setVisible(true)
      }
    })
  }

  private drawBlockWithScale(
    graphics: Phaser.GameObjects.Graphics,
    textPool: Phaser.GameObjects.Text[],
    textPoolIndex: { value: number },
    x: number,
    y: number,
    value: number,
    scale: number,
    alpha: number
  ) {
    if (scale <= 0 || alpha <= 0) return

    const centerX = this.offsetX + x * BLOCK_SIZE + BLOCK_SIZE / 2
    const centerY = this.offsetY + y * BLOCK_SIZE + BLOCK_SIZE / 2
    const size = (BLOCK_SIZE - 4) * scale
    const halfSize = size / 2

    graphics.fillStyle(COLORS[value], alpha)
    graphics.fillRect(centerX - halfSize, centerY - halfSize, size, size)

    if (textPoolIndex.value < textPool.length && scale > 0.3) {
      const text = textPool[textPoolIndex.value++]
      text.setText(value.toString())
      text.setPosition(centerX, centerY)
      text.setScale(scale)
      text.setAlpha(alpha)
      text.setVisible(true)
    }
  }

  /**
   * 演出中・落下中のブロックのキーセットを取得
   */
  getExcludedKeys(): Set<string> {
    const keys = new Set<string>()
    this.animatingBlocks.forEach(b => keys.add(`${b.x},${b.y}`))
    this.fallingBlocks.forEach(b => keys.add(`${b.x},${b.fromY}`))
    return keys
  }
}
