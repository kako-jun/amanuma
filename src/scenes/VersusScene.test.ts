/**
 * VersusScene のユニットテスト (Issue #54 / レビュー指摘 S12)。
 *
 * 対象:
 * - `transferGarbage`: from の pendingGarbageOut を consume して to に送る量計算。
 * - `handleEnd`: cleared / gameover からの勝敗判定と `settled` ガード。
 * - 引き分け (onDraw) が存在しないこと (Issue #60 で撤去。同時終了は構造的に観測
 *   不能なため、勝敗は先着確定の二分岐に統一)。
 *
 * `transferGarbage` / `handleEnd` は private のため、ブラケットアクセスで直接叩く。
 * 本来の発火経路 (PlayerBoard の onChain/onCleared/onGameOver) は `runChain` の
 * 非同期物理ループ越しでしか起動できず、ユニットテストとしては非決定的になる。
 * private 1 メソッドの入出力契約を deterministic に縛るのが目的なので、
 * 配線 (どのコールバックが handleEnd の引数 'p1'/'cleared' 等に対応するか) は
 * 別途 GameScene/main 経由の結合確認に委ね、ここでは判定ロジック単体を検証する。
 *
 * jsdom 環境 (vitest.config.ts の scenes グロブ)。PIXI.Text は canvas 無しでも
 * 構築できる (描画はしないので測定が劣化するだけ)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VersusScene } from './VersusScene'
import { PlayerBoard } from './PlayerBoard'
import { createInitialGameState, type GameState } from '../types/GameState'

/** private メソッドへ型付きでアクセスするための補助。 */
interface VersusSceneInternals {
  transferGarbage(from: PlayerBoard, to: PlayerBoard): void
  handleEnd(side: 'p1' | 'p2', kind: 'cleared' | 'gameover'): void
}
function internals(scene: VersusScene): VersusSceneInternals {
  return scene as unknown as VersusSceneInternals
}

/** 空盤面 (cols=5, rows=10)、status=playing の独立 state を 1 つ作る。 */
function freshState(): GameState {
  return createInitialGameState()
}

describe('VersusScene.handleEnd 勝敗判定 (S12)', () => {
  let scene: VersusScene | null = null

  afterEach(() => {
    if (scene && !scene.destroyed) scene.destroy()
    scene = null
  })

  it('P1 が cleared → P1 勝ち (onP1Win)', () => {
    const onP1Win = vi.fn()
    const onP2Win = vi.fn()
    scene = new VersusScene({ onP1Win, onP2Win })
    internals(scene).handleEnd('p1', 'cleared')
    expect(onP1Win).toHaveBeenCalledTimes(1)
    expect(onP2Win).not.toHaveBeenCalled()
  })

  it('P2 が cleared → P2 勝ち (onP2Win)', () => {
    const onP1Win = vi.fn()
    const onP2Win = vi.fn()
    scene = new VersusScene({ onP1Win, onP2Win })
    internals(scene).handleEnd('p2', 'cleared')
    expect(onP2Win).toHaveBeenCalledTimes(1)
    expect(onP1Win).not.toHaveBeenCalled()
  })

  it('P2 が gameover → P1 の不戦勝 (onP1Win)', () => {
    const onP1Win = vi.fn()
    const onP2Win = vi.fn()
    scene = new VersusScene({ onP1Win, onP2Win })
    internals(scene).handleEnd('p2', 'gameover')
    expect(onP1Win).toHaveBeenCalledTimes(1)
    expect(onP2Win).not.toHaveBeenCalled()
  })

  it('P1 が gameover → P2 の勝ち (onP2Win)', () => {
    const onP1Win = vi.fn()
    const onP2Win = vi.fn()
    scene = new VersusScene({ onP1Win, onP2Win })
    internals(scene).handleEnd('p1', 'gameover')
    expect(onP2Win).toHaveBeenCalledTimes(1)
    expect(onP1Win).not.toHaveBeenCalled()
  })

  it('settled ガード: 2 回目以降の handleEnd は no-op (先着のみ確定)', () => {
    const onP1Win = vi.fn()
    const onP2Win = vi.fn()
    scene = new VersusScene({ onP1Win, onP2Win })
    // P1 cleared で確定。
    internals(scene).handleEnd('p1', 'cleared')
    // 直後に P2 cleared が来ても無視される (両者同時 = 先着勝ち)。
    internals(scene).handleEnd('p2', 'cleared')
    expect(onP1Win).toHaveBeenCalledTimes(1)
    expect(onP2Win).not.toHaveBeenCalled()
  })

  it('initWithStates が settled をリセットし、再度判定できる', () => {
    const onP1Win = vi.fn()
    const onP2Win = vi.fn()
    scene = new VersusScene({ onP1Win, onP2Win })
    internals(scene).handleEnd('p1', 'cleared')
    expect(onP1Win).toHaveBeenCalledTimes(1)

    // 再初期化で settled=false に戻る → 次の局面で再び判定できる。
    scene.initWithStates(freshState(), freshState())
    internals(scene).handleEnd('p2', 'cleared')
    expect(onP2Win).toHaveBeenCalledTimes(1)
    // P1 は再計上されない (1 回のまま)。
    expect(onP1Win).toHaveBeenCalledTimes(1)
  })

  it('引き分けは仕様外: 両者同時終了でも先着勝ちに収束する (Issue #60 で onDraw 撤去)', () => {
    // Issue #60 決着: 引き分け (onDraw) は撤去した。2 盤面の cleared / gameover は
    // `runChain(...).then(...)` の非同期継続内で「status 確定 → コールバック発火」を
    // 不可分に行い、イベントループ上で必ず逐次実行されるため、先着が settled を立てて
    // 勝者を確定し、後続の handleEnd は no-op になる。「同一フレーム同時終了」は
    // 構造的に観測できないので、引き分けはこの設計に存在しない概念として確定させた。
    //
    // ここでは「両者がほぼ同時に終了通知してきても」先着勝ちに収束することを縛る
    // (p1 cleared が先着 → p1 勝ち。続く p2 gameover は settled で無視)。
    const onP1Win = vi.fn()
    const onP2Win = vi.fn()
    scene = new VersusScene({ onP1Win, onP2Win })
    internals(scene).handleEnd('p1', 'cleared')
    internals(scene).handleEnd('p2', 'gameover')
    expect(onP1Win).toHaveBeenCalledTimes(1)
    expect(onP2Win).not.toHaveBeenCalled()
  })

  it('VersusSceneCallbacks に onDraw が存在しない (撤去の型レベル回帰防止)', () => {
    // 撤去後に onDraw が再導入されたら型として検知できるよう、余剰プロパティ
    // チェックを効かせて縛る。VersusSceneCallbacks に onDraw が再び宣言されると
    // 下の @ts-expect-error が「未使用の抑制」になり tsc が失敗する = 回帰検知。
    const onP1Win = vi.fn()
    const onP2Win = vi.fn()
    scene = new VersusScene({
      onP1Win,
      onP2Win,
      // @ts-expect-error onDraw は Issue #60 で撤去済み。再導入されたらこの行が
      // 型エラーでなくなり @ts-expect-error が浮く → ビルドが赤くなる。
      onDraw: () => {},
    })
    // ランタイムでも、勝敗確定は P1/P2 の二者のみで完結する。
    internals(scene).handleEnd('p2', 'gameover')
    expect(onP1Win).toHaveBeenCalledTimes(1)
    expect(onP2Win).not.toHaveBeenCalled()
  })
})

