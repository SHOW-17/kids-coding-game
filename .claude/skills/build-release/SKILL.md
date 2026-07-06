---
name: build-release
description: >-
  「あそびのもり」の公開・リリース作業（sw.js 再生成→ヘッドレステスト→GitHub Pages 公開→
  Android APK ビルド）。ユーザーが「公開して」「リリースして」「APK作って」「ビルドして」
  等と言ったとき、または /build-release で使用。
user-invocable: true
allowed-tools: Bash, Read, Edit, Grep, Glob
---

# ビルド＆リリーススキル

詳細な背景・注意事項は `docs/build-release.md` を参照。

## 手順

1. `node scripts/build-sw.mjs` — sw.js を再生成（アセット・ページを追加/変更した場合は必須。
   sw.js は自動生成なので直接編集しない）
2. `node scripts/test-games.js` — ヘッドレス・スモークテスト。エラーがあれば**公開せず中断**して報告
3. GitHub Pages 公開 = master へ push（公開リポジトリのため、秘密情報・権利未クリア素材が
   含まれていないか push 前に確認する）。作業はブランチ→PR→マージの通常フロー（/ship・/merge）で行う
4. APK 更新を求められた場合のみ：
   - `node scripts/build-www.mjs`
   - `npx cap sync android`
   - `cd android && ./gradlew assembleRelease`
   - 生成物: `android/app/build/outputs/apk/release/app-release.apk`
   - 署名鍵は `~/.android-keys/`（リポジトリ外）。鍵が見つからない場合は**中断してユーザーに確認**

## 注意

- www/・dist/ の中身は生成物。手で編集しない
- APK ビルドには JDK 21 と Android SDK が必要。無ければその旨を報告して中断
