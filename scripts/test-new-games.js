/* ============================================================
   test-new-games.js — めいろ・いろまぜ・たいこ の あそびとおしテスト
   ------------------------------------------------------------
   各ゲームの テスト用フック（window.__meiro / __iromaze / __taiko）で
   「ただしく あそぶ」操作を再現し、クリア→結果モーダルまで到達するかを見る。
   - めいろ：全12レベルを 360x640 で生成・解く（ゴール→モーダル）。盤とボタンが画面内か。
             ジェネレータの検証（各レベル30こ：とける／とびらを とおらずに ゴールできない／ほしの数）
   - いろまぜ：全12ステージで レシピどおりに しずくを落として せいかい。比の判定（2:2＝1:1）
   - たいこ：判定関数の単体チェック＋ステージ1（5もん）を とおしで クリア
   いずれも console.error / pageerror ゼロ・横スクロールなし。

   実行（test-games.js と同じ）:
     python3 -m http.server 9123      # リポジトリ直下
     node scripts/test-new-games.js
   ============================================================ */
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:9123';
const wait = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function check(ok, msg) { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fails++; }

async function open(browser, path, vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'networkidle2' });
  await wait(700);
  return { page, errors };
}
const overflowX = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const modalShown = page => page.evaluate(() => { const o = document.getElementById('ovl'); return !!o && !o.hidden; });
const modalFits = page => page.evaluate(() => {
  const d = document.querySelector('#ovl .dlg'); if (!d) return false;
  const r = d.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1;
});

