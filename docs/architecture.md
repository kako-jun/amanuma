# amanuma - 技術アーキテクチャ

> ⚠️ Issue #11 (Phaser → PixiJS 移植) 完了時点の構成。
> ゲームデザインも Issue #10 で「水中落ち物パズル / お題型」に刷新予定。
> シーン・ロジック構造は後続 Issue (#13〜#21) で再構築される。
> Issue #14 でお題データ構造とローダーを追加した。

## 技術スタック

- **言語**: TypeScript 5
- **ビルド**: Vite 6
- **ゲームエンジン**: PixiJS v8
- **スタイル**: vanilla CSS (`src/index.css`)

## ディレクトリ構造 (Issue #14 時点)

```
src/
├── main.ts                 # PIXI.Application ブートストラップ + GameScene 起動 (PuzzleRotation 経由)
├── index.css               # 最小リセット + body 背景
├── vite-env.d.ts           # Vite クライアント型
├── types/
│   ├── GameState.ts        # GameState / BlockValue / FallingBlock 型 + ファクトリ
│   └── Puzzle.ts           # PuzzleDefinition / PuzzleCollection / PuzzleLoadResult 型
├── data/
│   ├── puzzles.json        # お題コレクション (tutorial-01 / 02 / 03 を同梱)
│   └── loadPuzzle.ts       # listPuzzles / getPuzzleById / buildGameStateFromPuzzle / PuzzleRotation
└── scenes/
    └── GameScene.ts        # ゲーム本編シーン (initWithState で任意局面から起動可)
index.html                  # <div id="root"></div> に canvas をマウント
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
      "id": "tutorial-01",        // 一意の識別子
      "title": "初級",             // 表示名
      "cols": 5,                   // 列数 (現状は 5 想定)
      "rows": 10,                  // 行数 (現状は 10 想定)
      "board": [                   // 行配列、長さは rows、各行は cols 文字
        ".....",                   //   "." = 空セル
        ".....",                   //   "1"〜"7" = ブロック値
        "..1..",                   // 行順は JSON の 0 行目 = 最上段、最後の行 = 最下段
        "..."
      ],
      "nextBlocks": [3, 4, 2],     // 任意。最初に降ってくるブロックのキュー
      "targetBlocks": [             // 任意。クリアに必要な 7 ブロックの位置 (情報用途)
        { "row": 8, "col": 2 }     //   row / col は GameState 座標 (0 = 最上段)
      ]
    }
  ]
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

## 後続 Issue で構築予定

- `#13` GameState 型定義と `initWithState` 実装
- `#14` お題（初期盤面）データ構造と読み込み
- `#15` PIXI.Graphics でボード・ブロック描画
- `#16` 水中物理プロファイル
- `#17` 着水エフェクト
- `#18` ブロック消去・連鎖ロジック (Promise チェーン)
- `#19` 水中爆発エフェクト
- `#20` キーボード・タッチ入力
- `#21` TitleScene / VersusScene
- `#22` 音実装
