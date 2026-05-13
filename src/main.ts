import { Application } from 'pixi.js'
import { GameScene } from './scenes/GameScene'
import { createInitialGameState } from './types/GameState'
import { PuzzleRotation, buildGameStateFromPuzzle } from './data/loadPuzzle'
import { generateBlockValue } from './game/randomBlocks'
import './index.css'

async function bootstrap(): Promise<void> {
  const container = document.getElementById('root')

  if (!container) {
    throw new Error('Mount element #root not found in index.html')
  }

  const app = new Application()

  await app.init({
    width: 800,
    height: 650,
    background: 0x0f0f1a,
    antialias: true,
    resolution: window.devicePixelRatio,
    autoDensity: true,
  })

  container.appendChild(app.canvas)

  const scene = new GameScene(app)

  // お題ローテーションから先頭のお題を読み込み、GameState を構築して初期化する。
  // 不正な puzzles.json でアプリ全体が落ちないよう、失敗時は空盤面にフォールバック。
  const rotation = new PuzzleRotation()
  const result = buildGameStateFromPuzzle(rotation.current())
  let state
  if (result.ok) {
    state = result.state
  } else {
    console.error('[amanuma] failed to load puzzle:', result.error)
    state = createInitialGameState()
  }

  // Issue #20: R キーで現在のお題から再構築できるようにする。
  scene.setRestartSource({
    build: () => {
      const r = buildGameStateFromPuzzle(rotation.current())
      if (!r.ok) {
        console.error('[amanuma] restart failed:', r.error)
        return null
      }
      return r.state
    },
  })

  // Issue #18: Next ベースのスポーン。
  // - お題側で `fallingBlock` が設定されていればそれを尊重する (再現テスト用)。
  // - 未設定なら state.nextBlock を最初の落下ブロックとし、Next 枠は新たに
  //   `generateBlockValue()` で補充する。
  if (state.fallingBlock === null) {
    state.fallingBlock = {
      value: state.nextBlock,
      col: Math.floor(state.cols / 2),
      row: 0,
      velocity: 0,
    }
    state.nextBlock = generateBlockValue()
  }
  scene.initWithState(state)
}

void bootstrap()
