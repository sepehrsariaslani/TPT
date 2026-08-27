/* =========================================================
   TPT — Scroll Scene
   گرانول → قیف → ذوب → تزریق → قالب → قطعه نهایی
   ========================================================= */
(function () {
  const canvas = document.getElementById('scene-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const scene = document.querySelector('.scene');
  const steps = [...document.querySelectorAll('.hud__step')];
  const bar = document.getElementById('sceneBar');
  const tempEl = document.getElementById('sceneTemp');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1;
  let cx = 0, cy = 0, S = 0;
  let particles = [], shapePts = [];
  let p = 0, pSmooth = 0;

  /* ---------- helpers ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (v, a, b) => clamp((v - a) / (b - a));         // 0..1 inside [a,b]
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const smooth = t => t * t * (3 - 2 * t);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

  /* ---------- product silhouette ---------- */
  function productPath(c, s) {
    // یک محفظه/سطل صنعتی تزریقی با لبه و دسته
    const w = s * .78, h = s * .62, x = -w / 2, y = -h / 2 + s * .06;
    const tp = s * .07; // taper
    c.beginPath();
    c.moveTo(x + tp * .3, y);
    c.lineTo(x + w - tp * .3, y);
    c.quadraticCurveTo(x + w, y, x + w - tp, y + h - s * .05);
    c.quadraticCurveTo(x + w - tp, y + h, x + w - tp - s * .05, y + h);
    c.lineTo(x + tp + s * .05, y + h);
    c.quadraticCurveTo(x + tp, y + h, x + tp, y + h - s * .05);
    c.quadraticCurveTo(x, y, x + tp * .3, y);
    c.closePath();
  }
  function rimPath(c, s) {
    const w = s * .92, h = s * .10, x = -w / 2, y = -s * .34, r = h / 2;
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function sampleShape(size, n) {
    const off = document.createElement('canvas');
    const s = 320;
    off.width = off.height = s;
    const o = off.getContext('2d');
    o.translate(s / 2, s / 2);
    o.fillStyle = '#fff';
    productPath(o, s * .92); o.fill();
    rimPath(o, s * .92); o.fill();
    // دسته‌ها (برش)
    o.globalCompositeOperation = 'destination-out';
    [-1, 1].forEach(d => {
      o.beginPath();
      o.ellipse(d * s * .27, s * .02, s * .055, s * .10, 0, 0, Math.PI * 2);
      o.fill();
    });
    o.globalCompositeOperation = 'source-over';

    const data = o.getImageData(0, 0, s, s).data;
    const pts = [];
    for (let y = 0; y < s; y += 2) {
      for (let x = 0; x < s; x += 2) {
        if (data[(y * s + x) * 4 + 3] > 140) {
          pts.push([(x - s / 2) / s, (y - s / 2) / s]);
        }
      }
    }
    // shuffle
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    const out = [];
    for (let i = 0; i < n; i++) out.push(pts[i % pts.length]);
    // ترتیب پر شدن: از گیت (بالا وسط) به بیرون
    out.sort((a, b) => (a[1] + Math.abs(a[0]) * .55) - (b[1] + Math.abs(b[0]) * .55));
    return out;
  }

  /* ---------- layout / particles ---------- */
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.6);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const wide = W > 820;
    S = Math.min(wide ? W * .44 : W * .80, H * .55);
    cx = wide ? W * (document.dir === 'rtl' ? .30 : .70) : W * .5;
    cy = wide ? H * .54 : H * .42;

    const N = W < 700 ? 620 : (W < 1200 ? 1000 : 1400);
    shapePts = sampleShape(S, N);
    build(N);
  }

  function build(N) {
    particles = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      particles.push({
        // موقعیت اولیه پراکنده (گرانول‌های ریخته‌شده)
        ix: cx + Math.cos(a) * r * S * .80,
        iy: cy + Math.sin(a) * r * S * .62 - S * .05,
        x: 0, y: 0,
        d: Math.random(),                  // تاخیر شخصی
        ph: Math.random() * Math.PI * 2,   // فاز نوسان
        sp: rnd(.5, 1.6),
        sz: rnd(1.6, 3.5),
        tint: Math.random(),
        tx: shapePts[i][0], ty: shapePts[i][1],
        order: i / N
      });
    }
  }

  /* ---------- machine drawing ---------- */
  function hopper(alpha, glow) {
    if (alpha <= .01) return;
    const topY = cy - S * .92, mouthY = cy - S * .56;
    const halfTop = S * .30, halfBot = S * .055;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(cx - halfTop, topY);
    ctx.lineTo(cx + halfTop, topY);
    ctx.lineTo(cx + halfBot, mouthY);
    ctx.lineTo(cx - halfBot, mouthY);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, topY, 0, mouthY);
    g.addColorStop(0, 'rgba(47,212,196,.05)');
    g.addColorStop(1, 'rgba(47,212,196,.13)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = `rgba(47,212,196,${.32 + glow * .5})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // نازل
    ctx.beginPath();
    ctx.moveTo(cx - halfBot, mouthY);
    ctx.lineTo(cx - halfBot * .5, cy - S * .46);
    ctx.lineTo(cx + halfBot * .5, cy - S * .46);
    ctx.lineTo(cx + halfBot, mouthY);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,138,61,${.10 + glow * .55})`;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function moldHalves(open, alpha) {
    if (alpha <= .01) return;
    const w = S * .62, h = S * .98, gap = open * S * .62;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.4;
    [-1, 1].forEach(d => {
      const x = cx + d * (w / 2 + gap) - w / 2;
      const y = cy - h / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, 10); else ctx.rect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.stroke();
      // پیچ‌های راهنما
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      [.16, .84].forEach(t => {
        ctx.beginPath();
        ctx.arc(x + w * (d < 0 ? .16 : .84), y + h * t, 3, 0, 7);
        ctx.fill();
      });
    });
    ctx.restore();
  }

  function productOutline(a) {
    if (a <= .01) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = a;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(47,212,196,.55)';
    ctx.shadowColor = 'rgba(47,212,196,.6)';
    ctx.shadowBlur = 18;
    productPath(ctx, S * .92); ctx.stroke();
    rimPath(ctx, S * .92); ctx.stroke();
    ctx.restore();
  }

  function glossSweep(a, t) {
    if (a <= .01) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = a * .5;
    ctx.beginPath();
    productPath(ctx, S * .92);
    ctx.clip();
    const x = lerp(-S, S, (t % 1));
    const g = ctx.createLinearGradient(x - S * .2, -S, x + S * .2, S);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(.5, 'rgba(255,255,255,.30)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-S, -S, S * 2, S * 2);
    ctx.restore();
  }

  function caption(a) {
    if (a <= .01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,240,245,.9)';
    ctx.font = '700 15px Vazirmatn, sans-serif';
    ctx.fillText('قطعه تحویل‌شده · PP گرید مهندسی', cx, cy + S * .62);
    ctx.fillStyle = 'rgba(147,166,179,.85)';
    ctx.font = '500 13px Vazirmatn, sans-serif';
    ctx.fillText('سیکل ۲۲ ثانیه · قالب ۴ حفره · تلورانس ±۰٫۰۵ میلی‌متر', cx, cy + S * .62 + 24);
    ctx.restore();
  }

  /* ---------- particle color ---------- */
  function colorFor(pt, heat, solid) {
    // granule → molten → cooled product
    const cool = [
      [122, 226, 214], [214, 234, 240], [255, 197, 130]
    ][(pt.tint * 3) | 0];
    const hot = [255, 150, 60];
    const white = [255, 226, 190];
    const fin = pt.tint > .72 ? [190, 214, 224] : [58, 200, 190];

    let r, g, b;
    const h = heat;
    const hotMix = h < .6 ? h / .6 : 1;
    r = lerp(cool[0], hot[0], hotMix);
    g = lerp(cool[1], hot[1], hotMix);
    b = lerp(cool[2], hot[2], hotMix);
    if (h > .6) {
      const t = (h - .6) / .4;
      r = lerp(r, white[0], t); g = lerp(g, white[1], t); b = lerp(b, white[2], t);
    }
    if (solid > 0) {
      r = lerp(r, fin[0], solid); g = lerp(g, fin[1], solid); b = lerp(b, fin[2], solid);
    }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  /* ---------- main frame ---------- */
  let time = 0;
  function frame() {
    time += .016;
    pSmooth = reduce ? p : lerp(pSmooth, p, .12);
    const v = pSmooth;

    ctx.clearRect(0, 0, W, H);

    // فازها
    const sScatter = seg(v, .00, .16);   // پراکنده / چرخش آرام
    const sFunnel = seg(v, .16, .36);   // ورود به قیف
    const sMelt = seg(v, .34, .52);   // ذوب در بشکه
    const sInject = seg(v, .50, .72);   // تزریق و پر شدن حفره
    const sCool = seg(v, .70, .86);   // خنک‌کاری و باز شدن قالب
    const sFinal = seg(v, .84, 1.0);   // قطعه نهایی

    const heat = clamp(sMelt * 1.0) * (1 - sCool * .95);
    const solid = smooth(sCool);

    // پس‌زمینه گرمایی
    if (heat > .02) {
      const g = ctx.createRadialGradient(cx, cy - S * .35, 0, cx, cy - S * .35, S * 1.5);
      g.addColorStop(0, `rgba(255,138,61,${.18 * heat})`);
      g.addColorStop(1, 'rgba(255,138,61,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    hopper(smooth(seg(v, .12, .26)) * (1 - seg(v, .62, .78)), heat);
    moldHalves(easeOut(seg(v, .74, .92)), smooth(seg(v, .44, .58)) * (1 - seg(v, .88, 1)) );

    const gateX = cx, gateY = cy - S * .46;

    ctx.save();
    if (heat > .18) ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      let x, y, size = pt.sz, alpha = 1;

      // 1) پراکنده با نوسان
      const wob = Math.sin(time * pt.sp + pt.ph);
      let sx = pt.ix + wob * 6;
      let sy = pt.iy + Math.cos(time * pt.sp * .8 + pt.ph) * 5 + sScatter * 10;

      // 2) به سمت دهانه قیف
      const fT = easeOut(clamp((sFunnel - pt.d * .35) / .65));
      const hopX = cx + (pt.tint - .5) * S * .10;
      const hopY = cy - S * .60 + pt.d * S * .10;
      x = lerp(sx, hopX, fT);
      y = lerp(sy, hopY, fT);

      // 3) ذوب: فشرده شدن در نازل
      const mT = ease(clamp((sMelt - pt.order * .25) / .75));
      x = lerp(x, gateX + (pt.tint - .5) * S * .03, mT);
      y = lerp(y, gateY - S * .02, mT);
      size = lerp(size, size * .75, mT);

      // 4) تزریق: حرکت به جایگاه نهایی در حفره
      const iT = easeOut(clamp((sInject - pt.order * .55) / .45));
      const fx = cx + pt.tx * S;
      const fy = cy + pt.ty * S;
      // مسیر جت: کمی قوس
      const jx = lerp(x, fx, iT);
      const jy = lerp(y, fy, iT) - Math.sin(iT * Math.PI) * S * .05 * (1 - Math.abs(pt.tx));
      x = jx; y = jy;

      // 5) لرزش حرارتی که با خنک شدن می‌خوابد
      const jitter = (1 - solid) * (heat * 2.2 + .4);
      x += Math.sin(time * 3 + pt.ph) * jitter;
      y += Math.cos(time * 2.4 + pt.ph) * jitter;

      // 6) قطعه نهایی: کمی «نفس کشیدن»
      if (sFinal > 0) {
        const br = 1 + Math.sin(time * .9) * .012 * sFinal;
        x = cx + (x - cx) * br;
        y = cy + (y - cy) * br;
        size = lerp(size, 2.6, sFinal);
      }

      pt.x = x; pt.y = y;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = colorFor(pt, heat, solid);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;

    productOutline(smooth(seg(v, .80, .95)));
    glossSweep(smooth(seg(v, .88, 1)), time * .25);
    caption(smooth(seg(v, .92, 1)));

    requestAnimationFrame(frame);
  }

  /* ---------- scroll wiring ---------- */
  const bounds = [0, .16, .34, .50, .70, .86];
  let lastStep = -1;

  function onScroll() {
    const r = scene.getBoundingClientRect();
    const total = scene.offsetHeight - window.innerHeight;
    p = clamp(-r.top / total);

    if (bar) bar.style.width = (p * 100).toFixed(1) + '%';

    let idx = 0;
    for (let i = 0; i < bounds.length; i++) if (p >= bounds[i]) idx = i;
    if (idx !== lastStep) {
      steps.forEach((el, i) => el.classList.toggle('is-on', i === idx));
      lastStep = idx;
    }
    if (tempEl) {
      const t = p < .34 ? 25 : p < .55 ? lerp(25, 265, seg(p, .34, .55))
        : p < .72 ? 265 : lerp(265, 38, seg(p, .72, .95));
      tempEl.textContent = fa(Math.round(t)) + '°C';
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { layout(); onScroll(); });
  layout();
  onScroll();
  requestAnimationFrame(frame);
})();
