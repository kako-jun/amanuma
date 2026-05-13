/**
 * Vitest 設定 (Issue #18)。
 *
 * - Node 環境で純粋関数 (`src/game/board.ts` 等) を検証する。
 * - PixiJS が絡む `src/scenes/` のテストは将来 jsdom 環境で別 include する想定。
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
