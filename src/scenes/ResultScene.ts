/**
 * リザルト画面 (Issue #21)。
 *
 * - 「クリア!」「ゲームオーバー」「あなたの勝ち」「あなたの負け」と score を表示
 * - 「もう一度」「タイトルへ」のグラスボタン (DESIGN.md 準拠)
 * - キーボード R / Enter で「もう一度」、Escape で「タイトルへ」
 */
import { Container, Graphics, Text } from 'pixi.js'
import type { KeyboardCommand, KeyboardManager } from '../input/KeyboardManager'
import { UI_PRIMARY, UI_SECONDARY, UI_TEXT_PRIMARY } from '../constants/colors'
import type { SoundManager } from '../audio/SoundManager'

export type ResultKind = 'cleared' | 'gameover' | 'win' | 'lose'

export interface ResultSceneOptions {
  kind: ResultKind
  score?: number
  onRestart: () => void
  onTitle: () => void
  /**
   * 任意の SoundManager 注入 (Issue #22)。
   * 注入があれば、表示時に kind に応じた SFX (`puzzle-cleared` / `game-over`) を
   * 鳴らし、ボタン操作時に `ui-select` を鳴らす。
   *
   * 注 (S8): シングル (`cleared` / `gameover`) では PlayerBoard 側で既に
   * `puzzle-cleared` / `game-over` を鳴らしているため、ResultScene からは
   * 鳴らさない (二重発火を防ぐ)。対戦 (`win` / `lose`) は VersusScene →
   * ResultScene 遷移で初めて勝敗が確定するため、ResultScene 側でのみ鳴らす。
   */
  soundManager?: SoundManager | null
}

interface ButtonAction {
  key: 'restart' | 'title'
  label: string
  centerX: number
  centerY: number
  graphics: Graphics
  hovered: boolean
}

const BUTTON_WIDTH = 220
const BUTTON_HEIGHT = 56
const BUTTON_GAP = 24
const BUTTON_RADIUS = 8

const HEADLINE_OFFSET_Y = -120
const SCORE_OFFSET_Y = -40
const BUTTONS_START_Y = 40

function headlineText(kind: ResultKind): string {
  switch (kind) {
    case 'cleared':
      return 'クリア!'
    case 'gameover':
      return 'ゲームオーバー'
    case 'win':
      return 'あなたの勝ち'
    case 'lose':
      return 'あなたの負け'
  }
}

export class ResultScene extends Container {
  private readonly opts: ResultSceneOptions
  private readonly buttons: ButtonAction[] = []
  private readonly soundManager: SoundManager | null

  constructor(opts: ResultSceneOptions) {
    super()
    this.opts = opts
    this.soundManager = opts.soundManager ?? null

    // 表示と同時に kind 別 SFX。
    // S8: シングル (cleared / gameover) は PlayerBoard で既に発火しているため、
    // ResultScene からは対戦結果 (win / lose) のみ鳴らす (二重発火回避)。
    if (this.soundManager) {
      switch (opts.kind) {
        case 'win':
          this.soundManager.playSfx('puzzle-cleared')
          break
        case 'lose':
          this.soundManager.playSfx('game-over')
          break
        case 'cleared':
        case 'gameover':
          // PlayerBoard 側で発火済み。ここでは鳴らさない。
          break
      }
    }

    // 見出し。
    const headline = new Text({
      text: headlineText(opts.kind),
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 48,
        fontWeight: '700',
        fill: UI_TEXT_PRIMARY,
        align: 'center',
      },
    })
    headline.anchor.set(0.5)
    headline.x = 0
    headline.y = HEADLINE_OFFSET_Y
    this.addChild(headline)

    // スコア (任意)。
    if (opts.score !== undefined) {
      const score = new Text({
        text: `SCORE: ${opts.score}`,
        style: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 24,
          fontWeight: '700',
          fill: UI_TEXT_PRIMARY,
          align: 'center',
        },
      })
      score.anchor.set(0.5)
      score.alpha = 0.85
      score.x = 0
      score.y = SCORE_OFFSET_Y
      this.addChild(score)
    }

    // ボタン定義。
    const defs: { key: 'restart' | 'title'; label: string }[] = [
      { key: 'restart', label: 'もう一度 (R)' },
      { key: 'title', label: 'タイトルへ (Esc)' },
    ]
    for (let i = 0; i < defs.length; i++) {
      const cy = BUTTONS_START_Y + i * (BUTTON_HEIGHT + BUTTON_GAP)
      this.addButton(defs[i].key, defs[i].label, 0, cy)
    }

    this.eventMode = 'static'
    this.cursor = 'default'
  }

  /**
   * KeyboardManager の購読。
   * - confirm (Enter / Space) / restart (R) → onRestart
   * - cancel (Escape) → onTitle
   */
  attachInputs(keyboard: KeyboardManager): () => void {
    const handler = (cmd: KeyboardCommand): void => {
      switch (cmd) {
        case 'restart':
        case 'confirm':
          this.soundManager?.playSfx('ui-select')
          this.opts.onRestart()
          break
        case 'cancel':
          this.soundManager?.playSfx('ui-select')
          this.opts.onTitle()
          break
        default:
          break
      }
    }
    return keyboard.onCommand(handler)
  }

  private addButton(
    key: 'restart' | 'title',
    label: string,
    cx: number,
    cy: number
  ): void {
    const g = new Graphics()
    g.eventMode = 'static'
    g.cursor = 'pointer'

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

    const entry: ButtonAction = {
      key,
      label,
      centerX: cx,
      centerY: cy,
      graphics: g,
      hovered: false,
    }
    this.buttons.push(entry)
    this.addChild(g)
    this.addChild(text)
    this.drawButton(entry)

    g.on('pointerover', () => {
      entry.hovered = true
      this.drawButton(entry)
    })
    g.on('pointerout', () => {
      entry.hovered = false
      this.drawButton(entry)
    })
    g.on('pointertap', () => {
      this.soundManager?.playSfx('ui-select')
      if (entry.key === 'restart') this.opts.onRestart()
      else this.opts.onTitle()
    })
  }

  private drawButton(entry: ButtonAction): void {
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

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    super.destroy(options ?? { children: true })
  }
}