describe('VersusScene.transferGarbage 送信量計算 (S12)', () => {
  let scene: VersusScene | null = null
  let from: PlayerBoard | null = null
  let to: PlayerBoard | null = null

  afterEach(() => {
    if (scene && !scene.destroyed) scene.destroy()
    if (from && !from.destroyed) from.destroy()
    if (to && !to.destroyed) to.destroy()
    scene = from = to = null
  })

  /** PlayerBoard の private pendingGarbageOut を直接積む補助 (連鎖を回さずに量だけ用意)。 */
  function setPending(pb: PlayerBoard, n: number): void {
    ;(pb as unknown as { pendingGarbageOut: number }).pendingGarbageOut = n
  }

  it('from に溜まった量を to に転送し、from は 0 にクリアされる', () => {
    scene = new VersusScene({})
    // RNG を固定して受け取り側のお邪魔値を決定論化 (rng=0 → 値 1)。
    from = new PlayerBoard({}, null, { rng: () => 0 })
    to = new PlayerBoard({}, null, { rng: () => 0 })
    from.initWithState(freshState())
    to.initWithState(freshState())

    setPending(from, 4)
    internals(scene).transferGarbage(from, to)

    // from の保留は消費されて 0。
    expect(from.consumePendingGarbage()).toBe(0)
    // to の盤面に 4 個のお邪魔 (値 1) が積まれている。
    const board = to.getState()!.board
    const placed = board.flat().filter(c => c !== null)
    expect(placed.length).toBe(4)
    expect(placed.every(v => v === 1)).toBe(true)
  })

  it('溜まりが 0 のときは to.garbageReceived を呼ばない (盤面不変)', () => {
    scene = new VersusScene({})
    from = new PlayerBoard({}, null, { rng: () => 0 })
    to = new PlayerBoard({}, null, { rng: () => 0 })
    from.initWithState(freshState())
    to.initWithState(freshState())

    const spy = vi.spyOn(to, 'garbageReceived')
    // setPending しない → 0。
    internals(scene).transferGarbage(from, to)
    expect(spy).not.toHaveBeenCalled()
    expect(
      to
        .getState()!
        .board.flat()
        .every(c => c === null)
    ).toBe(true)
  })
})
