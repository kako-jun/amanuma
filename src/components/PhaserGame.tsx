import { useEffect, useRef, useCallback } from 'react'
import Phaser from 'phaser'
import { gameConfig } from '../game/config'
import './PhaserGame.css'

const PhaserGame = () => {
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(gameConfig)
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [])

  const emitKey = useCallback((keyCode: number) => {
    if (!gameRef.current) return
    const scene = gameRef.current.scene.getScenes(true)[0]
    if (scene && scene.input.keyboard) {
      scene.input.keyboard.emit('keydown', { keyCode })
      setTimeout(() => {
        scene.input.keyboard?.emit('keyup', { keyCode })
      }, 100)
    }
  }, [])

  const handleLeft = useCallback(() => emitKey(37), [emitKey])
  const handleRight = useCallback(() => emitKey(39), [emitKey])
  const handleDown = useCallback(() => emitKey(40), [emitKey])

  return (
    <div className="phaser-game-container">
      <div id="phaser-game" />
      <div className="touch-controls">
        <div className="touch-row">
          <button
            className="touch-btn"
            onTouchStart={handleLeft}
            onMouseDown={handleLeft}
          >
            ←
          </button>
          <button
            className="touch-btn drop"
            onTouchStart={handleDown}
            onMouseDown={handleDown}
          >
            ↓
          </button>
          <button
            className="touch-btn"
            onTouchStart={handleRight}
            onMouseDown={handleRight}
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}

export default PhaserGame
