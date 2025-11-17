import Phaser from 'phaser'

export class TitleScene extends Phaser.Scene {
  private selectedMode: number = 1 // 1=Single, 2=Versus
  private singlePlayerText!: Phaser.GameObjects.Text
  private versusText!: Phaser.GameObjects.Text

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

    // モード選択
    this.add
      .text(centerX, centerY, 'SELECT MODE', {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // 1人用
    this.singlePlayerText = this.add
      .text(centerX, centerY + 50, '1. SINGLE PLAYER', {
        fontSize: '28px',
        color: '#00ff00',
      })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => this.startGame('MainScene'))

    // 対戦モード
    this.versusText = this.add
      .text(centerX, centerY + 100, '2. VS MODE', {
        fontSize: '28px',
        color: '#ff6600',
      })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => this.startGame('VersusScene'))

    // ハイスコア表示
    const highScore = localStorage.getItem('threeseven-highscore')
    if (highScore) {
      this.add
        .text(centerX, centerY + 160, `High Score: ${highScore}`, {
          fontSize: '20px',
          color: '#ffff00',
        })
        .setOrigin(0.5)
    }

    // 操作説明
    this.add
      .text(
        centerX,
        centerY + 220,
        'Single: ← → ↓ P\nVersus: P1(WASD) P2(Arrow) P',
        {
          fontSize: '14px',
          color: '#888888',
          align: 'center',
        }
      )
      .setOrigin(0.5)

    // スタート案内
    const startText = this.add
      .text(centerX, centerY + 280, 'Press 1/2 or Click to Select', {
        fontSize: '18px',
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

    key1.on('down', () => {
      this.selectedMode = 1
      this.startGame('MainScene')
    })

    key2.on('down', () => {
      this.selectedMode = 2
      this.startGame('VersusScene')
    })

    spaceKey.on('down', () => {
      this.startGame(this.selectedMode === 1 ? 'MainScene' : 'VersusScene')
    })

    // 初期選択表示を更新
    this.updateSelection()
  }

  private updateSelection() {
    if (this.selectedMode === 1) {
      this.singlePlayerText.setColor('#00ff00')
      this.singlePlayerText.setFontSize(32)
      this.versusText.setColor('#ff6600')
      this.versusText.setFontSize(28)
    } else {
      this.singlePlayerText.setColor('#00ff00')
      this.singlePlayerText.setFontSize(28)
      this.versusText.setColor('#ff6600')
      this.versusText.setFontSize(32)
    }
  }

  private startGame(sceneName: string) {
    this.scene.start(sceneName)
  }
}
