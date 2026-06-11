#!/usr/bin/env node
// sw.js を生成する：公開対象ファイルを走査してプリキャッシュ一覧を埋め込む。
// アセットを追加・更新したら `node scripts/build-sw.mjs` を実行して sw.js を作り直すこと。
// ※ assets/bgm/ のAI生成BGM（mp3）もコミット・配信対象になったためプリキャッシュに含める。
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(root, p).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) {
      if (['node_modules', '.git', 'scripts', 'android', 'www', 'resources'].includes(rel)) continue;
      walk(p);
    } else {
      if (/\.(html|css|js|webmanifest|png|webp|svg|ico|woff2|mp3)$/.test(name)) {
        if (rel === 'sw.js') continue;
        files.push(rel);
      }
    }
  }
}
walk(root);
files.sort();

// 中身のハッシュでキャッシュ名をバージョニング（更新時に古いキャッシュを確実に破棄）
const h = createHash('sha256');
for (const f of files) h.update(readFileSync(join(root, f)));
const version = h.digest('hex').slice(0, 12);

const sw = `// 自動生成ファイル。直接編集しない（scripts/build-sw.mjs で再生成）。
const CACHE = 'asobinomori-${version}';
const PRECACHE = ${JSON.stringify(['./', ...files.map((f) => './' + f)], null, 0)};

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 1つの404で全滅しないよう個別に add（失敗分は実行時キャッシュに任せる）
    await Promise.allSettled(PRECACHE.map((u) => cache.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(e.request, res.clone());
      }
      return res;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
`;

writeFileSync(join(root, 'sw.js'), sw);
console.log(`sw.js generated: ${files.length} files precached, version ${version}`);
