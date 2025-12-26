import Phaser from 'phaser'
import { STORAGE_KEY_HIGHSCORE, UI_COLORS, GAME_WIDTH, GAME_HEIGHT } from './constants'

export class TitleScene extends Phaser.Scene {
  private selectedMode: number = 1 // 1=Single, 2=Versus
  private singleBtn!: Phaser.GameObjects.Container
  private versusBtn!: Phaser.GameObjects.Container
  private particles!: Phaser.GameObjects.Graphics
  private particleData: Array<{ x: number; y: number; speed: number; size: number; alpha: number }> = []

  constructor() {
    super({ key: 'TitleScene' })
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // 背景グラデーション風（複数の矩形で表現）
    this.drawBackground()

    // パーティクル背景
    this.createParticleBackground()

    // ロゴ背景のグロー効果
    const logoGlow = this.add.graphics()
    logoGlow.fillStyle(UI_COLORS.primary, 0.1)
    logoGlow.fillCircle(centerX, centerY - 180, 120)

    // タイトル（グロー効果付き）
    this.add
      .text(centerX + 2, centerY - 178, 'amanuma', {
        fontSize: '64px',
        color: '#000000',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.3)

    const title = this.add
      .text(centerX, centerY - 180, 'amanuma', {
        fontSize: '64px',
        color: '#a855f7',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // タイトルのグロー効果（パルスアニメーション）
    this.tweens.add({
      targets: title,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // サブタイトル
    this.add
      .text(centerX, centerY - 115, '- the game master -', {
        fontSize: '16px',
        color: '#64748b',
        letterSpacing: 4,
      })
      .setOrigin(0.5)

    // 区切り線
    const divider = this.add.graphics()
    divider.lineStyle(1, UI_COLORS.border, 0.5)
    divider.lineBetween(centerX - 150, centerY - 85, centerX + 150, centerY - 85)

    // ゲーム説明（カード風）
    this.createInfoCard(centerX, centerY - 40)

    // モード選択ボタン
    this.singleBtn = this.createModernButton(
      centerX,
      centerY + 60,
      'SINGLE PLAYER',
      'ひとりで遊ぶ',
      UI_COLORS.success,
      () => this.startGame('MainScene')
    )

    this.versusBtn = this.createModernButton(
      centerX,
      centerY + 140,
      'VS MODE',
      'ふたりで対戦',
      UI_COLORS.warning,
      () => this.startGame('VersusScene')
    )

    // ハイスコア表示
    const highScore = localStorage.getItem(STORAGE_KEY_HIGHSCORE)
    if (highScore) {
      this.createHighScoreDisplay(centerX, centerY + 210, highScore)
    }

    // 操作説明
    this.createControlsInfo(centerX, centerY + 260)

    // スタート案内
    const startText = this.add
      .text(centerX, centerY + 300, '▼ タップ or クリックで選択 ▼', {
        fontSize: '14px',
        color: '#64748b',
      })
      .setOrigin(0.5)

    // 点滅アニメーション
    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // キーボード入力
    this.setupKeyboardInput()
    this.updateSelection()
  }

  update() {
    this.updateParticles()
  }

  private drawBackground() {
    const bg = this.add.graphics()
    // 暗いグラデーション風背景
    bg.fillStyle(UI_COLORS.background, 1)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // 上部のグラデーション
    for (let i = 0; i < 10; i++) {
      const alpha = 0.03 - i * 0.003
      bg.fillStyle(UI_COLORS.primary, alpha)
      bg.fillRect(0, i * 20, GAME_WIDTH, 20)
    }

    // 下部のグラデーション
    for (let i = 0; i < 10; i++) {
      const alpha = 0.03 - i * 0.003
      bg.fillStyle(UI_COLORS.secondary, alpha)
      bg.fillRect(0, GAME_HEIGHT - i * 20 - 20, GAME_WIDTH, 20)
    }
  }

  private createParticleBackground() {
    this.particles = this.add.graphics()

    // パーティクルデータの初期化
    for (let i = 0; i < 30; i++) {
      this.particleData.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        speed: 0.2 + Math.random() * 0.3,
        size: 1 + Math.random() * 2,
        alpha: 0.1 + Math.random() * 0.2,
      })
    }
  }

  private updateParticles() {
    this.particles.clear()

    for (const p of this.particleData) {
      p.y -= p.speed
      if (p.y < -10) {
        p.y = GAME_HEIGHT + 10
        p.x = Math.random() * GAME_WIDTH
      }

      this.particles.fillStyle(UI_COLORS.primaryGlow, p.alpha)
      this.particles.fillCircle(p.x, p.y, p.size)
    }
  }

  private createInfoCard(x: number, y: number) {
    const cardWidth = 320
    const cardHeight = 50

    const card = this.add.graphics()
    // カード背景
    card.fillStyle(UI_COLORS.backgroundCard, 0.8)
    card.fillRoundedRect(x - cardWidth / 2, y - cardHeight / 2, cardWidth, cardHeight, 8)
    // カードボーダー
    card.lineStyle(1, UI_COLORS.border, 0.5)
    card.strokeRoundedRect(x - cardWidth / 2, y - cardHeight / 2, cardWidth, cardHeight, 8)

    this.add
      .text(x, y, '縦・横に並べて合計7を作ろう！', {
        fontSize: '16px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5)
  }

  private createModernButton(
    x: number,
    y: number,
    label: string,
    sublabel: string,
    accentColor: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const width = 280
    const height = 64

    // グロー効果用（選択時に表示）
    const glow = this.add.graphics()
    glow.setVisible(false)

    // 背景
    const bg = this.add.graphics()
    this.drawButtonBg(bg, width, height, accentColor, false)

    // アイコン（左端）
    const icon = this.add
      .text(-width / 2 + 20, 0, label === 'SINGLE PLAYER' ? '👤' : '👥', {
        fontSize: '20px',
      })
      .setOrigin(0, 0.5)

    // メインラベル
    const text = this.add
      .text(0, -8, label, {
        fontSize: '18px',
        color: '#f8fafc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // サブラベル
    const subtext = this.add
      .text(0, 12, sublabel, {
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)

    // 矢印（右端）
    const arrow = this.add
      .text(width / 2 - 20, 0, '→', {
        fontSize: '18px',
        color: '#64748b',
      })
      .setOrigin(1, 0.5)

    const container = this.add.container(x, y, [glow, bg, icon, text, subtext, arrow])
    container.setSize(width, height)
    container.setInteractive()

    // ホバー効果
    container.on('pointerover', () => {
      this.drawButtonBg(bg, width, height, accentColor, true)
      arrow.setColor('#f8fafc')
      container.setScale(1.02)
    })

    container.on('pointerout', () => {
      this.drawButtonBg(bg, width, height, accentColor, false)
      arrow.setColor('#64748b')
      container.setScale(1)
    })

    container.on('pointerdown', () => {
      container.setScale(0.98)
      // クリック時のフィードバック
      this.time.delayedCall(100, onClick)
    })

    container.on('pointerup', () => {
      container.setScale(1.02)
    })

    return container
  }

  private drawButtonBg(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    accentColor: number,
    isHovered: boolean
  ) {
    graphics.clear()

    // 背景
    graphics.fillStyle(isHovered ? UI_COLORS.backgroundCard : UI_COLORS.backgroundLight, isHovered ? 1 : 0.9)
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 12)

    // 左側のアクセントライン
    graphics.fillStyle(accentColor, isHovered ? 1 : 0.7)
    graphics.fillRoundedRect(-width / 2, -height / 2, 4, height, { tl: 12, bl: 12, tr: 0, br: 0 })

    // ボーダー
    graphics.lineStyle(1, isHovered ? accentColor : UI_COLORS.border, isHovered ? 0.8 : 0.3)
    graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 12)
  }

  private createHighScoreDisplay(x: number, y: number, score: string) {
    const container = this.add.container(x, y)

    // バッジ風背景
    const badge = this.add.graphics()
    badge.fillStyle(UI_COLORS.warning, 0.15)
    badge.fillRoundedRect(-80, -15, 160, 30, 15)
    badge.lineStyle(1, UI_COLORS.warning, 0.3)
    badge.strokeRoundedRect(-80, -15, 160, 30, 15)

    // アイコン
    const icon = this.add.text(-60, 0, '🏆', { fontSize: '14px' }).setOrigin(0.5)

    // テキスト
    const text = this.add
      .text(10, 0, `High Score: ${score}`, {
        fontSize: '14px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    container.add([badge, icon, text])
  }

  private createControlsInfo(x: number, y: number) {
    const container = this.add.container(x, y)

    // 背景
    const bg = this.add.graphics()
    bg.fillStyle(UI_COLORS.backgroundCard, 0.5)
    bg.fillRoundedRect(-200, -12, 400, 24, 4)

    // テキスト
    const text = this.add
      .text(0, 0, '🎮 Single: ← → ↓  |  Versus: P1(ASD) P2(←→↓)', {
        fontSize: '12px',
        color: '#64748b',
      })
      .setOrigin(0.5)

    container.add([bg, text])
  }

  private setupKeyboardInput() {
    const key1 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE)
    const key2 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO)
    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    const upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    const downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
    const enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)

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
  }

  private updateSelection() {
    const singleBg = this.singleBtn.getAt(1) as Phaser.GameObjects.Graphics
    const versusBg = this.versusBtn.getAt(1) as Phaser.GameObjects.Graphics

    if (this.selectedMode === 1) {
      this.drawButtonBg(singleBg, 280, 64, UI_COLORS.success, true)
      this.drawButtonBg(versusBg, 280, 64, UI_COLORS.warning, false)
      this.singleBtn.setScale(1.02)
      this.versusBtn.setScale(1)
    } else {
      this.drawButtonBg(singleBg, 280, 64, UI_COLORS.success, false)
      this.drawButtonBg(versusBg, 280, 64, UI_COLORS.warning, true)
      this.singleBtn.setScale(1)
      this.versusBtn.setScale(1.02)
    }
  }

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
    // フェードアウト効果
    this.cameras.main.fadeOut(300, 15, 15, 26)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneName)
    })
  }
}
