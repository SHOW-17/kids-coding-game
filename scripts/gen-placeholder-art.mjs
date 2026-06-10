/* ============================================================
   gen-placeholder-art.mjs — 新ゲーム用プレースホルダー画像の生成
   ------------------------------------------------------------
   ユーザーが本番画像（LLM画像生成）を用意するまでのつなぎとして、
   ねんど調の bg / banner / card をヘッドレスChromeで描画して書き出す。
   本番画像が来たら同名ファイルを上書きするだけ（コードは変えない）。

   実行: node scripts/gen-placeholder-art.mjs
   出力: assets/bg/<id>.webp, assets/menu/banner_<id>.webp, assets/menu/card_<id>.webp
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9171;

const GAMES = [
  { id: 'tomare',  name: 'とまれあそび', ac: '#e8567c', acd: '#d13b64', soft: '#ffdce7', sky: '#ffeef3', uni: 'assets/uni/blue_wave.png' },
  { id: 'chigai',  name: 'どこちがう',   ac: '#2cb1a0', acd: '#1f9183', soft: '#d3f3ec', sky: '#e9faf6', uni: 'assets/uni/green_thinking.png' },
  { id: 'sokkuri', name: 'そっくりわけ', ac: '#c95fc2', acd: '#a844a1', soft: '#f7ddf5', sky: '#fcf0fb', uni: 'assets/uni/blue_standing.png' },
  { id: 'pair',    name: 'ぺあさがし',   ac: '#6577e0', acd: '#4a5cc4', soft: '#e1e5fb', sky: '#eef0fc', uni: 'assets/uni/purple_face.png' },
  { id: 'uta',     name: 'うたあそび',   ac: '#ff7e62', acd: '#e85c3e', soft: '#ffe2da', sky: '#fff1ec', uni: 'assets/uni/purple_wave.png' },
];

const MIME = { html: 'text/html', css: 'text/css', woff2: 'font/woff2', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', js: 'text/javascript' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).slice(1)] || 'application/octet-stream' });
    res.end(data);
  });
});

const head = `<base href="http://127.0.0.1:${PORT}/">
<link href="assets/fonts/fonts.css" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}</style>`;

/* 縦長シーン背景：空＋下1/3の丘（中央は余白＝UIが乗る低コントラスト） */
function bgHtml(g) {
  return `<!DOCTYPE html><html><head>${head}<style>
  body{width:512px;height:768px;overflow:hidden;position:relative;
    background:linear-gradient(180deg,${g.sky} 0%,#fffaf0 46%,#fff6e7 62%);}
  .sun{position:absolute;top:7%;right:14%;width:90px;height:90px;border-radius:50%;
    background:radial-gradient(circle at 38% 32%,#fff8e6,#ffe9b8 70%,transparent 72%);opacity:.85;filter:blur(1px);}
  .cloud{position:absolute;background:#ffffffd9;border-radius:999px;filter:blur(1px);}
  .hill{position:absolute;border-radius:50%;}
  .h1{left:-30%;bottom:-26%;width:110%;height:52%;background:${g.soft};opacity:.95;}
  .h2{right:-34%;bottom:-30%;width:115%;height:55%;background:color-mix(in oklab,${g.ac} 26%,#fff3dd);}
  .h3{left:-12%;bottom:-38%;width:140%;height:56%;background:color-mix(in oklab,${g.ac} 14%,#fff8ea);}
  .tree{position:absolute;bottom:26%;width:46px;height:60px;}
  .tree .top{position:absolute;top:0;left:50%;transform:translateX(-50%);width:46px;height:46px;border-radius:50%;
    background:color-mix(in oklab,${g.ac} 42%,#e7f3d9);box-shadow:inset 0 4px 0 #ffffff66, inset 0 -6px 8px #00000014;}
  .tree .trunk{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:9px;height:20px;border-radius:5px;background:#c89a64;}
  </style></head><body>
    <div class="sun"></div>
    <div class="cloud" style="top:12%;left:10%;width:120px;height:34px;"></div>
    <div class="cloud" style="top:22%;right:6%;width:90px;height:26px;"></div>
    <div class="hill h3"></div><div class="hill h2"></div><div class="hill h1"></div>
    <div class="tree" style="left:9%"><span class="top"></span><span class="trunk"></span></div>
    <div class="tree" style="right:7%;bottom:24%;transform:scale(.8)"><span class="top"></span><span class="trunk"></span></div>
  </body></html>`;
}

