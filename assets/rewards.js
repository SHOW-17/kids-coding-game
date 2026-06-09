/* ============================================================
   rewards.js — あそびのもり 共通ごほうび管理（どんぐり経済）
   ------------------------------------------------------------
   ・どんぐり（通貨）は「全ゲームのがんばり合計」から自動計算する。
     各ゲームのセーブには一切手を入れない＝最小構成で横断集計。
       programming … クリアしたレベル数（一意化）
       manekko     … さいこう だん数（best）
       kimari      … れんぞく さいこう（best）
       katachi     … かんせい数（cleared）
       pitagora    … クリア数（cleared）
   ・つかった どんぐり（spent）・もっているアイテム（owned）・きている
     もの（wear）は room 名前空間に保存する（Save.game('room')）。
   ・くじ（draw）は「まだ持っていないアイテム」からランダムに1つ。
     着せ替え系は自動で装備、かぐは部屋に出る。
   ・index.html / room.html の両方が読み込んで共有する。
   ============================================================ */
(function (global) {
  'use strict';

  var ROOM_NS = 'room';
  var PRICE = 4;            // くじ1かい＝どんぐり4こ

  // ごほうび図鑑（順序＝図鑑の並び）。見た目（CSS図形）は room.html 側で描画。
  // cat: 'hat'（あたま）/ 'face'（かお）/ 'neck'（くび）/ 'room'（かぐ）
  var ITEMS = [
    { id: 'hat_party',   cat: 'hat',  name: 'とんがりぼうし' },
    { id: 'hat_crown',   cat: 'hat',  name: 'おうかん' },
    { id: 'hat_ribbon',  cat: 'hat',  name: 'リボン' },
    { id: 'hat_flower',  cat: 'hat',  name: 'おはな' },
    { id: 'hat_knit',    cat: 'hat',  name: 'ニットぼう' },
    { id: 'face_glasses',cat: 'face', name: 'めがね' },
    { id: 'face_heart',  cat: 'face', name: 'ハートめがね' },
    { id: 'face_star',   cat: 'face', name: 'スターめがね' },
    { id: 'face_blush',  cat: 'face', name: 'ほっぺ' },
    { id: 'neck_scarf',  cat: 'neck', name: 'マフラー' },
    { id: 'neck_bow',    cat: 'neck', name: 'ちょうネクタイ' },
    { id: 'neck_bell',   cat: 'neck', name: 'すずくびわ' },
    { id: 'neck_cape',   cat: 'neck', name: 'マント' },
    { id: 'room_rug',     cat: 'room', name: 'ラグ' },
    { id: 'room_plant',   cat: 'room', name: 'はちうえ' },
    { id: 'room_lamp',    cat: 'room', name: 'ランプ' },
    { id: 'room_books',   cat: 'room', name: 'ほんだな' },
    { id: 'room_teddy',   cat: 'room', name: 'ぬいぐるみ' },
    { id: 'room_balloon', cat: 'room', name: 'ふうせん' },
    { id: 'room_window',  cat: 'room', name: 'まど' },
    { id: 'room_rainbow', cat: 'room', name: 'にじ' }
  ];

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
  function earned() {
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

  global.Rewards = {
    PRICE: PRICE, ITEMS: ITEMS,
    byId: byId, byCat: byCat,
    earned: earned, spent: spent, balance: balance,
    owned: owned, isOwned: isOwned,
    wear: wear, setWear: setWear, isWearing: isWearing,
    pool: pool, allCollected: allCollected, canDraw: canDraw, draw: draw
  };
})(window);
