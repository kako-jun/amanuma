# amanuma - 技術アーキテクチャ

> ⚠️ Issue #11 (Phaser → PixiJS 移植) 完了時点の構成。
> ゲームデザインも Issue #10 で「水中落ち物パズル / お題型」に刷新予定。
> シーン・ロジック構造は後続 Issue (#13〜#21) で再構築される。
> Issue #14 でお題データ構造とローダーを追加した。
> Issue #15 で `BoardRenderer` によるボード・ブロック描画を追加した。
> Issue #16 で水中物理 (`UnderwaterPhysics`) を追加した。
> Issue #18 で消去・連鎖ロジック (`src/game/`) と Vitest を追加した。
> Issue #20 でキーボード・タッチ入力 (`src/input/`) と一時停止・リスタートを追加した。
> Issue #17 で着水エフェクト (`src/scenes/effects/`) を追加した。
> Issue #21 で `SceneManager` + `TitleScene` / `VersusScene` / `ResultScene` / `PlayerBoard` を追加し、誌面パン&ズーム演出を導入した。
> Issue #31 で `BeakerFrame` を追加し、盤面をビーカー型ガラス容器のシルエットで囲み、斜光ライティング (上面ハイライト・下面影・水面の光の筋) を導入した。

## 技術スタック

- **言語**: TypeScript 5
- **ビルド**: Vite 6
- **ゲームエンジン**: PixiJS v8
- **スタイル**: vanilla CSS (`src/index.css`)

## ディレクトリ構造 (Phase 3 完成時点)

```
src/
├── main.ts                 # PIXI.Application ブートストラップ + SceneManager に全シーンを配置
├── index.css               # 最小リセット + body 背景 + canvas violet glow
├── vite-env.d.ts           # Vite クライアント型
├── constants/
│   └── colors.ts           # DESIGN.md 準拠 BLOCK_COLORS / UI_* + CELL_SIZE / BOARD_BORDER_WIDTH 等
├── types/
│   ├── GameState.ts        # GameState / BlockValue / FallingBlock 型 + ファクトリ
│   └── Puzzle.ts           # PuzzleDefinition / PuzzleCollection / PuzzleLoadResult 型
├── data/
│   ├── puzzles.json        # お題コレクション (tutorial-01 / 02 / 03 を同梱)
│   └── loadPuzzle.ts       # listPuzzles / getPuzzleById / buildGameStateFromPuzzle / PuzzleRotation
├── scenes/
│   ├── SceneManager.ts     # 巨大誌面 (world) と navigateTo() による cubicInOut tween (Issue #21)
│   ├── PlayerBoard.ts      # 1 プレイヤー分の物理・連鎖・スポーン・着水演出 (Issue #21 で抽出)
│   ├── GameScene.ts        # シングル用シーン (PlayerBoard を 1 個保持する薄いラッパ)
│   ├── VersusScene.ts      # 対戦用シーン (PlayerBoard を 2 個 + お邪魔送信 MVP, Issue #21)
│   ├── TitleScene.ts       # タイトル画面 (グラスボタン 3 種, Issue #21)
│   ├── ResultScene.ts      # リザルト画面 (cleared/gameover/win/lose 表示, Issue #21)
│   ├── BoardRenderer.ts    # PIXI.Graphics でボード・ブロック描画 + 斜光ライティング + shake API
│   └── effects/
│       ├── BeakerFrame.ts          # ビーカー (口広・底細台形) ガラス枠 + 水中青み overlay (Issue #31)
│       ├── BubbleParticleSystem.ts # 泡パーティクル (spawn/land/clear, Issue #17/#19)
│       └── WaterSurface.ts         # 水面 sin 波 + 局所波紋 + 光の筋 (Issue #17/#31)
├── physics/
│   └── UnderwaterPhysics.ts # 水中物理ステップ関数 (重力 - 浮力 - 粘性減衰)
├── game/
│   ├── board.ts            # 着地計算 / ブロック固定 / 消去判定 / 重力 / 7 個数集計 / 横移動衝突判定
│   ├── ChainRunner.ts      # 着水後の消去・重力・再判定を Promise チェーンで実行 (onClear フック)
│   └── randomBlocks.ts     # 1〜7 のブロック生成 (7 は 2%、1〜6 は残り 98% を等分)
├── input/                  # Issue #20
│   ├── KeyboardManager.ts  # キーマップ → KeyboardCommand へ変換、handler に通知
│   ├── TouchManager.ts     # PointerEvent → TouchCommand (左/右タップ・下スワイプ) 分類
│   └── constants.ts        # DROP_BOOST_VELOCITY 等の入力解釈用定数
└── audio/                  # Issue #22
    ├── SoundManager.ts     # WebAudio + HTMLAudioElement で SFX/BGM、ミュート永続化
    └── MuteButton.ts       # canvas 右上常駐 (app.stage 直下、SceneManager.world と独立)
index.html                  # <div id="root"></div> に canvas をマウント (+ Inter Web フォント読込)
public/
└── sounds/                 # SFX 7 種 + BGM 4 種を投入する (README.md 参照)
```

## 起動シーケンス

`src/main.ts`:

1. `Application` を生成し `await app.init({...})` で初期化
   - `width: 800, height: 650` (DESIGN.md の Game Canvas 仕様)
   - `background: 0x0f0f1a` (DESIGN.md `bg` トークン)
   - `antialias: true`
   - `resolution: window.devicePixelRatio`, `autoDensity: true`
2. `app.canvas` を `#root` 要素へ append
3. マウント先が見つからない場合は Error を throw
4. `PuzzleRotation` を生成し、`current()` で取得したお題を `buildGameStateFromPuzzle()` で `GameState` に変換する
5. 成功なら変換結果の state、失敗なら `createInitialGameState()` (空盤面) にフォールバックし、エラーを `console.error` に出力
6. `GameScene` を生成し、その state を `initWithState` に流し込んで起動

`GameScene.initWithState(state)` は任意の `GameState` から起動できる設計 (デバッグ・テスト容易化のため、後続 Issue でテストや任意局面再現に使う)。

## お題データ

お題 (初期盤面) は `src/data/puzzles.json` に集約する。

### JSON スキーマ

```jsonc
{
  "version": 1,
  "puzzles": [
    {
      "id": "tutorial-01", // 一意の識別子
      "title": "初級", // 表示名
      "cols": 5, // 列数 (現状は 5 想定)
      "rows": 10, // 行数 (現状は 10 想定)
      "board": [
        // 行配列、長さは rows、各行は cols 文字
        ".....", //   "." = 空セル
        ".....", //   "1"〜"7" = ブロック値
        "..1..", // 行順は JSON の 0 行目 = 最上段、最後の行 = 最下段
        "...",
      ],
      "nextBlocks": [3, 4, 2], // 任意。最初に降ってくるブロックのキュー
      "targetBlocks": [
        // 任意。クリアに必要な 7 ブロックの位置 (情報用途)
        { "row": 8, "col": 2 }, //   row / col は GameState 座標 (0 = 最上段)
      ],
    },
  ],
}
```

### `board` 文字列表記の規約

- 各文字: `.` = 空、`1`〜`7` = ブロック値
- 行数は `rows` と一致、各行の長さは `cols` と一致 (`buildGameStateFromPuzzle` が検証)
- **JSON の 0 行目が最上段、最後の行が最下段** (= `GameState.board[r][c]` と同じインデックス)
- 「下が詰まり、上が空」になるように人間が編集する想定

### ローテーション

`PuzzleRotation` クラスでお題を巡回する。

- `current()` — 現在のお題
- `next()` — 順送り (末尾の次は先頭)
- `random()` — RNG 経由でランダム選択 (RNG はコンストラクタ引数で差し替え可、テスタビリティ確保)
- `reset()` — index を 0 に戻す

対戦モード (#21) では片方のインスタンスから `current()` を取り、両プレイヤーに同じ お題を渡すことで完全同一の初期盤面からスタートできる。

## 画面サイズ

- 800 x 650px (DESIGN.md の Game Canvas 仕様)

## ビルドコマンド

```bash
npm run dev       # 開発サーバー起動 (port 3000)
npm run build     # tsc + vite build
npm run preview   # ビルド結果プレビュー
npm run lint      # ESLint
npm run format    # Prettier
```

## 描画方針 (Issue #15)

ボード・ブロックの描画は `src/scenes/BoardRenderer.ts` が担う。旧 Phaser 版で `add.graphics()` を毎フレーム `clear()` → 再構築する素直な方針を採っていたため、PixiJS 移行後もそれを踏襲する。`BoardRenderer` は 1 個の `PIXI.Graphics` インスタンスを保持し、`update()` が呼ばれるたびに `clear()` してから盤面背景・枠線・全ブロックを描き直す。5x10 程度の盤面なら v8 の `Graphics` 再構築は十分軽量で、後続 Issue (#16 物理 / #17 着水 / #18-19 消去) で揺れ・波紋・消滅アニメを足す際にもこの「state を見て毎フレーム再描画」モデルがそのまま使える。一方、ブロック上の数字テキスト (`PIXI.Text`) は再生成コストが Graphics より高いため、`textPool` に保持して使い回す (毎フレーム visible のみ切り替える)。`GameScene` は `Application.ticker.add` で `BoardRenderer.update()` を毎フレーム呼ぶ。

## 水中物理 (Issue #16)

`fallingBlock` の縦方向落下は `src/physics/UnderwaterPhysics.ts` の `stepUnderwaterPhysics(state, deltaMS)` が司る。`GameScene` の Ticker 内で `BoardRenderer.update()` の **直前** に呼び出され、`state.fallingBlock.row` / `velocity` を mutate する。

### 物理モデル

1 次元 (縦) の自由落下 + 浮力 + 粘性抵抗:

```
a = WATER_GRAVITY - WATER_BUOYANCY - WATER_DRAG * velocity
```

| 定数             | 値     | 単位   | 役割                                                 |
| ---------------- | ------ | ------ | ---------------------------------------------------- |
| `WATER_GRAVITY`  | `18.0` | row/s² | 下向き重力加速度。通常重力より弱め                   |
| `WATER_BUOYANCY` | `6.0`  | row/s² | 上向き浮力。重力の約 1/3 なのでブロックは沈む        |
| `WATER_DRAG`     | `1.6`  | 1/s    | 粘性抵抗係数 (速度比例)。終端速度を決める            |
| `MAX_VELOCITY`   | `12.0` | row/s  | 終端速度の安全上限 (パラメータ調整・dt スパイク防御) |

積分は semi-implicit Euler (`v` を先に更新してから `row` を更新)。`deltaMS` は内部で `50ms` にクランプし、タブ非アクティブ復帰時の位置ジャンプを防ぐ。

### row 単位で計算する設計理由

物理は `row/s` 単位 (1 行 = `cellSize` ピクセル) で完結させ、ピクセル換算は `BoardRenderer` に任せる。こうすると `CELL_SIZE` (描画解像度) が変わっても物理パラメータを変えずに済み、テスト時も描画なしで挙動を検証できる。

### 境界処理

- 上端 (`row < 0`): `row` を 0 にクランプし、上向き速度を反発係数 `0.5` で反転 (水面でぬるっと跳ね返る)。
- 下端 (`row > rows - 1`): `row` を `rows - 1` にクランプし、下向き速度を 0 にする。**着水後の board セル固定 (`board[r][c] = value`) や着水エフェクト (波紋・水しぶき・横揺れ) は本関数の責務外で、Issue #17 / #18 で実装する**。

### 範囲外

- 横揺れ (横方向の振動) は本 Issue ではスコープ外。Issue #17 で着水エフェクトと合わせて追加予定。

## 消去・連鎖ロジック (Issue #18)

旧 Phaser 版は `time.delayedCall(50ms)` でコールバック再帰していたが、PixiJS 移植では **Promise チェーン** で書き直した。`src/game/` 以下に純粋関数群 (`board.ts`) と、それを呼び出す非同期実行ロジック (`ChainRunner.ts`)、Next ブロック生成 (`randomBlocks.ts`) を集約。

### 消去ルール

- 縦または横に **連続した** ブロックの **任意の部分列** で合計が 7 になる箇所がすべて消える。
  - 例: `1+2+4`, `2+5`, `3+4`, `1+1+1+1+1+1+1`
  - 1 行の中に複数の合計 7 部分列があれば、すべて消去対象。
  - `null` セルを跨いだ合計はしない (= 区間は最小限の連続)。
- **7 ブロックは特別ルール**: 値 7 が **3 つ以上連続** したときだけ消える (`7+7` は消えない、`7+7+7` は消える)。単独の 7 (合計 = 7 の長さ 1 部分列) は通常ルールから除外する。
- 縦と横で同じセルが両方マッチしても、消去座標は集合 (`Set<number>`) で 1 つに統合する。

### 連鎖の Promise チェーン

`runChain(state, opts)` は以下を loop:

1. `findClearablePositions(state)` で消去対象を集める。空なら break。
2. `chainLevel++`。
3. `await delay(stepDelayMs)` (デフォルト 250ms) — 後続 Issue で着水・爆発エフェクトの間に挟むタイミング合わせ。
4. `clearCells(state, positions)` で実際に null 化。`state.score` と `state.chainCount` を更新。
5. `await delay(stepDelayMs)` — 爆発演出の見せ場用。
6. `applyGravity(state)` で重力適用 → ループ先頭に戻る。

スコアリングは旧スリーセブン準拠で `消去数 * 10 + 連鎖段数 * 50`。何も消えなければ `chainCount` を 0 にリセットして即解決する。

テスト時は `runChain(state, { stepDelayMs: 0 })` で待機を消せる。

### 着水 → 連鎖 → スポーンのフロー (`GameScene`)

`GameScene` の Ticker は以下のフローを毎フレーム回す:

1. `state.status !== 'playing'` または `isChaining` なら描画のみ。
2. `fallingBlock` があれば `stepUnderwaterPhysics(state, deltaMS)` で物理を進める。
3. `findLandingRow(state)` で着地 row を取得し、現在の `fallingBlock.row` がそれ以上なら着地と判定。
4. 着地時は row をスナップして `lockFallingBlock(state)` → `runChain()` を起動 (`isChaining = true`)。
5. `runChain` が解決したら:
   - `countSevens(state) === 0` なら `state.status = 'cleared'` (= 全ての 7 を消したら勝ち)。
   - そうでなければ `state.nextBlock` を新しい `fallingBlock` にセットし、`generateBlockValue()` で Next を補充。
6. `isChaining = false` に戻して通常ループに復帰。

### ブロック出現確率 (`randomBlocks.ts`)

旧仕様 (1〜6 各 17%、7 が 2%) は合計 104% で歪なため、本実装では「7 を 2% で抜き出し、残り 98% を 1〜6 で等分」する形に正規化。RNG は引数で差し替え可能で、テスト時に決定論的に検証できる。

## 入力 (Issue #20)

親 Issue #10 のタッチ方針 (kako-jun 明示): **バーチャルパッドは採用しない**。画面エリアに意味を持たせる。

### キーボード (`KeyboardManager`)

| キー      | コマンド      | 効果                                                                                              |
| --------- | ------------- | ------------------------------------------------------------------------------------------------- |
| `←`       | `left`        | `fallingBlock.col` を -1 (境界 + 衝突チェック後)                                                  |
| `→`       | `right`       | `fallingBlock.col` を +1 (同上)                                                                   |
| `↓`       | `drop`        | `fallingBlock.velocity` に `DROP_BOOST_VELOCITY` を加算 (高速落下、`MAX_VELOCITY` で終端クランプ) |
| `P` / `p` | `togglePause` | `playing` ↔ `paused` を切替 (`cleared` / `gameover` では無視)                                     |
| `R` / `r` | `restart`     | `RestartSource.build()` で現在のお題を再構築して `initWithState`                                  |

未対応キーは `preventDefault` せずスルー。長押し連発は OS のオートリピートに任せる (`↓` 押しっぱなしで連続加速)。

### タッチ (`TouchManager`)

`PointerEvent` を購読し、touchstart / mousedown を統一して扱う。

| ジェスチャ                                   | コマンド |
| -------------------------------------------- | -------- |
| canvas 左半分 (x < width/2) をタップ         | `left`   |
| canvas 右半分をタップ                        | `right`  |
| 下スワイプ (dy >= 50px かつ \|dy\| > \|dx\|) | `drop`   |

- 中央 (x = width/2 ちょうど) は右扱い。
- 上スワイプ・横スワイプ・スワイプ未満の微動はタップ扱いに倒れ、開始 x で左右判定。
- 2 本目以降のポインタは無視 (`active` で 1 本のみ追跡)。`pointercancel` で追跡解除。
- スワイプ閾値は `TouchManagerOptions.swipeThresholdPx` で差し替え可能 (既定 50px)。

### 入力封じ (`GameScene` で集中管理)

各 Manager は「コマンド発火」までを担当し、ゲーム状態は参照しない。封じロジックは `GameScene.handleKeyboard` / `handleTouch` に集約:

- `state.status !== 'playing'` (= `paused` / `cleared` / `gameover`) のとき: `left` / `right` / `drop` を無視
- `isChaining = true` のとき: `left` / `right` / `drop` を無視
- `togglePause`: `playing` ↔ `paused` のみ。`cleared` / `gameover` (終端状態) では無視
- `restart`: 常時有効 (`cleared` / `gameover` からの復帰に必要)。`setRestartSource()` 未設定なら no-op

### リスタートソース (`RestartSource`)

`GameScene.setRestartSource({ build(): GameState | null })` で注入する。`main.ts` では `PuzzleRotation.current()` + `buildGameStateFromPuzzle` を `build` に渡す。タイトル画面 (#21) 実装時は別ソースに差し替えることで「タイトルへ戻る」も同じ仕組みで作れる。

## 着水エフェクト (Issue #17)

ブロックが水面に「たぷん」と落ちる演出 + 盤面下部 (積層) への着水演出を、3 つのレイヤーで構成する。GameState は触らず、`GameScene` が以下を「上に重ねるだけ」で完結させる。

### 3 つの構成要素

| 要素                                      | 役割                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `WaterSurface` (`y=0` 水面)               | 常時 sin 波で揺らぎ、`splash(x, intensity)` で局所波紋を 500ms 発生           |
| `BubbleParticleSystem` (盤面と同レイヤー) | 半透明白円を上方向にゆっくり立ち上がらせるパーティクル管理 (#19 でも共用予定) |
| `BoardRenderer.shake(row, col)`           | 着水セルだけを 600ms の減衰横揺れ (`sin(2π·12Hz·t) · (1−age) · 3px`)          |

### 呼び出しタイミング (`GameScene`)

1. **Next からブロック投入時** (= `startChainSequence` の最後で次の `fallingBlock` を生成する瞬間、および `initWithState` 直後): `emitSpawnEffect(col)` を呼ぶ。
   - `WaterSurface.splash(x, 0.7)`: 控えめな波紋。
   - `BubbleParticleSystem.emitBubbles({ x, y: 0, kind: 'spawn', count: 3 })`: 3 個の泡。
2. **ブロックが盤面下部 (積層) に着水したとき** (= `tick` 内で `landingRow` に到達した瞬間): `emitLandEffect(row, col)` を呼ぶ。
   - `WaterSurface.splash(x, 1.0)`: 強めの波紋。
   - `BubbleParticleSystem.emitBubbles({ x, y: row*CELL_SIZE + CELL_SIZE/2, kind: 'land', count: 4 })`: 4 個の泡。
   - `BoardRenderer.shake(row, col)`: 着水セルの横揺れ (0.6 秒で減衰)。
3. **毎フレーム**: `WaterSurface.update()` と `BubbleParticleSystem.update(deltaMS)` を Ticker から呼ぶ (`state.status` に関わらず常駐アニメは続ける)。

### `BubbleKind` の区別 (`spawn` / `land` / `clear`)

呼び出し元の意図を `kind` で明示する。`spawn` / `land` は #17 で同じパラメータを共有し、`clear` は #19 で別パラメータを持つ (下記)。

### 命名注: `emitBubbles`

PIXI の `Container` は `EventEmitter` を継承するため、`emit()` 名は型レベルで衝突する。`BubbleParticleSystem.emitBubbles()` の名前はこの衝突を避けるため。

## 消去時の泡 (Issue #19)

ブロックが消えるとき「水中で気泡になってほどけて昇る」演出を、既存の `BubbleParticleSystem` の `kind: 'clear'` バリアントで発火する。新規レイヤーは増やさず、着水演出 (#17) と同じパーティクル系に乗せる。

### ChainRunner の `onClear` フック

`runChain(state, { onClear })` の `onClear` は **消去発生の直前 (clearCells 呼び出しの直前)** で呼ばれる。コールバックには消去対象セルの `Set<row * cols + col>` が渡る。

- 消去前に呼ぶ理由: 位置情報を使って演出を発火するため。clearCells 後だと board から値が消えてしまい、座標復元が `Set` キー経由 (row, col) でしかできなくなる。位置情報のみで十分な現状の演出には影響ないが、将来「消えた色を残した泡」等を入れる場合に備えて消去前のタイミングを正本とする。
- 消去が発生しないステップでは呼ばれない (= ループ終了条件と等価)。
- 連鎖が発生したら 1 段ごとに呼ばれる。連鎖時は連続して泡が立ち上がる絵になる。

### `'clear'` バリアントのパラメータ

`BubbleParticleSystem` の `VARIANT_PARAMS.clear` で定義:

| パラメータ | 値                | 備考                                              |
| ---------- | ----------------- | ------------------------------------------------- |
| 個数       | 4 (固定)          | `GameScene.emitClearBubbles` で `count: 4` を渡す |
| 上昇速度   | -25..-45 px/s     | `'land'` / `'spawn'` (-30..-70) よりも遅め        |
| 寿命       | 1500..2500 ms     | 水面に向けてゆっくり昇る尺                        |
| 半径       | 2..5 px           | 元ブロック (48px 矩形) よりかなり小さい           |
| 横揺れ     | ±10 px sin        | 周期は他バリアントと共通 (`sin(ageMs / 200)`)     |
| 色 / alpha | `0xffffff` / 0.55 | 半透明白で水中の気泡感                            |

### 呼び出しタイミング (`GameScene`)

`GameScene.startChainSequence` で `runChain(state, { onClear: positions => this.emitClearBubbles(positions) })` を渡す。`emitClearBubbles` は位置 `key = row * cols + col` から (row, col) を復元し、各セル中心 `(col * CELL_SIZE + 24, row * CELL_SIZE + 24)` で `emitBubbles({ kind: 'clear', count: 4 })` を発火する。

連鎖時はループの各ステップで `onClear` が呼ばれるため、段ごとに泡が立ち上がる。`stepDelayMs` (デフォルト 250ms) と泡の寿命 (1500..2500ms) の組み合わせで、次の段の泡が前の段の泡と重なって昇る絵になる。

### 本 Issue ではやらないこと

- 「爆発の中心からの閃光」は描かない (本 Issue は泡のみ)。
- 連鎖カウント表示は別 Issue。
- 音は #22。

## テスト (Issue #18 / #20 / #17 / #19 / #21 / #22 / #31)

Vitest を導入した。`vitest.config.ts` の `environmentMatchGlobs` で **`src/input/**`、`src/scenes/**`、`src/audio/**`** を jsdom 環境、それ以外は Node 環境で動かす。**現状 159 tests passing (12 files)**。

テスト対象:

- `src/game/board.test.ts` — 消去判定の各パターン (1+2+4, 2+5, 7+7+7 は消える / 7+7 は消えない, 縦横同時, 単独 7 は消えない 等)、`findLandingRow`、`lockFallingBlock`、`applyGravity`、`clearCells`、`countSevens`、`canMoveFallingTo` (境界・衝突・浮動小数 row)。
- `src/game/randomBlocks.test.ts` — 境界値検証 + 100,000 試行で 7 の出現率が 2% に収束することを確認。
- `src/game/ChainRunner.test.ts` — 単発消去、重力経由の 2 連鎖、7+7+7 + 重力後の連続消去、消去 0 件で即終了。`stepDelayMs: 0` で実時間 wait を除去。`onClear` フック (#19) の呼び出し回数 / 引数 / 呼び出しタイミング (clearCells 前) も検証。
- `src/input/KeyboardManager.test.ts` — `KeyboardEvent` 発火でキー → コマンド変換、`preventDefault`、unsubscribe、attach 重複防御を検証 (jsdom)。
- `src/input/TouchManager.test.ts` — `PointerEvent` 発火でタップ位置・下スワイプの分類、閾値カスタム、2 本目無視、`pointercancel` を検証 (jsdom)。
- `src/scenes/effects/BubbleParticleSystem.test.ts` — `emitBubbles` での生成数、`update` の上昇移動、寿命到達での自動削除、`destroy()` のクリア (jsdom + 決定論的 RNG)。`kind: 'clear'` (#19) は `'land'` より上昇速度が遅いこと、速度レンジが -25..-45 px/s、寿命レンジが 1500..2500ms に収まることを検証。
- `src/scenes/effects/WaterSurface.test.ts` — `splash` での登録、500ms 経過後の自動削除、複数 splash の独立寿命 (jsdom + 手動クロック)。
- `src/scenes/effects/BeakerFrame.test.ts` — `getBackLayer` / `getFrontLayer` の取得、`destroy` 後の二重破棄耐性、デフォルト/カスタムオプションでの生成 (jsdom)。
- `src/scenes/SceneManager.test.ts` — `cubicInOut` 単体 (境界 / 単調性)、`navigateTo` の即時スナップ (duration=0)、tween 中点・終端、進行中の navigateTo 切り替え、`applyCamera` の world 座標を検証。
- `src/scenes/TitleScene.test.ts` — `attachInputs(KeyboardManager)` 経由で 1 / 2 / Escape / Enter が `onSelect('single' / 'versus' / 'exit' / 'single')` を発火することを検証 (jsdom)。
- `src/scenes/ResultScene.test.ts` — R / Enter で `onRestart`、Escape で `onTitle` が呼ばれること、全 kind (cleared/gameover/win/lose) でコンストラクタが通ること、unsubscribe 後はキーが無効になることを検証 (jsdom)。
- `src/audio/SoundManager.test.ts` — ミュート状態の persist/load、404 graceful、`playSfx` のクローン再生、`playBgm` の loop / cross-fade、`unlock` の AudioContext.resume と再 play を検証 (jsdom + HTMLAudioElement モック)。

**未カバー (TODO)**: VersusScene の対戦ロジック (お邪魔送信 `transferGarbage`、勝敗判定 `handleEnd`)、`PlayerBoard` の `consumePendingGarbage` / `garbageReceived`。レビュー指摘 (Phase 3 review) で should レベルとして特定済み、別 Issue で対応。

```bash
npm test          # 1 回実行
npm run test:watch # ファイル変更で再実行
```

PIXI.Graphics の WebGL/Canvas 描画自体は jsdom では動かない (`Not implemented: HTMLCanvasElement's getContext()` の警告が出る) ため、`scenes/effects` のテストはライフサイクル管理 (寿命・配列状態) に絞っている。BoardRenderer は state を見て毎フレーム再構築する純粋関数的な構造なので、テストせず手動確認に任せる方針は Issue #15 のまま据え置く。

## カラーマッピング

DESIGN.md セクション 2 (Block Colors) を `BlockValue` 1..7 にマッピングしたもの (`src/constants/colors.ts`)。Hex 値は DESIGN.md と完全一致させる。7 はクリア対象ブロックなので、もっとも目立つ Magenta を割り当てている。

| BlockValue | DESIGN.md カラー名 | Hex       |
| ---------- | ------------------ | --------- |
| 1          | Rose               | `#ff6b9d` |
| 2          | Coral              | `#ffa06b` |
| 3          | Gold               | `#ffd93d` |
| 4          | Mint               | `#6bffb8` |
| 5          | Sky                | `#6bb3ff` |
| 6          | Purple             | `#a06bff` |
| 7          | Magenta            | `#ff6bff` |

ボード枠線は `UI_PRIMARY` (`#7c3aed`, Violet) で `alignment: 1` (内側) を指定する。ブロック上の数字テキストは `UI_TEXT_PRIMARY` (`#ffffff`) + Inter 700 (Google Fonts、`index.html` で読み込み)。

## シーン構成 (Issue #21)

タイトル / シングル / 対戦 / リザルトの 4 シーンを、**1 枚の巨大「宇宙誌面」コンテナ (= `SceneManager.world`)** の中に絶対座標で配置する。カメラを 4 シーン間で `cubicInOut` の tween 補間して移動し、「宇宙に浮かぶページをパン&ズームする」演出を実現する。

### 誌面上のシーン配置 (`main.ts`)

| シーン | 誌面ローカル (x, y) | scale | コンポーネント                                                   |
| ------ | ------------------- | ----- | ---------------------------------------------------------------- |
| title  | (400, 325)          | 1.0   | `TitleScene` (ロゴ + シングル/対戦/終了の 3 ボタン)              |
| single | (1500, 325)         | 1.0   | `GameScene.board` (シングル用 `PlayerBoard`)                     |
| versus | (2700, 325)         | 1.0   | `VersusScene` (2 つの `PlayerBoard` を横並び)                    |
| result | (2000, 1200)        | 1.0   | `ResultScene` (cleared/gameover/win/lose に応じた見出し + score) |

座標は誌面ローカル (= world Container の子としての位置)。`SceneManager(VIEW_W, VIEW_H)` がカメラ中心 → ビューポート中心への変換 (`world.x/y/scale`) を担う。

### `SceneManager`

```ts
class SceneManager {
  readonly world: Container
  registerScene(key, transform): void
  navigateTo(key, durationMs = 1000): Promise<void> // cubicInOut tween
  update(deltaMS): void // Ticker から呼ぶ
}
```

- 進行中の tween 中に別の `navigateTo` を呼ぶと、**現在のカメラ位置から** 新しい目的地へ繋ぎ直す (= 折り返しできる)。
- 自前 `cubicInOut` で十分な絵が出るので GSAP 等の重い tween ライブラリは導入しない。
- `update(deltaMS)` は Ticker 1 個に統一する設計 (`main.ts` で `SceneManager.update` → `GameScene.update` → `VersusScene.update` の順で 1 ループを回す)。

### 入力フォワーディング

`KeyboardManager` / `TouchManager` は **アプリ全体で 1 個** を `window` / `canvas` に attach。
「今アクティブなシーン」だけがコマンドを購読する設計で、`main.setActiveScene(key)` が前の購読を `unsubscribe()` → 新しいシーンの `attachInputs(keyboard, touch?)` を呼ぶ。

シーン別マッピング (本 Issue 時点):

| シーン | キー               | 動作                                                       |
| ------ | ------------------ | ---------------------------------------------------------- |
| Title  | `1`                | シングル開始 (= single へ navigate)                        |
| Title  | `2`                | 対戦開始 (= versus へ navigate)                            |
| Title  | `Escape` / `Enter` | 終了 (ブラウザでは no-op) / シングル開始                   |
| Single | `← → ↓ P R`        | 既存の GameScene と同じ。タッチも有効                      |
| Single | (cleared/gameover) | ResultScene へ自動遷移                                     |
| Versus | `← → ↓`            | P1 のみ操作可。P2 は本 Issue では待機                      |
| Result | `R` / `Enter`      | onRestart (シングルなら startSingle、対戦なら startVersus) |
| Result | `Escape`           | onTitle (タイトルへ navigate)                              |

`KeyboardCommand` に Issue #21 で `select1` / `select2` / `cancel` / `confirm` を追加。
タイトル/リザルトの選択や戻る操作に使う。

## 対戦モード (Issue #21)

`VersusScene` は 2 個の `PlayerBoard` を横並びに配置する。両プレイヤーは独立した `GameState` (= 同じお題から `buildGameStateFromPuzzle` を 2 回呼ぶ) を持ち、物理・連鎖・スポーンを並行に進める。

### お邪魔ブロック送信 (MVP)

```
PlayerBoard.startChainSequence
  └─ runChain({ onClear: positions => {
         emitClearBubbles(positions)
         pendingGarbageOut += floor(positions.size / 3)
         callbacks.onChain(cleared, chainLevel)
     }})
VersusScene.transferGarbage(from, to)  ← onChain で呼ばれる
  └─ to.garbageReceived(from.consumePendingGarbage())

PlayerBoard.garbageReceived(count)
  └─ 上から null セルを探して 1..6 のランダムブロックを最大 count 個埋める
```

- レート: 連鎖 1 段の消去数の `floor(N / 3)` を相手に送る (= 3 個消すごとに 1 個降る)。
- 送信タイミング: `onChain` フックは連鎖の各段で呼ばれるので、連鎖中じわじわ相手に降っていく絵になる。
- 内容: 1..6 のランダム (= ターゲット `7` は送らない。テンポを崩さないため)。
- 受信側が `playing` 以外 / 連鎖中なら受け取りを破棄する (= バランス調整は後続課題)。

### 勝敗判定

- `cleared` (= 残 7 が 0): **その側の勝ち** (先に消し切った方の勝利)。
- `gameover` (= スポーン位置に既にブロックがある): **相手の勝ち**。
- どちらかが確定したら `settled = true` で以後のコールバックを抑止する。

### 本 Issue ではやらないこと

- P2 のキーバインド (現状はキーボード ← → ↓ が P1 のみに割り当て。WASD 等は別 Issue)。
- 連鎖段数に応じた送信量の重み付け (今は単純な `floor(N/3)`)。
- 連鎖カウント表示・対戦専用 UI (P1/P2 のスコアパネル等)。

## 音 (Issue #22)

ゲームの音は `src/audio/SoundManager.ts` の `SoundManager` クラスに集約する。
重い音声ライブラリ (Howler / Tone) は導入せず、`HTMLAudioElement` と
`AudioContext` の最小組み合わせで実現する。

### 設計の前提

- **アセットが無くても落ちない**。`Audio` の `error` イベントは黙って無視し、
  ブラウザコンソールの 404 警告だけが出る。実音は `public/sounds/` に随時投入する。
- SFX は `new Audio(src)` を毎回作って同時再生に耐える (短いので片付けは GC 任せ)。
- BGM は 1 個の `HTMLAudioElement` を使い回し、`fadeMs` を渡せば `volume`
  補間でクロスフェード。
- `unlock()` を初回ユーザー操作 (pointerdown / keydown / touchstart) で呼ぶと
  Safari/iOS のオートプレイポリシーを解除できる (`AudioContext.resume()`)。
- ミュート状態は `localStorage` (key: `amanuma_muted`) に永続化、
  `setMuted`/`toggleMute` 時に自動保存。
- PixiJS のリソース管理とは独立。シーン遷移で勝手に停止されない。

### SFX / BGM キー一覧

`SoundManager` のキー (= `public/sounds/{key}.mp3` のファイル名)。

#### SFX (短い効果音)

| key              | 発火タイミング                                                   |
| ---------------- | ---------------------------------------------------------------- |
| `block-land`     | `PlayerBoard.emitLandEffect` (= 着水時)                          |
| `block-spawn`    | `PlayerBoard.emitSpawnEffect` (= 新ブロック投入時)               |
| `block-clear`    | `runChain` の `onClear` (連鎖各段の消去音)                       |
| `chain-up`       | 2 連鎖目以降に `block-clear` と重ねて発火                        |
| `puzzle-cleared` | `state.status = 'cleared'` 遷移時 / 対戦 win 時                  |
| `game-over`      | `state.status = 'gameover'` 遷移時 / 対戦 lose 時                |
| `ui-select`      | タイトル / リザルトのボタン操作 + キーボード confirm/cancel など |

#### BGM (シーンごとに切替)

| key          | シーン      | loop         |
| ------------ | ----------- | ------------ |
| `bgm-title`  | TitleScene  | ✓            |
| `bgm-game`   | GameScene   | ✓            |
| `bgm-versus` | VersusScene | ✓            |
| `bgm-result` | ResultScene | ✗ (1 度きり) |

`setActiveScene(key)` の中で `sound.playBgm(...)` を呼んで切り替える。
同じ key が既に再生中なら `playBgm` は no-op で、上書き fade による音量の暴れを防ぐ。

### ミュート UI

`src/audio/MuteButton.ts` の `MuteButton` (PIXI Container 派生) を **`app.stage` 直下**
(= `SceneManager.world` の外) に配置する。canvas 右上に固定で表示され、`navigateTo`
の camera tween 中でも動かない。

- クリック / タップで `SoundManager.toggleMute()`。
- ラベルは `ON` / `OFF` のテキスト (emoji 未対応フォントを避ける)。
- `SoundManager.onMuteChange()` を購読して再描画。

### キーボードショートカット

`KeyboardManager` に `mute` コマンドを追加。

| キー      | コマンド | 動作                        |
| --------- | -------- | --------------------------- |
| `m` / `M` | `mute`   | `SoundManager.toggleMute()` |

mute コマンドはシーン非依存で `main.ts` が直接購読する (画面遷移中でも常に効く)。

### アセット投入手順

1. 音ファイル (mp3, 44.1kHz, 320kbps 程度) を準備する。
2. `public/sounds/{key}.mp3` のファイル名で配置する。詳細は
   [`public/sounds/README.md`](../public/sounds/README.md) を参照。
3. ビルド不要 (Vite の static asset 経由)。リロードで反映される。

### 注入ポリシー (テスト容易性)

`PlayerBoard` / `GameScene` / `VersusScene` / `TitleScene` / `ResultScene` は
すべて `SoundManager` を **任意注入 (optional)** で受ける。テストや音不要のモードでは
`null` を渡せば音呼出は完全にスキップされる (`?.()` chain で no-op)。

### 後続 Issue で扱う予定

- 実音アセットの制作 (kako 声 / シンセ / 録音)。
- 連鎖段数に応じた `chain-up` のピッチ補正 (現状は同じ音を重ねる)。
- 音量スライダー UI (現状はミュートのトグルのみ)。

## ビーカーとライティング (Issue #31)

amanuma の盤面は四角い枠ではなく、**ビーカー (理科実験用ガラス容器) の中で行う水中落ち物パズル**である。
盤面 (BoardRenderer) の前後にレイヤーを挟むことで、ガラスの存在感と斜光を表現する。

### レイヤー順 (奥 → 手前)

`PlayerBoard.initWithState` 内で次の順に `addChild` する:

1. `BeakerFrame.getBackLayer()` — 内部の薄い青 (Cyan) overlay (alpha ~0.10) + 上下の擬似 gradient
2. `BoardRenderer` — 盤面のブロック (斜光ハイライト・影込み)
3. `WaterSurface` — 水面の sin 波 + 局所波紋 + 光の筋
4. `BubbleParticleSystem` — 泡パーティクル (spawn / land / clear)
5. `BeakerFrame.getFrontLayer()` — ガラスの輪郭 + 口のリップ + 反射ハイライト + 影

`BeakerFrame` は `Container` 派生だが内部に `back` / `front` を child として持たず、
それぞれを `getBackLayer()` / `getFrontLayer()` 経由で取り出し、呼び出し側 (PlayerBoard) が
レイヤー順を制御する。これにより BoardRenderer / WaterSurface / BubbleParticleSystem を
back と front の間に自由に挟める。

### ビーカー形状

`BeakerOptions` で形状を調整できる:

- 上辺 = `boardWidth`、下辺 = `boardWidth - taperPx * 2` の **口広・底細の台形**
- 口部分 (`y < 0`): `lipExtensionPx` だけ盤面より外に張り出した「リップ」(注ぎ口の簡略表現) を `lipHeightPx` の高さで描画
- 輪郭線色は `UI_PRIMARY` (Violet)、太さは 2 px

デフォルト: `wallThickness=6`, `taperPx=6`, `lipExtensionPx=12`, `lipHeightPx=8`。

### 斜光の方向 (左上から)

光源は **左上から斜めに** 当たっている想定で統一する:

- **ブロック (BoardRenderer)**: 上半分に薄い白ハイライト (alpha 0.10) + 全体に微弱な白ハイライト (0.08) + 下半分に薄い黒の影 (0.18)。DESIGN.md の Block Colors は変えず、alpha を控えめにして識別性を維持する
- **ガラス (BeakerFrame.front)**: 右側面の **内側** に縦の白ハイライトライン (alpha 0.3、boardHeight の 60%)、左側面の内側に薄い黒影 (alpha 0.2)、リップ上面に薄い白ライン
- **水面 (WaterSurface)**: 横方向にゆっくり振動する白の光の筋 (長さ = widthPx の 30%、周期 6 秒、alpha 0.35)。波紋とは別の常駐エフェクト

### Block Colors との両立

DESIGN.md の Block Colors はそのまま保つ。ライティングは **既存ブロックの上に半透明の重ね描き**
として実装されているため、識別性 (DESIGN.md「dark background 上で互いに区別可能」) は維持される。
ShaderFilter / displacement のような重い処理は本 Issue では使わず、Graphics の単純な重ねだけで構成する。

### テスト

- `BeakerFrame.test.ts`: コンストラクタ・getBackLayer/getFrontLayer・オプションのデフォルト・destroy 後の状態を検証
- jsdom 環境では Graphics の描画自体は走らないが、ライフサイクルと API シグネチャは十分カバーできる

## 後続 Issue で構築予定

- `#13` GameState 型定義と `initWithState` 実装
- `#14` お題（初期盤面）データ構造と読み込み
- `#15` PIXI.Graphics でボード・ブロック描画
- `#16` 水中物理プロファイル
- `#17` 着水エフェクト
- `#18` ブロック消去・連鎖ロジック (Promise チェーン)
- `#19` 水中爆発エフェクト
- `#20` キーボード・タッチ入力
- `#21` TitleScene / VersusScene / シーン遷移 (実装済)
- `#22` 音実装 (実装済、アセット投入は後続)
