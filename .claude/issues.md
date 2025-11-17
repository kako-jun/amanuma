# 既知の問題と解決策

## 🔴 Critical Issues

### ✅ Issue #1: メモリリーク - Textオブジェクトの無限生成 【解決済み】

**問題**
- ファイル: `src/game/MainScene.ts:325-348`
- `drawBlock()`メソッドで毎フレーム新しいTextオブジェクトを作成
- 作成したTextオブジェクトを破棄していない
- 長時間プレイでメモリ使用量が増加し続ける

**実装した解決策**

Textオブジェクトプールパターンを実装：

```typescript
// Textオブジェクトのプールを追加
private textPool: Phaser.GameObjects.Text[]
private textPoolIndex: number

// create()で事前に必要数を作成
const poolSize = ROWS * COLS + 1
for (let i = 0; i < poolSize; i++) {
  const text = this.add.text(0, 0, '', {...})
  text.setVisible(false)
  this.textPool.push(text)
}

// draw()でプールをリセット
this.textPoolIndex = 0
this.textPool.forEach(text => text.setVisible(false))

// drawBlock()でプールから再利用
const text = this.textPool[this.textPoolIndex++]
text.setText(value.toString())
text.setPosition(...)
text.setVisible(true)
```

**解決日**: 2025-11-17
**コミット**: Fix memory leak by implementing text object pooling

---

## 🟡 High Priority Issues

### Issue #2: 連鎖システム未実装

**問題**
- ブロック消去後、新たに合計7になる組み合わせができても自動消去されない
- ユーザー体験的に重要な機能

**解決策**
```typescript
private checkAndClearSevens() {
  let cleared = false
  do {
    cleared = this.checkAndClearOnce()
    if (cleared) {
      this.chainCount++
      this.applyGravity()
      // アニメーション待ち時間を入れる
      await this.delay(300)
    }
  } while (cleared)

  if (this.chainCount > 1) {
    // 連鎖ボーナス加算
    this.score += this.chainCount * 50
  }
  this.chainCount = 0
}
```

**優先度**: 🟡 High
**影響**: ゲームプレイ
**推定作業時間**: 1時間

---

### Issue #3: ネクストブロック表示なし

**問題**
- 次に来るブロックが分からない
- 戦略的なプレイが難しい

**解決策**
- `nextBlock`変数を追加
- 画面右側にネクスト表示エリアを作成
- ブロック生成時に次のブロックも決定

**優先度**: 🟡 High
**影響**: ゲームプレイ、UX
**推定作業時間**: 45分

---

## 🟢 Medium Priority Issues

### Issue #4: ゲームオーバー後の操作不可

**問題**
- ゲームオーバー後、リロードしないと再プレイできない

**解決策**
```typescript
// Rキーでリスタート
if (this.gameOver && Phaser.Input.Keyboard.JustDown(rKey)) {
  this.scene.restart()
}
```

**優先度**: 🟢 Medium
**影響**: UX
**推定作業時間**: 15分

---

### Issue #5: スコアが保存されない

**問題**
- ハイスコアが記録されない

**解決策**
```typescript
// localStorage使用
const highScore = localStorage.getItem('highScore') || 0
if (score > highScore) {
  localStorage.setItem('highScore', score.toString())
}
```

**優先度**: 🟢 Medium
**影響**: UX
**推定作業時間**: 20分

---

## 🔵 Low Priority Issues

### Issue #6: 難易度が固定

**問題**
- ゲームが単調になりやすい

**解決策**
- スコアに応じて落下速度を増加
- レベル表示追加

**優先度**: 🔵 Low
**影響**: ゲームバランス
**推定作業時間**: 30分

---

## パフォーマンス問題

### 毎フレーム全体再描画

**現状**
- `update()`メソッドで毎フレーム`draw()`を呼び出し
- 全ブロックを毎回再描画

**改善案**
- dirty flagパターン導入
- 変更があった部分のみ再描画

**優先度**: 🔵 Low
**影響**: パフォーマンス（現状問題なし）

---

最終更新: 2025-11-17
