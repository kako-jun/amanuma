import { useEffect, useRef, useCallback } from 'react'
import Phaser from 'phaser'
import { gameConfig } from '../game/config'
import { MainScene } from '../game/MainScene'
import { TitleScene } from '../game/TitleScene'
import { VersusScene } from '../game/VersusScene'
import './PhaserGame.css'

const PhaserGame = () => {
  const gameRef = useRef<Phaser.Game | null>(null)
  const dropIntervalRef = useRef<number | null>(null)
  const p1DropIntervalRef = useRef<number | null>(null)
  const p2DropIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(gameConfig)
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
      if (dropIntervalRef.current) {
        clearInterval(dropIntervalRef.current)
      }
      if (p1DropIntervalRef.current) {
        clearInterval(p1DropIntervalRef.current)
      }
      if (p2DropIntervalRef.current) {
        clearInterval(p2DropIntervalRef.current)
      }
    }
  }, [])

  const getActiveScene = useCallback(() => {
    if (!gameRef.current) return { title: null, main: null, versus: null }
    const titleScene = gameRef.current.scene.getScene('TitleScene')
    const mainScene = gameRef.current.scene.getScene('MainScene')
    const versusScene = gameRef.current.scene.getScene('VersusScene')
    return {
      title:
        titleScene && titleScene.scene.isActive()
          ? (titleScene as TitleScene)
          : null,
      main:
        mainScene && mainScene.scene.isActive()
          ? (mainScene as MainScene)
          : null,
      versus:
        versusScene && versusScene.scene.isActive()
          ? (versusScene as VersusScene)
          : null,
    }
  }, [])

  const handleLeft = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      // タッチイベントの後にclickも発火するのを防ぐ
      if (e.type === 'click' && 'ontouchstart' in window) return
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
      // タッチイベントの後にclickも発火するのを防ぐ
      if (e.type === 'click' && 'ontouchstart' in window) return
      const { title, main } = getActiveScene()
      if (title) {
        title.selectDown() // タイトル: 下のモード選択
      } else if (main) {
        main.touchRight()
      }
    },
    [getActiveScene]
  )

  const handleDownStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      // タッチイベントの後にclickも発火するのを防ぐ
      if (e.type === 'click' && 'ontouchstart' in window) return
      const { title, main } = getActiveScene()
      if (title) {
        title.confirmSelection() // タイトル: 決定
      } else if (main) {
        // 最初の1回を即座に実行
        main.touchDown()
        // 長押しで連続落下（50msごと）
        if (dropIntervalRef.current) {
          clearInterval(dropIntervalRef.current)
        }
        dropIntervalRef.current = window.setInterval(() => {
          const { main: currentMain } = getActiveScene()
          if (currentMain) {
            currentMain.touchDown()
          }
        }, 50)
      }
    },
    [getActiveScene]
  )

  const handleDownEnd = useCallback(() => {
    if (dropIntervalRef.current) {
      clearInterval(dropIntervalRef.current)
      dropIntervalRef.current = null
    }
  }, [])

  // 対戦モード用ハンドラ（Player 1）
  const handleP1Left = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'click' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) versus.p1TouchLeft()
    },
    [getActiveScene]
  )

  const handleP1Right = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'click' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) versus.p1TouchRight()
    },
    [getActiveScene]
  )

  const handleP1DownStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'click' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) {
        versus.p1TouchDown()
        if (p1DropIntervalRef.current) {
          clearInterval(p1DropIntervalRef.current)
        }
        p1DropIntervalRef.current = window.setInterval(() => {
          const { versus: v } = getActiveScene()
          if (v) v.p1TouchDown()
        }, 50)
      }
    },
    [getActiveScene]
  )

  const handleP1DownEnd = useCallback(() => {
    if (p1DropIntervalRef.current) {
      clearInterval(p1DropIntervalRef.current)
      p1DropIntervalRef.current = null
    }
  }, [])

  // 対戦モード用ハンドラ（Player 2）
  const handleP2Left = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'click' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) versus.p2TouchLeft()
    },
    [getActiveScene]
  )

  const handleP2Right = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'click' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) versus.p2TouchRight()
    },
    [getActiveScene]
  )

  const handleP2DownStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'click' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) {
        versus.p2TouchDown()
        if (p2DropIntervalRef.current) {
          clearInterval(p2DropIntervalRef.current)
        }
        p2DropIntervalRef.current = window.setInterval(() => {
          const { versus: v } = getActiveScene()
          if (v) v.p2TouchDown()
        }, 50)
      }
    },
    [getActiveScene]
  )

  const handleP2DownEnd = useCallback(() => {
    if (p2DropIntervalRef.current) {
      clearInterval(p2DropIntervalRef.current)
      p2DropIntervalRef.current = null
    }
  }, [])

  return (
    <div className="phaser-game-container">
      {/* 対戦モード: P1コントロール（左側） */}
      <div className="versus-controls p1-controls">
        <div className="player-label">P1</div>
        <div className="touch-row">
          <button className="touch-btn" onTouchStart={handleP1Left} onClick={handleP1Left}>←</button>
          <button
            className="touch-btn drop"
            onTouchStart={handleP1DownStart}
            onTouchEnd={handleP1DownEnd}
            onMouseDown={handleP1DownStart}
            onMouseUp={handleP1DownEnd}
            onMouseLeave={handleP1DownEnd}
          >↓</button>
          <button className="touch-btn" onTouchStart={handleP1Right} onClick={handleP1Right}>→</button>
        </div>
      </div>

      <div id="phaser-game" />

      {/* 対戦モード: P2コントロール（右側） */}
      <div className="versus-controls p2-controls">
        <div className="player-label">P2</div>
        <div className="touch-row">
          <button className="touch-btn" onTouchStart={handleP2Left} onClick={handleP2Left}>←</button>
          <button
            className="touch-btn drop"
            onTouchStart={handleP2DownStart}
            onTouchEnd={handleP2DownEnd}
            onMouseDown={handleP2DownStart}
            onMouseUp={handleP2DownEnd}
            onMouseLeave={handleP2DownEnd}
          >↓</button>
          <button className="touch-btn" onTouchStart={handleP2Right} onClick={handleP2Right}>→</button>
        </div>
      </div>

      {/* シングルモード: 中央コントロール */}
      <div className="touch-controls single-controls">
        <div className="touch-row">
          <button className="touch-btn" onTouchStart={handleLeft} onClick={handleLeft}>←</button>
          <button
            className="touch-btn drop"
            onTouchStart={handleDownStart}
            onTouchEnd={handleDownEnd}
            onMouseDown={handleDownStart}
            onMouseUp={handleDownEnd}
            onMouseLeave={handleDownEnd}
          >↓</button>
          <button className="touch-btn" onTouchStart={handleRight} onClick={handleRight}>→</button>
        </div>
      </div>
    </div>
  )
}

export default PhaserGame
