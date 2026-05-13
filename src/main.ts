import { Application } from 'pixi.js'
import './index.css'

async function bootstrap(): Promise<void> {
  const container =
    document.getElementById('app') ?? document.getElementById('root')

  if (!container) {
    throw new Error('Mount element (#app or #root) not found in index.html')
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
}

void bootstrap()
