/* ============================================================
   save.js — あそびのもり 共通セーブ管理（localStorage）
   ------------------------------------------------------------
   - ゲームごとに名前空間を分けて保存（衝突しない）
   - localStorage が使えない環境（プレビュー iframe 等）では
     メモリ内フォールバックに自動切替（try/catch ガード）
   - 使い方:
       var save = Save.game('manekko');
       save.set('best', 12);
       var best = save.get('best', 0);
       save.merge({ best: 12, cleared: true });
   ============================================================ */
(function (global) {
  'use strict';

  var PREFIX = 'asobinomori:';
  var mem = {};            // フォールバック用メモリストア
  var hasLS = (function () {
    try {
      var k = PREFIX + '__t';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  function readRaw(key) {
    if (hasLS) { try { return global.localStorage.getItem(key); } catch (e) {} }
    return key in mem ? mem[key] : null;
  }
  function writeRaw(key, val) {
    if (hasLS) { try { global.localStorage.setItem(key, val); return; } catch (e) {} }
    mem[key] = val;
  }
  function removeRaw(key) {
    if (hasLS) { try { global.localStorage.removeItem(key); return; } catch (e) {} }
    delete mem[key];
  }

  function load(ns) {
    var raw = readRaw(PREFIX + ns);
    if (!raw) return {};
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  function store(ns, obj) {
    writeRaw(PREFIX + ns, JSON.stringify(obj));
  }

  function game(ns) {
    return {
      get: function (key, fallback) {
        var data = load(ns);
        return (key in data) ? data[key] : fallback;
      },
      set: function (key, val) {
        var data = load(ns); data[key] = val; store(ns, data); return val;
      },
      merge: function (patch) {
        var data = load(ns);
        for (var k in patch) if (patch.hasOwnProperty(k)) data[k] = patch[k];
        store(ns, data); return data;
      },
      all: function () { return load(ns); },
      // ベストスコア更新（大きいほど良い）。更新されたら true
      bestMax: function (key, val) {
        var cur = this.get(key, -Infinity);
        if (val > cur) { this.set(key, val); return true; }
        return false;
      },
      // ベストスコア更新（小さいほど良い：手数・タイム）
      bestMin: function (key, val) {
        var cur = this.get(key, Infinity);
        if (val < cur) { this.set(key, val); return true; }
        return false;
      },
      reset: function () { removeRaw(PREFIX + ns); }
    };
  }

  // 全ゲームのセーブを消す（アーケードの「ぜんぶ さいしょ」用）
  function resetAll(namespaces) {
    (namespaces || []).forEach(function (ns) { removeRaw(PREFIX + ns); });
  }

  global.Save = { game: game, resetAll: resetAll, available: hasLS };
})(window);
