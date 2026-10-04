---
name: new-game
description: >-
  「あそびのもり」に新しいミニゲームを追加する一連の手順（HTML作成→index登録→テスト→ビルド）。
  ユーザーが「新しいゲームを追加して」「○○のゲームを作って」「ゲームを増やして」等と言ったとき、
  または /new-game で使用。
user-invocable: true
---

# 新ゲーム追加スキル

## 前提（必読）

- 方針・設計の前提は `CLAUDE.md`（小1対象・ひらがなのみ・タップ前提・ポジティブ演出）
- 視覚言語は `Design.md`（ねんどの森。絵文字でなくCSS図形、キャラは assets/uni/）
- 各ゲームの落とし穴・アセット規約は `docs/game-notes.md`
- どんぐり獲得の設計は `docs/rewards-system.md`（ベース1・上限3の式に揃える）

## 手順

1. `games/新ゲーム.html` を作る。**必ず `audio.js / fx.js / save.js / rewards.js / bgm.js / talk.js / guard.js` を
   この順で読み込み（Sfx/FX/Save/Rewards/Bgm/Talk/Guard）、ヒント1行に `data-talk` を付ける（読み上げ）。manekko.html を品質・構成の参照基準にする。**
   UIガワ（topbar・結果モーダル・トースト）はテーマに合わせて各HTMLに自前インライン実装
   （shell.js は読み込まない）。`:root` で `--accent / --accent-d / --accent-l` を上書きし、
   入場アニメは `.enter .d1..d6`。フォントは `../assets/fonts/fonts.css`（外部CDN禁止）。
2. 自前 topbar（CSS mask の家アイコン。manekko/kimari 等を踏襲）で `../index.html` へ戻る導線を付ける。
3. 進捗を規定キーで保存する（index.html のカードが読む）：
   `Save.game('ns').set('cleared', n)` または `set('best', n)`。
   クリア時は `wins` 加算＋`FX.acornGain()` で どんぐりゲット演出（式は docs/rewards-system.md）。
4. **5か所を必ず更新**：index.html の `GAMES` 配列（href・名前ひらがな・アクセント色・看板アート・進捗キー）
   ／index.html の `doReset` の名前空間リスト／rewards.js の `earned()`（wins 集計）
   ／rewards.js の `DAILY_ORDER` と `DAILY_NS`（きょうの 3つ のローテーション）
   ／scripts/test-games.js の `PAGES` 配列。
5. プレースホルダー画像が要るなら `node scripts/gen-placeholder-art.mjs`（本番画像が来たら同名上書き）。
6. `node scripts/test-games.js` でヘッドレス確認（console error / 例外 / はみ出しゼロ）。
7. `node scripts/build-sw.mjs` で sw.js を再生成（/build-release スキル参照。APK 更新まで行うならそちらで）。
8. 動作OKなら README（あそべるゲーム表）・docs/game-notes.md（一覧表と実装メモ）を更新。

## 注意

- 出題があるゲームはジェネレータ＋検証をセットで（正解ちょうど1つ・解の存在を必ず確認）
- レベル制のゲームは解の存在チェック（BFS 等）を入れてから追加する
- 新ゲームを self-contained にしない（programming.html だけが歴史的例外）
