import Phaser from 'phaser'
import { STORAGE_KEY_HIGHSCORE } from './constants'

export class TitleScene extends Phaser.Scene {
  private selectedMode: number = 1 // 1=Single, 2=Versus
  private singleBtn!: Phaser.GameObjects.Container
  private versusBtn!: Phaser.GameObjects.Container

  constructor() {
    super({ key: 'TitleScene' })
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // タイトル
    this.add
      .text(centerX, centerY - 200, 'スリーセブン', {
        fontSize: '64px',
        color: '#9400d3',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(centerX, centerY - 150, 'THREE SEVEN', {
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    // ゲーム説明
    this.add
      .text(
        centerX,
        centerY - 80,
        '縦・横に並べて合計7を作ろう！\n7は3つ以上並べないと消えない',
        {
          fontSize: '18px',
          color: '#aaaaaa',
          align: 'center',
        }
      )
      .setOrigin(0.5)

    // モード選択ボタン（大きなタップ領域）
    this.singleBtn = this.createButton(
      centerX,
      centerY + 40,
      'SINGLE PLAYER',
      0x00aa00,
      () => this.startGame('MainScene')
    )

    this.versusBtn = this.createButton(
      centerX,
      centerY + 120,
      'VS MODE',
      0xcc5500,
      () => this.startGame('VersusScene')
    )

    // ハイスコア表示
    const highScore = localStorage.getItem(STORAGE_KEY_HIGHSCORE)
    if (highScore) {
      this.add
        .text(centerX, centerY + 200, `High Score: ${highScore}`, {
          fontSize: '20px',
          color: '#ffff00',
        })
        .setOrigin(0.5)
    }

    // 操作説明
    this.add
      .text(
        centerX,
        centerY + 250,
        'Single: ← → ↓ | Versus: P1(ASD) P2(←→↓)',
        {
          fontSize: '14px',
          color: '#888888',
          align: 'center',
        }
      )
      .setOrigin(0.5)

    // スタート案内
    const startText = this.add
      .text(centerX, centerY + 290, 'タップ or クリックで選択', {
        fontSize: '16px',
        color: '#cccccc',
      })
      .setOrigin(0.5)

    // 点滅アニメーション
    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    })

    // キーボード入力
    const key1 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE)
    const key2 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO)
    const spaceKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    )
    const upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    const downKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.DOWN
    )
    const enterKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER
    )

    key1.on('down', () => this.startGame('MainScene'))
    key2.on('down', () => this.startGame('VersusScene'))

    upKey.on('down', () => {
      this.selectedMode = 1
      this.updateSelection()
    })
    downKey.on('down', () => {
      this.selectedMode = 2
      this.updateSelection()
    })

    spaceKey.on('down', () => this.confirmSelection())
    enterKey.on('down', () => this.confirmSelection())

    this.updateSelection()
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const width = 280
    const height = 60

    const bg = this.add.graphics()
    bg.fillStyle(color, 0.8)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12)
    bg.lineStyle(3, 0xffffff, 0.5)
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12)

    const text = this.add
      .text(0, 0, label, {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    const container = this.add.container(x, y, [bg, text])
    container.setSize(width, height)
    container.setInteractive()
    container.on('pointerdown', onClick)
    container.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(color, 1)
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12)
      bg.lineStyle(3, 0xffffff, 1)
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12)
    })
    container.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(color, 0.8)
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12)
      bg.lineStyle(3, 0xffffff, 0.5)
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12)
    })

    return container
  }

  private updateSelection() {
    // 選択中のボタンをハイライト
    const singleBg = this.singleBtn.getAt(0) as Phaser.GameObjects.Graphics
    const versusBg = this.versusBtn.getAt(0) as Phaser.GameObjects.Graphics

    singleBg.clear()
    versusBg.clear()

    if (this.selectedMode === 1) {
      singleBg.fillStyle(0x00ff00, 1)
      singleBg.fillRoundedRect(-140, -30, 280, 60, 12)
      singleBg.lineStyle(4, 0xffffff, 1)
      singleBg.strokeRoundedRect(-140, -30, 280, 60, 12)

      versusBg.fillStyle(0xcc5500, 0.6)
      versusBg.fillRoundedRect(-140, -30, 280, 60, 12)
      versusBg.lineStyle(2, 0xffffff, 0.3)
      versusBg.strokeRoundedRect(-140, -30, 280, 60, 12)
    } else {
      singleBg.fillStyle(0x00aa00, 0.6)
      singleBg.fillRoundedRect(-140, -30, 280, 60, 12)
      singleBg.lineStyle(2, 0xffffff, 0.3)
      singleBg.strokeRoundedRect(-140, -30, 280, 60, 12)

      versusBg.fillStyle(0xff6600, 1)
      versusBg.fillRoundedRect(-140, -30, 280, 60, 12)
      versusBg.lineStyle(4, 0xffffff, 1)
      versusBg.strokeRoundedRect(-140, -30, 280, 60, 12)
    }
  }

  // タッチ入力用の公開メソッド
  public selectUp() {
    this.selectedMode = 1
    this.updateSelection()
  }

  public selectDown() {
    this.selectedMode = 2
    this.updateSelection()
  }

  public confirmSelection() {
    this.startGame(this.selectedMode === 1 ? 'MainScene' : 'VersusScene')
  }

  private startGame(sceneName: string) {
    this.scene.start(sceneName)
  }
}
