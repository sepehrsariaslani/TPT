/* =========================================================
   TPT — کاروسل سه‌بعدی محصولات
   چرخش با درگ، تعویض محصول، تغییر رنگ متریال
   ========================================================= */
import * as THREE from 'three';
import { makeProduct, PRODUCTS } from './models.js';

const host = document.getElementById('product-3d');
if (host) init();

function init() {
  let ok = true;
  try {
    const c = document.createElement('canvas');
    ok = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { ok = false; }
  if (!ok) { host.classList.add('is-off'); return; }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.70, 3.95);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0x9ec8ff, 0x05080f, 0.7));
  const key = new THREE.DirectionalLight(0xe6f1ff, 2.4); key.position.set(-2, 3.4, 3); scene.add(key);
  const rim = new THREE.PointLight(0x3d8bff, 22, 16, 2); rim.position.set(2.4, 1.2, -2.4); scene.add(rim);
  const fill = new THREE.PointLight(0x8fd0ff, 9, 14, 2); fill.position.set(-2.6, -0.6, 1.4); scene.add(fill);

  const material = new THREE.MeshPhysicalMaterial({
    color: 0x1d4fd8, metalness: 0.40, roughness: 0.28,
    clearcoat: 0.85, clearcoatRoughness: 0.20,
    emissive: 0x0a1f5c, emissiveIntensity: 0.45
  });

  const pivot = new THREE.Group();
  scene.add(pivot);

  let current = null, currentIdx = 0;
  function show(idx) {
    currentIdx = idx;
    const { group } = makeProduct(THREE, PRODUCTS[idx].id, material);
    const wrap = new THREE.Group();      // پوسته بیرونی برای انیمیشن ورود/خروج
    wrap.add(group);
    wrap.scale.setScalar(0.001);
    if (current) {
      const old = current;
      old.userData.dying = true;
      setTimeout(() => pivot.remove(old), 420);
    }
    pivot.add(wrap);
    current = wrap;

    // متن مشخصات
    const d = PRODUCTS[idx];
    const info = document.getElementById('product-info');
    if (info) {
      info.innerHTML = `
        <h3>${d.name}</h3>
        <dl>
          <div><dt>ماده</dt><dd>${d.material}</dd></div>
          <div><dt>قالب</dt><dd>${d.cavities}</dd></div>
          <div><dt>سیکل</dt><dd>${d.cycle}</dd></div>
          <div><dt>کاربرد</dt><dd>${d.use}</dd></div>
        </dl>`;
    }
    document.querySelectorAll('.pcar__tab').forEach((b, i) => b.classList.toggle('is-on', i === idx));
  }

  /* تب‌ها */
  const tabs = document.getElementById('product-tabs');
  if (tabs) {
    tabs.innerHTML = PRODUCTS.map((p, i) =>
      `<button class="pcar__tab${i === 0 ? ' is-on' : ''}" type="button" data-i="${i}">${p.name}</button>`).join('');
    tabs.addEventListener('click', e => {
      const b = e.target.closest('.pcar__tab');
      if (b) show(+b.dataset.i);
    });
  }

  /* رنگ‌ها */
  const swatches = document.getElementById('product-colors');
  if (swatches) {
    const COLORS = [
      ['#1d4fd8', 'آبی'], ['#e8edf5', 'سفید'], ['#111827', 'مشکی'],
      ['#c81e1e', 'قرمز'], ['#0f9d58', 'سبز'], ['#f5a524', 'کهربایی']
    ];
    swatches.innerHTML = COLORS.map(([c, n], i) =>
      `<button class="pcar__sw${i === 0 ? ' is-on' : ''}" type="button" style="--c:${c}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('');
    swatches.addEventListener('click', e => {
      const b = e.target.closest('.pcar__sw');
      if (!b) return;
      material.color.set(b.dataset.c);
      const dark = b.dataset.c === '#111827';
      material.emissive.set(dark ? 0x0a1230 : 0x0a1f5c);
      material.metalness = dark ? 0.55 : 0.40;
      swatches.querySelectorAll('.pcar__sw').forEach(x => x.classList.toggle('is-on', x === b));
    });
  }

  /* درگ برای چرخش */
  let rotY = 0.5, rotX = 0.22, velY = 0.0035, dragging = false, px = 0, py = 0;
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', e => {
    dragging = true; px = e.clientX; py = e.clientY;
    dom.setPointerCapture(e.pointerId); host.classList.add('is-drag');
  });
  dom.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    rotY += dx * 0.008; velY = dx * 0.0016;
    rotX = Math.max(-0.75, Math.min(0.95, rotX + dy * 0.005));
  });
  const end = () => { dragging = false; host.classList.remove('is-drag'); };
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);
  dom.addEventListener('pointerleave', end);

  /* کیبورد */
  host.tabIndex = 0;
  host.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { rotY -= .25; e.preventDefault(); }
    if (e.key === 'ArrowRight') { rotY += .25; e.preventDefault(); }
    if (e.key === 'ArrowUp') { show((currentIdx + PRODUCTS.length - 1) % PRODUCTS.length); e.preventDefault(); }
    if (e.key === 'ArrowDown') { show((currentIdx + 1) % PRODUCTS.length); e.preventDefault(); }
  });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  let visible = false;
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }, { threshold: .05 }).observe(host);

  show(0);

  let t = 0;
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    t += .016;
    if (!dragging) { rotY += velY; velY += (0.0035 - velY) * 0.02; }
    pivot.rotation.y += (rotY - pivot.rotation.y) * 0.10;
    pivot.rotation.x += (rotX - pivot.rotation.x) * 0.10;
    pivot.position.y = Math.sin(t * 0.9) * 0.045;

    pivot.children.forEach(g => {
      const target = g.userData.dying ? 0.001 : 1;
      g.scale.setScalar(g.scale.x + (target - g.scale.x) * 0.14);
    });

    renderer.render(scene, camera);
  })();
}
