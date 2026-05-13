/**
 * アプリのエントリーポイント (Issue #21 でシーン統合済み)。
 *
 * - 1 個の `Application` (PixiJS) を初期化
 * - 1 個の `KeyboardManager` を window に attach (全シーンで共有)
 * - `SceneManager` の world を stage に追加し、その中に Title / Single / Versus /
 *   Result の 4 シーンを誌面ローカル座標で配置
 * - シーン遷移は `SceneManager.navigateTo()` (cubicInOut tween)
 *
 * 入力フォワーディング:
 * - 「今アクティブなシーン」だけが KeyboardManager の onCommand を購読する。
 *   `setActiveScene(key)` で前の購読を解除し、新しいシーンの `attachInputs` を呼ぶ。
 */
import { Application } from 'pixi.js'
import { GameScene } from './scenes/GameScene'
import { SceneManager, type SceneKey } from './scenes/SceneManager'
import { TitleScene, type TitleAction } from './scenes/TitleScene'
import { VersusScene } from './scenes/VersusScene'
import { ResultScene, type ResultKind } from './scenes/ResultScene'
import { KeyboardManager } from './input/KeyboardManager'
import { TouchManager } from './input/TouchManager'
import { createInitialGameState } from './types/GameState'
import { PuzzleRotation, buildGameStateFromPuzzle } from './data/loadPuzzle'
import { generateBlockValue } from './game/randomBlocks'
import { SoundManager } from './audio/SoundManager'
import { MuteButton } from './audio/MuteButton'
import './index.css'

const VIEW_W = 800
const VIEW_H = 650

/** 誌面 (world) 上の各シーンの絶対座標。「宇宙に浮かぶ別ページ」感を出す。 */
const SCENE_TRANSFORMS = {
  title: { x: 400, y: 325, scale: 1 },
  single: { x: 1500, y: 325, scale: 1 },
  versus: { x: 2700, y: 325, scale: 1 },
  result: { x: 2000, y: 1200, scale: 1 },
} as const

