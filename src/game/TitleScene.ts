import Phaser from 'phaser'

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' })
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // タイトル
    this.add
      .text(centerX, centerY - 150, 'スリーセブン', {
        fontSize: '64px',
        color: '#9400d3',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(centerX, centerY - 100, 'THREE SEVEN', {
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    // ゲーム説明
    this.add
      .text(
        centerX,
        centerY - 20,
        '縦・横に並べて合計7を作ろう！\n7は3つ以上並べないと消えない',
        {
          fontSize: '18px',
          color: '#aaaaaa',
          align: 'center',
        }
      )
      .setOrigin(0.5)

    // ハイスコア表示
    const highScore = localStorage.getItem('threeseven-highscore')
    if (highScore) {
      this.add
        .text(centerX, centerY + 60, `High Score: ${highScore}`, {
          fontSize: '24px',
          color: '#ffff00',
        })
        .setOrigin(0.5)
    }

    // スタート案内
    const startText = this.add
      .text(centerX, centerY + 120, 'Press SPACE to Start', {
        fontSize: '28px',
        color: '#00ff00',
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

    // 操作説明
    this.add
      .text(
        centerX,
        centerY + 200,
        '← → : 移動  ↓ : 高速落下  P : 一時停止',
        {
          fontSize: '16px',
          color: '#888888',
          align: 'center',
        }
      )
      .setOrigin(0.5)

    // スペースキーでゲーム開始
    const spaceKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    )
    spaceKey.on('down', () => {
      this.scene.start('MainScene')
    })

    // クリックでもゲーム開始
    this.input.on('pointerdown', () => {
      this.scene.start('MainScene')
    })
  }
}
