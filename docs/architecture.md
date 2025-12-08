# スリーセブン - 技術アーキテクチャ

## 技術スタック

- **フレームワーク**: React 18 + Vite 6
- **言語**: TypeScript 5
- **ゲームエンジン**: Phaser 3.87.0
- **スタイリング**: Tailwind CSS 4

## ディレクトリ構造

```
src/
├── game/
│   ├── config.ts          # Phaser設定
│   ├── constants.ts       # 定数定義
│   ├── GameBoard.ts       # ゲームロジック（共有）
│   ├── TitleScene.ts      # タイトル画面
│   ├── MainScene.ts       # シングルプレイ
│   └── VersusScene.ts     # 対戦モード
├── components/
│   └── PhaserGame.tsx     # React-Phaser連携
├── App.tsx
├── main.tsx
└── index.css
```

## クラス設計

### GameBoard

1人分のゲームロジックをカプセル化したクラス。

```typescript
class GameBoard {
  board: number[][]          // 0=空, 1-7=ブロック
  currentBlock: Block | null // 落下中ブロック
  nextBlock: number          // 次のブロック
  score: number
  level: number
  chainCount: number
  offsetX, offsetY: number   // 描画位置（VS用）
}
```

**主要メソッド:**
- `spawnBlock()` - 新ブロック生成
- `collision(dx, dy)` - 衝突判定
- `merge()` - ブロック固定
- `move(dir)` - 左右移動
- `drop()` - 落下
- `checkAndClearSevens()` - 消去判定
- `applyGravity()` - 重力適用
- `addGarbageBlocks(count)` - お邪魔ブロック追加

### シーン構成

```
TitleScene (モード選択)
    ├── MainScene (シングルプレイ)
    └── VersusScene (対戦モード)
```

## パフォーマンス最適化

### Textオブジェクトプール

毎フレームのText生成によるメモリリークを防止。

```typescript
// 事前に必要数を確保
const poolSize = ROWS * COLS + 1
for (let i = 0; i < poolSize; i++) {
  const text = this.add.text(0, 0, '', {...})
  text.setVisible(false)
  this.textPool.push(text)
}

// 描画時は再利用
const text = this.textPool[this.textPoolIndex++]
text.setText(value.toString())
text.setPosition(x, y)
text.setVisible(true)
```

### 今後の最適化候補

- Dirty flagパターン（変更箇所のみ再描画）
- Web Workersでのロジック処理
- Canvas/WebGL直接操作

## 画面サイズ

- シングルプレイ: 800 x 650px
- 対戦モード: 800 x 650px（左右にフィールド配置）
- ブロックサイズ: 50 x 50px

## データ永続化

- ハイスコア: `localStorage` (`threeseven-highscore`)

## ビルドコマンド

```bash
npm run dev       # 開発サーバー起動
npm run build     # プロダクションビルド
npm run preview   # ビルド結果プレビュー
npm run lint      # ESLintチェック
npm run format    # Prettierフォーマット
```