async function bootstrap(): Promise<void> {
  const container = document.getElementById('root')
  if (!container) {
    throw new Error('Mount element #root not found in index.html')
  }

  const app = new Application()
  await app.init({
    width: VIEW_W,
    height: VIEW_H,
    background: 0x0f0f1a,
    antialias: true,
    resolution: window.devicePixelRatio,
    autoDensity: true,
  })
  container.appendChild(app.canvas)

  // ---------------------------------------------------------------------
  // 入力 Manager (全シーン共有)
  // ---------------------------------------------------------------------
  const keyboard = new KeyboardManager()
  keyboard.attach(window)
  const touch = new TouchManager()
  if (app.canvas instanceof HTMLCanvasElement) {
    touch.attach(app.canvas)
  }

  // ---------------------------------------------------------------------
  // SoundManager (Issue #22)
  // ---------------------------------------------------------------------
  // - 1 個だけ生成し、各シーンに任意注入で渡す。
  // - 起動時に localStorage からミュート状態を復元。
  // - 初回 pointerdown / keydown で `unlock()` を呼ぶ (AudioContext を resume)。
  // - アセット未配置時は 404 警告のみで silent (落ちない)。
  const sound = new SoundManager()
  sound.loadPersisted()

  let unlocked = false
  const unlockOnce = (): void => {
    if (unlocked) return
    unlocked = true
    sound.unlock()
    // BGM はタイトルから流したいので、unlock 後に再試行ループから抜けるよう
    // 既に playBgm('bgm-title') を呼んでおく (下の bootstrap 末尾)。
    window.removeEventListener('pointerdown', unlockOnce)
    window.removeEventListener('keydown', unlockOnce)
    window.removeEventListener('touchstart', unlockOnce)
  }
  window.addEventListener('pointerdown', unlockOnce, { once: false })
  window.addEventListener('keydown', unlockOnce, { once: false })
  window.addEventListener('touchstart', unlockOnce, { once: false })

  // M キー (mute toggle) はシーン非依存で受ける。
  // 個別シーンの onCommand に並列して購読しても、Set ベースなので両方発火する。
  keyboard.onCommand(cmd => {
    if (cmd === 'mute') sound.toggleMute()
  })

  // ---------------------------------------------------------------------
  // SceneManager + シーン群
  // ---------------------------------------------------------------------
  const sceneManager = new SceneManager(VIEW_W, VIEW_H)
  app.stage.addChild(sceneManager.world)

  // ミュートボタンは canvas 右上に固定 (world ではなく stage 直下)。
  // navigateTo で world が tween 中でも UI として常に同じ位置に表示される。
  const muteButton = new MuteButton(sound, 32)
  const MUTE_MARGIN = 8
  muteButton.x = VIEW_W - 32 - MUTE_MARGIN
  muteButton.y = MUTE_MARGIN
  app.stage.addChild(muteButton)

  const rotation = new PuzzleRotation()

  let activeUnsub: (() => void) | null = null
  let resultScene: ResultScene | null = null

  /**
   * 現在のお題から GameState を作る。失敗時は空盤面にフォールバック。
   * 最初の fallingBlock 未設定なら Next ベースで補充する。
   */
  function buildStateFromCurrentPuzzle(): ReturnType<
    typeof buildGameStateFromPuzzle
  > {
    return buildGameStateFromPuzzle(rotation.current())
  }
  function ensureFallingState(): ReturnType<typeof createInitialGameState> {
    const r = buildStateFromCurrentPuzzle()
    const state = r.ok ? r.state : createInitialGameState()
    if (!r.ok) console.error('[amanuma] failed to load puzzle:', r.error)
    if (state.fallingBlock === null) {
      state.fallingBlock = {
        value: state.nextBlock,
        col: Math.floor(state.cols / 2),
        row: 0,
        velocity: 0,
      }
      state.nextBlock = generateBlockValue()
    }
    return state
  }

  // --- Title ---
  const titleScene = new TitleScene(action => onTitleAction(action), sound)
  // SceneManager 座標系: title は (400, 325) に置く。
  titleScene.x = SCENE_TRANSFORMS.title.x
  titleScene.y = SCENE_TRANSFORMS.title.y
  sceneManager.world.addChild(titleScene)

  // --- Single (GameScene, 統合モード: app=null) ---
  const gameScene = new GameScene(null, sound)
  // SceneManager の world に直接 PlayerBoard を入れる。
  // PlayerBoard 内部は盤面左上が (0,0)。center に置きたいので、シーン位置から
  // 盤面幅/高さの半分だけ左上にオフセットする (initWithState 後に再計算する)。
  sceneManager.world.addChild(gameScene.board)

  gameScene.onCleared = (): void => {
    showResult({ kind: 'cleared', score: gameScene.getState()?.score })
  }
  gameScene.onGameOver = (): void => {
    showResult({ kind: 'gameover', score: gameScene.getState()?.score })
  }

  // --- Versus ---
  const versusScene = new VersusScene(
    {
      onP1Win: () => showResult({ kind: 'win' }),
      onP2Win: () => showResult({ kind: 'lose' }),
      onDraw: () => showResult({ kind: 'lose' }),
    },
    sound
  )
  versusScene.x = SCENE_TRANSFORMS.versus.x
  versusScene.y = SCENE_TRANSFORMS.versus.y
  sceneManager.world.addChild(versusScene)

  // SceneManager に登録。
  sceneManager.registerScene('title', SCENE_TRANSFORMS.title)
  sceneManager.registerScene('single', SCENE_TRANSFORMS.single)
  sceneManager.registerScene('versus', SCENE_TRANSFORMS.versus)
  sceneManager.registerScene('result', SCENE_TRANSFORMS.result)
  // 初期カメラは title にスナップ。
  void sceneManager.navigateTo('title', 0)
  setActiveScene('title')

  // 1 個の Ticker で全部を回す。
  app.ticker.add(ticker => {
    sceneManager.update(ticker.deltaMS)
    gameScene.update(ticker)
    versusScene.update(ticker)
  })

  // --------------------------------------------------------------------
  // シーン遷移ハンドラ
  // --------------------------------------------------------------------

  function setActiveScene(key: SceneKey): void {
    activeUnsub?.()
    activeUnsub = null
    switch (key) {
      case 'title':
        activeUnsub = titleScene.attachInputs(keyboard)
        sound.playBgm('bgm-title', { fadeMs: 500 })
        break
      case 'single':
        activeUnsub = gameScene.attachInputs(keyboard, touch, () => {
          // S5/S6: Esc でタイトルへ戻る。
          setActiveScene('title')
          void sceneManager.navigateTo('title', 800)
        })
        sound.playBgm('bgm-game', { fadeMs: 500 })
        break
      case 'versus':
        activeUnsub = versusScene.attachInputs(keyboard, () => {
          // S5/S6: Esc でタイトルへ戻る。
          setActiveScene('title')
          void sceneManager.navigateTo('title', 800)
        })
        sound.playBgm('bgm-versus', { fadeMs: 500 })
        break
      case 'result':
        if (resultScene) activeUnsub = resultScene.attachInputs(keyboard)
        // result は短い曲なのでループしない。
        sound.playBgm('bgm-result', { fadeMs: 500, loop: false })
        break
    }
  }

  function onTitleAction(action: TitleAction): void {
    switch (action) {
      case 'single':
        startSingle()
        break
      case 'versus':
        startVersus()
        break
      case 'exit':
        // ブラウザでは閉じられないので no-op (実装方針通り)。
        break
    }
  }

  function startSingle(): void {
    const state = ensureFallingState()
    gameScene.initWithState(state)
    // SceneManager 統合モード: board を single ページの中心に置く。
    // single = (1500, 325) なので、盤面の中心がそこに来るよう x/y を補正。
    const { width: bw, height: bh } = gameScene.board.getBoardSize()
    gameScene.board.x = SCENE_TRANSFORMS.single.x - bw / 2
    gameScene.board.y = SCENE_TRANSFORMS.single.y - bh / 2

    gameScene.setRestartSource({
      build: () => {
        const r = buildStateFromCurrentPuzzle()
        if (!r.ok) {
          console.error('[amanuma] restart failed:', r.error)
          return null
        }
        return r.state
      },
    })

    setActiveScene('single')
    void sceneManager.navigateTo('single', 800)
  }

  function startVersus(): void {
    // 同一お題から 2 つの独立した state を作る。
    const r1 = buildStateFromCurrentPuzzle()
    const r2 = buildStateFromCurrentPuzzle()
    const s1 = r1.ok ? r1.state : createInitialGameState()
    const s2 = r2.ok ? r2.state : createInitialGameState()
    // どちらも fallingBlock 未設定なら Next で補充。
    for (const s of [s1, s2]) {
      if (s.fallingBlock === null) {
        s.fallingBlock = {
          value: s.nextBlock,
          col: Math.floor(s.cols / 2),
          row: 0,
          velocity: 0,
        }
        s.nextBlock = generateBlockValue()
      }
    }
    versusScene.initWithStates(s1, s2)
    // VersusScene は (versus.x, versus.y) を「中心」と見做すよう自身の中で
    // 中央寄せしているので、シーン位置のままで OK。

    setActiveScene('versus')
    void sceneManager.navigateTo('versus', 800)
  }

  function showResult(opts: { kind: ResultKind; score?: number }): void {
    if (resultScene && !resultScene.destroyed) {
      resultScene.destroy()
    }
    resultScene = new ResultScene({
      kind: opts.kind,
      score: opts.score,
      soundManager: sound,
      onRestart: () => {
        // 直前のモードを判定する: cleared/gameover ならシングル、win/lose なら対戦。
        if (opts.kind === 'cleared' || opts.kind === 'gameover') {
          startSingle()
        } else {
          startVersus()
        }
      },
      onTitle: () => {
        setActiveScene('title')
        void sceneManager.navigateTo('title', 800)
      },
    })
    resultScene.x = SCENE_TRANSFORMS.result.x
    resultScene.y = SCENE_TRANSFORMS.result.y
    sceneManager.world.addChild(resultScene)

    setActiveScene('result')
    void sceneManager.navigateTo('result', 800)
  }
}

void bootstrap()
