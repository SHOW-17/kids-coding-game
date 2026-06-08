/* ============================================================
   fx.js — あそびのもり 共通エフェクトエンジン
   ------------------------------------------------------------
   - 紙吹雪 / キラキラ / 画面シェイク / 浮かぶ絵文字 / リング波
   - canvas を1枚だけ重ね、requestAnimationFrame で描画
   - 軽量・依存なし。どのゲームからも FX.confetti() 等で呼べる
   ============================================================ */
(function (global) {
  'use strict';

  var canvas = null, g = null, dpr = 1;
  var particles = [];
  var running = false;
  var MAX_PARTICLES = 600;   // 溜まりすぎ防止（描画負荷の上限）

  // 「動きを減らす」設定を尊重（無いブラウザでもエラーにならないよう判定）
  function reduceMotion() {
    try {
      return global.matchMedia &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  // 上限を超えた分は古いものから捨てる
  function clampParticles() {
    if (particles.length > MAX_PARTICLES) {
      particles.splice(0, particles.length - MAX_PARTICLES);
    }
  }

  function init() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'fx-canvas';
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    g = canvas.getContext('2d');
    resize();
    global.addEventListener('resize', resize, { passive: true });
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, global.devicePixelRatio || 1);
    canvas.width = global.innerWidth * dpr;
    canvas.height = global.innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loop() {
    if (!running) return;
    var W = global.innerWidth, H = global.innerHeight;
    g.clearRect(0, 0, W, H);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= 1;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.update(p);
      p.draw(g, p);
    }
    if (particles.length === 0) { running = false; g.clearRect(0, 0, W, H); return; }
    requestAnimationFrame(loop);
  }

  function start() { clampParticles(); if (!running) { running = true; requestAnimationFrame(loop); } }

  function rnd(a, b) { return a + (b - a) * fakeRandom(); }
  // Math.random() はこの環境のスクリプトでは可。ブラウザでは普通に使える
  function fakeRandom() { return Math.random(); }

  var CONFETTI_COLORS =
    ['#ff6b9d', '#ffd23f', '#5cc8e8', '#6ad08a', '#b58cff', '#ff9f43', '#ff5e7e'];

  // ---- 紙吹雪 ----
  function confetti(opts) {
    init();
    opts = opts || {};
    var W = global.innerWidth;
    var count = opts.count || 130;
    if (reduceMotion()) count = Math.min(count, 36);  // 動き控えめ設定では量を抑える
    var originX = opts.x != null ? opts.x : W / 2;
    var originY = opts.y != null ? opts.y : -10;
    var spread = opts.spread != null ? opts.spread : W;
    for (var i = 0; i < count; i++) {
      var col = CONFETTI_COLORS[(i + (Math.random() * 7 | 0)) % CONFETTI_COLORS.length];
      var shape = Math.random() < 0.35 ? 'circle' : 'rect';
      particles.push({
        x: originX + rnd(-spread / 2, spread / 2),
        y: originY + rnd(-20, 20),
        vx: rnd(-2.2, 2.2),
        vy: rnd(1.5, 5),
        rot: rnd(0, 6.28),
        vr: rnd(-0.25, 0.25),
        size: rnd(7, 13),
        color: col,
        shape: shape,
        sway: rnd(0.01, 0.05),
        swayPhase: rnd(0, 6.28),
        life: opts.life || rnd(120, 220),
        update: function (p) {
          p.swayPhase += p.sway;
          p.x += p.vx + Math.sin(p.swayPhase) * 1.1;
          p.y += p.vy;
          p.vy += 0.045;
          p.rot += p.vr;
        },
        draw: function (ctx, p) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.min(1, p.life / 40);
          ctx.fillStyle = p.color;
          if (p.shape === 'circle') {
            ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, 6.283); ctx.fill();
          } else {
            ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          }
          ctx.restore();
        }
      });
    }
    start();
  }

  // ---- 一点から弾ける（タップごほうび・正解） ----
  function burst(x, y, opts) {
    init();
    opts = opts || {};
    var count = opts.count || 22;
    var colors = opts.colors || CONFETTI_COLORS;
    for (var i = 0; i < count; i++) {
      var a = (Math.PI * 2 * i) / count + rnd(-0.2, 0.2);
      var sp = rnd(2.5, 6.5) * (opts.power || 1);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        size: rnd(5, 10),
        color: colors[i % colors.length],
        life: rnd(35, 60),
        update: function (p) { p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.97; },
        draw: function (ctx, p) {
          ctx.save(); ctx.globalAlpha = Math.min(1, p.life / 30);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, 6.283); ctx.fill();
          ctx.restore();
        }
      });
    }
    start();
  }

  // ---- キラキラ星（ゆっくり浮かぶ） ----
  function sparkles(x, y, opts) {
    init();
    opts = opts || {};
    var count = opts.count || 14;
    for (var i = 0; i < count; i++) {
      particles.push({
        x: x + rnd(-40, 40), y: y + rnd(-30, 30),
        vy: rnd(-0.6, -1.6), vx: rnd(-0.4, 0.4),
        size: rnd(8, 18), rot: rnd(0, 6.28), vr: rnd(-0.06, 0.06),
        color: opts.color || '#ffd23f',
        life: rnd(40, 75),
        maxLife: 75,
        update: function (p) { p.x += p.vx; p.y += p.vy; p.vy *= 0.99; p.rot += p.vr; },
        draw: function (ctx, p) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = Math.min(1, p.life / 35);
          ctx.fillStyle = p.color;
          star(ctx, 0, 0, 4, p.size, p.size / 2.2);
          ctx.restore();
        }
      });
    }
    start();
  }

  function star(ctx, cx, cy, spikes, outer, inner) {
    var rot = Math.PI / 2 * 3, step = Math.PI / spikes;
    ctx.beginPath(); ctx.moveTo(cx, cy - outer);
    for (var i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer); rot += step;
      ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner); rot += step;
    }
    ctx.lineTo(cx, cy - outer); ctx.closePath(); ctx.fill();
  }

  // ---- 浮かんで消える絵文字（＋10、🎉 など） ----
  function floatEmoji(x, y, text, opts) {
    init(); opts = opts || {};
    particles.push({
      x: x, y: y, vy: -1.3, size: opts.size || 38, text: text,
      life: opts.life || 60,
      update: function (p) { p.y += p.vy; p.vy *= 0.97; },
      draw: function (ctx, p) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.font = p.size + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }
    });
    start();
  }

  // ---- 広がるリング波（ボタン押下・ワープ） ----
  function ring(x, y, opts) {
    init(); opts = opts || {};
    particles.push({
      x: x, y: y, r: opts.r0 || 6, vr: opts.vr || 5,
      color: opts.color || '#ffffff', lw: opts.lw || 4,
      life: opts.life || 28, maxLife: opts.life || 28,
      update: function (p) { p.r += p.vr; p.vr *= 0.96; },
      draw: function (ctx, p) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.8;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.lw;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.stroke();
        ctx.restore();
      }
    });
    start();
  }

  // ---- 画面シェイク（失敗時など） ----
  function shake(el, intensity, dur) {
    el = el || document.body;
    if (reduceMotion()) return;  // 動き控えめ設定では揺らさない
    intensity = intensity || 8; dur = dur || 380;
    // 元の inline transform を退避し、終了後に必ず復元（他のtransformを壊さない）
    var prev = el.style.transform || '';
    var start = performance.now();
    function frame(t) {
      var p = (t - start) / dur;
      if (p >= 1) { el.style.transform = prev; return; }
      var damp = (1 - p) * intensity;
      var dx = (Math.random() * 2 - 1) * damp;
      var dy = (Math.random() * 2 - 1) * damp;
      el.style.transform = prev + ' translate(' + dx + 'px,' + dy + 'px)';
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---- 派手な勝利演出（紙吹雪 + 左右からの噴射 + キラキラ） ----
  function celebrate() {
    var W = global.innerWidth, H = global.innerHeight;
    confetti({ count: 140 });
    setTimeout(function () { burst(W * 0.2, H * 0.5, { count: 26, power: 1.3 }); }, 150);
    setTimeout(function () { burst(W * 0.8, H * 0.5, { count: 26, power: 1.3 }); }, 280);
    setTimeout(function () { confetti({ count: 80, x: W * 0.3 }); }, 500);
    setTimeout(function () { confetti({ count: 80, x: W * 0.7 }); }, 700);
  }

  global.FX = {
    confetti: confetti, burst: burst, sparkles: sparkles,
    floatEmoji: floatEmoji, ring: ring, shake: shake, celebrate: celebrate,
    COLORS: CONFETTI_COLORS
  };
})(window);
