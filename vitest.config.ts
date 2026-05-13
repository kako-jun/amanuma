/**
 * Vitest 設定 (Issue #18 / #20)。
 *
 * - 既定は Node 環境で純粋関数 (`src/game/board.ts` 等) を検証する。
 * - `src/input/*.test.ts` のみ `jsdom` 環境で実行する。
 *   KeyboardEvent / PointerEvent を発火させて入力マネージャを検証するため。
 * - PixiJS が絡む `src/scenes/` のテストは将来 jsdom 環境で別 include する想定。
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    environmentMatchGlobs: [
      ['src/input/**/*.test.ts', 'jsdom'],
      ['src/**/*.test.ts', 'node'],
    ],
  },
})
