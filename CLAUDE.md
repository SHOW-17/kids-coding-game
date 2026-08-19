# kids-coding-game ＝「あそびのもり」

小学校1年生（6〜7歳）が、**文字を読まずに**遊びながら賢くなれる、こども向けのミニゲーム集（アーケード）。
オープニング（`index.html`）でゲームを選び、それぞれの遊びに入る。以降、知育になるゲームを増やしていく。

> デザインテーマは「ねんどの森」（ねんど／フェルト質感・マスコットはユニコーン）。
> 視覚言語の定義は **[Design.md](Design.md) が本体**。新画面・新ゲームはまず Design.md に従うこと。
> キャラは `assets/uni/` のユニコーン画像、アイコンは CSS図形で表現し、原則 絵文字を使わない
> （UIの矢印など機能アイコンを除く）。スタイルは各HTMLにインライン（旧 `assets/arcade.css` は廃止）。

## ドキュメント・スキル一覧（詳細はこちらが正本）

- `Design.md` — デザインシステム「ねんどの森」（視覚言語の本体・必読）
- `docs/programming-game.md` — プログラミングの詳細（概念・UNLOCKS・ブロック制限・全19レベル・データ構造・保存キー・拡張アイデア）
- `docs/rewards-system.md` — ごほうびシステム（どんぐり経済・くじ・きせかえ・おへや）
- `docs/game-notes.md` — 各ゲームの実装メモ（落とし穴回避）・ゲーム一覧表・アセット規約
- `docs/build-release.md` — PWA / GitHub Pages / Android APK のビルド・公開手順
- `.claude/skills/new-game/` — 新ゲーム追加の手順（/new-game）
- `.claude/skills/build-release/` — 公開・APKビルドの手順（/build-release）
- `.agents/skills` は `.claude/skills` へのローカル用シンボリックリンク（Codex 等から参照するため）

---

## このプロジェクトの方針（最優先・絶対に守る）

- **とにかくハイクオリティ。** 「個人が作ったと分からない」プロ品質を目指す。見た目・演出・効果音・
  手触り（game feel）まで作り込む。安っぽい・雑な実装はしない。コストや手間より品質を優先する。
- **子供の知育になることが前提。** すべてのゲームは「知的好奇心をくすぐる」「非認知能力（集中・やりぬく力・
  試行錯誤・創造性・空間認識など）を伸ばす」ことを目的にする。あからさまな算数ドリル・国語ドリルにはしない。
- **隙間時間で遊べる。** 1プレイは短く、すぐ結果が出る（即フィードバック）。
- **デザイン素材は画像生成で強化できる。** ロゴ・ゲーム看板・背景・キャラ等は、ユーザー側で LLM 画像生成や
  Claude Design を使って用意できる。CSS/SVG/絵文字でプレースホルダーを作り、画像が来たら差し替える運用。
  「ここは画像があるとプロっぽくなる」箇所は遠慮なくユーザーに依頼してよい。
- 上記は全ゲーム共通。新ゲーム追加時もこの方針を必ず引き継ぐ。

## いちばん大事なこと（設計の前提・絶対に崩さない）

- **対象は小1。** 漢字はまだ読めない前提。**UIテキストはひらがな＋やじるし等のアイコンのみ。漢字を使わない。**
- **文字を読まなくても遊べること。** 命令はアイコン（⬆⬇⬅➡ や 🔁🦘）で表現する。
- **指でタップする前提。** ボタンは大きく（最低44px、できれば64px以上）。
- **失敗してもポジティブに。** ぶつかったら優しく知らせて自動でスタートに戻すだけ。叱らない・減点しない・何度でも試せる。
- **達成感を強く。** クリア時は効果音・アニメ・紙吹雪などで「できた！」を演出。
- **集中力が短い前提。** 1レベルは短く、結果がすぐ見える（即フィードバック）。
- **新要素は段階的に。** 新しい命令はレベルが進むと1つずつ解禁。一度に全部見せない。
- **対象年齢を上げる拡張（関数・マイコマンド等）は、実装前に必ずユーザーに確認する。**

---

## ファイル構成

```
index.html              アーケード選択画面（オープニング／PWAのホーム。実体でありシンボリックリンクではない）
room.html               わたしの おへや（ごほうび画面。→ docs/rewards-system.md）
Design.md               デザインシステム「ねんどの森」（視覚言語の本体・必読）
manifest.webmanifest    PWAマニフェスト
games/
  programming.html      プログラミング（第1弾。→ docs/programming-game.md）
  manekko.html          まねっこ（サイモン）        kimari.html    きまりあそび（パターン推理）
  katachi.html          かたちづくり（タングラム）   pitagora.html  ぴたごら（たまころがし）
  tomare.html           とまれあそび（Go/No-Go）     chigai.html    どこちがう（まちがいさがし）
  sokkuri.html          そっくりわけ（属性分類）     pair.html      ぺあさがし（神経衰弱）
  uta.html              うたあそび（音程トレーニング）
assets/                 画像・音・共通JS（置き場の規約 → docs/game-notes.md §アセット規約）
  audio.js / fx.js / save.js / rewards.js / shell.js / bgm.js   共通基盤（下記）
  uni/ bg/ tokens/ pairs/ items/ gacha/ room/ icons/ fonts/ bgm/
sw.js                   Service Worker（scripts/build-sw.mjs で自動生成。直接編集しない）
capacitor.config.json   Capacitor 設定（appId: jp.show17.asobinomori）
android/                Android ネイティブプロジェクト（→ docs/build-release.md）
scripts/                test-games.js / build-sw.mjs / build-www.mjs / gen-placeholder-art.mjs（→ docs/build-release.md）
```

