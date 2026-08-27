/* =========================================================
   مدل سه‌بعدی درب پیچی (پروسیجرال)
   خروجی: یک Group برای نمایش + یک Mesh ساده برای نمونه‌برداری سطح
   بعداً می‌توان این فایل را با بارگذاری GLB واقعی جایگزین کرد.
   ========================================================= */
export function buildCap(THREE, opts = {}) {
  const R = opts.radius ?? 1;          // شعاع درب
  const Hh = opts.height ?? 0.34;      // ارتفاع درب
  const ribs = opts.ribs ?? 96;        // تعداد شیارهای کناری

  /* --- پروفیل چرخشی (بدنه + سقف گنبدی خیلی ملایم) --- */
  const pts = [];
  const seg = 26;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;                       // 0 مرکز سقف → 1 لبه
    const x = R * 0.86 * t;
    const y = Hh - 0.018 * t * t;            // گنبد ملایم
    pts.push(new THREE.Vector2(x, y));
  }
  // شانه گرد
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(
      R * (0.86 + 0.14 * Math.sin(a)),
      Hh - 0.018 - R * 0.085 * (1 - Math.cos(a))
    ));
  }
  pts.push(new THREE.Vector2(R, Hh * 0.20));
  pts.push(new THREE.Vector2(R * 0.995, 0.012));
  pts.push(new THREE.Vector2(R * 0.94, 0));
  pts.push(new THREE.Vector2(R * 0.80, 0));
  pts.push(new THREE.Vector2(R * 0.80, Hh * 0.72));   // حفره داخلی
  pts.push(new THREE.Vector2(0, Hh * 0.72));

  const body = new THREE.LatheGeometry(pts, 128);
  body.computeVertexNormals();

  /* --- شیارهای کناری (knurling) --- */
  const ring = new THREE.CylinderGeometry(R, R, Hh * 0.62, ribs * 2, 1, true);
  const pos = ring.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const th = Math.atan2(v.z, v.x);
    const tri = Math.abs(((th * ribs) / Math.PI) % 2 - 1);   // موج مثلثی
    const k = 1 + 0.016 * (tri - 0.5) * 2;
    v.x *= k; v.z *= k;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  ring.computeVertexNormals();
  ring.translate(0, Hh * 0.34, 0);

  /* --- شیارهای هم‌مرکز روی سقف --- */
  const grooves = [];
  for (let i = 0; i < 7; i++) {
    const rr = R * (0.16 + i * 0.082);
    const g = new THREE.TorusGeometry(rr, R * 0.0075, 6, 128);
    g.rotateX(Math.PI / 2);
    g.translate(0, Hh - 0.018 * (rr / (R * 0.86)) ** 2 + 0.002, 0);
    grooves.push(g);
  }

  return { body, ring, grooves, R, H: Hh };
}

/* هندسه یک گرانول کوچک */
export function buildPellet(THREE, s = 1) {
  const g = new THREE.IcosahedronGeometry(0.02 * s, 0);
  g.scale(1, 0.78, 1.15);
  return g;
}
