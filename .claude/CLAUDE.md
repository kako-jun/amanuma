# amanuma

> 旧称「スリーセブン」(幽遊白書 天沼月人のパズルゲーム再現)。
> Issue #10 で水中落ち物パズル + お題型クリアにゲームデザインを刷新中。

## 技術スタック

- TypeScript 5 + Vite 6
- PixiJS v8 (ゲーム描画)

## クイックスタート

```bash
npm install
npm run dev    # http://localhost:3000
```

## ドキュメント

| ファイル | 内容 |
|---------|------|
| [docs/rules.md](../docs/rules.md) | ゲームルール (Phaser 版時代の旧仕様。新仕様は Issue #10 で刷新予定) |
| [docs/architecture.md](../docs/architecture.md) | 技術設計 (PixiJS 移行後) |
| [docs/changelog.md](../docs/changelog.md) | 開発履歴・変更ログ |
| [DESIGN.md](../DESIGN.md) | UI デザインシステム (色・タイポグラフィ) |

## 現在の状態

- 〜Phase 2 (Phaser 版): シングル + 対戦 完成済、`git log main` で履歴参照
- Issue #11: Phaser → PixiJS v8 移植 (環境整備のみ完了。シーン未実装)
- 後続: Issue #13〜#22 でシーン・ロジック・音・タッチ入力を再構築

## デザインシステム

UIの生成・修正時は `DESIGN.md` に定義されたデザインシステムに従うこと。
定義外の色・フォント・スペーシングを勝手に使わない。
