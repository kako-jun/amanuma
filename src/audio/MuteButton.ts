/**
 * ミュート切替ボタン (Issue #22)。
 *
 * Canvas 右上に小さく常駐するグラスボタン。クリックで `SoundManager.toggleMute()` を呼ぶ。
 *
 * 仕様:
 * - サイズは正方形 (既定 32px)。タッチで押しやすいよう本体の hit area は
 *   `hitArea` で軽く広げる必要は無い (canvas 内 UI、マウス前提で OK)。
 * - 状態表記は emoji を避け、`ON` / `OFF` の文字ラベルにする。
 *   (emoji フォント未搭載の Linux 環境でも描画が壊れない)
 * - 背景: 半透明 dark + Violet 枠線 (DESIGN.md のグラスボタン準拠)。
 * - ミュート状態の変化は `SoundManager.onMuteChange` で受け取って再描画する。
 *
 * 親の Container (= `app.stage`) に追加する想定。`x`/`y` は呼び出し側で
 * canvas の右上に置く。
 */
import { Container, Graphics, Text } from 'pixi.js'
import type { SoundManager } from './SoundManager'
import { UI_PRIMARY, UI_SECONDARY, UI_TEXT_PRIMARY } from '../constants/colors'

export class MuteButton extends Container {
  private readonly bg: Graphics
  private readonly labelText: Text
  private hovered: boolean = false
  private readonly soundManager: SoundManager
  private readonly size: number
  private readonly unsubMute: () => void

  constructor(soundManager: SoundManager, size: number = 32) {
    super()
    this.soundManager = soundManager
    this.size = size

    this.bg = new Graphics()
    this.bg.eventMode = 'static'
    this.bg.cursor = 'pointer'
    this.addChild(this.bg)

    this.labelText = new Text({
      text: '',
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: Math.max(10, Math.floor(size * 0.36)),
        fontWeight: '700',
        fill: UI_TEXT_PRIMARY,
        align: 'center',
      },
    })
    this.labelText.anchor.set(0.5)
    this.labelText.x = size / 2
    this.labelText.y = size / 2
    this.addChild(this.labelText)

    this.bg.on('pointerover', () => {
      this.hovered = true
      this.redraw()
    })
    this.bg.on('pointerout', () => {
      this.hovered = false
      this.redraw()
    })
    this.bg.on('pointertap', () => {
      this.soundManager.toggleMute()
    })

    this.unsubMute = this.soundManager.onMuteChange(() => this.redraw())
    this.redraw()
  }

  /**
   * 背景とラベルを (再) 描画する。
   * - 通常: dark 半透明 + Violet border。
   * - hover: Cyan border、塗り alpha 増。
   * - ミュート中: ラベルは "OFF"、border alpha を高めて警告感を出す。
   */
  private redraw(): void {
    const muted = this.soundManager.isMuted()
    this.labelText.text = muted ? 'OFF' : 'ON'
    const fillAlpha = this.hovered ? 0.45 : 0.3
    const borderAlpha = this.hovered ? 0.9 : muted ? 0.7 : 0.5
    const borderColor = this.hovered ? UI_SECONDARY : UI_PRIMARY
    this.bg.clear()
    this.bg
      .roundRect(0, 0, this.size, this.size, 6)
      .fill({ color: 0x0f0f1a, alpha: fillAlpha })
      .stroke({ color: borderColor, width: 1, alpha: borderAlpha })
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.unsubMute()
    super.destroy(options ?? { children: true })
  }
}
