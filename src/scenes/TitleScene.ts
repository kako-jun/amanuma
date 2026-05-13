/**
 * タイトル画面 (Issue #21)。
 *
 * - 中央に「amanuma」ロゴ + 副題「水中落ち物パズル」
 * - 下に 3 つのグラスボタン: 「シングル」「対戦」「終了」
 * - キーボード 1 / 2 / Escape で選択可
 *
 * DESIGN.md セクション 4 "Glass Buttons":
 *   - Background: semi-transparent violet gradient
 *   - Border: 1px solid rgba(124,58,237,0.3)
 *   - Border-radius: 8px
 *   - Hover: brighter gradient, stronger border
 *
 * PixiJS には CSS の linear-gradient / backdrop-filter が直接無いので、
 * `Graphics` で半透明矩形 + Violet 枠線 + 角丸 8px を描いて代用する。
 * hover 時は枠線の alpha と塗りの alpha を上げて「明るくなる」演出にする。
 */
import { Container, Graphics, Text } from 'pixi.js'
import type { KeyboardCommand, KeyboardManager } from '../input/KeyboardManager'
import { UI_PRIMARY, UI_SECONDARY, UI_TEXT_PRIMARY } from '../constants/colors'
import type { SoundManager } from '../audio/SoundManager'

export type TitleAction = 'single' | 'versus' | 'exit'

/** ボタン 1 個分の幅・高さ。タッチ最小 48px を超える。 */
const BUTTON_WIDTH = 220
const BUTTON_HEIGHT = 56
const BUTTON_GAP = 16
const BUTTON_RADIUS = 8

/** ロゴ・副題のレイアウト基点 (TitleScene ローカル座標で「中心」)。 */
const LOGO_OFFSET_Y = -160
const SUBTITLE_OFFSET_Y = -88
const BUTTONS_START_Y = -8

interface ButtonEntry {
  action: TitleAction
  label: string
  graphics: Graphics
  text: Text
  /** TitleScene ローカル座標での中心 x。クリック判定で使う。 */
  centerX: number
  centerY: number
  hovered: boolean
}

export class TitleScene extends Container {
  private readonly buttons: ButtonEntry[] = []
  private readonly onSelect: (action: TitleAction) => void
  private readonly soundManager: SoundManager | null

  constructor(
    onSelect: (action: TitleAction) => void,
    soundManager: SoundManager | null = null
  ) {
    super()
    this.onSelect = onSelect
    this.soundManager = soundManager

    // ロゴ。
    const logo = new Text({
      text: 'amanuma',
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 64,
        fontWeight: '700',
        fill: UI_TEXT_PRIMARY,
        align: 'center',
      },
    })
    logo.anchor.set(0.5)
    logo.x = 0
    logo.y = LOGO_OFFSET_Y
    this.addChild(logo)

    // 副題。
    const subtitle = new Text({
      text: '水中落ち物パズル',
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 16,
        fontWeight: '400',
        // text-secondary: rgba(255,255,255,0.7) → 0x ffffff + alpha は Text の alpha で表現。
        fill: UI_TEXT_PRIMARY,
        align: 'center',
      },
    })
    subtitle.anchor.set(0.5)
    subtitle.alpha = 0.7
    subtitle.x = 0
    subtitle.y = SUBTITLE_OFFSET_Y
    this.addChild(subtitle)

    // ボタン定義。
    const defs: { action: TitleAction; label: string }[] = [
      { action: 'single', label: 'シングル (1)' },
      { action: 'versus', label: '対戦 (2)' },
      { action: 'exit', label: '終了 (Esc)' },
    ]
    for (let i = 0; i < defs.length; i++) {
      const cy = BUTTONS_START_Y + i * (BUTTON_HEIGHT + BUTTON_GAP)
      this.addButton(defs[i].action, defs[i].label, 0, cy)
    }

    // PixiJS の interactive 設定: hover / click を受ける。
    this.eventMode = 'static'
    this.cursor = 'default'
  }

  /**
   * KeyboardManager のコマンドを subscribe する。
   * 戻り値は unsubscribe。
   */
  attachInputs(keyboard: KeyboardManager): () => void {
    const handler = (cmd: KeyboardCommand): void => {
      switch (cmd) {
        case 'select1':
          this.fireSelect('single')
          break
        case 'select2':
          this.fireSelect('versus')
          break
        case 'cancel':
          this.fireSelect('exit')
          break
        case 'confirm':
          // Enter / Space はデフォルトで「シングル」開始。
          this.fireSelect('single')
          break
        default:
          break
      }
    }
    return keyboard.onCommand(handler)
  }

  /** 共通: ui-select 音 + 上位通知。 */
  private fireSelect(action: TitleAction): void {
    this.soundManager?.playSfx('ui-select')
    this.onSelect(action)
  }

  // ----------------------------------------------------------------------
  // private
  // ----------------------------------------------------------------------

  private addButton(
    action: TitleAction,
    label: string,
    cx: number,
    cy: number
  ): void {
    const g = new Graphics()
    g.eventMode = 'static'
    g.cursor = 'pointer'
    // hit area は GraphicsContext の bbox に従う。後で drawButton で描画。

    const text = new Text({
      text: label,
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 16,
        fontWeight: '600',
        fill: UI_TEXT_PRIMARY,
        align: 'center',
      },
    })
    text.anchor.set(0.5)
    text.x = cx
    text.y = cy

    const entry: ButtonEntry = {
      action,
      label,
      graphics: g,
      text,
      centerX: cx,
      centerY: cy,
      hovered: false,
    }
    this.buttons.push(entry)
    this.addChild(g)
    this.addChild(text)
    this.drawButton(entry)

    // hover / click。
    g.on('pointerover', () => {
      entry.hovered = true
      this.drawButton(entry)
    })
    g.on('pointerout', () => {
      entry.hovered = false
      this.drawButton(entry)
    })
    g.on('pointertap', () => {
      this.fireSelect(entry.action)
    })
  }

  /**
   * 1 つのボタンを再描画する。グラスボタン: 半透明 Violet 矩形 + 1px 枠線。
   * hover 時は alpha を上げて「明るく」する。
   */
  private drawButton(entry: ButtonEntry): void {
    const { graphics: g, centerX, centerY, hovered } = entry
    const x = centerX - BUTTON_WIDTH / 2
    const y = centerY - BUTTON_HEIGHT / 2
    const fillAlpha = hovered ? 0.35 : 0.2
    const borderAlpha = hovered ? 0.9 : 0.5
    const borderColor = hovered ? UI_SECONDARY : UI_PRIMARY
    g.clear()
    g.roundRect(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS)
      .fill({ color: UI_PRIMARY, alpha: fillAlpha })
      .stroke({ color: borderColor, width: 1, alpha: borderAlpha })
  }

  /** PIXI.Container.destroy をオーバーライドして children も解放。 */
  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    super.destroy(options ?? { children: true })
  }
}
