# ビルド・公開・オフライン対応（PWA / GitHub Pages / Android APK）

CLAUDE.md から分離した正本（2026-07-06〜）。ビルド手順・公開経路を変更するときはこのファイルを更新すること。
手順の実行は `/build-release` スキル（`.claude/skills/build-release/`）でも呼び出せる。

## PWA（Service Worker）

- `sw.js` が全公開ファイルをプリキャッシュ。**`sw.js` は自動生成＝直接編集しない**。
- **アセット・ページを追加/変更したら `node scripts/build-sw.mjs` で再生成**（キャッシュ版数が中身ハッシュで変わる）。
- 登録は index.html 末尾（Capacitor 内では `window.Capacitor` 検出でスキップ）。

## GitHub Pages（公開サイト）

- リポジトリは public で、master へ push すると
  https://show-17.github.io/kids-coding-game/ に自動公開される。
- iPhone/iPad はここから「ホーム画面に追加」でPWAとして利用。
- **公開対象になるため秘密情報・権利未クリア素材は絶対にコミットしない。**

## Androidアプリ（Capacitor）

- 設定：`capacitor.config.json`＋`android/`。appId は `jp.show17.asobinomori`。
- ビルド手順（要：JDK 21・Android SDK）：
  1. `node scripts/build-www.mjs` で公開ファイルだけを `www/` に集める（BGM mp3 も同梱）
  2. `npx cap sync android`
  3. `cd android && ./gradlew assembleRelease` で署名済みAPK
     （→ `android/app/build/outputs/apk/release/app-release.apk`）
- 署名鍵はリポジトリ外 `~/.android-keys/`（`asobinomori.jks`＋`asobinomori.keystore.properties`。
  **紛失すると同一署名で更新できなくなる**）。
- APK は INTERNET 権限なし＝完全オフライン（uta あそび用の `RECORD_AUDIO` のみ宣言）。
- 画面の向きは固定しない（ゲームは横画面2カラム対応のため。webmanifest も `orientation: any`）。
- BGM はアプリ内（`window.Capacitor` あり）ではタップを待たず即時再生（Capacitor の WebView は
  自動再生許可済み。bgm.js の `play()` が分岐）。ブラウザは従来どおり初回タップで開始。
- **新ゲーム追加時は www/ 再構築 → cap sync → APK 再ビルドも忘れずに。**
- アプリのアイコン/スプラッシュは `assets/icons/icon.svg` から生成
  （`resources/` に sharp で書き出し → `npx @capacitor/assets generate --android`）。

## テスト（ヘッドレス・スモーク）

- `node scripts/test-games.js` — `google-chrome-stable` + puppeteer-core で各ページの
  console error / 例外 / 横スクロールはみ出しを検査。
- 新ゲーム追加時は同スクリプトの `PAGES` 配列にも足す。

## scripts/ 一覧

| スクリプト | 用途 |
|---|---|
| `test-games.js` | ヘッドレス・スモークテスト（console error/例外/はみ出し検査） |
| `build-sw.mjs` | sw.js 生成（アセット追加・変更時に実行） |
| `build-www.mjs` | Capacitor 用 www/ 組み立て（APKビルド前に実行） |
| `gen-placeholder-art.mjs` | 新ゲーム用プレースホルダー画像の生成（bg/banner/card をヘッドレス Chrome で描画。本番の生成画像が来たら同名ファイルを上書きするだけ） |
