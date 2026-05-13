import type { GameState } from '../types/GameState'

/**
 * 水中物理パラメータ。row/s 単位で扱う (1 行 = `cellSize` ピクセルだが、
 * ピクセル換算は描画側 (`BoardRenderer`) の責任で、物理計算はピクセル解像度に
 * 依存しない)。
 *
 * モデルは 1 次元 (縦方向のみ) の自由落下 + 浮力 + 粘性抵抗:
 *   `a = WATER_GRAVITY - WATER_BUOYANCY - WATER_DRAG * velocity`
 *
 * 重力 > 浮力なのでブロックは下に沈むが、粘性抵抗のおかげで急加速せず、
 * 終端速度に近づきながら「ふわっと」落ちる挙動になる。Issue #16 のゴールは
 * この縦方向の減衰振動感を出すこと。横揺れ・着水エフェクトは Issue #17 で
 * 別途追加する。
 *
 * - WATER_GRAVITY: 下向き重力加速度 [row/s^2]。通常重力より弱め。
 * - WATER_BUOYANCY: 上向き浮力 [row/s^2]。重力の約 1/3 で、ブロックは沈む方向。
 * - WATER_DRAG: 粘性抵抗係数 [1/s]。速度に比例した減衰、大きいほどブレーキ強。
 * - MAX_VELOCITY: 終端速度の安全上限 [row/s]。
 */
export const WATER_GRAVITY = 18.0
export const WATER_BUOYANCY = 6.0
export const WATER_DRAG = 1.6
export const MAX_VELOCITY = 12.0

/** タブ非アクティブ復帰時などのスパイク対策で、1 ステップで許容する最大 deltaMS。 */
const MAX_STEP_MS = 50

/** 上端 (水面) で跳ね返るときの反発係数。`0` に近いほどぬるっと止まる。 */
const TOP_BOUNCE_COEFFICIENT = 0.5

/**
 * 1 ステップぶん `state.fallingBlock` の水中物理を進める。
 *
 * - `state.fallingBlock` が `null` なら何もしない。
 * - `deltaMS` は Pixi の `Ticker.deltaMS` (前フレームからの経過ミリ秒) を想定。
 *   タブ復帰時の巨大値で位置がジャンプしないよう、内部で {@link MAX_STEP_MS} に
 *   クランプする。`deltaMS = 0` (初回呼び出し直後など) は no-op に等価。
 * - 上端 (`row < 0`) では水面で跳ね返るような小さな反発を入れて速度を反転する
 *   (係数 0.5)。下端 (`row > rows - 1`) では `row` を最大値にクランプし、
 *   `velocity` を 0 にしてその場で停止させる。**着水後の board セル固定処理
 *   (`board[r][c] = value`) は本関数の責務外** (Issue #17 / #18 で実装予定)。
 *
 * `GameState` を mutate する点を除けば外部依存のない純粋関数なので、後続 Issue
 * でテストを導入したら単体検証が容易にできる (本 Issue では Vitest 未導入)。
 */
export function stepUnderwaterPhysics(state: GameState, deltaMS: number): void {
  const falling = state.fallingBlock
  if (falling === null) return

  // 異常系: 負値・NaN は no-op、巨大値はクランプ。
  if (!Number.isFinite(deltaMS) || deltaMS <= 0) return
  const clampedMS = Math.min(deltaMS, MAX_STEP_MS)
  const dt = clampedMS / 1000

  // semi-implicit Euler: velocity を先に更新してから row を更新する。
  // a = g - b - c * v  (符号は下向きを + として定義)
  const aNet = WATER_GRAVITY - WATER_BUOYANCY - WATER_DRAG * falling.velocity
  let nextVelocity = falling.velocity + aNet * dt

  // 終端速度の安全上限。物理パラメータ的にも MAX_VELOCITY を超えないはずだが、
  // dt スパイクや将来のパラメータ調整に備えてクランプする。
  if (nextVelocity > MAX_VELOCITY) nextVelocity = MAX_VELOCITY
  else if (nextVelocity < -MAX_VELOCITY) nextVelocity = -MAX_VELOCITY

  let nextRow = falling.row + nextVelocity * dt

  // 上端 (水面側) クランプ + 反発。
  if (nextRow < 0) {
    nextRow = 0
    if (nextVelocity < 0) {
      nextVelocity = -nextVelocity * TOP_BOUNCE_COEFFICIENT
    }
  }

  // 下端 (コップ底側) クランプ。着水後の固定処理は Issue #17 / #18 で行う。
  const maxRow = state.rows - 1
  if (nextRow > maxRow) {
    nextRow = maxRow
    if (nextVelocity > 0) {
      nextVelocity = 0
    }
  }

  falling.velocity = nextVelocity
  falling.row = nextRow
}
