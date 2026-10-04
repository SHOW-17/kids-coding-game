# ごほうびシステム（わたしの おへや＝room.html / assets/rewards.js）

CLAUDE.md から分離した正本（2026-07-06〜）。どんぐり経済・くじ・きせかえ・かぐの仕様を変更するときはこのファイルを更新すること。

全ゲーム横断の継続動機。**ゲーム側のコードには一切手を入れず**、既存セーブから通貨を集計する設計（最小構成）。

## どんぐり（横断通貨）

- **どんぐり＝全ゲームの「せいこう量（`wins`）」の累計**。`assets/rewards.js`（グローバル `Rewards`）が集計。
  **クリア／せいかいするたびに増える（再クリアでも増える）。むずかしいステージほど多くもらえる。** 各ゲームが
  自分の名前空間に `wins`（獲得した どんぐり量の累計）を貯め、`Rewards.earned()` がその合計を返す。**減らない**。
- 旧方式（最高記録・初クリア数ベース）で貯めた分は **`legacyBonus`** として room 名前空間に一度だけ確定し、
  新方式の `wins` 合計に加算（移行してもどんぐりが減らない）。`earned() = legacyBonus + Σ各ゲームの wins + dailyBonus`。
- **programming だけは rewards.js を持たない自己完結**のため、累積を独自キー `kuma_prog_save_v1.wins` に保存し、
  rewards.js は `progWins()` でそれを読む（`cleared` 配列を読むのと同じ要領）。

## どんぐりゲット演出（即フィードバック）

クリアした瞬間に「🌰＋N」を噴き上げる。N＝そのステージの獲得量（難しいほど大きい）。
各ゲームは成功時に `acGain` を計算 → `Save.set('wins', wins+acGain)` → `FX.acornGain(acGain, x, y)`
（fx.js。見た目は `.acorn`＝room.html 準拠の canvas 描画）。

**難易度→獲得量の式**：

- ぴたごら/かたち/プログラミング＝`1 + floor(lvIndex/8)`（8レベルごと段階アップ・最大3）
- まねっこ＝`1 + floor((段-1)/5)`
- きまり＝`ceil(difficulty/2)`（1〜3、問が進むほど）。**一発正解のときだけ**（外した選択肢は除外され、あてずっぽうでは稼げない。2026-10〜）
- どこちがう＝`1 + min(2, floor(stage/8))`
- とまれ＝`min(3, 1 + floor(score/12))`
- そっくり＝**ラウンド完了時にまとめて** `1 + (size か mix なら 1)`（以前は1問ごとで1ラウンド8〜16個出ていた。2026-10〜）
- ぺあ＝`max(1, round-1)`
- うた＝`max(1,floor(score/4))`/`ceil(popped/3)`（0個なら0）/`min(3, done)`

※ **ベースは必ず1（最低でも どんぐり1こ）で即フィードバックを担保し、難易度ボーナスの上限は概ね3に揃える**（ゆるすぎ調整・2026-06）。
※ programming は独自の `acornPop(n)` で同じ演出（詳細は docs/programming-game.md）。

## きょうの 3つ（まいにちの スタンプ・2026-10〜）

- `Rewards.daily()`：その日の おすすめ3本（`DAILY_ORDER` を3つずつローテ＝10日で一巡。同じ日に重複なし）と、
  そのうち「その日はじめて見た `wins`」より増えたもの（`done`）を返す。状態は room 名前空間の `daily`
  （`{date,picks,base,bonus}`）。rewards.js を読んだ時点（＝あそぶ前）に その日の `base` を記録する。
- 3つそろったら `Rewards.claimDaily()` が1日1回だけ **`DAILY_BONUS`（=5）** を room の `dailyBonus` に加算（earned に入る）。
  ホームが紙吹雪＋`FX.acornGain`＋読み上げで くばる。
- **ゲーム中の「スタンプ ゲット！」**：rewards.js が `Save.game` を包み、`set('wins', …)` で今日のおすすめが
  はじめて せいこうした瞬間にトースト（`assets/menu/stamp.webp`）を出す。ゲーム側のコードは変えない
  （programming は独自キーのため、ホームに戻ったときにスタンプが押される）。
- あそんだ日の記録：room の `days`（`{日付: スタンプ数}`、直近14日）。ホームは直近7日を表示。連続日数は数えない。
- 新ゲームを足したら `DAILY_ORDER`（ローテ順）と `DAILY_NS`（ゲーム中トースト対象）にも足す。

## 収支・くじ・図鑑