async function meiro(browser) {
  console.log('めいろ');
  const vp = { width: 360, height: 640, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
  const { page, errors } = await open(browser, '/games/meiro.html', vp);
  check(await page.evaluate(() => window.__meiro.verifyAll(30)) === 0, 'ジェネレータ：全レベル×30こ とける（かぎ・とびら・ほし）');
  for (let lv = 0; lv < 12; lv++) {
    await page.evaluate(n => window.__meiro.load(n), lv);
    await wait(150);
    const lay = await page.evaluate(() => {
      const b = document.getElementById('board').getBoundingClientRect();
      const c = document.querySelector('.controls').getBoundingClientRect();
      return { boardOk: b.left >= 0 && b.right <= innerWidth, ctrlBottom: Math.round(c.bottom), cell: Math.round(b.width / window.__meiro.state().c) };
    });
    // 360x640：盤は よこに おさまり、マスは 40px 以上（ゆびで なぞれる）
    check(lay.boardOk && lay.cell >= 40, `L${lv + 1} 盤が画面内・マス ${lay.cell}px・ボタン下端 ${lay.ctrlBottom}`);
    const route = await page.evaluate(() => window.__meiro.solve());
    for (const d of route) { await page.evaluate(d => window.__meiro.step(d), d); }
    await wait(1400);
    const st = await page.evaluate(() => window.__meiro.state());
    check(st.finished && await modalShown(page) && await modalFits(page), `L${lv + 1} ゴール→結果（${route.length}ほ${st.total ? '' : ''}）`);
    await page.evaluate(() => { const o = document.getElementById('ovl'); o.hidden = true; o.classList.remove('show'); });
  }
  check(await page.evaluate(() => (JSON.parse(localStorage.getItem('asobinomori:meiro') || '{}').cleared)) === 12, 'cleared が 12');
  check(await overflowX(page) <= 2, '横スクロールなし');
  check(!errors.length, 'エラーなし ' + errors.join(' | '));
  await page.close();
}

async function iromaze(browser) {
  console.log('いろまぜ');
  const vp = { width: 360, height: 640, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
  const { page, errors } = await open(browser, '/games/iromaze.html', vp);
  const H = '__iromaze';
  check(await page.evaluate(h => window[h].isMatch({ r: 2, y: 2, b: 0, w: 0 }, { r: 1, y: 1, b: 0, w: 0 }), H), '比：あか2きいろ2 ＝ あか1きいろ1');
  check(!await page.evaluate(h => window[h].isMatch({ r: 1, y: 2, b: 0, w: 0 }, { r: 2, y: 1, b: 0, w: 0 }), H), '比：1:2 ≠ 2:1');
  for (let st = 1; st <= 12; st++) {
    await page.evaluate((h, n) => window[h].load(n), H, st);
    await wait(150);
    const rc = await page.evaluate((h, n) => window[h].recipe(n), H, st);
    for (const k of ['r', 'y', 'b', 'w']) for (let i = 0; i < rc[k]; i++) await page.evaluate((h, k) => window[h].drop(k), H, k);
    await wait(2600);
    const s = await page.evaluate(h => window[h].state(), H);
    check(s.won && await modalShown(page) && await modalFits(page), `ステージ${st} せいかい→結果`);
    await page.evaluate(() => { const o = document.getElementById('ovl'); o.hidden = true; o.classList.remove('show'); });
  }
  check(await page.evaluate(() => (JSON.parse(localStorage.getItem('asobinomori:iromaze') || '{}').cleared)) === 12, 'cleared が 12');
  check(await overflowX(page) <= 2, '横スクロールなし');
  check(!errors.length, 'エラーなし ' + errors.join(' | '));
  await page.close();
}

async function taiko(browser) {
  console.log('たいこ');
  const vp = { width: 360, height: 640, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
  const { page, errors } = await open(browser, '/games/taiko.html', vp);
  const j = await page.evaluate(() => {
    const J = window.__taiko.judge, P = [0, 1, 2, 2.5, 3], K = ['d', 'd', 'd', 'd', 'd'];
    const at = (m, jit) => P.map((b, i) => 1000 + (b + (jit ? jit[i] : 0)) * 650 * m);
    return {
      exact: J(P, K, at(1), K, 650), slow: J(P, K, at(1.4), K, 650),
      off: J(P, K, at(1, [0, 0.45, 0, 0, 0]), K, 650), short: J(P, K, at(1).slice(0, 4), K.slice(0, 4), 650),
      kind: J(P, K, at(1), ['d', 'k', 'd', 'd', 'd'], 650),
    };
  });
  check(j.exact.ok && j.exact.stars === 3, '判定：ぴったり＝ほし3');
  check(j.slow.ok, '判定：ゆっくり（1.4ばい）でも ok');
  check(!j.off.ok && !j.short.ok && !j.kind.ok, '判定：ずれ・かずぶそく・どん/かっ ちがい は ×');
  await page.evaluate(() => window.__taiko.start());
  for (let q = 0; q < 5; q++) {
    let t0 = Date.now();
    while (Date.now() - t0 < 15000) { if (await page.evaluate(() => window.__taiko.state().phase === 'child' && window.__taiko.state().accept)) break; await wait(150); }
    check(await page.evaluate(() => window.__taiko.solve(1)), `もん${q + 1} こどもの ばん→たたく`);
    await wait(400);
  }
  let t0 = Date.now();
  while (Date.now() - t0 < 8000 && !await modalShown(page)) await wait(200);
  check(await modalShown(page) && await modalFits(page), 'ステージ1 クリア→結果');
  check(await page.evaluate(() => (JSON.parse(localStorage.getItem('asobinomori:taiko') || '{}').cleared)) >= 1, 'cleared ≥ 1');
  check(await overflowX(page) <= 2, '横スクロールなし');
  check(!errors.length, 'エラーなし ' + errors.join(' | '));
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  try { await meiro(browser); await iromaze(browser); await taiko(browser); }
  catch (e) { console.log('  ✗ 例外: ' + e.message); fails++; }
  await browser.close();
  console.log(fails ? `\n=== ${fails} FAIL ===` : '\n=== ALL PASS ===');
  process.exit(fails ? 1 : 0);
})();
