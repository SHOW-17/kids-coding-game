/* ============================================================
   bgm.js — あそびのもり 共通BGMエンジン
   ------------------------------------------------------------
   ■ 方針
   - 画面ごとに曲を割り当てて、やさしくループ再生する。
   - mp3 を assets/bgm/<トラック名>.mp3 に置けば、それを優先して鳴らす。
     （例: assets/bgm/home.mp3 / programming.mp3 ...）
     ※ うちの子がはまってる曲を入れればOK。差し替えるだけ。
   - mp3 が無いトラックは、Web Audio で合成した「やさしいオリジナル
     ループBGM」を暫定で鳴らす（著作権フリー・ロード待ちゼロ・落ちない）。
   - 端末ミュート/未対応でも try/catch で必ず無音フォールバック。
   - 右上に音符トグルボタンを自動で出す。ON/OFF は全画面共通で保存。

   ■ 使い方（各HTML）
       <script src="assets/bgm.js"></script>      // index から
       <script src="../assets/bgm.js"></script>   // games/ から
       Bgm.play('home');                          // 画面ロード後に1回

   ■ API
       Bgm.play(track)     トラックを鳴らす（ボタンも自動設置）
       Bgm.stop()          止める
       Bgm.toggle()        ON/OFF 切替（戻り値: 新しい enabled）
       Bgm.setEnabled(b)   ON/OFF 設定
       Bgm.enabled         現在の ON/OFF
   ============================================================ */
