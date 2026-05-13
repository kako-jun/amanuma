import { Application } from 'pixi.js'
import { GameScene } from './scenes/GameScene'
import { createInitialGameState } from './types/GameState'
import { PuzzleRotation, buildGameStateFromPuzzle } from './data/loadPuzzle'
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
  scene.initWithState(state)
}

void bootstrap()
