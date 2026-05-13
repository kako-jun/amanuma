/**
 * ビーカー (理科実験用ガラス容器) のシルエット描画 (Issue #31)。
 *
 * amanuma の盤面は四角い枠ではなく、ビーカー型のガラス容器の中で行う
 * 水中落ち物パズルである。本クラスは盤面 (BoardRenderer) の前後に
 * 「水中の青み overlay」「ガラスの輪郭・ハイライト」を描画する。
 *
 * レイヤー構成 (奥 → 手前):
 *   - back  : 水中の青み (盤面の下に置く)
 *   - 盤面 / 水面 / 泡 (本クラスの外側)
 *   - front : ガラスの輪郭・反射・口のリップ (盤面の上に置く)
 *
 * 光源は左上から斜めに当たっている想定で、右側面のハイライト・
 * 左下の影で表現する。ShaderFilter は使わず、Graphics の重ね描き
 * だけでビーカーの存在感を出す。
 *
 * 形状は「口広・底細の台形」。`taperPx` で片側の細りを指定する。
 * 盤面 (boardWidth × boardHeight) のローカル座標系で描画する。
 * x: 0 .. boardWidth, y: 0 .. boardHeight が盤面。
 * y: -lipHeightPx .. 0 がビーカーの口のリップ部分。
 */

import { Graphics } from 'pixi.js'
import { UI_PRIMARY, UI_SECONDARY } from '../../constants/colors'

export interface BeakerOptions {
  /** 内部の盤面幅 (px)。 */
  boardWidth: number
  /** 内部の盤面高さ (px)。 */
  boardHeight: number
  /** ガラスの厚み (px)。輪郭線の太さに使う。既定 6。 */
  wallThickness?: number
  /** 底にかけて細くする量 (片側 px)。既定 6。 */
  taperPx?: number
  /** 口のリップが盤面より外に張り出す量 (片側 px)。既定 12。 */
  lipExtensionPx?: number
  /** リップの高さ (px)。既定 8。 */
  lipHeightPx?: number
}

const DEFAULT_WALL_THICKNESS = 6
const DEFAULT_TAPER_PX = 6
const DEFAULT_LIP_EXTENSION_PX = 12
const DEFAULT_LIP_HEIGHT_PX = 8

/** 水中の青み overlay の α 値。alpha 0.10 前後で「水っぽい」薄青を出す。 */
const WATER_OVERLAY_ALPHA = 0.1
/** 水中の青み overlay の上端 (口側) の追加 α。上ほど明るく見せる擬似 gradient。 */
const WATER_OVERLAY_TOP_ALPHA = 0.04
/** 水中の青み overlay の下端 (底側) の追加 α。下ほど暗く見せる擬似 gradient。 */
const WATER_OVERLAY_BOTTOM_ALPHA = 0.06

/** ガラスの輪郭線の色 (UI_PRIMARY = Violet)。 */
const GLASS_STROKE_COLOR = UI_PRIMARY
/** ガラスの輪郭線の不透明度。 */
const GLASS_STROKE_ALPHA = 0.85

/** 右側面の縦ハイライト (反射) の色。 */
const HIGHLIGHT_COLOR = 0xffffff
const HIGHLIGHT_ALPHA = 0.3
const HIGHLIGHT_WIDTH_PX = 2

/** 左下の影の色。 */
const SHADOW_COLOR = 0x000000
const SHADOW_ALPHA = 0.2
const SHADOW_WIDTH_PX = 1.5

/**
 * ビーカーシルエット。`back` / `front` の 2 つの Graphics を保持する。
 *
 * N20: 以前は `Container` を継承していたが、自身を表示木に挿入することはなく、
 * `back` / `front` を **独立した Graphics として親 (PlayerBoard) が直接 addChild する**
 * 設計だったため、Container 継承は無意味でかつ二重 destroy の罠を生んでいた。
 * 本クラスは「2 枚の Graphics を生成・描画・破棄する純粋なホルダ」とし、
 * PIXI の表示木からは独立させる (plain class)。
 *
 * BoardRenderer / WaterSurface / BubbleParticleSystem を間に挟むためのレイヤー順
 * 制御は引き続き呼び出し側 (PlayerBoard) の責務。
 */