各ゲームは独立した単一HTMLファイル・バニラJS・ビルド不要。見た目のルール（ねんどカード・カラー・タイポ）は各HTMLにインラインで持つ（共通定義は Design.md）。

## 共通基盤の使い方（新ゲームは Sfx/FX/Save に必ず乗せる＝統一感とプロ品質の担保）

- **Sfx**（audio.js）：`Sfx.tap()/pop()/step()/ding()/success()/fanfare()/error()/whoosh()/sparkle()/note(freq)`。操作ごとに必ず鳴らす。
- **FX**（fx.js）：`FX.confetti()/burst(x,y)/sparkles(x,y)/ring(x,y)/floatEmoji(x,y,text)/shake(el)/celebrate()`＋`FX.acornGain(n,x,y)`。
- **Save**（save.js）：`const save = Save.game('ゲーム名'); save.get(k,def); save.set(k,v); save.bestMax/bestMin(k,v)`。localStorage不可環境はメモリに自動フォールバック。
- 上記 **Sfx/FX/Save の3本＋rewards.js（save.js の後に読む）は新ゲームで必須**。
  ※ **programming.html だけは歴史的経緯で完全自己完結の例外**（bgm.js のみ読む。詳細 → docs/programming-game.md）。新ゲームは self-contained にしないこと。
  ※ **BGM は全画面共通方針**：`bgm.js` を読み込み `Bgm.play('画面名')`。
- **App**（shell.js）は**現状 index.html 専用**。各ゲームは topbar・結果モーダル・トーストをテーマに合わせて
  自前インライン実装する（色・演出のビスポーク性と「基盤が無くても落ちない」自己完結を優先）。
  `App.showModal` は絵文字を渡せる API だが「絵文字を使わない」方針のため使わない。
- 見た目は `:root` で `--accent / --accent-d / --accent-l` をゲームごとに上書きし、背景グラデも合わせる。入場は `.enter .d1..d6`。
- **アーケードのトップ（index.html）が各ゲームの進捗を読む。** 各ゲームは規定キーで保存すること：
  - manekko / kimari / tomare → `set('best', 最高記録)`（kimari は れんぞく さいこう）、その他 → `set('cleared', クリア/正解 数)`
  - programming は独自キー `kuma_prog_save_v1`（互換のため変更しない。index.html はこれも読む）
- **新ゲームを足したら4か所を必ず更新**：index.html の `GAMES` 配列・`doReset` の名前空間リスト・
  rewards.js の `earned()`（wins 集計）・scripts/test-games.js の `PAGES`。手順の全体は /new-game スキル参照。
- **どんぐり（ごほうび通貨）**：クリア時に `wins` を加算し `FX.acornGain()` で「🌰＋N」演出。
  獲得量の式・くじ・きせかえの仕様は docs/rewards-system.md。

## キャラクター・テーマについて（重要）

- **マスコットはユニコーン**（旧・仮のクマ🐻から差し替え済み）。画像は `assets/uni/`。配役は Design.md §2：
  ブルー＝主役（プレイヤー／案内）、グリーン＝はかせ（ヒント・新要素説明）、パープル＝ごほうび（ゴール・クリア祝い）。
- **ゲームロジックはキャラに一切依存させない。** ゴール・壁・プレイヤーは「テーマ用の見た目」。
- 名前・文言も特定キャラに寄せない（「くまさん」等のハードコードを増やさない。ゲーム名は「プログラミング」）。
- **アイコンは原則 絵文字でなく CSS図形**（Design.md §5）。UIの機能アイコン（矢印・ループ等の命令チップ）はこの限りでない。

## 技術メモ（コア）

- フォント: Mochiy Pop One / M PLUS Rounded 1c。**`assets/fonts/` にセルフホスト**。
  **外部CDN（fonts.googleapis.com 等）への参照を復活させないこと**＝オフライン動作の前提。
  新ページは `assets/fonts/fonts.css` を読む（games/ からは `../assets/fonts/fonts.css`）。
- **公開リポジトリ**（GitHub Pages で自動公開）のため、**秘密情報・権利未クリア素材は絶対にコミットしない**。
- オフライン対応（PWA / GitHub Pages / Capacitor APK）のビルド・公開手順は docs/build-release.md（/build-release スキル）。
- 状態管理はメモリ内。永続化は `localStorage`（try/catchでガード済み）。
  Claude.aiのプレビューiframe等では `localStorage` が保存されないことがある（実機ブラウザでは正常動作）。
- キャラは絶対配置のトークン。cellサイズは画面幅から動的計算（スマホ対応）。効果音は Web Audio で生成（try/catchでガード）。
- アセット・ページを追加/変更したら `node scripts/build-sw.mjs` で sw.js を再生成する（直接編集しない）。
