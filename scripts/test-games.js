/* ============================================================
   test-games.js — 全ページのヘッドレス・スモークテスト
   ------------------------------------------------------------
   各ページを 412x892 のモバイル相当で開き、以下を検査する：
   - console.error / pageerror（JS例外）
   - 自前アセット（127.0.0.1）のリクエスト失敗（リンク切れ）
   - 横スクロール（はみ出し）
   合わせて /tmp/shot-<name>.png にスクリーンショットを保存。

   実行方法（puppeteer-core と google-chrome-stable が必要）:
     # 1) リポジトリ直下で静的サーバーを起動
     python3 -m http.server 9123
     # 2) 別シェルでテスト実行（puppeteer-core の場所を NODE_PATH で指定）
     NODE_PATH=/path/to/node_modules node scripts/test-games.js

   終了コード：問題ゼロなら 0、1件以上で 1。
   ============================================================ */
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:9123';
const PAGES = [
  { name: 'index',       url: BASE + '/index.html' },
  { name: 'room',        url: BASE + '/room.html' },
  { name: 'programming', url: BASE + '/games/programming.html' },
  { name: 'manekko',     url: BASE + '/games/manekko.html' },
  { name: 'kimari',      url: BASE + '/games/kimari.html' },
  { name: 'katachi',     url: BASE + '/games/katachi.html' },
  { name: 'pitagora',    url: BASE + '/games/pitagora.html' },
  { name: 'tomare',      url: BASE + '/games/tomare.html' },
  { name: 'chigai',      url: BASE + '/games/chigai.html' },
  { name: 'sokkuri',     url: BASE + '/games/sokkuri.html' },
  { name: 'pair',        url: BASE + '/games/pair.html' },
  { name: 'uta',         url: BASE + '/games/uta.html' },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 412, height: 892, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  });

  let totalErrors = 0;
  for (const p of PAGES) {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', r => {
      const u = r.url();
      // フォント等の外部は無視、自前アセットの失敗のみ拾う
      if (u.includes('127.0.0.1')) errors.push('requestfailed: ' + u + ' (' + r.failure().errorText + ')');
    });
    try {
      await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(r => setTimeout(r, 800));
      // 横スクロール（はみ出し）検出
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return de.scrollWidth - de.clientWidth;
      });
      if (overflow > 4) errors.push('overflow-x: ' + overflow + 'px はみ出し');
      await page.screenshot({ path: '/tmp/shot-' + p.name + '.png' });
    } catch (e) {
      errors.push('goto failed: ' + e.message);
    }
    const tag = errors.length ? '✗' : '✓';
    console.log(`${tag} ${p.name}` + (errors.length ? '\n   ' + errors.join('\n   ') : ''));
    totalErrors += errors.length;
    await page.close();
  }
  await browser.close();
  console.log(totalErrors ? `\n=== ${totalErrors} ISSUE(S) ===` : '\n=== ALL CLEAN ===');
  process.exit(totalErrors ? 1 : 0);
})();