export class BeakerFrame {
  private readonly back: Graphics
  private readonly front: Graphics
  private readonly opts: Required<BeakerOptions>
  /** PIXI 互換の `children` プロパティ (内部木は持たないので常に空)。テスト後方互換用。 */
  readonly children: ReadonlyArray<never> = []

  constructor(opts: BeakerOptions) {
    this.opts = {
      boardWidth: opts.boardWidth,
      boardHeight: opts.boardHeight,
      wallThickness: opts.wallThickness ?? DEFAULT_WALL_THICKNESS,
      taperPx: opts.taperPx ?? DEFAULT_TAPER_PX,
      lipExtensionPx: opts.lipExtensionPx ?? DEFAULT_LIP_EXTENSION_PX,
      lipHeightPx: opts.lipHeightPx ?? DEFAULT_LIP_HEIGHT_PX,
    }
    this.back = new Graphics()
    this.front = new Graphics()
    this.drawBack()
    this.drawFront()
  }

  /** 後ろレイヤー (水中の青み overlay)。BoardRenderer の下に置く。 */
  getBackLayer(): Graphics {
    return this.back
  }

  /** 前レイヤー (ガラスの輪郭・ハイライト)。BoardRenderer の上に置く。 */
  getFrontLayer(): Graphics {
    return this.front
  }

  /** 設定値の取得 (テスト・デバッグ用)。 */
  getOptions(): Readonly<Required<BeakerOptions>> {
    return this.opts
  }

  /**
   * 2 枚の Graphics を destroy する (N20)。
   *
   * 旧 API (Container 派生時) は `destroy({ children: true })` の形で呼ばれていたが、
   * plain class になった本実装では引数は無視する (互換のため受け取りだけする)。
   * back / front は親 (PlayerBoard) の表示木から `removeChild` 相当で外れた後、
   * 本メソッドで明示破棄する。
   */
  destroy(_options?: unknown): void {
    void _options
    if (!this.back.destroyed) this.back.destroy()
    if (!this.front.destroyed) this.front.destroy()
  }

  // ----------------------------------------------------------------------
  // private
  // ----------------------------------------------------------------------

  /**
   * 水中の青み overlay を `back` に描画する。
   *
   * 台形 (上辺 = boardWidth、下辺 = boardWidth - taperPx*2) を Cyan で
   * 薄く塗り、上下に追加の rect を重ねて擬似的に上→明・下→暗の gradient を出す。
   */
  private drawBack(): void {
    const { boardWidth, boardHeight, taperPx } = this.opts
    const g = this.back
    g.clear()

    // 内部の台形ポリゴン。
    const topLeft = { x: 0, y: 0 }
    const topRight = { x: boardWidth, y: 0 }
    const bottomRight = { x: boardWidth - taperPx, y: boardHeight }
    const bottomLeft = { x: taperPx, y: boardHeight }
    g.poly([
      topLeft.x,
      topLeft.y,
      topRight.x,
      topRight.y,
      bottomRight.x,
      bottomRight.y,
      bottomLeft.x,
      bottomLeft.y,
    ]).fill({ color: UI_SECONDARY, alpha: WATER_OVERLAY_ALPHA })

    // 上端 (口側) を少し明るく。
    const topBandHeight = boardHeight * 0.18
    g.poly([
      0,
      0,
      boardWidth,
      0,
      boardWidth - taperPx * (topBandHeight / boardHeight),
      topBandHeight,
      taperPx * (topBandHeight / boardHeight),
      topBandHeight,
    ]).fill({ color: UI_SECONDARY, alpha: WATER_OVERLAY_TOP_ALPHA })

    // 下端 (底側) を少し暗く。
    const bottomBandHeight = boardHeight * 0.25
    const yStart = boardHeight - bottomBandHeight
    const taperAtYStart = taperPx * (yStart / boardHeight)
    g.poly([
      taperAtYStart,
      yStart,
      boardWidth - taperAtYStart,
      yStart,
      boardWidth - taperPx,
      boardHeight,
      taperPx,
      boardHeight,
    ]).fill({ color: 0x000000, alpha: WATER_OVERLAY_BOTTOM_ALPHA })
  }

