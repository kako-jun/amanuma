# amanuma

ビーカーに溜めた水の中に落ちてくるブロックを使って遊ぶ、PixiJS v8 + Vite + TypeScript 製の水中落ち物パズル。

Live: <https://amanuma.pages.dev/> (Cloudflare Pages)

## 特徴

- **水中の物理**: 浮力・粘性減衰でブロックが「ふわっと」沈む semi-implicit Euler
- **ホワッと泡になる消去**: 合計 7 で消えたブロックが半透明の気泡数個になり、水面に向けてゆっくり上昇
- **着水の演出**: 着水時にセル横揺れ + 水面波紋 + 泡。Next 投入時も水面で「たぷん」
- **ビーカー形状 + 斜光ライティング**: 口広・底細の台形シルエットに、左上からの光源を反映 (ブロック上面ハイライト、下面影、ガラスの反射ライン、水面の光の筋)
- **シーン管理**: 「宇宙誌面パン＆ズーム」演出でタイトル → シングル/対戦 → リザルトを cubicInOut tween で遷移
- **タッチ + キーボード**: バーチャルパッドなしの画面分割タップ + 下スワイプ、キーボード ←→↓PRM、対戦は両プレイヤー同一お題

## 操作

| キー | 動作 |
|---|---|
| ← / → | 左右移動 |
| ↓ | 高速落下 |
| P | 一時停止トグル |
| R | リスタート |
| M | ミュート切替 |
| 1 / 2 | タイトル画面でシングル / 対戦選択 |
| Enter / Space | 確定 (タイトル / Result) |
| Esc | キャンセル (タイトルへ戻る) |

タッチ:

| 操作 | 動作 |
|---|---|
| canvas 左半分タップ | 左移動 |
| canvas 右半分タップ | 右移動 |
| 下スワイプ (50px+) | 高速落下 |

## ルール (お題型クリア)

- 5 列 × 10 行のビーカー
- 縦または横に連続したブロックの合計が **7** になると消える (例: 2+5, 3+4, 1+2+4)
- **7 のブロックは 3 つ以上連続** しないと消えない
- 消去後、上のブロックが落下 → 再判定で連鎖
- お題は積み上がった盤面からスタート (1・2 主体 + ターゲット 7)
- **ターゲットの 7 をすべて消す** とクリア (`status='cleared'`)
- 対戦モードは両者同一お題、消去 N 個で相手に `floor(N/3)` 個のお邪魔ブロックを送信、先にクリアした方が勝ち
- 対戦モードは現状 **P1 のみ操作可** (P2 はキー未割当)。P2 は自動落下で沈み続けるため、操作しないと最終的に P1 の不戦勝になる MVP 仕様 (CPU AI / ネット対戦は今後の課題)

## 開発

### 必要な環境
- Node.js 22 以上
- npm

### セットアップ
```bash
npm install
```

### コマンド
```bash
npm run dev          # 開発サーバ (http://localhost:3000)
npm run build        # tsc + vite build
npm run preview      # ビルド結果プレビュー
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Vitest (159 tests)
```

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | 技術設計 (PixiJS 構成、シーン、物理、エフェクト、ビーカー、音) |
| [docs/rules.md](docs/rules.md) | ゲームルール |
| [docs/changelog.md](docs/changelog.md) | 開発履歴 |
| [DESIGN.md](DESIGN.md) | UI デザインシステム (カラーパレット、Inter フォント、グラスボタン) |

## サウンドアセット

`public/sounds/` 配下に以下のファイルを置くと自動で鳴ります (詳細は [public/sounds/README.md](public/sounds/README.md)):

- SFX: block-land / block-spawn / block-clear / chain-up / puzzle-cleared / game-over / ui-select
- BGM: bgm-title / bgm-game / bgm-versus / bgm-result

未投入でも 404 警告のみで全機能動作します。

## ライセンス

MIT

## 作者

kako-jun
