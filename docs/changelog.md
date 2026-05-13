# 開発履歴・変更ログ

## Phase 3: PixiJS 移植 + 水中リデザイン (2026-05)

旧 Phaser 版「スリーセブン」を PixiJS v8 ベースの水中落ち物パズルに刷新。
Issue #10 を親に、#11〜#23 / #29 / #31 の連続 PR で実装。

### 環境整備
- React 18 / Phaser 3 / Tailwind CSS 4 を撤去し、PixiJS v8 + Vite + TypeScript の最小構成に (#11)

### 型基盤
- `GameState` / `BlockValue` / `BoardCell` / `FallingBlock` 型と `initWithState` 設計 (#13)
- お題 JSON データ構造 + `PuzzleRotation` ローダー (検証つき、throw せず Result 型) (#14)

### 描画
- `BoardRenderer` で PIXI.Graphics + Text プール (#15)
- DESIGN.md セクション 2 (Block Colors) を 1〜7 にマッピング、Inter フォント
- Canvas 外周に DESIGN.md 準拠の violet border + glow (#29)
- `BeakerFrame` でビーカー silhouette + 水中の青み + 斜光ライティング (#31)

### 物理・ゲームロジック
- 水中物理 (重力 18 / 浮力 6 / 粘性減衰 1.6 row/s²) を semi-implicit Euler で (#16)
- 消去・連鎖 (合計 7、7 は 3 つで消える) を Promise チェーンで (#18)
- Vitest 導入 + board / randomBlocks / ChainRunner のテスト

### エフェクト
- `BubbleParticleSystem` 基盤、`WaterSurface` (sin 波 + 局所波紋 + 光の筋)、`BoardRenderer.shake` (#17)
- 消去時の `clear` バリアント泡 (水面に向けてゆっくり上昇) (#19)

### 入力・シーン
- `KeyboardManager` (←→↓PRM + 1/2/Enter/Esc) + `TouchManager` (画面分割タップ + 下スワイプ) (#20)
- `SceneManager` で「宇宙誌面パン＆ズーム」 cubicInOut tween (#21)
- `TitleScene` / `VersusScene` / `ResultScene` 実装、対戦は両プレイヤー同一お題 + お邪魔ブロック MVP

### 音
- `SoundManager` (WebAudio + HTMLAudioElement)、`MuteButton` 常駐 (#22)
- SFX 7 種 + BGM 4 種のフック整備、`localStorage` でミュート永続化
- アセット未投入でも 404 graceful

### 周辺
- `name-name` の PROJECTS に登録 (#23)
- Phaser 版コード一式は #11 で削除済 (#24 close)

### 統計
- 164 tests passing
- 9 PR (#11, #13–#22 の連続実装) + #29, #31, name-name#232

---

## Phase 2 (Phaser 版): 対戦モード (2025-11-17)

> Phaser 版時代の履歴。`git log main` でコード履歴を参照可能。

### 追加機能
- 横画面レイアウト（800×650px）
- 2つのフィールド左右配置
- P1用操作（WASD）/ P2用操作（Arrow keys）
- 攻撃システム（お邪魔ブロック送信）
- 連鎖攻撃（連鎖数に応じた攻撃量増加）
- 勝敗判定（先に埋まった方が負け）

### 技術的変更
- GameBoardクラス抽出（ロジック共有化）
- VersusScene追加
- TitleSceneにモード選択追加

## Phase 1 (Phaser 版): シングルプレイ (2025-11-17)

### 基本システム
- テトリスからスリーセブンへの基本変換
- 5列×10行のフィールド
- 1-7の数字ブロック
- 合計7で消去するロジック
- 7の特別ルール（3つ必要）

### 追加機能
- 連鎖システム（連鎖ボーナス付き）
- ネクストブロック表示
- リスタート機能（Rキー）
- ハイスコア記録・表示（localStorage）
- 一時停止機能（Pキー）
- レベルシステム（難易度自動調整）
- タイトル画面（モード選択対応）
- 数字の出現確率調整（7を少なめに）

### バグ修正
- メモリリーク修正（Textオブジェクトプール実装）

## 解決済みの問題 (Phaser 版)

| Issue | 問題 | 解決策 |
|-------|------|--------|
| #1 | Textオブジェクト無限生成 | オブジェクトプール |
| #2 | 連鎖未実装 | 再帰チェック+遅延 |
| #3 | ネクスト表示なし | nextBlock変数追加 |
| #4 | リスタート不可 | scene.restart() |
| #5 | スコア保存なし | localStorage使用 |

## Phase 3 以降の予定 (未着手)

- 実音アセット制作 (kako 声 / シンセ録音)
- お題追加 (現状 3 件のみ)
- 対戦のお邪魔ブロックバランス調整
- 対戦の P2 入力 (CPU AI または ネット対戦)
- ShaderFilter による水の屈折表現
- 連鎖カウント・スコアの HUD 表示
