import Phaser from 'phaser'

// ゲームの定数
export const COLS = 5
export const ROWS = 10
export const BLOCK_SIZE = 50

// 数字ごとの色定義
export const COLORS = [
  0x808080, // 0 (使用しない)
  0xff0000, // 1 赤
  0xff7f00, // 2 オレンジ
  0xffff00, // 3 黄色
  0x00ff00, // 4 緑
  0x0000ff, // 5 青
  0x4b0082, // 6 藍色
  0x9400d3, // 7 紫
]

/**
 * 1人分のゲームボードを管理するクラス
 * シングルプレイと対戦モードの両方で使用可能
 */
export class GameBoard {
  public board: number[][] // 0=空, 1-7=数字ブロック
  public currentBlock: {
    value: number
    x: number
    y: number
  } | null
  public nextBlock: number
  public score: number
  public level: number
  public linesCleared: number
  public chainCount: number
  public dropTimer: number
  public dropInterval: number
  public gameOver: boolean
  public offsetX: number
  public offsetY: number

  private baseDropInterval: number

  constructor(_scene: Phaser.Scene, offsetX: number, offsetY: number) {
    this.offsetX = offsetX
    this.offsetY = offsetY
    this.board = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0))
    this.currentBlock = null
    this.nextBlock = this.generateRandomNumber()
    this.score = 0
    this.level = 1
    this.linesCleared = 0
    this.chainCount = 0
    this.dropTimer = 0
    this.baseDropInterval = 1000
    this.dropInterval = 1000
    this.gameOver = false
  }

  /**
   * 確率調整した乱数生成
   * 1-6: 各17%、7: 2%
   */
  private generateRandomNumber(): number {
    const rand = Math.random()
    if (rand < 0.02) {
      return 7 // 2%
    } else {
      return Math.floor(rand * 6.12) + 1 // 1-6を均等に
    }
  }

  /**
   * 新しいブロックを生成
   * @returns ゲームオーバーならtrue
   */
  public spawnBlock(): boolean {
    const value = this.nextBlock
    this.nextBlock = this.generateRandomNumber()

    this.currentBlock = {
      value: value,
      x: Math.floor(COLS / 2),
      y: 0,
    }

    // ゲームオーバー判定
    if (this.board[0][this.currentBlock.x] !== 0) {
      this.gameOver = true
      return true
    }

    return false
  }

  /**
   * 衝突判定
   */
  public collision(offsetX: number, offsetY: number): boolean {
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

  /**
   * 現在のブロックをボードに固定
   */
  public merge() {
    if (!this.currentBlock) return

    const { x, y, value } = this.currentBlock
    if (y >= 0 && y < ROWS) {
      this.board[y][x] = value
    }
  }

  /**
   * ブロックを左右に移動
   */
  public move(dir: number) {
    if (!this.collision(dir, 0)) {
      this.currentBlock!.x += dir
    }
  }

  /**
   * ブロックを1マス落下
   * @returns 固定されたらtrue
   */
  public drop(): boolean {
    if (this.gameOver) return false

    if (!this.collision(0, 1)) {
      this.currentBlock!.y++
      return false
    } else {
      this.merge()
      return true
    }
  }

  /**
   * 合計7のチェックと消去（連鎖対応）
   * @returns 消去が発生したブロック数
   */
  public checkAndClearSevens(): number {
    const toRemove: Set<string> = new Set()

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

          if (sum === 7) {
            // 全て7の場合、3つ以上かチェック
            if (sequence.every(s => s.value === 7)) {
              if (sequence.length >= 3) {
                sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
              }
            } else {
              sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
            }
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

          if (sum === 7) {
            if (sequence.every(s => s.value === 7)) {
              if (sequence.length >= 3) {
                sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
              }
            } else {
              sequence.forEach(s => toRemove.add(`${s.x},${s.y}`))
            }
            break
          } else if (sum > 7) {
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
      this.linesCleared++

      // レベルアップ処理
      const newLevel = Math.floor(this.linesCleared / 10) + 1
      if (newLevel > this.level) {
        this.level = newLevel
        this.dropInterval = Math.max(
          this.baseDropInterval / (1 + (this.level - 1) * 0.1),
          this.baseDropInterval / 2
        )
      }

      // 重力を適用
      this.applyGravity()

      return toRemove.size
    }

    return 0
  }

  /**
   * 重力を適用（空きマスを詰める）
   */
  private applyGravity() {
    for (let x = 0; x < COLS; x++) {
      const column: number[] = []
      for (let y = ROWS - 1; y >= 0; y--) {
        if (this.board[y][x] !== 0) {
          column.push(this.board[y][x])
        }
      }

      for (let y = 0; y < ROWS; y++) {
        this.board[y][x] = 0
      }
      for (let i = 0; i < column.length; i++) {
        this.board[ROWS - 1 - i][x] = column[i]
      }
    }
  }

  /**
   * 攻撃ブロックを追加（対戦モード用）
   * @param count 追加するブロック数
   */
  public addGarbageBlocks(count: number) {
    // 上から押し上げる形でランダムブロックを追加
    for (let i = 0; i < count; i++) {
      // 最下行にランダムな列にブロックを追加
      const col = Math.floor(Math.random() * COLS)

      // 全体を1行上にシフト
      for (let y = 0; y < ROWS - 1; y++) {
        for (let x = 0; x < COLS; x++) {
          this.board[y][x] = this.board[y + 1][x]
        }
      }

      // 最下行をクリアして、1つだけランダムブロックを配置
      for (let x = 0; x < COLS; x++) {
        this.board[ROWS - 1][x] = 0
      }
      this.board[ROWS - 1][col] = this.generateRandomNumber()
    }
  }
}
