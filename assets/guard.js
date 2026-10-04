/* ============================================================
   guard.js — あそびのもり「おうちの ひと」機能（あんしん）
   ------------------------------------------------------------
   ■ ねらい（親が安心して渡せる）
   - おうちの ひと ゲート：設定・記録消去などは、こどもが偶然あけられない
     ように かけざん問題（小1は まだ習わない）で守る。
   - あそぶ じかん タイマー：1日の上限（15/30/45/60ふん）を決められる。
     のこり1ぷんで やさしく予告し、時間になったら「おやすみ」画面で
     その日の あそびを おしまいにする（責めない・こわくない演出）。
   - 全画面（index / room / games/*）で読み込む。時間はページをまたいで
     localStorage に積算する（見えている間だけ数える）。

   ■ API
       Guard.gate(onPass)          かけざんゲート → 正解で onPass()
       Guard.limit / setLimit(m)   1日の上限（ぷん。0=なし）
       Guard.usedMin()             きょう あそんだ ぷん
       Guard.extend(m)             きょうだけ m ぷん のばす（m=Infinity で きょうは なし）
   ============================================================ */
(function (global) {
  'use strict';

  var SELF = (document.currentScript && document.currentScript.src) || '';
  function asset(p) { try { return new URL(p, SELF).href; } catch (e) { return p; } }

  var KEY_CFG = 'amori_care';     // { limit: ぷん }
  var KEY_USE = 'amori_usage';    // { date, ms, extra(ぷん), warned }
  var TICK = 5000;

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function read(k, def) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : def; } catch (e) { return def; }
  }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function cfg() { var c = read(KEY_CFG, {}); return { limit: +c.limit || 0 }; }
  function usage() {
    var u = read(KEY_USE, null);
    if (!u || u.date !== today()) u = { date: today(), ms: 0, extra: 0, warned: false };
    return u;
  }
  function remainingMs() {
    var c = cfg(); if (!c.limit) return Infinity;
    var u = usage();
    if (u.extra === -1) return Infinity;               // きょうは せいげん なし
    return c.limit * 60000 + (u.extra || 0) * 60000 - u.ms;
  }

  /* ---------- 見た目 ---------- */
  function injectStyle() {
    if (document.getElementById('guard-style')) return;
    var st = document.createElement('style');
    st.id = 'guard-style';
    st.textContent = [
      '.gd-ovl{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;',
      ' padding:20px;background:rgba(50,35,15,.5);backdrop-filter:blur(3px);font-family:"M PLUS Rounded 1c",sans-serif;color:#5b4022;}',
      '.gd-dlg{width:100%;max-width:360px;background:#fffdf7;border-radius:28px;padding:22px 20px 20px;text-align:center;',
      ' box-shadow:0 26px 50px -16px rgba(90,55,15,.6),inset 0 3px 0 #fff;animation:gdPop .28s cubic-bezier(.22,1,.36,1);}',
      '@keyframes gdPop{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}',
      '.gd-dlg h2{font-family:"Mochiy Pop One";font-size:19px;margin-bottom:6px;}',
      '.gd-dlg p{font-size:13.5px;font-weight:700;color:#7c5d39;line-height:1.6;}',
      '.gd-q{font-family:"Mochiy Pop One";font-size:34px;margin:12px 0 14px;letter-spacing:.04em;}',
      '.gd-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
      '.gd-btn{font-family:"Mochiy Pop One";font-size:22px;min-height:60px;border:none;border-radius:20px;cursor:pointer;',
      ' color:#5b4022;background:linear-gradient(180deg,#fff3da,#ffe2b3);box-shadow:0 5px 0 rgba(150,100,40,.28),inset 0 2px 0 #fff;}',
      '.gd-btn:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(150,100,40,.28);}',
      '.gd-btn.ng{animation:gdShake .35s;}',
      '@keyframes gdShake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}',
      '.gd-close{margin-top:14px;font-family:"Mochiy Pop One";font-size:15px;min-height:48px;padding:0 26px;border:none;',
      ' border-radius:999px;cursor:pointer;background:#f0e6d3;color:#7c5d39;box-shadow:0 4px 0 rgba(150,110,60,.18);}',
      '.gd-lock{width:44px;height:44px;margin:0 auto 6px;position:relative;}',
      '.gd-lock::before{content:"";position:absolute;left:11px;top:2px;width:22px;height:22px;border:5px solid #c69a5b;border-bottom:none;border-radius:14px 14px 0 0;box-sizing:border-box;}',
      '.gd-lock::after{content:"";position:absolute;left:5px;bottom:2px;width:34px;height:24px;border-radius:8px;background:linear-gradient(180deg,#ffcf6b,#f0a531);box-shadow:inset 0 2px 0 rgba(255,255,255,.6),0 3px 0 #c98316;}',
      /* おやすみ画面 */
      '.gd-sleep{position:fixed;inset:0;z-index:100001;display:flex;flex-direction:column;align-items:center;justify-content:center;',
      ' gap:6px;padding:24px;text-align:center;color:#fff;font-family:"M PLUS Rounded 1c",sans-serif;',
      ' background:radial-gradient(120% 80% at 50% 0%,#5b6fc9 0%,#3a3f8f 55%,#262a63 100%);animation:gdFade .8s ease;}',
      '@keyframes gdFade{from{opacity:0}to{opacity:1}}',
      '.gd-sleep .sky{position:absolute;inset:0;pointer-events:none;overflow:hidden;}',
      '.gd-sleep .sky i{position:absolute;width:6px;height:6px;border-radius:50%;background:#fff6c8;opacity:.8;animation:gdTw 2.6s ease-in-out infinite;}',
      '@keyframes gdTw{50%{opacity:.2;transform:scale(.6)}}',
      '.gd-sleep img{width:min(62vw,300px);height:auto;filter:drop-shadow(0 18px 18px rgba(0,0,0,.35));animation:gdBreath 4s ease-in-out infinite;}',
      '@keyframes gdBreath{50%{transform:translateY(-6px) scale(1.02)}}',
      '.gd-sleep h1{font-family:"Mochiy Pop One";font-size:clamp(24px,7vw,34px);margin-top:6px;text-shadow:0 3px 0 rgba(0,0,0,.25);}',
      '.gd-sleep p{font-size:clamp(15px,4.4vw,19px);font-weight:800;opacity:.92;line-height:1.6;}',
      '.gd-sleep .parent{position:absolute;bottom:calc(18px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);',
      ' font-family:"Mochiy Pop One";font-size:13px;color:#dfe3ff;background:rgba(255,255,255,.12);border:none;border-radius:999px;',
      ' min-height:44px;padding:0 20px;cursor:pointer;}',
      '.gd-toast{position:fixed;left:50%;top:calc(70px + env(safe-area-inset-top));transform:translateX(-50%);z-index:99999;',
      ' display:flex;align-items:center;gap:10px;font-family:"Mochiy Pop One";font-size:16px;color:#5b4022;white-space:nowrap;',
      ' background:#fffdf7;padding:10px 20px 10px 12px;border-radius:999px;box-shadow:0 12px 26px -10px rgba(90,55,15,.55);',
      ' animation:gdDrop .5s cubic-bezier(.34,1.56,.64,1);}',
      '@keyframes gdDrop{from{transform:translate(-50%,-30px);opacity:0}}',
      '.gd-clock{width:30px;height:30px;border-radius:50%;background:#ffb43d;position:relative;box-shadow:inset 0 2px 0 rgba(255,255,255,.5);}',
      '.gd-clock::before,.gd-clock::after{content:"";position:absolute;left:14px;bottom:15px;width:3px;border-radius:2px;background:#fff;transform-origin:bottom center;}',
      '.gd-clock::before{height:10px;}.gd-clock::after{height:7px;transform:rotate(100deg);}',
      '@media (prefers-reduced-motion: reduce){.gd-sleep img,.gd-sleep .sky i{animation:none}}'
    ].join('');
    document.head.appendChild(st);
  }
  function sfx(n) { try { if (global.Sfx && global.Sfx[n]) global.Sfx[n](); } catch (e) {} }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  /* ---------- おうちの ひと ゲート（かけざん） ---------- */
  function gate(onPass, onCancel) {
    injectStyle();
    var a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
    var ans = a * b, opts = [ans];
    while (opts.length < 4) {
      var d = ans + (Math.floor(Math.random() * 5) + 1) * (Math.random() < .5 ? -1 : 1) * (Math.random() < .5 ? 1 : a);
      if (d > 0 && opts.indexOf(d) < 0) opts.push(d);
    }
    opts.sort(function () { return Math.random() - .5; });
    var ov = el('<div class="gd-ovl" role="dialog" aria-modal="true"><div class="gd-dlg">' +
      '<div class="gd-lock" aria-hidden="true"></div>' +
      '<h2>おうちの ひとへ</h2><p>こたえを えらんでください</p>' +
      '<div class="gd-q">' + a + ' × ' + b + ' ＝ ？</div>' +
      '<div class="gd-opts">' + opts.map(function (o) { return '<button class="gd-btn" data-v="' + o + '">' + o + '</button>'; }).join('') + '</div>' +
      '<button class="gd-close">とじる</button></div></div>');
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.addEventListener('click', function (e) {
      var t = e.target;
      if (t === ov || t.classList.contains('gd-close')) { sfx('tap'); close(); if (onCancel) onCancel(); return; }
      if (!t.classList.contains('gd-btn')) return;
      if (+t.getAttribute('data-v') === ans) { sfx('ding'); close(); onPass(); }
      else { sfx('error'); close(); if (onCancel) onCancel(); }   // まちがえたら とじる（総当たり防止）
    });
    document.body.appendChild(ov);
  }

  /* ---------- あそぶ じかん ---------- */
  var sleeping = null, lastTick = Date.now();

  function showToast() {
    injectStyle();
    var t = el('<div class="gd-toast" role="status"><span class="gd-clock" aria-hidden="true"></span>もうすぐ おしまい だよ</div>');
    document.body.appendChild(t);
    try { if (global.Talk) global.Talk.say('もうすぐ おしまい だよ'); } catch (e) {}
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 6000);
  }

  function showSleep() {
    if (sleeping) return;
    injectStyle();
    try { if (global.Bgm) global.Bgm.stop(); } catch (e) {}
    try { if (global.Sfx && global.Sfx.setMuted) global.Sfx.setMuted(true); } catch (e) {}
    var stars = '';
    for (var i = 0; i < 18; i++) {
      stars += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 60).toFixed(1) +
        '%;animation-delay:' + (Math.random() * 2.6).toFixed(2) + 's"></i>';
    }
    sleeping = el('<div class="gd-sleep" role="dialog" aria-modal="true" aria-label="きょうは おしまい">' +
      '<div class="sky">' + stars + '</div>' +
      '<img alt="" draggable="false">' +
      '<h1>きょうは ここまで</h1>' +
      '<p>たくさん あそんだね！<br>また あした あそぼうね</p>' +
      '<button class="parent">おうちの ひと</button></div>');
    var img = sleeping.querySelector('img');
    img.onerror = function () { img.onerror = null; img.src = asset('uni/blue_sit.webp'); };
    img.src = asset('uni/blue_sleep.webp');
    // 下の画面を触れないように（すべての操作をここで止める）
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(function (ev) {
      sleeping.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
    });
    sleeping.querySelector('.parent').addEventListener('click', function () {
      gate(function () { parentChoice(); });
    });
    document.body.appendChild(sleeping);
    try { if (global.Talk) setTimeout(function () { global.Talk.say('きょうは ここまで。たくさん あそんだね。また あした あそぼうね'); }, 400); } catch (e) {}
  }
  function hideSleep() {
    if (!sleeping) return;
    if (sleeping.parentNode) sleeping.parentNode.removeChild(sleeping);
    sleeping = null;
    try { if (global.Sfx && global.Sfx.setMuted) global.Sfx.setMuted(false); } catch (e) {}
  }
  function parentChoice() {
    injectStyle();
    var ov = el('<div class="gd-ovl" role="dialog" aria-modal="true" style="z-index:100002"><div class="gd-dlg">' +
      '<h2>じかんを のばす</h2><p>きょうだけ のばします</p>' +
      '<div class="gd-opts" style="grid-template-columns:1fr;margin-top:12px">' +
      '<button class="gd-btn" data-m="10">あと 10ぷん</button>' +
      '<button class="gd-btn" data-m="30">あと 30ぷん</button>' +
      '<button class="gd-btn" data-m="-1" style="font-size:17px">きょうは せいげん なし</button></div>' +
      '<button class="gd-close">やめる</button></div></div>');
    ov.addEventListener('click', function (e) {
      var t = e.target;
      if (t === ov || t.classList.contains('gd-close')) { ov.parentNode.removeChild(ov); return; }
      if (!t.hasAttribute('data-m')) return;
      extend(+t.getAttribute('data-m'));
      ov.parentNode.removeChild(ov);
      hideSleep();
      sfx('success');
    });
    document.body.appendChild(ov);
  }
  function extend(m) {
    var u = usage();
    if (m === -1 || m === Infinity) u.extra = -1;
    else {
      // 「いまから m ぷん」あそべるように のばす（上限を こえていた ぶんは すてる）
      var lim = cfg().limit * 60000;
      var allowed = lim + Math.max(0, u.extra || 0) * 60000;
      u.extra = Math.ceil((Math.max(allowed, u.ms) + m * 60000 - lim) / 60000);
    }
    u.warned = false;
    write(KEY_USE, u);
  }

  function check() {
    var r = remainingMs();
    if (r === Infinity) { hideSleep(); return; }
    var u = usage();
    if (r <= 0) { showSleep(); return; }
    hideSleep();
    if (r <= 60000 && !u.warned) { u.warned = true; write(KEY_USE, u); showToast(); }
  }
  function tick() {
    var now = Date.now();
    var dt = Math.min(now - lastTick, TICK * 2);       // スリープ復帰などの大きな飛びは数えない
    lastTick = now;
    if (document.hidden || sleeping) return;
    var u = usage();
    u.ms += dt;
    write(KEY_USE, u);
    check();
  }
  function start() {
    lastTick = Date.now();
    check();
    setInterval(tick, TICK);
    document.addEventListener('visibilitychange', function () { lastTick = Date.now(); if (!document.hidden) check(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  global.Guard = {
    gate: gate,
    get limit() { return cfg().limit; },
    setLimit: function (m) {
      write(KEY_CFG, { limit: +m || 0 });
      var u = usage(); u.extra = 0; u.warned = false; write(KEY_USE, u);
      check();
    },
    usedMin: function () { return Math.floor(usage().ms / 60000); },
    remainingMin: function () { var r = remainingMs(); return r === Infinity ? Infinity : Math.max(0, Math.ceil(r / 60000)); },
    extend: function (m) { extend(m); check(); }
  };
})(window);