/* 看板：ねんどリボンに白抜きのゲーム名（透過） */
function bannerHtml(g) {
  return `<!DOCTYPE html><html><head>${head}<style>
  body{background:transparent;display:flex;align-items:flex-start;justify-content:flex-start;padding:14px;}
  .b{font-family:'Mochiy Pop One';font-size:46px;color:#fff;letter-spacing:1px;
    background:linear-gradient(180deg,${g.ac},${g.acd});padding:14px 34px;border-radius:26px;
    text-shadow:0 3px 0 ${g.acd};
    box-shadow:0 8px 0 color-mix(in oklab,${g.acd} 80%,#000), inset 0 4px 0 #ffffff70, inset 0 -8px 12px #00000022;}
  </style></head><body><div class="b" id="t">${g.name}</div></body></html>`;
}

/* カード絵（4:3）：ねんどの丘＋ユニコーン＋テーマ色モチーフ */
function cardHtml(g) {
  return `<!DOCTYPE html><html><head>${head}<style>
  body{width:800px;height:600px;overflow:hidden;position:relative;
    background:linear-gradient(180deg,${g.sky},#fff7e9 70%);}
  .hill{position:absolute;left:-15%;bottom:-42%;width:130%;height:80%;border-radius:50%;
    background:color-mix(in oklab,${g.ac} 28%,#fff3dd);}
  .hill2{position:absolute;right:-30%;bottom:-50%;width:120%;height:80%;border-radius:50%;background:${g.soft};}
  .blob{position:absolute;border-radius:50%;background:linear-gradient(180deg,${g.ac},${g.acd});
    box-shadow:inset 0 8px 0 #ffffff55, inset 0 -14px 18px #00000022, 0 18px 24px -12px #00000044;}
  .star{position:absolute;background:#ffd23f;
    clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);
    filter:drop-shadow(0 6px 4px #00000022);}
  img.uni{position:absolute;left:50%;bottom:30px;transform:translateX(-50%);height:380px;
    filter:drop-shadow(0 18px 14px #00000033);}
  .pad{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);width:300px;height:46px;border-radius:50%;
    background:#00000022;filter:blur(10px);}
  </style></head><body>
    <div class="hill2"></div><div class="hill"></div>
    <div class="blob" style="left:60px;top:70px;width:110px;height:110px;"></div>
    <div class="blob" style="right:80px;top:150px;width:70px;height:70px;opacity:.85"></div>
    <div class="star" style="left:200px;top:60px;width:54px;height:54px;transform:rotate(-12deg)"></div>
    <div class="star" style="right:190px;top:60px;width:38px;height:38px;transform:rotate(14deg)"></div>
    <div class="pad"></div>
    <img class="uni" src="${g.uni}">
  </body></html>`;
}

await new Promise(r => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

async function shot(html, vp, file, opts = {}) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 150));
  if (opts.clip) {
    const el = await page.$(opts.clip);
    await el.screenshot({ path: file, type: 'webp', quality: 92, omitBackground: !!opts.alpha });
  } else {
    await page.screenshot({ path: file, type: 'webp', quality: 88, omitBackground: !!opts.alpha });
  }
  await page.close();
  console.log('✓', path.relative(ROOT, file));
}

for (const g of GAMES) {
  await shot(bgHtml(g), { width: 512, height: 768, deviceScaleFactor: 2 }, path.join(ROOT, 'assets/bg', g.id + '.webp'));
  await shot(bannerHtml(g), { width: 800, height: 160, deviceScaleFactor: 2 }, path.join(ROOT, 'assets/menu', 'banner_' + g.id + '.webp'), { clip: '#t', alpha: true });
  await shot(cardHtml(g), { width: 800, height: 600, deviceScaleFactor: 1.2 }, path.join(ROOT, 'assets/menu', 'card_' + g.id + '.webp'));
}

await browser.close();
server.close();
