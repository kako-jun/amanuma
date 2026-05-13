/**
 * 盤面ロジック (Issue #18)。
 *
 * - 着地計算 (`findLandingRow`)
 * - 落下ブロックの固定 (`lockFallingBlock`)
 * - 消去判定 (`findClearablePositions`)
 * - 消去実行 (`clearCells`)
 * - 重力適用 (`applyGravity`)
 *
 * 純粋関数を基本とするが、`GameState` を mutate する関数 (lock / clear / gravity) と
 * mutate しない判定関数 (findLandingRow / findClearablePositions) は JSDoc で
 * 明示する。後者のみテスト時に「同じ盤面で何度呼んでも結果が変わらない」前提を
 * 利用できる。
 */
import type { BlockValue, GameState } from '../types/GameState'

/**
 * fallingBlock が着地すべき整数 row を返す。着地しないなら null。
 *
 * - mutate しない。
 * - 落下ブロックの真下 (`fallingBlock.col` 列) を上から走査して、最初に存在する
 *   ブロックの 1 つ上 (= 着地 row) を返す。
 * - 列内にブロックが無ければ最下段 (`rows - 1`) を返す。
 * - 着地 row が `fallingBlock.row` より小さい (= もう通り過ぎてる) なら null。
 *   ただし水中物理で振動して row が小さくなる可能性があるので、
 *   「現在の row 以上」を着地条件とする。
 */
export function findLandingRow(state: GameState): number | null {
  const falling = state.fallingBlock
  if (falling === null) return null
  const { col } = falling
  if (col < 0 || col >= state.cols) return null

  // 列内の最上段にあるブロックの row を探す。
  let firstBlockRow = state.rows // = 何もない場合の番兵
  for (let r = 0; r < state.rows; r++) {
    if (state.board[r][col] !== null) {
      firstBlockRow = r
      break
    }
  }

  const landing = firstBlockRow - 1
  if (landing < 0) {
    // 列が満杯。実質的に着地不能だが、最上段 (0) を返して呼び出し側に
    // 処理を委ねる (gameover 判定は本 Issue 外なので state.status は触らない)。
    return 0
  }
  return landing
}

/**
 * fallingBlock を board に固定し、`state.fallingBlock` を null にする。
 *
 * - mutate する。
 * - row は `Math.round` で整数化してから固定する。
 * - 固定先が範囲外の場合は warning なしで no-op (= fallingBlock は残る)。
 *   呼び出し側で `findLandingRow` の戻り値を使って row を確定してから呼ぶことを推奨。
 */
export function lockFallingBlock(state: GameState): void {
  const falling = state.fallingBlock
  if (falling === null) return
  const row = Math.round(falling.row)
  const { col, value } = falling
  if (row < 0 || row >= state.rows) return
  if (col < 0 || col >= state.cols) return
  state.board[row][col] = value
  state.fallingBlock = null
}

/**
 * 消去対象の座標を集合で返す (`row * cols + col` で 1 次元化)。
 *
 * - mutate しない。
 * - 縦・横の連続区間それぞれについて、全部分列 (start..end) の合計を計算し、
 *   合計が 7 なら部分列内の全セル位置を結果に追加する。
 * - 7 ブロックの特別ルール: 連続区間内で「値が 7」が連続している部分を抽出し、
 *   長さ 3 以上のときだけその位置を追加する。7+7 では消えず、7+7+7 で消える。
 * - 7 を含む合計 = 7 の部分列 (= 単独の 7 一個) は通常ルールではマッチしないので
 *   重複懸念はない。
 *
 * 計算量: 列ごと・行ごとに O(n^2) で部分列を試すが、5x10 程度なら十分軽量。
 */
export function findClearablePositions(state: GameState): Set<number> {
  const result = new Set<number>()
  const { rows, cols, board } = state

  // 縦方向: 各列を上から走査。
  for (let c = 0; c < cols; c++) {
    let segment: { key: number; value: BlockValue }[] = []
    for (let r = 0; r <= rows; r++) {
      const cell = r < rows ? board[r][c] : null
      if (cell !== null) {
        segment.push({ key: r * cols + c, value: cell })
      }
      // 区切り (null or 末尾) で segment を flush。
      if ((cell === null || r === rows) && segment.length > 0) {
        processSegment(segment, result)
        segment = []
      }
    }
  }

  // 横方向: 各行を左から走査。
  for (let r = 0; r < rows; r++) {
    let segment: { key: number; value: BlockValue }[] = []
    for (let c = 0; c <= cols; c++) {
      const cell = c < cols ? board[r][c] : null
      if (cell !== null) {
        segment.push({ key: r * cols + c, value: cell })
      }
      if ((cell === null || c === cols) && segment.length > 0) {
        processSegment(segment, result)
        segment = []
      }
    }
  }

  return result
}

