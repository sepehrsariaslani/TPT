/* =========================================================
   TPT — Scroll Scene  (blue / vortex edition)
   بارش گرانول → چرخش → گردابه → شکل‌گیری → محصول نهایی → پاشیدن دوباره
   ========================================================= */
(function () {
  const canvas = document.getElementById('scene-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const scene = document.querySelector('.scene');
  const steps = [...document.querySelectorAll('.hud__step')];
  const bar = document.getElementById('sceneBar');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* product photo */
  const lid = new Image();
  let lidReady = false;
  lid.onload = () => (lidReady = true);
  lid.src = 'assets/product-lid.jpg';

  let W = 0, H = 0, DPR = 1;
  let cx = 0, cy = 0, R = 0, coneTop = 0, coneH = 0, diskY = 0, Rd = 0, ry = 0, T = 0;
  let rain = [], swarm = [];
  let p = 0, pS = 0, t = 0;

  /* helpers */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (v, a, b) => clamp((v - a) / (b - a));
  const smooth = k => k * k * (3 - 2 * k);
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeIO = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------------- layout ---------------- */
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.6);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const small = W < 760;
    cx = W * .5;
    cy = H * (small ? .44 : .50);
    R = Math.min(W * (small ? .34 : .21), H * .27);
    coneH = R * 1.80;
    diskY = cy + R * .58;
    coneTop = diskY - coneH;
    Rd = R * .92; ry = Rd * .30; T = Rd * .26;

    build(small ? 320 : 520, small ? 520 : 900);
  }

  function build(nRain, nSwarm) {
    rain = [];
    for (let i = 0; i < nRain; i++) {
      const g = (Math.random() + Math.random() + Math.random()) / 3 - .5; // تمرکز روی مرکز
      rain.push({
        x: cx + g * R * 3.4,
        seed: Math.random(),
        sp: rnd(.10, .30),
        sz: rnd(1.0, 3.2),
        streak: Math.random() < .34,
        br: rnd(.35, 1)
      });
    }
    swarm = [];
    for (let i = 0; i < nSwarm; i++) {
      const h = Math.pow(Math.random(), .8);           // 0 بالا (پهن) … 1 پایین (باریک)
      const onTop = Math.random() < .58;
      const da = Math.random() * Math.PI * 2;
      const dr = Math.sqrt(Math.random());
      swarm.push({
        a0: Math.random() * Math.PI * 2,
        h,
        spin: rnd(.55, 1.15),
        wob: Math.random() * 6.28,
        sz: rnd(1.1, 2.8),
        br: rnd(.4, 1),
        delay: Math.random() * .45,
        // مقصد روی درب
        dTop: onTop, da, dr, dv: Math.random(),
        // بردار پاشیدن نهایی
        bx: Math.cos(da) * rnd(.6, 2.2), by: rnd(-1.6, .5) - Math.abs(Math.sin(da)) * .4,
        bs: rnd(.6, 1.6)
      });
    }
  }

  /* ---------------- positions ---------------- */
  function rainPos(o) {
    const span = coneH + R * 2.4;
    const y = -R * .6 + ((t * o.sp + o.seed) % 1) * span;
    return [o.x + Math.sin(t * .5 + o.seed * 9) * 5, y];
  }
  function vortexPos(o, tight) {
    const h = o.h;
    const ang = o.a0 + t * o.spin * (.55 + (1 - h) * 1.35);
    const rad = R * (.16 + .84 * Math.pow(1 - h, .75)) * lerp(1.12, 1, tight);
    return [
      cx + Math.cos(ang) * rad,
      coneTop + h * coneH + Math.sin(ang) * rad * .30 + Math.sin(t * 2 + o.wob) * 2
    ];
  }
  function diskPos(o) {
    const spin = t * .18;
    if (o.dTop) {
      const rr = Rd * .96 * o.dr, a = o.da + spin;
      return [cx + Math.cos(a) * rr, diskY - T * .55 + Math.sin(a) * rr * .30];
    }
    const a = o.da + spin;
    return [cx + Math.cos(a) * Rd, diskY - T * .55 + Math.sin(a) * Rd * .30 + o.dv * T];
  }

  /* ---------------- drawing bits ---------------- */
  function drawRain(alpha) {
    if (alpha <= .01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const o of rain) {
      const [x, y] = rainPos(o);
      const a = alpha * o.br;
      if (o.streak) {
        const g = ctx.createLinearGradient(x, y - 90, x, y + 20);
        g.addColorStop(0, 'rgba(70,140,255,0)');
        g.addColorStop(1, `rgba(150,200,255,${a * .5})`);
        ctx.strokeStyle = g; ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(x, y - 90); ctx.lineTo(x, y + 12); ctx.stroke();
      }
      ctx.fillStyle = `rgba(${150 + o.br * 90 | 0},${195 + o.br * 50 | 0},255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, o.sz, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  function drawRings(alpha, tighten, flat) {
    if (alpha <= .01) return;
    const N = 16;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      const h = k;
      const radFlat = R * (.28 + .72 * k);                       // حلقه‌های هم‌مرکز
      const radCone = R * (.16 + .84 * Math.pow(1 - h, .75));    // مخروط گردابه
      const rad = lerp(radFlat, radCone, tighten) * lerp(1, .96, flat);
      const yy = lerp(diskY - coneH * .26 + (k - .5) * R * .16, coneTop + h * coneH, tighten);
      const rot = t * (.35 + (1 - h) * .5) + i * .4;
      const a = alpha * (.12 + .52 * Math.pow(1 - Math.abs(k - .35), 2)) * lerp(1.7 - k * .7, 1, tighten);
      ctx.save();
      ctx.translate(cx, yy);
      ctx.rotate(Math.sin(rot) * .06);
      ctx.strokeStyle = `rgba(90,170,255,${a})`;
      ctx.lineWidth = lerp(.7, 2.1, Math.sin(rot) * .5 + .5);
      ctx.beginPath(); ctx.ellipse(0, 0, rad, rad * .30, 0, 0, 6.2832); ctx.stroke();
      // ریبون درخشان
      ctx.strokeStyle = `rgba(190,225,255,${a * .9})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, rad, rad * .30, 0, rot % 6.2832, (rot % 6.2832) + 1.5 + h * .8);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawGlowFloor(alpha) {
    if (alpha <= .01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, diskY, 0, cx, diskY, R * 2.1);
    g.addColorStop(0, `rgba(60,130,255,${.30 * alpha})`);
    g.addColorStop(.4, `rgba(40,90,220,${.12 * alpha})`);
    g.addColorStop(1, 'rgba(10,20,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, diskY, R * 2.1, R * .8, 0, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  function drawLidPhoto(alpha, rise) {
    if (alpha <= .01 || !lidReady) return;
    const w = Rd * 3.0;
    const h = w * (lid.naturalHeight / lid.naturalWidth);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(lid, cx - w / 2, diskY - h * .52 + rise, w, h);
    ctx.restore();
  }

  /* ---------------- frame ---------------- */
  function frame() {
    t += .016;
    pS = reduce ? p : lerp(pS, p, .10);
    const v = pS;

    ctx.clearRect(0, 0, W, H);

    /* فازها */
    const toVortex = smooth(seg(v, .10, .34));   // از بارش به گردابه
    const tighten = smooth(seg(v, .20, .48));   // حلقه‌ها مخروطی می‌شوند
    const toDisk = smooth(seg(v, .46, .70));   // نشستن روی فرم درب
    const photo = smooth(seg(v, .68, .82));   // ظاهر شدن محصول واقعی
    const hold = 1 - smooth(seg(v, .86, .93)); // شروع باز شدن
    const burst = easeOut(seg(v, .86, 1));      // پاشیدن به گرانول
    const gone = smooth(seg(v, .95, 1));

    const rainA = (1 - smooth(seg(v, .46, .68))) * (1 - gone) + smooth(seg(v, .88, .97)) * .55 * (1 - gone);
    const ringA = smooth(seg(v, .10, .30)) * (1 - smooth(seg(v, .62, .78)));

    drawGlowFloor(smooth(seg(v, .30, .55)) * (1 - gone) * lerp(1, .5, photo));
    drawRain(rainA);
    drawRings(ringA, tighten, toDisk);

    /* ذرات اصلی */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < swarm.length; i++) {
      const o = swarm[i];

      // 1) بارش اولیه
      const span = coneH + R * 2.2;
      let x = cx + Math.cos(o.a0) * R * 2.2 * (.3 + o.dr);
      let y = -R * .5 + ((t * (.12 + o.spin * .12) + o.h) % 1) * span;

      // 2) گردابه
      const kV = clamp((toVortex - o.delay * .5) / (1 - o.delay * .5));
      const [vx, vy] = vortexPos(o, tighten);
      x = lerp(x, vx, kV); y = lerp(y, vy, kV);

      // 3) نشستن روی فرم محصول
      const kD = clamp((toDisk - o.h * .30) / .70);
      const [dx, dy] = diskPos(o);
      x = lerp(x, dx, easeIO(kD)); y = lerp(y, dy, easeIO(kD));

      // 4) پاشیدن دوباره به گرانول
      if (burst > 0) {
        const kB = easeOut(clamp((burst - o.delay * .3) / .7)) * o.bs;
        x += o.bx * R * 1.6 * kB;
        y += o.by * R * 1.5 * kB + kB * kB * R * .5;
      }

      let a = o.br * (.68 + .32 * kV);
      a *= (1 - photo * .92);                      // هنگام نمایش عکس محو می‌شوند
      a += o.br * smooth(seg(v, .86, .93)) * .95;  // و دوباره برمی‌گردند
      a *= (1 - gone);
      if (a <= .01) continue;

      const sz = o.sz * lerp(1, .8, kD);
      ctx.fillStyle = `rgba(${140 + o.br * 100 | 0},${190 + o.br * 55 | 0},255,${clamp(a)})`;
      ctx.beginPath(); ctx.arc(x, y, sz, 0, 6.2832); ctx.fill();
    }
    ctx.restore();

    /* محصول نهایی */
    drawLidPhoto(photo * hold, lerp(10, 0, photo));

    requestAnimationFrame(frame);
  }

  /* ---------------- scroll ---------------- */
  const bounds = [0, .12, .30, .46, .62, .74, .90];
  let last = -1;
  function onScroll() {
    const r = scene.getBoundingClientRect();
    const total = scene.offsetHeight - window.innerHeight;
    p = clamp(-r.top / total);
    if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
    let idx = 0;
    for (let i = 0; i < bounds.length; i++) if (p >= bounds[i]) idx = i;
    if (idx !== last) {
      steps.forEach((el, i) => el.classList.toggle('is-on', i === idx));
      last = idx;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { layout(); onScroll(); });
  layout(); onScroll();
  requestAnimationFrame(frame);
})();
