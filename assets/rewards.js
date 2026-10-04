/* ============================================================
   rewards.js — あそびのもり 共通ごほうび管理（どんぐり経済）
   ------------------------------------------------------------
   ・どんぐり（通貨）＝全ゲームの「せいこう量（wins）」の累計。各ゲームが自分の名前空間に
     wins を貯め、earned() が合計する（programming だけは独自キー
     kuma_prog_save_v1.wins を progWins() で読む）。
   ・旧方式（最高記録・初クリア数ベース）の分は legacyEarned() を一度だけ
     legacyBonus として確定して加算する。
   ・つかった どんぐり（spent）・もっているアイテム（owned）・きている
     もの（wear）は room 名前空間に保存する（Save.game('room')）。
   ・くじ（draw）は「まだ持っていないアイテム」からランダムに1つ。
     着せ替え系は自動で装備、かぐは部屋に出る。
   ・index.html / room.html の両方が読み込んで共有する。
   ============================================================ */
(function (global) {
  'use strict';

  var ROOM_NS = 'room';
  var PRICE = 8;            // くじ1かい＝どんぐり8こ（コンプ総額＝8×31＝248。2026-10 に 10しゅ ついか）

  // ごほうび図鑑（順序＝図鑑の並び）。見た目は画像 assets/items/<id>.webp を room.html の itemImg() が描画（face_blush だけ CSS図形の例外）。
  // cat: 'hat'（あたま）/ 'face'（かお）/ 'neck'（くび）/ 'room'（かぐ）
  var ITEMS = [
    { id: 'hat_party',   cat: 'hat',  name: 'とんがりぼうし' },
    { id: 'hat_crown',   cat: 'hat',  name: 'おうかん' },
    { id: 'hat_ribbon',  cat: 'hat',  name: 'リボン' },
    { id: 'hat_flower',  cat: 'hat',  name: 'おはな' },
    { id: 'hat_knit',    cat: 'hat',  name: 'ニットぼう' },
    { id: 'hat_wizard',  cat: 'hat',  name: 'まほうの ぼうし' },
    { id: 'hat_bunny',   cat: 'hat',  name: 'うさみみ' },
    { id: 'hat_chef',    cat: 'hat',  name: 'コックさん' },
    { id: 'face_glasses',cat: 'face', name: 'めがね' },
    { id: 'face_heart',  cat: 'face', name: 'ハートめがね' },
    { id: 'face_star',   cat: 'face', name: 'スターめがね' },
    { id: 'face_blush',  cat: 'face', name: 'ほっぺ' },
    { id: 'face_sun',    cat: 'face', name: 'サングラス' },
    { id: 'neck_scarf',  cat: 'neck', name: 'マフラー' },
    { id: 'neck_bow',    cat: 'neck', name: 'ちょうネクタイ' },
    { id: 'neck_bell',   cat: 'neck', name: 'すずくびわ' },
    { id: 'neck_cape',   cat: 'neck', name: 'マント' },
    { id: 'neck_lei',    cat: 'neck', name: 'はなの わ' },
    { id: 'room_rug',     cat: 'room', name: 'ラグ' },
    { id: 'room_plant',   cat: 'room', name: 'はちうえ' },
    { id: 'room_lamp',    cat: 'room', name: 'ランプ' },
    { id: 'room_books',   cat: 'room', name: 'ほんだな' },
    { id: 'room_teddy',   cat: 'room', name: 'ぬいぐるみ' },
    { id: 'room_balloon', cat: 'room', name: 'ふうせん' },
    { id: 'room_window',  cat: 'room', name: 'まど' },
    { id: 'room_rainbow', cat: 'room', name: 'にじ' },
    { id: 'room_stars',   cat: 'room', name: 'ほしの かざり' },
    { id: 'room_clock',   cat: 'room', name: 'とけい' },
    { id: 'room_piano',   cat: 'room', name: 'ピアノ' },
    { id: 'room_fishbowl',cat: 'room', name: 'きんぎょ' },
    { id: 'room_blocks',  cat: 'room', name: 'つみき' }
  ];

  // きせかえの重ね位置（ユニコーン画像 uni/blue_standing に対する % ＝ 中心x・中心y・幅）。
  // room.html と index.html（ホームの じぶんの ユニコーン）で共有する。wrap＝首まわりの前レイヤーのクリップ。
  var PLACE = {
  hat_party:   {cx:50, cy:-2,  w:46},
  hat_crown:   {cx:50, cy:9,   w:52},
  hat_ribbon:  {cx:50, cy:6,   w:56},
  hat_flower:  {cx:67, cy:13,  w:30},
  hat_knit:    {cx:50, cy:3,   w:58},
  hat_wizard:  {cx:50, cy:-9,  w:60},
  hat_bunny:   {cx:50, cy:-6,  w:62},
  hat_chef:    {cx:50, cy:0,   w:52},
  face_glasses:{cx:50, cy:35,  w:62},
  face_heart:  {cx:50, cy:35,  w:64},
  face_star:   {cx:50, cy:35,  w:64},
  face_blush:  {cx:50, cy:43,  w:58},
  face_sun:    {cx:50, cy:35,  w:64},
  /* 首まわりは「巻いてる」立体感のため前後2レイヤー。
     wrap = 前レイヤー（手前）に見せるクリップ。後ろレイヤーは全体を本体の裏(z-1)へ。 */
  neck_scarf:  {cx:50, cy:61,  w:58,  wrap:'inset(40% 0 0 0)'},
  neck_bow:    {cx:50, cy:56,  w:40},
  neck_bell:   {cx:50, cy:60,  w:60,  wrap:'inset(45% 0 0 0)'},
  neck_cape:   {cx:50, cy:74,  w:106, wrap:'inset(0 0 62% 0)'},
  neck_lei:    {cx:50, cy:58,  w:66,  wrap:'inset(46% 0 0 0)'}
  };

  function byId(id) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
    return null;
  }
  function byCat(cat) {
    return ITEMS.filter(function (it) { return it.cat === cat; });
  }

  function save() {
    try { if (global.Save && global.Save.game) return global.Save.game(ROOM_NS); } catch (e) {}
    return null;
  }

  // ---- どんぐり（通貨） ---------------------------------------
  function g(ns, key) {
    try { if (global.Save && global.Save.game) return global.Save.game(ns).get(key, 0) || 0; } catch (e) {}
    return 0;
  }
  // 旧方式（最高記録・初クリア数ベース）の集計＝移行ボーナスの元になる値。
  function legacyEarned() {
    var total = 0;
    try {
      var d = JSON.parse(global.localStorage.getItem('kuma_prog_save_v1'));
      if (d && Array.isArray(d.cleared)) total += new Set(d.cleared).size;
    } catch (e) {}
    total += g('manekko', 'best');
    total += g('kimari', 'best');
    total += g('katachi', 'cleared');
    total += g('pitagora', 'cleared');
    return total;
  }
  // programming の累積クリア回数（自己完結のため独自キー kuma_prog_save_v1.wins）。
  function progWins() {
    try {
      var d = JSON.parse(global.localStorage.getItem('kuma_prog_save_v1'));
      if (d && typeof d.wins === 'number') return d.wins;
    } catch (e) {}
    return 0;
  }
  // どんぐり＝各ゲームの「せいこう量（wins）」の累計。クリア/正解のたびに増える
  // （むずかしいほど多く・再クリアでも増える）。旧データで貯めた分は legacyBonus として
  // 一度だけ確定し、どんぐりが減らないようにする。
  function earned() {
    var s = save();
    var bonus = s ? s.get('legacyBonus', -1) : -1;
    if (bonus < 0) { bonus = legacyEarned(); if (s) s.set('legacyBonus', bonus); }
    var wins = g('manekko', 'wins') + g('kimari', 'wins') +
               g('katachi', 'wins') + g('pitagora', 'wins') +
               g('tomare', 'wins') + g('chigai', 'wins') + g('sokkuri', 'wins') +
               g('pair', 'wins') + g('uta', 'wins') + progWins();
    var s2 = save();
    return bonus + wins + (s2 ? (s2.get('dailyBonus', 0) || 0) : 0);
  }
  function spent() {
    var s = save();
    return s ? (s.get('spent', 0) || 0) : 0;
  }
  function balance() {
    return Math.max(0, earned() - spent());
  }

  // ---- もちもの / きせかえ -----------------------------------
  function owned() {
    var s = save();
    var o = s ? s.get('owned', []) : [];
    return Array.isArray(o) ? o : [];
  }
  function isOwned(id) { return owned().indexOf(id) >= 0; }

  function wear() {
    var s = save();
    var w = s ? s.get('wear', {}) : {};
    return (w && typeof w === 'object') ? w : {};
  }
  function setWear(cat, id) {           // id=null で ぬぐ
    var s = save(); if (!s) return;
    var w = wear();
    if (id === null || id === undefined) delete w[cat];
    else w[cat] = id;
    s.set('wear', w);
  }
  function isWearing(id) {
    var it = byId(id); if (!it) return false;
    return wear()[it.cat] === id;
  }

  // ---- くじ ---------------------------------------------------
  function pool() {                     // まだ持っていないアイテム
    var o = owned();
    return ITEMS.filter(function (it) { return o.indexOf(it.id) < 0; });
  }
  function allCollected() { return pool().length === 0; }
  function canDraw() { return balance() >= PRICE && pool().length > 0; }

  // くじを1回ひく。引けたら当たったアイテムを返す。引けなければ null。
  function draw() {
    if (!canDraw()) return null;
    var p = pool();
    var item = p[Math.floor(Math.random() * p.length)];
    var s = save();
    if (s) {
      s.set('spent', spent() + PRICE);
      var o = owned(); o.push(item.id); s.set('owned', o);
      if (item.cat !== 'room') setWear(item.cat, item.id);   // 着せ替えは自動できせる
    }
    return item;
  }

  // ---- きょうの 3つ（まいにちの スタンプ） --------------------
  // 毎日ちがう 3つの あそびを おすすめし、それぞれ1回でも せいこうしたら スタンプ。
  // 3つ そろうと ボーナスどんぐり。いろいろな力を まんべんなく使う＋また あした
  // あそびたくなる仕掛け。判定は「その日はじめに見た wins」より増えたか（ゲーム側は無改修）。
  // ゲームID（programming だけ独自キーなので 'kuma'）。並びは日替わりローテの順番。
  var DAILY_ORDER = ['kuma', 'pair', 'kimari', 'tomare', 'katachi', 'manekko', 'chigai', 'pitagora', 'sokkuri', 'uta'];
  var DAILY_BONUS = 5;
  function winsOf(id) { return id === 'kuma' ? progWins() : g(id, 'wins'); }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function dayIndex() {
    var d = new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }
  function picksFor(day) {
    // 10個を3つずつ順番に。10日で ぜんぶ一巡する（同じ日に同じゲームは出ない）
    var n = DAILY_ORDER.length, out = [];
    for (var i = 0; i < 3; i++) out.push(DAILY_ORDER[(day * 3 + i) % n]);
    return out;
  }
  function daily() {
    var s = save();
    var d = s ? s.get('daily', null) : null;
    if (!d || d.date !== today()) {
      var picks = picksFor(dayIndex()), base = {};
      picks.forEach(function (id) { base[id] = winsOf(id); });
      d = { date: today(), picks: picks, base: base, bonus: false };
      if (s) s.set('daily', d);
    }
    var done = d.picks.filter(function (id) { return winsOf(id) > (d.base[id] || 0); });
    if (s) {   // あそんだ日の きろく（スタンプ数。直近14日ぶん）
      var h = s.get('days', {}) || {};
      if ((h[d.date] || 0) !== done.length && done.length) {
        h[d.date] = done.length;
        var keys = Object.keys(h).sort();
        while (keys.length > 14) delete h[keys.shift()];
        s.set('days', h);
      }
    }
    return { date: d.date, picks: d.picks.slice(), done: done, complete: done.length === d.picks.length,
             bonusGiven: !!d.bonus, bonus: DAILY_BONUS };
  }
  // 3つ そろったら1回だけ ボーナス。くばれたら true
  function claimDaily() {
    var st = daily(); if (!st.complete || st.bonusGiven) return false;
    var s = save(); if (!s) return false;
    var d = s.get('daily', null); d.bonus = true; s.set('daily', d);
    s.set('dailyBonus', (s.get('dailyBonus', 0) || 0) + DAILY_BONUS);
    return true;
  }
  function stampDays() { var s = save(); return s ? (s.get('days', {}) || {}) : {}; }

  /* ゲーム中に「スタンプ ゲット！」を出す：各ゲームの save.set('wins', …) を見張る
     （Save.game を包むだけ。ゲーム側のコードは変えない） */
  var DAILY_NS = { manekko: 1, kimari: 1, katachi: 1, pitagora: 1, tomare: 1, chigai: 1, sokkuri: 1, pair: 1, uta: 1 };
  function hookSave() {
    var S = global.Save; if (!S || !S.game || S.game.__daily) return;
    var orig = S.game;
    S.game = function (ns) {
      var o = orig(ns);
      if (!DAILY_NS[ns]) return o;
      var set = o.set;
      o.set = function (k, v) {
        var before = k === 'wins' ? daily() : null;
        var r = set.call(o, k, v);
        if (before && before.picks.indexOf(ns) >= 0 && before.done.indexOf(ns) < 0) {
          var after = daily();
          if (after.done.indexOf(ns) >= 0) setTimeout(function () { stampToast(after); }, 900);
        }
        return r;
      };
      return o;
    };
    S.game.__daily = true;
  }
  var SELF = (document.currentScript && document.currentScript.src) || '';
  function asset(p) { try { return new URL(p, SELF).href; } catch (e) { return p; } }
  function stampToast(st) {
    try {
      if (!document.getElementById('stamp-style')) {
        var css = document.createElement('style'); css.id = 'stamp-style';
        css.textContent =
          '.stp-toast{position:fixed;left:50%;top:calc(76px + env(safe-area-inset-top));z-index:99990;transform:translateX(-50%);' +
          'display:flex;align-items:center;gap:10px;padding:8px 20px 8px 8px;border-radius:999px;background:#fffdf7;' +
          'font-family:"Mochiy Pop One";font-size:17px;color:#5b4022;white-space:nowrap;pointer-events:none;' +
          'box-shadow:0 14px 28px -10px rgba(90,55,15,.55),inset 0 2px 0 #fff;animation:stpIn .6s cubic-bezier(.34,1.56,.64,1),stpOut .4s ease 3.2s forwards;}' +
          '.stp-toast img{width:52px;height:52px;animation:stpSpin .7s cubic-bezier(.34,1.56,.64,1);}' +
          '.stp-toast small{font-size:13px;color:#a98c66;margin-left:2px;}' +
          '@keyframes stpIn{from{transform:translate(-50%,-40px) scale(.6);opacity:0}}' +
          '@keyframes stpOut{to{transform:translate(-50%,-30px);opacity:0}}' +
          '@keyframes stpSpin{from{transform:scale(2.2) rotate(-40deg);opacity:0}}';
        document.head.appendChild(css);
      }
      var t = document.createElement('div');
      t.className = 'stp-toast'; t.setAttribute('role', 'status');
      t.innerHTML = '<img src="' + asset('menu/stamp.webp') + '" alt="">スタンプ ゲット！<small>' + st.done.length + '/' + st.picks.length + '</small>';
      document.body.appendChild(t);
      try { if (global.Sfx && global.Sfx.sparkle) global.Sfx.sparkle(); } catch (e) {}
      try { if (global.Talk) global.Talk.say('スタンプ ゲット！'); } catch (e) {}
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3800);
    } catch (e) {}
  }

  hookSave();
  try { daily(); } catch (e) {}   // その日の さいしょの wins を ここで覚える（あそぶ前）

  global.Rewards = {
    PRICE: PRICE, ITEMS: ITEMS, PLACE: PLACE,
    byId: byId, byCat: byCat,
    earned: earned, spent: spent, balance: balance,
    owned: owned, isOwned: isOwned,
    wear: wear, setWear: setWear, isWearing: isWearing,
    pool: pool, allCollected: allCollected, canDraw: canDraw, draw: draw,
    daily: daily, claimDaily: claimDaily, stampDays: stampDays, DAILY_BONUS: DAILY_BONUS
  };
})(window);
