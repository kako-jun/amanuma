import { Application } from 'pixi.js'
import { GameScene } from './scenes/GameScene'
import { createInitialGameState } from './types/GameState'
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
  scene.initWithState(createInitialGameState())
}

void bootstrap()