(function (global) {
  'use strict';

  var AC = global.AudioContext || global.webkitAudioContext;

  /* このスクリプト自身の URL を基準に assets/bgm/ を解決
     （index からでも games/ からでも同じパスで mp3 を探せる） */
  var SELF = (document.currentScript && document.currentScript.src) || '';
  function mp3url(track) {
    try { return new URL('bgm/' + track + '.mp3', SELF).href; }
    catch (e) { return 'bgm/' + track + '.mp3'; }
  }

  /* mp3 の探索順を返す。
     1) 画面別 <track>.mp3（あれば最優先）
     2) 共通 _default.mp3（全画面で同じ曲を流したいとき。1ファイル置けばOK）
     どちらも無ければ合成BGMへフォールバックする。 */
  var SHARED = '_default';
  function mp3candidates(track) {
    return track === SHARED ? [mp3url(SHARED)] : [mp3url(track), mp3url(SHARED)];
  }

  /* ---- ON/OFF 永続化（全画面共通キー）---- */
  var KEY = 'amori_bgm_on';
  var enabled = true;
  try {
    var saved = localStorage.getItem(KEY);
    if (saved !== null) enabled = (saved === '1');
  } catch (e) {}
  function persist() { try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (e) {} }

  /* ============================================================
     音名 → 周波数（A4 = 440Hz の平均律）
     "C4","D#5","Eb3" などに対応。0/null/'' は休符。
     ============================================================ */
  var SEMI = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  function freq(name) {
    if (!name) return 0;
    var m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    var semi = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    var midi = semi + (parseInt(m[3], 10) + 1) * 12; // C4 = midi 60
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ============================================================
     トラック定義（暫定の合成メロディ）
     - step: 1ステップの拍数（0.5 = 8分音符）
     - lead/bass: ステップ列。各自の長さでループ（音名 or 0=休符）
     - すべてオリジナルの単純な進行。実在曲は使っていない。
     mp3 を置けばこの合成は使われず mp3 が鳴る。
     ============================================================ */
  function r(name, n) { var a = []; for (var i = 0; i < n; i++) a.push(name); return a; } // 連続休符など
  var TRACKS = {
    // ホーム：明るく弾む（Cメジャー・ペンタ寄り）
    home: {
      bpm: 104, step: 0.5, type: 'triangle',
      lead: ['C5','E5','G5','E5','A4','C5','E5','C5',
             'D5','F5','A5','F5','G4','B4','D5','G4',
             'C5','E5','G5','C6','A5','G5','E5','D5',
             'C5',0,'G4',0,'C5',0,0,0],
      bass: ['C3',0,'G3',0,'A2',0,'E3',0,
             'F2',0,'C3',0,'G2',0,'D3',0],
      bassType: 'sine'
    },
    // プログラミング：コミカルに歩く（軽快）
    programming: {
      bpm: 116, step: 0.5, type: 'square',
      lead: ['C5',0,'C5','D5','E5',0,'E5','F5',
             'G5',0,'E5',0,'C5',0,'G4',0,
             'A4',0,'A4','B4','C5',0,'C5','D5',
             'E5',0,'C5',0,'G4',0,0,0],
      bass: ['C3','G3','C3','G3','F3','C4','G3','D4'],
      bassType: 'triangle', leadVol: 0.16
    },
    // まねっこ：ふしぎ・きおく（やわらかい上モノ）
    manekko: {
      bpm: 88, step: 0.5, type: 'sine',
      lead: ['A4',0,'C5',0,'E5',0,'D5',0,
             'C5',0,'A4',0,'G4',0,0,0,
             'F4',0,'A4',0,'C5',0,'B4',0,
             'A4',0,'E4',0,'A4',0,0,0],
      bass: ['A2',0,0,0,'F2',0,0,0,'G2',0,0,0,'E2',0,0,0],
      bassType: 'sine'
    },
    // きまり：すいり・おちつき
    kimari: {
      bpm: 92, step: 0.5, type: 'triangle',
      lead: ['E5',0,'D5',0,'C5',0,'D5',0,
             'E5',0,'E5',0,'E5',0,0,0,
             'D5',0,'D5',0,'E5',0,'G5',0,
             'E5',0,'D5',0,'C5',0,0,0],
      bass: ['C3',0,'G2',0,'A2',0,'E2',0,'F2',0,'C3',0,'G2',0,0,0],
      bassType: 'sine'
    },
    // かたち：やわらか・まるい
    katachi: {
      bpm: 84, step: 0.5, type: 'sine',
      lead: ['G4',0,'B4',0,'D5',0,'B4',0,
             'C5',0,'E5',0,'D5',0,0,0,
             'A4',0,'C5',0,'E5',0,'D5',0,
             'C5',0,'B4',0,'G4',0,0,0],
      bass: ['G2',0,0,0,'C3',0,0,0,'A2',0,0,0,'D3',0,0,0],
      bassType: 'sine'
    },
    // ぴたごら：コロコロ転がる（はずむ）
    pitagora: {
      bpm: 120, step: 0.5, type: 'triangle',
      lead: ['C5','D5','E5','G5','E5','D5','C5',0,
             'D5','E5','F5','A5','F5','E5','D5',0,
             'E5','F5','G5','C6','G5','F5','E5',0,
             'G5','E5','C5','E5','G5',0,0,0],
      bass: ['C3','C3','G3','G3','F3','F3','G3','G3'],
      bassType: 'sine'
    }
  };

  /* ============================================================
     Web Audio 合成プレイヤー（lookahead スケジューラ）
     ============================================================ */
  var ctx = null, master = null;
  function ensureCtx() {
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0;             // フェードインのため 0 から
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    return ctx;
  }

  var synth = {
    timer: null, track: null,
    leadStep: 0, bassStep: 0,
    nextLead: 0, nextBass: 0,

    voice: function (f, when, dur, type, vol) {
      if (!f) return;
      try {
        var o = ctx.createOscillator();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(f, when);
        var g = ctx.createGain();
        var atk = 0.02, v = vol;
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(v, when + atk);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        o.connect(g); g.connect(master);
        o.start(when); o.stop(when + dur + 0.05);
        o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) {} };
      } catch (e) {}
    },

    schedule: function () {
      if (!ctx) return;
      var t = this.track, spb = 60 / t.bpm;     // 1拍の秒数
      var leadDur = t.step * spb, bassDur = (t.step * 2) * spb;
      var ahead = ctx.currentTime + 0.2;
      // 主旋律（step刻み）
      while (this.nextLead < ahead) {
        var ln = t.lead[this.leadStep % t.lead.length];
        this.voice(freq(ln), this.nextLead, leadDur * 0.92, t.type, t.leadVol || 0.2);
        this.leadStep++; this.nextLead += leadDur;
      }
      // ベース（2step刻み＝ゆっくり）
      while (this.nextBass < ahead) {
        var bn = t.bass[this.bassStep % t.bass.length];
        this.voice(freq(bn), this.nextBass, bassDur * 0.9, t.bassType || 'sine', 0.16);
        this.bassStep++; this.nextBass += bassDur;
      }
    },

    start: function (track) {
      if (!ensureCtx()) return;
      this.stop();
      this.track = TRACKS[track] || TRACKS.home;
      this.leadStep = 0; this.bassStep = 0;
      var t0 = ctx.currentTime + 0.06;
      this.nextLead = t0; this.nextBass = t0;
      try { master.gain.cancelScheduledValues(ctx.currentTime); } catch (e) {}
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.32, ctx.currentTime + 1.4); // やさしくフェードイン
      var self = this;
      this.timer = setInterval(function () { self.schedule(); }, 40);
    },

    stop: function () {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      if (ctx && master) {
        try {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
          master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        } catch (e) {}
      }
    }
  };

  /* ============================================================
     再生コントローラ（mp3 優先 → 無ければ合成）
     ============================================================ */
  var curTrack = null;
  var audioEl = null;     // mp3 用
  var usingMp3 = false;
  var started = false;    // ユーザー操作後に本当に鳴り始めたか

  function startPlayback() {
    if (!enabled || !curTrack) return;
    started = true;
    // まず mp3 を試す
    if (!audioEl) {
      try {
        audioEl = new Audio();
        audioEl.loop = true;
        audioEl.preload = 'auto';
      } catch (e) { audioEl = null; }
    }
    if (audioEl) {
      usingMp3 = true;
      audioEl.volume = 0;
      var fadeIn = function () {
        var step = function () {
          if (!usingMp3 || !audioEl) return;
          if (audioEl.volume < 0.6) {
            audioEl.volume = Math.min(0.6, audioEl.volume + 0.04);
            setTimeout(step, 60);
          }
        };
        step();
      };
      audioEl.oncanplay = null;
      // 候補 mp3 を順に試し、すべて読めなければ合成へフォールバック。
      var cands = mp3candidates(curTrack);
      var ci = 0, done = false, attempt = 0;
      // 同じ候補について onerror と play().catch が両方来ても、次候補へは1回だけ進む。
      var failCurrent = function (a) {
        if (done || a !== attempt) return;   // 既に解決済み／別試行のイベントは無視
        attempt++;
        tryNext();
      };
      function tryNext() {
        if (done) return;
        if (ci >= cands.length) {            // mp3 が一つも無い → 合成へ
          done = true; usingMp3 = false;
          try { audioEl.pause(); } catch (e) {}
          synth.start(curTrack);
          return;
        }
        var a = attempt;
        audioEl.onerror = function () { failCurrent(a); };  // 読み込み失敗 → 次候補
        audioEl.src = cands[ci++];
        var p = audioEl.play();
        if (p && p.then) {
          p.then(function () { if (a === attempt) { done = true; fadeIn(); } })
           .catch(function () { failCurrent(a); });   // この候補は不可 → 次の候補へ
        } else { done = true; fadeIn(); }
      }
      tryNext();
    } else {
      synth.start(curTrack);
    }
  }

  function stopPlayback() {
    started = false;
    if (audioEl) { try { audioEl.pause(); } catch (e) {} }
    synth.stop();
  }

  /* 自動再生制限：最初のユーザー操作で開始
     ※ ここで AudioContext を「ユーザー操作の瞬間」に必ず起こしておく。
        こうしないと、mp3 が無くて合成へフォールバックするとき（onerror は
        非同期＝操作の瞬間を外れる）に AudioContext が suspended のままになり、
        合成BGMが永久に鳴らない。 */
  function kick() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} }
    if (enabled && curTrack && !started) startPlayback();
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    global.addEventListener(ev, kick, { passive: true });
  });

  /* ============================================================
     バックグラウンド化したら必ず止める
     ------------------------------------------------------------
     Safari（特にiOS）はページが隠れても <audio> が裏で鳴り続けるため、
     アプリを離れる/タブを切替/ホームに戻ると BGM が残ってしまう。
     画面が隠れたら止め、戻ってきたら再生中だったトラックを再開する。
     ============================================================ */
  function pauseForHide() {
    // started は保持（＝復帰時にどのトラックを鳴らすか覚えておく）。
    if (audioEl) { try { audioEl.pause(); } catch (e) {} }
    synth.stop();
  }
  function resumeFromShow() {
    if (!enabled || !curTrack || !started) return;
    if (usingMp3 && audioEl) {
      var p = audioEl.play();
      // 自動再開が拒否されたら、次のユーザー操作で鳴らせるよう started を戻す。
      if (p && p.catch) p.catch(function () { started = false; });
    } else if (!usingMp3) {
      synth.start(curTrack);
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pauseForHide();
    else resumeFromShow();
  });
  // bfcache 退避・ページ離脱でも確実に止める。
  global.addEventListener('pagehide', pauseForHide);

  /* ============================================================
     トグルボタン（右上・自動マウント）
     ============================================================ */
  var btn = null;
  function injectStyle() {
    if (document.getElementById('bgm-style')) return;
    var s = document.createElement('style');
    s.id = 'bgm-style';
    s.textContent =
      '#bgmBtn{position:fixed;top:calc(10px + env(safe-area-inset-top));' +
      'right:calc(10px + env(safe-area-inset-right));z-index:9999;' +
      'width:46px;height:46px;border:none;cursor:pointer;border-radius:16px;' +
      'background:#fff;display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 5px 0 rgba(60,60,90,.18), inset 0 2px 0 #fff;' +
      '-webkit-tap-highlight-color:transparent;transition:transform .12s ease;}' +
      '#bgmBtn:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(60,60,90,.18), inset 0 2px 0 #fff;}' +
      '#bgmBtn .ic{width:24px;height:24px;background:#7a7aa8;transition:background .15s;' +
      '-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat;}' +
      '#bgmBtn.on .ic{background:#ff8fab;}';
    document.head.appendChild(s);
  }
  // ON: 音符あり / OFF: 音符に斜線（CSS mask の SVG を差し替え）
  var ICON_ON  = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M9 17V5l10-2v12' fill='none' stroke='%23000' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='6.5' cy='17.5' r='3' fill='%23000'/%3E%3Ccircle cx='16.5' cy='15.5' r='3' fill='%23000'/%3E%3C/svg%3E\")";
  var ICON_OFF = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M9 17V5l10-2v12' fill='none' stroke='%23000' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='6.5' cy='17.5' r='3' fill='%23000'/%3E%3Ccircle cx='16.5' cy='15.5' r='3' fill='%23000'/%3E%3Cline x1='3' y1='21' x2='21' y2='3' stroke='%23000' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E\")";

  function syncBtn() {
    if (!btn) return;
    btn.classList.toggle('on', enabled);
    var ic = btn.querySelector('.ic');
    ic.style.setProperty('--m', enabled ? ICON_ON : ICON_OFF);
    btn.setAttribute('aria-label', enabled ? 'おんがくを とめる' : 'おんがくを ながす');
  }
  function mountButton() {
    if (btn) return;
    injectStyle();
    btn = document.createElement('button');
    btn.id = 'bgmBtn';
    btn.innerHTML = '<span class="ic"></span>';
    btn.addEventListener('click', function () {
      if (global.Sfx && Sfx.tap) try { Sfx.tap(); } catch (e) {}
      Bgm.toggle();
    });
    (document.body || document.documentElement).appendChild(btn);
    syncBtn();
  }

  /* ============================================================
     公開 API
     ============================================================ */
  var Bgm = {
    get enabled() { return enabled; },
    play: function (track) {
      curTrack = track;
      if (document.body) mountButton();
      else document.addEventListener('DOMContentLoaded', mountButton);
      // 実再生はブラウザの自動再生制限に従い、最初のユーザー操作（kick）で開始する。
      // ただし Capacitor アプリ内の WebView は自動再生が許可されている
      // （Bridge が setMediaPlaybackRequiresUserGesture(false) を設定）ため、
      // タップを待たず即時に開始する。失敗時は従来どおり kick で再試行される。
      if (global.Capacitor) kick();
    },
    stop: stopPlayback,
    setEnabled: function (b) {
      enabled = !!b; persist(); syncBtn();
      if (!enabled) stopPlayback();
      else if (curTrack) startPlayback();
    },
    toggle: function () { this.setEnabled(!enabled); return enabled; }
  };

  global.Bgm = Bgm;
})(window);
