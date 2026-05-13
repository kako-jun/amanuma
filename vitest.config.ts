/**
 * Vitest 設定 (Issue #18 / #20 / #17)。
 *
 * - 既定は Node 環境で純粋関数 (`src/game/board.ts` 等) を検証する。
 * - `src/input/*.test.ts` は `jsdom` 環境で実行する。
 *   KeyboardEvent / PointerEvent を発火させて入力マネージャを検証するため。
 * - `src/scenes/effects/*.test.ts` も `jsdom` 環境で実行する (Issue #17)。
 *   PIXI.Container を継承するため、`window` を参照する初期化処理がある。
 *   Graphics の WebGL/Canvas 描画自体は jsdom で動かないため、
 *   テスト対象はライフサイクル管理 (emit / 寿命) に限定する。
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    environmentMatchGlobs: [
      ['src/input/**/*.test.ts', 'jsdom'],
      ['src/scenes/**/*.test.ts', 'jsdom'],
      ['src/audio/**/*.test.ts', 'jsdom'],
      ['src/**/*.test.ts', 'node'],
    ],
  },
})
