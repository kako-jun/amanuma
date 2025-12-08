import { useEffect, useRef, useCallback } from 'react'
import Phaser from 'phaser'
import { gameConfig } from '../game/config'
import { MainScene } from '../game/MainScene'
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

  const getMainScene = useCallback((): MainScene | null => {
    if (!gameRef.current) return null
    const scene = gameRef.current.scene.getScene('MainScene')
    if (scene && scene.scene.isActive()) {
      return scene as MainScene
    }
    return null
  }, [])

  const handleLeft = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      const scene = getMainScene()
      scene?.touchLeft()
    },
    [getMainScene]
  )

  const handleRight = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      const scene = getMainScene()
      scene?.touchRight()
    },
    [getMainScene]
  )

  const handleDown = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      const scene = getMainScene()
      scene?.touchDown()
    },
    [getMainScene]
  )

  return (
    <div className="phaser-game-container">
      <div id="phaser-game" />
      <div className="touch-controls">
        <div className="touch-row">
          <button
            className="touch-btn"
            onTouchStart={handleLeft}
            onClick={handleLeft}
          >
            ←
          </button>
          <button
            className="touch-btn drop"
            onTouchStart={handleDown}
            onClick={handleDown}
          >
            ↓
          </button>
          <button
            className="touch-btn"
            onTouchStart={handleRight}
            onClick={handleRight}
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}

export default PhaserGame