  /**
   * ガラスの輪郭・口のリップ・ハイライト・影を `front` に描画する。
   */
  private drawFront(): void {
    const { boardWidth, boardHeight, taperPx, lipExtensionPx, lipHeightPx } =
      this.opts
    const g = this.front
    g.clear()

    // ガラスの本体輪郭 (左右側面 + 底)。口部分はリップで覆うため上辺は描かない。
    // moveTo で開始し、左側面 → 底 → 右側面の順で描いて stroke する。
    g.moveTo(0, 0)
      .lineTo(taperPx, boardHeight)
      .lineTo(boardWidth - taperPx, boardHeight)
      .lineTo(boardWidth, 0)
      .stroke({
        color: GLASS_STROKE_COLOR,
        alpha: GLASS_STROKE_ALPHA,
        width: 2,
      })

    // 口のリップ: 盤面上端 (y=0) よりさらに上 (y = -lipHeightPx) に
    // 左右へ lipExtensionPx ぶん張り出した「フチ」。理科ビーカーの注ぎ口を
    // 簡略化したもの。閉じた台形として stroke する。
    g.moveTo(-lipExtensionPx, -lipHeightPx)
      .lineTo(boardWidth + lipExtensionPx, -lipHeightPx)
      .lineTo(boardWidth, 0)
      .lineTo(0, 0)
      .closePath()
      .stroke({
        color: GLASS_STROKE_COLOR,
        alpha: GLASS_STROKE_ALPHA,
        width: 2,
      })

    // 右側面の縦ハイライト (反射)。右壁の少し内側に細い白ラインを描く。
    // 左上光源 → ガラスの厚みで右側にハイライトが乗る、という直感に従う。
    // 高さは boardHeight の 60%、上から 20% の位置から開始。
    const hiYStart = boardHeight * 0.2
    const hiYEnd = boardHeight * 0.8
    // 右壁の x = boardWidth - (taperPx * y / boardHeight) に沿わせるが、
    // ここは「壁の内側」に置くため -3 px オフセットする。
    const hiInset = 3
    const hiTopX = boardWidth - taperPx * (hiYStart / boardHeight) - hiInset
    const hiBotX = boardWidth - taperPx * (hiYEnd / boardHeight) - hiInset
    g.moveTo(hiTopX, hiYStart).lineTo(hiBotX, hiYEnd).stroke({
      color: HIGHLIGHT_COLOR,
      alpha: HIGHLIGHT_ALPHA,
      width: HIGHLIGHT_WIDTH_PX,
    })

    // 左側面の薄い影。左下にかけて影が落ちている表現。
    // 同じく壁の少し内側に。
    const shYStart = boardHeight * 0.35
    const shYEnd = boardHeight * 0.95
    const shInset = 3
    const shTopX = taperPx * (shYStart / boardHeight) + shInset
    const shBotX = taperPx * (shYEnd / boardHeight) + shInset
    g.moveTo(shTopX, shYStart).lineTo(shBotX, shYEnd).stroke({
      color: SHADOW_COLOR,
      alpha: SHADOW_ALPHA,
      width: SHADOW_WIDTH_PX,
    })

    // リップ上面の薄いハイライト (口の角に光が当たる)。
    g.moveTo(-lipExtensionPx + 2, -lipHeightPx + 1)
      .lineTo(boardWidth + lipExtensionPx - 2, -lipHeightPx + 1)
      .stroke({
        color: HIGHLIGHT_COLOR,
        alpha: HIGHLIGHT_ALPHA * 0.7,
        width: 1,
      })
  }
}
