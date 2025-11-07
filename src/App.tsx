import { useState } from 'react'
import PhaserGame from './components/PhaserGame'
import './App.css'

function App() {
  const [gameStarted, setGameStarted] = useState(false)

  return (
    <div className="App">
      <header className="App-header">
        <h1>落ち物パズル - React + Vite + TypeScript</h1>
      </header>

      <main>
        {!gameStarted ? (
          <div className="start-screen">
            <p>シンプルな落ち物パズルゲームです</p>
            <p>左右矢印キーで移動、上キーで回転、下キーで落下</p>
            <button onClick={() => setGameStarted(true)}>ゲームスタート</button>
          </div>
        ) : (
          <PhaserGame />
        )}
      </main>
    </div>
  )
}

export default App
