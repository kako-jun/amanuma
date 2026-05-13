# Sound assets

amanuma の SFX / BGM 配置先 (Issue #22)。

`SoundManager` は `/sounds/{key}.mp3` を参照する。
ここに以下のファイル名で **mp3** を置けば、リビルド不要で自動的に再生される。

ファイルが無くても `SoundManager` は黙って silent (404 警告のみ) になる設計なので、
**実音は揃え次第ここにコミットする**。

## 期待されるファイル名

### SFX (短い効果音)

| ファイル名           | 用途                                              |
| -------------------- | ------------------------------------------------- |
| `block-land.mp3`     | ブロック着水。`PlayerBoard.emitLandEffect` で発火 |
| `block-spawn.mp3`    | 新ブロックがスポーン (= 水面に投入される) 瞬間    |
| `block-clear.mp3`    | 連鎖 1 段ぶんの消去音                             |
| `chain-up.mp3`       | 2 連鎖目以降に重ねる「盛り上げ」音                |
| `puzzle-cleared.mp3` | クリア (残 7 が 0) / 対戦勝利時                   |
| `game-over.mp3`      | ゲームオーバー / 対戦敗北時                       |
| `ui-select.mp3`      | タイトル・リザルトでのボタン選択音                |

### BGM (ループ再生)

| ファイル名       | シーン | loop         |
| ---------------- | ------ | ------------ |
| `bgm-title.mp3`  | Title  | ✓            |
| `bgm-game.mp3`   | Single | ✓            |
| `bgm-versus.mp3` | Versus | ✓            |
| `bgm-result.mp3` | Result | ✗ (1 度きり) |

BGM の volume は既定 0.4 (SFX 0.7)。`SoundManagerOptions` で調整可。

## 推奨スペック

- フォーマット: **mp3 320kbps** (互換性最優先)
- サンプリング: 44.1 kHz
- 長さ:
  - SFX は 0.5 〜 2 秒以内、フェードイン/アウト不要
  - BGM は 30 秒 〜 2 分でループ点を綺麗に
- ピーク: -3 dBFS 程度 (mp3 化で歪まないマージン)

## 制作メモ (将来の自分へ)

- `block-land` と `block-spawn` は **似た系統で違う高さ** にする
  (連続して鳴っても疲れない)
- `chain-up` は単音ではなく「コードが 1 段上がる」イメージで
  (連鎖 2,3,4... と上がっていく時に重ねるだけで盛り上がる)
- `puzzle-cleared` と `game-over` は明確に対比 (上行 vs 下行)
- BGM はすべて水中残響系。`bgm-versus` だけはテンポを少し上げる

## アセット未配置時の挙動

`new Audio(src)` が `error` イベントを発火するだけで、JS は落ちない。
ブラウザコンソールに 404 警告が並ぶが、ゲーム進行には影響しない。
