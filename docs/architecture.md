# amanuma - 技術アーキテクチャ

> ⚠️ Issue #11 (Phaser → PixiJS 移植) 完了時点の構成。
> ゲームデザインも Issue #10 で「水中落ち物パズル / お題型」に刷新予定。
> シーン・ロジック構造は後続 Issue (#13〜#21) で再構築される。

## 技術スタック

- **言語**: TypeScript 5
- **ビルド**: Vite 6
- **ゲームエンジン**: PixiJS v8
- **スタイル**: vanilla CSS (`src/index.css`)

## ディレクトリ構造 (現時点・最小ブート)

```
src/
├── main.ts        # PIXI.Application ブートストラップ
├── index.css      # 最小リセット + body 背景
└── vite-env.d.ts  # Vite クライアント型
index.html        # <div id="root"></div> に canvas をマウント
```

## 起動シーケンス

`src/main.ts`:

1. `Application` を生成し `await app.init({...})` で初期化
   - `width: 800, height: 650` (DESIGN.md の Game Canvas 仕様)
   - `backgroundColor: 0x0f0f1a` (DESIGN.md `bg` トークン)
   - `antialias: true`
   - `resolution: window.devicePixelRatio`, `autoDensity: true`
2. `app.canvas` を `#app` または `#root` 要素へ append
3. マウント先が見つからない場合は Error を throw

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
