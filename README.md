# amanuma

PixiJS v8 + Vite + TypeScript で作成する水中落ち物パズル (お題型) のプロジェクト。

## 概要

ぷよぷよ系の流れを汲んだ落ち物パズルを、水中をモチーフにしたビジュアル + お題型のルール
で再構築するプロジェクトです。現在は環境整備フェーズで、ゲームロジックは別 Issue で
順次実装します。

## 技術スタック

- **レンダリング**: PixiJS v8
- **ビルド/開発サーバ**: Vite 6
- **言語**: TypeScript 5
- **デザイン**: vanilla CSS (HTML シェル) + PixiJS canvas
- **開発ツール**: Prettier、ESLint、Husky、lint-staged
- **デプロイ**: GitHub Pages (自動)

## 開発

### 必要な環境

- Node.js 20 以上
- npm

### セットアップ

```bash
npm install
```

### 開発サーバ

```bash
npm run dev
```

### 型チェック + ビルド

```bash
npm run build
```

### プレビュー

```bash
npm run preview
```

## ライセンス

MIT

## 作者

kako-jun
