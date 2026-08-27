/* =========================================================
   مدل‌های سه‌بعدی پروسیجرال محصولات TPT
   هر مدل: { group, sampleGeo, meta }
   sampleGeo = هندسه‌ای که برای نمونه‌برداری ذرات استفاده می‌شود
   ========================================================= */
import { buildCap } from './cap-model.js';

function knurl(THREE, R, h, ribs, y) {
  const g = new THREE.CylinderGeometry(R, R, h, ribs * 2, 1, true);
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const th = Math.atan2(v.z, v.x);
    const tri = Math.abs(((th * ribs) / Math.PI) % 2 - 1);
    const k = 1 + 0.016 * (tri - 0.5) * 2;
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  g.computeVertexNormals();
  g.translate(0, y, 0);
  return g;
}

function lathe(THREE, pts, seg = 128) {
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
  g.computeVertexNormals();
  return g;
}

/* ---------- ۱) درب پیچی (محصول شاخص صحنه اصلی) ---------- */
function screwCap(THREE) {
  const { body, ring, grooves } = buildCap(THREE, { radius: 1, height: 0.34 });
  return { parts: [body, ring, ...grooves], sampleGeo: body };
}

/* ---------- ۲) درب فلیپ‌تاپ ---------- */
function flipCap(THREE) {
  const R = 0.72, H = 0.58;
  const prof = [
    [0, H], [R * .52, H], [R * .58, H - .04],
    [R * .60, H - .18], [R * .92, H - .26], [R, H - .34],
    [R, .04], [R * .95, 0], [R * .78, 0], [R * .78, H - .40], [0, H - .40]
  ];
  const body = lathe(THREE, prof);
  const ribs = knurl(THREE, R, H * .40, 72, H * .18);
  const spout = new THREE.CylinderGeometry(R * .30, R * .34, .16, 48);
  spout.translate(0, H + .07, 0);
  const hinge = new THREE.TorusGeometry(R * .30, .028, 8, 40, Math.PI);
  hinge.rotateY(Math.PI / 2);
  hinge.translate(-R * .55, H - .02, 0);
  return { parts: [body, ribs, spout, hinge], sampleGeo: body };
}

/* ---------- ۳) درب سطل صنعتی ---------- */
function bucketLid(THREE) {
  const R = 1.15, H = 0.20;
  const prof = [
    [0, H * .86], [R * .58, H * .86], [R * .66, H],
    [R * .80, H], [R * .86, H * .70], [R, H * .58],
    [R, .05], [R * .92, 0], [R * .74, 0], [R * .74, H * .46], [0, H * .46]
  ];
  const body = lathe(THREE, prof);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.TorusGeometry(R * (.22 + i * .13), .012, 6, 120);
    g.rotateX(Math.PI / 2); g.translate(0, H * .87, 0);
    rings.push(g);
  }
  return { parts: [body, ...rings], sampleGeo: body };
}

/* ---------- ۴) ظرف/قوطی جداره‌نازک ---------- */
function container(THREE) {
  const R = 0.78, H = 1.05;
  const prof = [
    [0, 0], [R * .86, 0], [R * .90, .05],
    [R * .97, H * .55], [R, H - .10], [R * 1.06, H - .02], [R * 1.06, H],
    [R * .96, H], [R * .90, H - .06], [R * .84, H * .5], [R * .78, .07], [0, .07]
  ];
  const body = lathe(THREE, prof);
  const grip = knurl(THREE, R * .995, H * .30, 90, H * .34);
  return { parts: [body, grip], sampleGeo: body };
}

/* ---------- ۵) اتصال آبیاری (سه‌راهی) ---------- */
function fitting(THREE) {
  const parts = [];
  const tube = (len, r, rot, pos) => {
    const g = new THREE.CylinderGeometry(r, r, len, 40, 1, false);
    if (rot) g.rotateZ(rot);
    g.translate(...pos);
    return g;
  };
  parts.push(tube(1.5, .22, Math.PI / 2, [0, .30, 0]));
  parts.push(tube(.75, .22, 0, [0, .68, 0]));
  [[-.62, .30], [.62, .30]].forEach(([x, y]) => {
    const g = new THREE.TorusGeometry(.24, .045, 10, 44);
    g.rotateY(Math.PI / 2); g.translate(x, y, 0); parts.push(g);
  });
  const collar = new THREE.TorusGeometry(.24, .05, 10, 44);
  collar.rotateX(Math.PI / 2); collar.translate(0, 1.0, 0); parts.push(collar);
  return { parts, sampleGeo: parts[0] };
}

const BUILDERS = {
  'screw-cap': screwCap,
  'flip-cap': flipCap,
  'bucket-lid': bucketLid,
  'container': container,
  'fitting': fitting
};

export function makeProduct(THREE, kind, material) {
  const b = BUILDERS[kind] || screwCap;
  const { parts, sampleGeo } = b(THREE);
  const group = new THREE.Group();
  parts.forEach(g => group.add(new THREE.Mesh(g, material)));
  // مرکز و مقیاس یکسان برای همه محصولات
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3(), center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  const s = 1.70 / Math.max(size.x, size.y, size.z);
  group.scale.setScalar(s);
  group.position.set(-center.x * s, -center.y * s, -center.z * s);
  return { group, sampleGeo, size, kinds: Object.keys(BUILDERS) };
}

export const PRODUCTS = [
  { id: 'screw-cap', name: 'درب پیچی ۳۸ میلی‌متری', material: 'PP هموپلیمر', cavities: '۱۶ حفره', cycle: '۹ ثانیه', use: 'رب، سس، روغن خوراکی' },
  { id: 'flip-cap', name: 'درب فلیپ‌تاپ بهداشتی', material: 'PP + TPE', cavities: '۸ حفره', cycle: '۱۴ ثانیه', use: 'شامپو، مایع دستشویی' },
  { id: 'bucket-lid', name: 'درب سطل ۴ لیتری', material: 'PP کوپلیمر', cavities: '۲ حفره', cycle: '۲۴ ثانیه', use: 'رنگ، چسب، مواد غذایی' },
  { id: 'container', name: 'ظرف جداره‌نازک ۵۰۰ گرمی', material: 'PP شفاف', cavities: '۴ حفره', cycle: '۷ ثانیه', use: 'لبنیات و بسته‌بندی غذا' },
  { id: 'fitting', name: 'اتصال سه‌راهی آبیاری', material: 'PP مقاوم به UV', cavities: '۴ حفره', cycle: '۱۸ ثانیه', use: 'شبکه آبیاری قطره‌ای' }
];
