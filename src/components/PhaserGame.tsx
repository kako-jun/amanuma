import { useEffect, useRef, useCallback, useState } from 'react'
import Phaser from 'phaser'
import { gameConfig } from '../game/config'
import { MainScene } from '../game/MainScene'
import { TitleScene } from '../game/TitleScene'
import { VersusScene } from '../game/VersusScene'
import './PhaserGame.css'

const MOVE_REPEAT_INTERVAL = 100 // 左右移動の繰り返し間隔（ms）
const DROP_REPEAT_INTERVAL = 50  // 落下の繰り返し間隔（ms）

const PhaserGame = () => {
  const gameRef = useRef<Phaser.Game | null>(null)
  // シングルモード用
  const leftIntervalRef = useRef<number | null>(null)
  const rightIntervalRef = useRef<number | null>(null)
  const dropIntervalRef = useRef<number | null>(null)
  // 対戦モード用
  const p1LeftIntervalRef = useRef<number | null>(null)
  const p1RightIntervalRef = useRef<number | null>(null)
  const p1DropIntervalRef = useRef<number | null>(null)
  const p2LeftIntervalRef = useRef<number | null>(null)
  const p2RightIntervalRef = useRef<number | null>(null)
  const p2DropIntervalRef = useRef<number | null>(null)
  // 現在のシーン状態
  const [isVersusMode, setIsVersusMode] = useState(false)

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(gameConfig)
    }

    // シーン状態を定期的にチェック
    const checkScene = setInterval(() => {
      if (gameRef.current) {
        const versusScene = gameRef.current.scene.getScene('VersusScene')
        setIsVersusMode(versusScene?.scene.isActive() ?? false)
      }
    }, 200)

    return () => {
      clearInterval(checkScene)
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
      // クリーンアップ
      ;[leftIntervalRef, rightIntervalRef, dropIntervalRef,
        p1LeftIntervalRef, p1RightIntervalRef, p1DropIntervalRef,
        p2LeftIntervalRef, p2RightIntervalRef, p2DropIntervalRef
      ].forEach(ref => {
        if (ref.current) clearInterval(ref.current)
      })
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

  // シングルモード: 左ボタン
  const handleLeftStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'mousedown' && 'ontouchstart' in window) return
      const { title, main } = getActiveScene()
      if (title) {
        title.selectUp()
      } else if (main) {
        main.touchLeft()
        if (leftIntervalRef.current) clearInterval(leftIntervalRef.current)
        leftIntervalRef.current = window.setInterval(() => {
          const { main: m } = getActiveScene()
          if (m) m.touchLeft()
        }, MOVE_REPEAT_INTERVAL)
      }
    },
    [getActiveScene]
  )

  const handleLeftEnd = useCallback(() => {
    if (leftIntervalRef.current) {
      clearInterval(leftIntervalRef.current)
      leftIntervalRef.current = null
    }
  }, [])

  // シングルモード: 右ボタン
  const handleRightStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'mousedown' && 'ontouchstart' in window) return
      const { title, main } = getActiveScene()
      if (title) {
        title.selectDown()
      } else if (main) {
        main.touchRight()
        if (rightIntervalRef.current) clearInterval(rightIntervalRef.current)
        rightIntervalRef.current = window.setInterval(() => {
          const { main: m } = getActiveScene()
          if (m) m.touchRight()
        }, MOVE_REPEAT_INTERVAL)
      }
    },
    [getActiveScene]
  )

  const handleRightEnd = useCallback(() => {
    if (rightIntervalRef.current) {
      clearInterval(rightIntervalRef.current)
      rightIntervalRef.current = null
    }
  }, [])

  // シングルモード: 下ボタン
  const handleDownStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'mousedown' && 'ontouchstart' in window) return
      const { title, main } = getActiveScene()
      if (title) {
        title.confirmSelection()
      } else if (main) {
        main.touchDown()
        if (dropIntervalRef.current) clearInterval(dropIntervalRef.current)
        dropIntervalRef.current = window.setInterval(() => {
          const { main: m } = getActiveScene()
          if (m) m.touchDown()
        }, DROP_REPEAT_INTERVAL)
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

  // 対戦モード: P1左ボタン
  const handleP1LeftStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'mousedown' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) {
        versus.p1TouchLeft()
        if (p1LeftIntervalRef.current) clearInterval(p1LeftIntervalRef.current)
        p1LeftIntervalRef.current = window.setInterval(() => {
          const { versus: v } = getActiveScene()
          if (v) v.p1TouchLeft()
        }, MOVE_REPEAT_INTERVAL)
      }
    },
    [getActiveScene]
  )

  const handleP1LeftEnd = useCallback(() => {
    if (p1LeftIntervalRef.current) {
      clearInterval(p1LeftIntervalRef.current)
      p1LeftIntervalRef.current = null
    }
  }, [])

  // 対戦モード: P1右ボタン
  const handleP1RightStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'mousedown' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) {
        versus.p1TouchRight()
        if (p1RightIntervalRef.current) clearInterval(p1RightIntervalRef.current)
        p1RightIntervalRef.current = window.setInterval(() => {
          const { versus: v } = getActiveScene()
          if (v) v.p1TouchRight()
        }, MOVE_REPEAT_INTERVAL)
      }
    },
    [getActiveScene]
  )

  const handleP1RightEnd = useCallback(() => {
    if (p1RightIntervalRef.current) {
      clearInterval(p1RightIntervalRef.current)
      p1RightIntervalRef.current = null
    }
  }, [])

  // 対戦モード: P1下ボタン
  const handleP1DownStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'mousedown' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) {
        versus.p1TouchDown()
        if (p1DropIntervalRef.current) clearInterval(p1DropIntervalRef.current)
        p1DropIntervalRef.current = window.setInterval(() => {
          const { versus: v } = getActiveScene()
          if (v) v.p1TouchDown()
        }, DROP_REPEAT_INTERVAL)
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

  // 対戦モード: P2左ボタン
  const handleP2LeftStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'mousedown' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) {
        versus.p2TouchLeft()
        if (p2LeftIntervalRef.current) clearInterval(p2LeftIntervalRef.current)
        p2LeftIntervalRef.current = window.setInterval(() => {
          const { versus: v } = getActiveScene()
          if (v) v.p2TouchLeft()
        }, MOVE_REPEAT_INTERVAL)
      }
    },
    [getActiveScene]
  )

  const handleP2LeftEnd = useCallback(() => {
    if (p2LeftIntervalRef.current) {
      clearInterval(p2LeftIntervalRef.current)
      p2LeftIntervalRef.current = null
    }
  }, [])

  // 対戦モード: P2右ボタン
  const handleP2RightStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'mousedown' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) {
        versus.p2TouchRight()
        if (p2RightIntervalRef.current) clearInterval(p2RightIntervalRef.current)
        p2RightIntervalRef.current = window.setInterval(() => {
          const { versus: v } = getActiveScene()
          if (v) v.p2TouchRight()
        }, MOVE_REPEAT_INTERVAL)
      }
    },
    [getActiveScene]
  )

  const handleP2RightEnd = useCallback(() => {
    if (p2RightIntervalRef.current) {
      clearInterval(p2RightIntervalRef.current)
      p2RightIntervalRef.current = null
    }
  }, [])

  // 対戦モード: P2下ボタン
  const handleP2DownStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      if (e.type === 'mousedown' && 'ontouchstart' in window) return
      const { versus } = getActiveScene()
      if (versus) {
        versus.p2TouchDown()
        if (p2DropIntervalRef.current) clearInterval(p2DropIntervalRef.current)
        p2DropIntervalRef.current = window.setInterval(() => {
          const { versus: v } = getActiveScene()
          if (v) v.p2TouchDown()
        }, DROP_REPEAT_INTERVAL)
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
    <div className={`phaser-game-container ${isVersusMode ? 'versus-active' : ''}`}>
      {/* 対戦モード: P1コントロール（左側・横画面用） */}
      <div className="versus-controls p1-controls">
        <div className="player-label">P1</div>
        <div className="touch-row">
          <button
            className="touch-btn"
            onTouchStart={handleP1LeftStart}
            onTouchEnd={handleP1LeftEnd}
            onMouseDown={handleP1LeftStart}
            onMouseUp={handleP1LeftEnd}
            onMouseLeave={handleP1LeftEnd}
          >←</button>
          <button
            className="touch-btn drop"
            onTouchStart={handleP1DownStart}
            onTouchEnd={handleP1DownEnd}
            onMouseDown={handleP1DownStart}
            onMouseUp={handleP1DownEnd}
            onMouseLeave={handleP1DownEnd}
          >↓</button>
          <button
            className="touch-btn"
            onTouchStart={handleP1RightStart}
            onTouchEnd={handleP1RightEnd}
            onMouseDown={handleP1RightStart}
            onMouseUp={handleP1RightEnd}
            onMouseLeave={handleP1RightEnd}
          >→</button>
        </div>
      </div>

      <div id="phaser-game" />

      {/* 対戦モード: P2コントロール（右側） */}
      <div className="versus-controls p2-controls">
        <div className="player-label">P2</div>
        <div className="touch-row">
          <button
            className="touch-btn"
            onTouchStart={handleP2LeftStart}
            onTouchEnd={handleP2LeftEnd}
            onMouseDown={handleP2LeftStart}
            onMouseUp={handleP2LeftEnd}
            onMouseLeave={handleP2LeftEnd}
          >←</button>
          <button
            className="touch-btn drop"
            onTouchStart={handleP2DownStart}
            onTouchEnd={handleP2DownEnd}
            onMouseDown={handleP2DownStart}
            onMouseUp={handleP2DownEnd}
            onMouseLeave={handleP2DownEnd}
          >↓</button>
          <button
            className="touch-btn"
            onTouchStart={handleP2RightStart}
            onTouchEnd={handleP2RightEnd}
            onMouseDown={handleP2RightStart}
            onMouseUp={handleP2RightEnd}
            onMouseLeave={handleP2RightEnd}
          >→</button>
        </div>
      </div>

      {/* シングルモード: 中央コントロール */}
      <div className="touch-controls single-controls">
        <div className="touch-row">
          <button
            className="touch-btn"
            onTouchStart={handleLeftStart}
            onTouchEnd={handleLeftEnd}
            onMouseDown={handleLeftStart}
            onMouseUp={handleLeftEnd}
            onMouseLeave={handleLeftEnd}
          >←</button>
          <button
            className="touch-btn drop"
            onTouchStart={handleDownStart}
            onTouchEnd={handleDownEnd}
            onMouseDown={handleDownStart}
            onMouseUp={handleDownEnd}
            onMouseLeave={handleDownEnd}
          >↓</button>
          <button
            className="touch-btn"
            onTouchStart={handleRightStart}
            onTouchEnd={handleRightEnd}
            onMouseDown={handleRightStart}
            onMouseUp={handleRightEnd}
            onMouseLeave={handleRightEnd}
          >→</button>
        </div>
      </div>

      {/* 縦画面対戦モード: 下部に両プレイヤーのボタン */}
      <div className="versus-portrait-controls">
        <div className="versus-controls p1-portrait">
          <div className="player-label">P1</div>
          <div className="touch-row">
            <button
              className="touch-btn"
              onTouchStart={handleP1LeftStart}
              onTouchEnd={handleP1LeftEnd}
              onMouseDown={handleP1LeftStart}
              onMouseUp={handleP1LeftEnd}
              onMouseLeave={handleP1LeftEnd}
            >←</button>
            <button
              className="touch-btn drop"
              onTouchStart={handleP1DownStart}
              onTouchEnd={handleP1DownEnd}
              onMouseDown={handleP1DownStart}
              onMouseUp={handleP1DownEnd}
              onMouseLeave={handleP1DownEnd}
            >↓</button>
            <button
              className="touch-btn"
              onTouchStart={handleP1RightStart}
              onTouchEnd={handleP1RightEnd}
              onMouseDown={handleP1RightStart}
              onMouseUp={handleP1RightEnd}
              onMouseLeave={handleP1RightEnd}
            >→</button>
          </div>
        </div>
        <div className="versus-controls p2-portrait">
          <div className="player-label">P2</div>
          <div className="touch-row">
            <button
              className="touch-btn"
              onTouchStart={handleP2LeftStart}
              onTouchEnd={handleP2LeftEnd}
              onMouseDown={handleP2LeftStart}
              onMouseUp={handleP2LeftEnd}
              onMouseLeave={handleP2LeftEnd}
            >←</button>
            <button
              className="touch-btn drop"
              onTouchStart={handleP2DownStart}
              onTouchEnd={handleP2DownEnd}
              onMouseDown={handleP2DownStart}
              onMouseUp={handleP2DownEnd}
              onMouseLeave={handleP2DownEnd}
            >↓</button>
            <button
              className="touch-btn"
              onTouchStart={handleP2RightStart}
              onTouchEnd={handleP2RightEnd}
              onMouseDown={handleP2RightStart}
              onMouseUp={handleP2RightEnd}
              onMouseLeave={handleP2RightEnd}
            >→</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhaserGame
