import Phaser from 'phaser'
import { MainScene } from './MainScene'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 400,
  height: 600,
  parent: 'phaser-game',
  backgroundColor: '#1a1a2e',
  scene: [MainScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
}
