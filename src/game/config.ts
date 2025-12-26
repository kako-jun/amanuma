import Phaser from 'phaser'
import { TitleScene } from './TitleScene'
import { MainScene } from './MainScene'
import { VersusScene } from './VersusScene'
import { GAME_WIDTH, GAME_HEIGHT } from './constants'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'phaser-game',
  backgroundColor: '#0f0f1a',
  scene: [TitleScene, MainScene, VersusScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
}