/**
 * 連続区間 (隣接した非 null セルの並び) に対して消去判定を適用する。
 *
 * - 全部分列 (start..end inclusive) の合計をチェック
 *   - 合計 = 7 で、かつ 7 単独 (長さ 1 で値 7) は対象外
 *   - 合計 = 7 を満たす部分列内のすべての位置を `out` に追加
 * - 7 の連続: 区間内で値 7 が 3 個以上連続したらその位置を `out` に追加
 *
 * `entries` は `{ key, value }[]` で、key は座標を 1 次元化したもの。
 */
function processSegment(
  entries: { key: number; value: BlockValue }[],
  out: Set<number>
): void {
  const n = entries.length
  if (n === 0) return

  // 通常ルール: 合計 7 の部分列を全列挙。
  // 7 単独セル (合計 = 7 だが長さ 1) は特別ルールで扱うのでここでは除外。
  for (let start = 0; start < n; start++) {
    let sum = 0
    for (let end = start; end < n; end++) {
      sum += entries[end].value
      if (sum > 7) break // 全部正の整数なので sum > 7 で打ち切り。
      if (sum === 7) {
        const length = end - start + 1
        // 長さ 1 で値 7 の場合は特別ルール側に処理を任せる。
        if (length === 1 && entries[start].value === 7) {
          continue
        }
        for (let i = start; i <= end; i++) {
          out.add(entries[i].key)
        }
      }
    }
  }

  // 特別ルール: 値 7 が 3 個以上連続している区間。
  let runStart = -1
  for (let i = 0; i <= n; i++) {
    const isSeven = i < n && entries[i].value === 7
    if (isSeven && runStart === -1) {
      runStart = i
    } else if (!isSeven && runStart !== -1) {
      const length = i - runStart
      if (length >= 3) {
        for (let j = runStart; j < i; j++) {
          out.add(entries[j].key)
        }
      }
      runStart = -1
    }
  }
}

/**
 * 与えられた座標集合のセルを null にする。
 *
 * - mutate する。
 * - 戻り値は実際に消した個数 (= 元々 null でないセルの個数)。
 */
export function clearCells(state: GameState, positions: Set<number>): number {
  let cleared = 0
  const { cols, rows, board } = state
  for (const key of positions) {
    const row = Math.floor(key / cols)
    const col = key % cols
    if (row < 0 || row >= rows || col < 0 || col >= cols) continue
    if (board[row][col] !== null) {
      board[row][col] = null
      cleared++
    }
  }
  return cleared
}

/**
 * 重力適用。各列で null セルを下に詰める (= 上のブロックが落ちる)。
 *
 * - mutate する。
 * - 戻り値: 1 つでもセルが動いたかどうか。
 *
 * アルゴリズム: 各列を下から走査し、null でないセルを書込み先 (`writeRow`) に
 * 詰め直す。残りは null で埋める。
 */
export function applyGravity(state: GameState): boolean {
  const { rows, cols, board } = state
  let moved = false

  for (let c = 0; c < cols; c++) {
    let writeRow = rows - 1
    for (let r = rows - 1; r >= 0; r--) {
      const cell = board[r][c]
      if (cell !== null) {
        if (writeRow !== r) {
          board[writeRow][c] = cell
          board[r][c] = null
          moved = true
        }
        writeRow--
      }
    }
    // writeRow より上は null で埋める (既に null のはずだが念のため)。
    for (let r = writeRow; r >= 0; r--) {
      if (board[r][c] !== null) {
        board[r][c] = null
        moved = true
      }
    }
  }

  return moved
}

/**
 * 盤面に残っている 7 ブロックの個数を返す。
 *
 * - mutate しない。
 * - クリア判定 (= 残 7 が 0) で使う。
 */
export function countSevens(state: GameState): number {
  const { rows, cols, board } = state
  let n = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] === 7) n++
    }
  }
  return n
}
