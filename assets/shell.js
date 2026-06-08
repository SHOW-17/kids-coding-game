/* ============================================================
   shell.js — あそびのもり 共通UIヘルパー
   ------------------------------------------------------------
   各ゲーム共通の小物をまとめる：
   - App.toast(msg)            … その場ヒントの吹き出し
   - App.topbar({title,back})  … 戻る/タイトル/音ボタン付きヘッダー生成
   - App.confirm / App.modal   … モーダル制御
   - App.go(href)              … 画面遷移（whoosh＋フェード）
   依存：audio.js（Sfx）, fx.js（任意）
   ============================================================ */
(function (global) {
  'use strict';

  var doc = document;

  function el(tag, cls, html) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---- トースト ---- */
  var toastEl = null, toastTimer = null;
  function toast(msg, ms) {
    if (!toastEl) { toastEl = el('div', 'toast'); doc.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2200);
  }

  /* ---- ミュートボタン（状態はlocalStorageへ） ---- */
  function muteButton() {
    var btn = el('button', 'icon-btn');
    btn.setAttribute('aria-label', 'おと');
    var saved = false;
    try { saved = global.Save && Save.game('app').get('muted', false); } catch (e) {}
    if (global.Sfx) Sfx.setMuted(saved);
    function render() { btn.textContent = (global.Sfx && Sfx.muted) ? '🔇' : '🔊'; }
    render();
    btn.addEventListener('click', function () {
      var m = global.Sfx ? Sfx.toggleMute() : false;
      try { Save.game('app').set('muted', m); } catch (e) {}
      render();
      if (!m && global.Sfx) Sfx.tap();
    });
    return btn;
  }

  /* ---- 戻るボタン ---- */
  function backButton(href) {
    var btn = el('button', 'icon-btn');
    btn.setAttribute('aria-label', 'もどる');
    btn.textContent = '🏠';
    btn.addEventListener('click', function () { go(href || '../index.html'); });
    return btn;
  }

  /* ---- ヘッダー生成 ---- */
  function topbar(opts) {
    opts = opts || {};
    var bar = el('div', 'topbar safe-top');
    bar.appendChild(backButton(opts.back));
    var title = el('div', 'title', opts.title || '');
    bar.appendChild(title);
    if (opts.right) { bar.appendChild(opts.right); }
    else { bar.appendChild(muteButton()); }
    return bar;
  }

  /* ---- 画面遷移（whoosh＋フェードアウト） ---- */
  var transitioning = false;
  function go(href) {
    if (transitioning) return;
    transitioning = true;
    try { if (global.Sfx) Sfx.whoosh(); } catch (e) {}
    var fade = el('div');
    fade.style.cssText =
      'position:fixed;inset:0;z-index:9998;background:var(--bg-2,#ffe9c7);' +
      'opacity:0;transition:opacity .32s ease;pointer-events:none;';
    doc.body.appendChild(fade);
    requestAnimationFrame(function () { fade.style.opacity = '1'; });
    setTimeout(function () { global.location.href = href; }, 300);
  }

  /* ---- 汎用モーダル ----
     show({emoji, title, text, buttons:[{label,cls,onClick}]}) */
  var overlay = null, modal = null;
  function ensureModal() {
    if (overlay) return;
    overlay = el('div', 'overlay');
    modal = el('div', 'modal');
    overlay.appendChild(modal);
    doc.body.appendChild(overlay);
  }
  function showModal(cfg) {
    ensureModal();
    cfg = cfg || {};
    modal.innerHTML = '';
    if (cfg.emoji) modal.appendChild(el('div', 'big-emoji', cfg.emoji));
    if (cfg.title) modal.appendChild(el('h2', null, cfg.title));
    if (cfg.text) modal.appendChild(el('p', null, cfg.text));
    var row = el('div');
    row.style.cssText = 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;';
    (cfg.buttons || []).forEach(function (b) {
      var btn = el('button', 'btn ' + (b.cls || ''), b.label);
      btn.addEventListener('click', function () {
        if (global.Sfx) Sfx.tap();
        if (b.keepOpen !== true) hideModal();
        if (b.onClick) b.onClick();
      });
      row.appendChild(btn);
    });
    if ((cfg.buttons || []).length) modal.appendChild(row);
    requestAnimationFrame(function () { overlay.classList.add('show'); });
    return { close: hideModal };
  }
  function hideModal() { if (overlay) overlay.classList.remove('show'); }

  /* ---- 軽いハプティック（対応端末のみ） ---- */
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 18); } catch (e) {} }

  global.App = {
    el: el, toast: toast, topbar: topbar, backButton: backButton,
    muteButton: muteButton, go: go, showModal: showModal, hideModal: hideModal,
    buzz: buzz
  };
})(window);
