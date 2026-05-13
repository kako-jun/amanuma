/**
 * 入力系の定数 (Issue #20)。
 *
 * 物理パラメータと密結合させず、入力解釈側の調整値はここに集約する。
 */

/**
 * ↓ キー / 下スワイプで fallingBlock.velocity に加算する加速量 [row/s]。
 *
 * `UnderwaterPhysics.MAX_VELOCITY` で終端速度クランプがかかるため、
 * 過大な値を与えても発散はしないが、体感の応答性を見て調整する。
 */
export const DROP_BOOST_VELOCITY = 8.0
