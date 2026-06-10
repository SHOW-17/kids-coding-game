#!/usr/bin/env node
// Capacitor 用の www/ を組み立てる：公開対象（HTML・manifest・assets）だけをコピーする。
// node_modules や android/ を webDir に含めないための分離。APK には assets/bgm/ の
// mp3（.gitignore 済み）も同梱する。
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const www = join(root, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www);

for (const f of ['index.html', 'room.html', 'manifest.webmanifest', 'sw.js', 'games', 'assets']) {
  cpSync(join(root, f), join(www, f), { recursive: true });
}
console.log('www/ built');
