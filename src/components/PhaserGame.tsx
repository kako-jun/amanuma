import { useEffect, useRef, useCallback } from 'react'
import Phaser from 'phaser'
import { gameConfig } from '../game/config'
import { MainScene } from '../game/MainScene'
import { TitleScene } from '../game/TitleScene'
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

  const getActiveScene = useCallback(() => {
    if (!gameRef.current) return { title: null, main: null }
    const titleScene = gameRef.current.scene.getScene('TitleScene')
    const mainScene = gameRef.current.scene.getScene('MainScene')
    return {
      title:
        titleScene && titleScene.scene.isActive()
          ? (titleScene as TitleScene)
          : null,
      main:
        mainScene && mainScene.scene.isActive()
          ? (mainScene as MainScene)
          : null,
    }
  }, [])

  const handleLeft = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      const { title, main } = getActiveScene()
      if (title) {
        title.selectUp() // タイトル: 上のモード選択
      } else if (main) {
        main.touchLeft()
      }
    },
    [getActiveScene]
  )

  const handleRight = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      const { title, main } = getActiveScene()
      if (title) {
        title.selectDown() // タイトル: 下のモード選択
      } else if (main) {
        main.touchRight()
      }
    },
    [getActiveScene]
  )

  const handleDown = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      const { title, main } = getActiveScene()
      if (title) {
        title.confirmSelection() // タイトル: 決定
      } else if (main) {
        main.touchDown()
      }
    },
    [getActiveScene]
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
