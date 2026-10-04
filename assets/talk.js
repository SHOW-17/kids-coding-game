/* ============================================================
   talk.js — あそびのもり 共通「こえの あんない」（よみあげ）
   ------------------------------------------------------------
   ■ ねらい
   - 小1は文字を読めない前提。ヒント1行（「いまやること」）を
     やさしい声で読み上げて、「よめなくても わかる」を担保する。
   - Web Speech API（speechSynthesis・ja-JP）を使う。端末内の音声合成なので
     通信しない。未対応環境（Android WebView 等）では何もしない＝落ちない。

   ■ 使い方（各HTML）
       <div class="hint" id="hint" data-talk>…</div>   ← data-talk を付けるだけ
       <script src="../assets/talk.js"></script>
     - data-talk の要素は、文字が変わると自動で読み上げる（短い間に連続で
       変わったら最後の1回だけ）。タップするともう一度読む（スピーカー印つき）。
     - data-talk="tap" は自動では読まず、タップのときだけ読む。
     - JS から直接: Talk.say('やったね！')

   ■ API
       Talk.say(text)        読み上げる（前の読み上げは止める）
       Talk.stop()           止める
       Talk.supported        端末が対応しているか
       Talk.enabled          ON/OFF（おうちの ひと メニューで切替・全画面共通で保存）
       Talk.setEnabled(b)
       Talk.pause(b)         一時的に黙らせる（うたあそびのマイク中など）
   ============================================================ */
(function (global) {
  'use strict';

  var synth = global.speechSynthesis;
  var supported = !!(synth && global.SpeechSynthesisUtterance);

  var KEY = 'amori_talk_on';
  var enabled = true;
  try { var s = localStorage.getItem(KEY); if (s !== null) enabled = (s === '1'); } catch (e) {}

  var paused = false;
  var activated = false;      // ユーザー操作のあと（ブラウザの自動再生制限）
  var pending = null;         // 操作前に出たヒント（最初のタップで読む）
  var lastText = '', lastAt = 0;
  var voice = null;

  function pickVoice() {
    if (!supported) return null;
    var vs = [];
    try { vs = synth.getVoices() || []; } catch (e) {}
    var ja = vs.filter(function (v) { return /^ja/i.test(v.lang); });
    if (!ja.length) return null;
    // 自然な声を優先（端末ごとに名前が違う）
    var pref = [/google/i, /kyoko/i, /o-?ren/i, /nanami/i, /haruka/i, /ayumi/i];
    for (var i = 0; i < pref.length; i++) {
      for (var j = 0; j < ja.length; j++) if (pref[i].test(ja[j].name)) return ja[j];
    }
    return ja[0];
  }
  if (supported) {
    voice = pickVoice();
    try { synth.addEventListener('voiceschanged', function () { voice = pickVoice(); }); } catch (e) {}
  }

  // 読み上げ用に整える（記号・絵文字を落とす。ひらがなは そのまま）
  function clean(t) {
    return String(t || '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️]/gu, '')
      .replace(/[⬆⬇⬅➡▶◀★☆●○♪…]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function speakNow(text) {
    if (!supported || !enabled || paused) return;
    var t = clean(text);
    if (!t) return;
    var now = Date.now();
    if (t === lastText && now - lastAt < 1200) return;   // 同じ文の連打は1回
    lastText = t; lastAt = now;
    try {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(t);
      u.lang = 'ja-JP';
      if (voice) u.voice = voice;
      u.rate = 0.95;      // 小1向けに少しゆっくり
      u.pitch = 1.15;     // やさしく明るめ
      u.volume = 1;
      synth.speak(u);
    } catch (e) {}
  }

  function say(text) {
    if (!activated) { pending = { text: text, at: Date.now() }; return; }
    speakNow(text);
  }
  function stop() { try { if (supported) synth.cancel(); } catch (e) {} pending = null; }

  // 最初の操作で「起こす」。操作前に出ていたヒントは 6秒以内なら読む
  function activate() {
    if (activated) return;
    activated = true;
    if (pending && Date.now() - pending.at < 6000) {
      var p = pending; pending = null;
      setTimeout(function () { speakNow(p.text); }, 60);
    }
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    global.addEventListener(ev, activate, { capture: true, passive: true });
  });
  // 画面を離れたら黙る
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
  global.addEventListener('pagehide', stop);

  /* ---- data-talk の自動配線 ---- */
  function styleOnce() {
    if (document.getElementById('talk-style')) return;
    var st = document.createElement('style');
    st.id = 'talk-style';
    // スピーカー印（CSS mask。絵文字は使わない）
    st.textContent =
      '[data-talk].talk-on{cursor:pointer;}' +
      '[data-talk].talk-on::after{content:"";display:inline-block;vertical-align:-3px;' +
      'width:1.05em;height:1.05em;margin-left:.4em;opacity:.55;background:currentColor;' +
      '-webkit-mask:var(--talk-ic) center/contain no-repeat;mask:var(--talk-ic) center/contain no-repeat;}' +
      '[data-talk].talk-speak::after{animation:talkPulse .6s ease-in-out 2;}' +
      '@keyframes talkPulse{50%{transform:scale(1.25);opacity:.9}}' +
      ':root{--talk-ic:url("data:image/svg+xml,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z" fill="#000"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="#000" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>') +
      '");}' +
      '@media (prefers-reduced-motion: reduce){[data-talk].talk-speak::after{animation:none}}';
    document.head.appendChild(st);
  }

  function wire(el) {
    if (el.__talk) return;
    el.__talk = true;
    if (!supported || !enabled) return;
    el.classList.add('talk-on');
    var mode = el.getAttribute('data-talk');
    var timer = null;
    var flash = function () {
      el.classList.remove('talk-speak'); void el.offsetWidth; el.classList.add('talk-speak');
    };
    el.addEventListener('click', function () { lastText = ''; speakNow(el.textContent); flash(); });
    if (mode === 'tap') return;
    var last = clean(el.textContent);
    var onChange = function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var t = clean(el.textContent);
        if (!t || t === last) return;
        last = t;
        // 見えていない（hidden な画面の中の）ヒントは読まない
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return;
        say(t);
      }, 280);
    };
    try {
      new MutationObserver(onChange).observe(el, { childList: true, characterData: true, subtree: true });
    } catch (e) {}
    // 最初の文（ページを開いた直後のヒント）
    if (el.offsetParent !== null && last) say(last);
  }
  function scan() {
    styleOnce();
    var els = document.querySelectorAll('[data-talk]');
    for (var i = 0; i < els.length; i++) wire(els[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();

  global.Talk = {
    get supported() { return supported; },
    get enabled() { return enabled; },
    setEnabled: function (b) {
      enabled = !!b;
      try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (e) {}
      if (!enabled) stop();
    },
    pause: function (b) { paused = !!b; if (paused) stop(); },
    say: say,
    stop: stop,
    rescan: scan
  };
})(window);
