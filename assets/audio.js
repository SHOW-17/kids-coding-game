/* ============================================================
   audio.js — あそびのもり 共通サウンドエンジン（Web Audio）
   ------------------------------------------------------------
   - すべて Web Audio で合成（音声ファイル不要・ロード待ちゼロ）
   - 端末ミュート/未対応でも try/catch で必ず無音フォールバック
   - 使い方:  Sfx.tap();  Sfx.success();  Sfx.note(440);
   - 初回タップ時に Sfx.unlock() が自動で呼ばれ AudioContext を起こす
   ============================================================ */
(function (global) {
  'use strict';

  var AC = global.AudioContext || global.webkitAudioContext;
  var ctx = null;
  var master = null;
  var muted = false;

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    return ctx;
  }

  // iOS/Chrome の自動再生制限対策：最初のユーザー操作で resume
  function unlock() {
    var c = ensure();
    if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} }
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  /* 単音を鳴らす低レベル関数
     opts: {freq, dur, type, vol, attack, release, slideTo, when, pan} */
  function tone(opts) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    try {
      var o = opts || {};
      var t0 = (o.when != null ? o.when : c.currentTime);
      var dur = o.dur != null ? o.dur : 0.18;
      var atk = o.attack != null ? o.attack : 0.008;
      var rel = o.release != null ? o.release : Math.max(0.04, dur * 0.5);
      var vol = o.vol != null ? o.vol : 0.5;

      var osc = c.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq || 440, t0);
      if (o.slideTo) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, o.slideTo), t0 + dur);
      }

      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      var node = g;
      // パン（左右）— 対応端末のみ
      if (o.pan != null && c.createStereoPanner) {
        var p = c.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, o.pan));
        g.connect(p); p.connect(master);
      } else {
        g.connect(master);
      }
      osc.connect(g);

      osc.start(t0);
      osc.stop(t0 + dur + rel);
    } catch (e) {}
  }

  // 和音・連続音をまとめて鳴らすヘルパ
  function seq(notes) {
    var c = ensure(); if (!c) return;
    var base = c.currentTime;
    notes.forEach(function (n) {
      tone(Object.assign({}, n, { when: base + (n.t || 0) }));
    });
  }

  // ---- ドレミ（純正律っぽい平均律の周波数表） ----
  var SCALE = { C:261.63, D:293.66, E:329.63, F:349.23, G:392.00,
                A:440.00, B:493.88, C5:523.25, D5:587.33, E5:659.25,
                G5:783.99, A5:880.00 };

  var Sfx = {
    unlock: unlock,
    tone: tone,
    get muted() { return muted; },
    setMuted: function (m) { muted = !!m; },
    toggleMute: function () { muted = !muted; return muted; },
    setVolume: function (v) { ensure(); if (master) master.gain.value = v; },

    // 任意の周波数を1音（ゲームの「光って鳴る」用）
    note: function (freq, dur, type) {
      tone({ freq: freq, dur: dur || 0.32, type: type || 'sine',
             vol: 0.45, release: 0.18 });
    },

    // やわらかいタップ音（ボタン・チップ）
    tap: function () {
      tone({ freq: 660, dur: 0.07, type: 'sine', vol: 0.32, slideTo: 880 });
    },
    // ぽよん（選択・配置）
    pop: function () {
      tone({ freq: 420, dur: 0.12, type: 'triangle', vol: 0.4, slideTo: 760 });
    },
    // ステップ移動（コトッ）
    step: function () {
      tone({ freq: 300, dur: 0.06, type: 'square', vol: 0.18, slideTo: 240 });
    },
    // ピンポン♪（小さな正解）
    ding: function () {
      seq([{ freq: SCALE.E5, dur: 0.14, type: 'sine', vol: 0.4 },
           { freq: SCALE.A5, dur: 0.22, type: 'sine', vol: 0.4, t: 0.1 }]);
    },
    // ブッ（失敗・やさしく）— 不快にならない低めの2度
    error: function () {
      tone({ freq: 200, dur: 0.22, type: 'sine', vol: 0.34, slideTo: 150 });
      tone({ freq: 150, dur: 0.26, type: 'sine', vol: 0.22, when: now() + 0.02 });
    },
    // カウントダウンのピッ
    blip: function (high) {
      tone({ freq: high ? 880 : 520, dur: 0.1, type: 'square', vol: 0.3 });
    },
    // ちいさな達成（レベル内クリア）
    success: function () {
      seq([{ freq: SCALE.C5, dur: 0.13, type: 'triangle', vol: 0.42 },
           { freq: SCALE.E5, dur: 0.13, type: 'triangle', vol: 0.42, t: 0.1 },
           { freq: SCALE.G5, dur: 0.26, type: 'triangle', vol: 0.46, t: 0.2 }]);
    },
    // 大きな達成（ファンファーレ）
    fanfare: function () {
      seq([
        { freq: SCALE.C5, dur: 0.16, type: 'triangle', vol: 0.45 },
        { freq: SCALE.C5, dur: 0.12, type: 'triangle', vol: 0.45, t: 0.16 },
        { freq: SCALE.C5, dur: 0.12, type: 'triangle', vol: 0.45, t: 0.30 },
        { freq: SCALE.C5, dur: 0.18, type: 'triangle', vol: 0.5,  t: 0.44 },
        { freq: SCALE.E5, dur: 0.18, type: 'triangle', vol: 0.5,  t: 0.62 },
        { freq: SCALE.G5, dur: 0.18, type: 'triangle', vol: 0.5,  t: 0.80 },
        { freq: SCALE.C5 * 2, dur: 0.5, type: 'triangle', vol: 0.55, t: 0.98 },
        // きらきらの上モノ
        { freq: SCALE.E5, dur: 0.4, type: 'sine', vol: 0.2, t: 1.0 },
        { freq: SCALE.G5, dur: 0.4, type: 'sine', vol: 0.2, t: 1.05 }
      ]);
    },
    // 上昇スワイプ（画面遷移・解禁）
    whoosh: function () {
      tone({ freq: 320, dur: 0.3, type: 'sine', vol: 0.28, slideTo: 900 });
    },
    // きらーん（星・ごほうび）
    sparkle: function () {
      seq([{ freq: SCALE.A5, dur: 0.1, type: 'sine', vol: 0.3 },
           { freq: SCALE.C5 * 2, dur: 0.1, type: 'sine', vol: 0.3, t: 0.07 },
           { freq: SCALE.E5 * 2, dur: 0.18, type: 'sine', vol: 0.3, t: 0.14 }]);
    },
    SCALE: SCALE
  };

  // 最初の操作で必ずアンロック
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    global.addEventListener(ev, unlock, { once: false, passive: true });
  });

  global.Sfx = Sfx;
})(window);
