import { useEffect, useRef } from 'react'
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

  return (
    <div className="phaser-game-container">
      <div id="phaser-game" />
    </div>
  )
}

export default PhaserGame