- **収支**：`balance() = earned() - spent()`。`spent`・所持 `owned`・装備 `wear` は **room 名前空間**
  （`Save.game('room')`）に保存。`index.html` のリセット（ぜんぶ けす）も `room` を含めて消す。
- **どんぐりくじ**：1回 `Rewards.PRICE`（=8。図鑑31種でコンプ総額248）。`Rewards.draw()` が **未所持プールからランダム1つ**（ダブりなし）。
  着せ替え系（hat/face/neck）は当選時に自動装備、かぐ（room）は部屋に並ぶ。全部そろうと `allCollected()`。
- **ごほうび図鑑** = `Rewards.ITEMS`（`{id,cat,name}`）。**見た目は画像アセット**（`assets/items/<id>.webp`。
  ユニコーンと同じつやつやクレイ調の透過WebP）。room.html 側は `itemImg(id)` が `<img>` を返すだけ
  （rewards.js はデータとロジックのみ＝関心の分離）。新ごほうびは ITEMS に1行足し、同名のWebPを
  `assets/items/` に置けば増える（着せ替えなら rewards.js の `PLACE` に重ね位置、かぐなら `FURNI` に配置を1行追加）。
  - アイテム画像（**WebP**。2026-10 に PNG から変換）は透明余白をトリムして使う（床置き家具を下端で揃えるため）。
  - 2026-10 追加の10種（hat_wizard/hat_bunny/hat_chef/face_sun/neck_lei/room_stars/room_clock/room_piano/room_fishbowl/room_blocks）は
    Codex の画像生成で既存アイテムを参照して作成。
  - 未所持スロットは **シルエット**（同じ画像を `brightness(0)`＋薄く）で見せる。
  - **あけていない たまご**：`draw()` は即確定するので、room の `unopened` に当たりIDを保存し、開封（うける）で消す。
    演出前に閉じても、次に おへやを開いたとき たまごから再開する。
  - 見た目は `itemInner(id)` 経由（原則 `<img>`）。**ほっぺ(`face_blush`)だけは画像がいまいちなのでCSS図形**
    （`.blush-css`）で描く例外。画像がいまいちなアイテムは同様に itemInner で個別にCSSへ逃がせる。

## アバター・おへや

- **アバター＝自分のユニコーン**（`assets/uni/blue_standing.webp`）に着せ替え画像を絶対配置で重ねる方式。
  重ね位置の**初期値**は rewards.js の `Rewards.PLACE`（`{cx,cy,w,wrap}`＝ユニコーン画像に対する%で中心位置・幅）。
  **ホーム（index.html）のヒーローも同じ表で きせかえ中の すがたを描く**（タップで おへやへ）。
  新キャラは作らずマスコットを流用＝世界観を崩さない。重ね順は くび→かお→あたま。
  ユニコーン＋着せ替えは共通ラッパー `.bob` に入れて一緒にふわふわ上下させる（影 `.pad` は外＝固定）。
- **ドラッグで自由配置**：きせかえ（`.acc`）も かぐ（`.furni`）も Pointer Events でつかんで動かせる。
  着せ替えの基準は `.bob`、家具の基準は `#room`。動かした座標（中心%）は `Save.game('room').set('pos', {<id>:{x,y}})`
  に保存し、`placeStyle`/`furniStyle` が **カスタム位置があればそれを、無ければ `PLACE`/`FURNI` の初期値**を使う。
  ドラッグ中は `.bob` の bob を止めて座標を安定させる。`index.html` のリセットは `pos` も含めて消える。
  「ならびを もとに もどす」ボタン（動かしたものがあるときだけ表示）で `pos` を空にする。かぐのスロットをタップすると部屋の その かぐが はねる。
- **おへや背景**＝`assets/room/room_bg.webp`（家具なしの空っぽの部屋）。家具は手前に重ねる。
  どんぐり通貨アイコンだけは従来どおり CSS図形（`.acorn`）。

## index 連携・演出

- **index 連携**：ホームに「わたしの おへや」入口。`Rewards.balance()` を表示し、`Rewards.canDraw()` なら
  「！」バッジ。index も `rewards.js` を読み込む（save.js の後）。
- **文字を読ませない**：くじは どんぐりガチャマシン（`assets/gacha/machine.webp`）が回り、虹色のたまご
  （`egg_closed`→タップで`egg_open`）が割れてごほうびが飛び出す演出＋紙吹雪＋効果音だけで伝わる。
- room.html は新ゲームと同じく `audio.js / fx.js / save.js`（＋ `rewards.js` / `bgm.js`）を読み込み、UIは自前インライン。
