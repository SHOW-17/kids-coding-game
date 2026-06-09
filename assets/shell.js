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

  /* ---- CSSマスクのアイコン（絵文字は使わない方針：Design.md §5） ----
     外部CSSに依存しないよう、必要なスタイルはインラインで自己完結させる */
  var ICON_PATHS = {
    home: "M12 3 2 12h3v8h5v-5h4v5h5v-8h3z",
    sound: "M3 9v6h4l5 5V4L7 9zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z",
    muted: "M3 9v6h4l5 5V4L7 9zm18.3-1.3-1.4-1.4L17 9.2 14.1 6.3l-1.4 1.4L15.6 10.6l-2.9 2.9 1.4 1.4 2.9-2.9 2.9 2.9 1.4-1.4-2.9-2.9z"
  };
  function maskIcon(name) {
    var span = el('span');
    var svg = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='" +
      ICON_PATHS[name] + "'/%3E%3C/svg%3E\") center/contain no-repeat";
    span.style.cssText = 'display:inline-block;width:22px;height:22px;background:currentColor;' +
      '-webkit-mask:' + svg + ';mask:' + svg + ';';
    return span;
  }

  /* ---- ミュートボタン（状態はlocalStorageへ） ---- */
  function muteButton() {
    var btn = el('button', 'icon-btn');
    btn.setAttribute('aria-label', 'おと');
    var saved = false;
    try { saved = global.Save && Save.game('app').get('muted', false); } catch (e) {}
    if (global.Sfx) Sfx.setMuted(saved);
    function render() {
      btn.innerHTML = '';
      btn.appendChild(maskIcon((global.Sfx && Sfx.muted) ? 'muted' : 'sound'));
    }
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
    btn.appendChild(maskIcon('home'));
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
  var fadeEl = null;
  function go(href) {
    if (transitioning) return;
    transitioning = true;
    try { if (global.Sfx) Sfx.whoosh(); } catch (e) {}
    fadeEl = el('div');
    fadeEl.style.cssText =
      'position:fixed;inset:0;z-index:9998;background:var(--bg-2,#ffe9c7);' +
      'opacity:0;transition:opacity .32s ease;pointer-events:none;';
    doc.body.appendChild(fadeEl);
    requestAnimationFrame(function () { if (fadeEl) fadeEl.style.opacity = '1'; });
    setTimeout(function () { global.location.href = href; }, 300);
  }
  // ブラウザ「戻る」での bfcache 復帰時にフェード幕と遷移ロックを解除
  global.addEventListener('pageshow', function (e) {
    if (e.persisted || transitioning) {
      transitioning = false;
      if (fadeEl && fadeEl.parentNode) fadeEl.parentNode.removeChild(fadeEl);
      fadeEl = null;
    }
  });

  /* ---- 汎用モーダル ----
     show({emoji, title, text, buttons:[{label,cls,onClick}]}) */
  var overlay = null, modal = null, modalDismissable = false;
  function ensureModal() {
    if (overlay) return;
    overlay = el('div', 'overlay');
    modal = el('div', 'modal');
    overlay.appendChild(modal);
    doc.body.appendChild(overlay);
    // アクセシビリティ：ダイアログとして読み上げ可能に
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    // 幕の外（ダイアログ自身でない部分）をタップで閉じる
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay && modalDismissable) hideModal();
    });
    // Escape でも閉じる
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalDismissable &&
          overlay.classList.contains('show')) hideModal();
    });
  }
  function showModal(cfg) {
    ensureModal();
    cfg = cfg || {};
    // dismissOnBackdrop が明示 false のときだけ幕外タップ無効。既定は閉じてOK
    modalDismissable = (cfg.dismissOnBackdrop !== false);
    modal.innerHTML = '';
    if (cfg.emoji) modal.appendChild(el('div', 'big-emoji', cfg.emoji));
    if (cfg.title) modal.appendChild(el('h2', null, cfg.title));
    if (cfg.text) modal.appendChild(el('p', null, cfg.text));
    var row = el('div');
    row.style.cssText = 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;';
    var firstBtn = null;
    (cfg.buttons || []).forEach(function (b) {
      var btn = el('button', 'btn ' + (b.cls || ''), b.label);
      if (!firstBtn) firstBtn = btn;
      btn.addEventListener('click', function () {
        if (global.Sfx) Sfx.tap();
        if (b.keepOpen !== true) hideModal();
        if (b.onClick) b.onClick();
      });
      row.appendChild(btn);
    });
    if ((cfg.buttons || []).length) modal.appendChild(row);
    requestAnimationFrame(function () {
      overlay.classList.add('show');
      // 主ボタンへフォーカス（キーボード/スクリーンリーダー）
      if (firstBtn) { try { firstBtn.focus(); } catch (e) {} }
    });
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
