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

### ✅ Issue #2: 連鎖システム未実装 【解決済み】

**問題**
- ブロック消去後、新たに合計7になる組み合わせができても自動消去されない
- ユーザー体験的に重要な機能

**実装した解決策**

```typescript
private checkAndClearSevensWithChain() {
  const cleared = this.checkAndClearSevens()
  if (cleared) {
    this.chainCount++
    // 連鎖表示と連鎖ボーナス
    if (this.chainCount > 1) {
      this.chainText.setText(`${this.chainCount} Chain!`)
      const bonus = this.chainCount * 50
      this.score += bonus
    }
    // 300ms待ってから再チェック
    this.time.delayedCall(300, () => {
      this.checkAndClearSevensWithChain()
    })
  }
}
```

**解決日**: 2025-11-17

---

### ✅ Issue #3: ネクストブロック表示なし 【解決済み】

**問題**
- 次に来るブロックが分からない
- 戦略的なプレイが難しい

**実装した解決策**

- `nextBlock`変数を追加
- 画面右側にネクスト表示エリアを作成（70×70px）
- spawnBlock()でnextBlockを使用し、新しいnextBlockを生成
- drawNextBlock()メソッドで描画

**解決日**: 2025-11-17

---

## 🟢 Medium Priority Issues

### ✅ Issue #4: ゲームオーバー後の操作不可 【解決済み】

**問題**
- ゲームオーバー後、リロードしないと再プレイできない

**実装した解決策**

```typescript
// Rキーを追加
this.rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)

// update()でリスタート処理
if (this.gameOver && Phaser.Input.Keyboard.JustDown(this.rKey)) {
  this.scene.restart()
}

// ゲームオーバーメッセージにリスタート案内を追加
'GAME OVER\n\nPress R to Restart'
```

**解決日**: 2025-11-17

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
