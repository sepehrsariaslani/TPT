/* =========================================================
   TPT — Scroll Scene (Three.js + GSAP ScrollTrigger)
   گرانول → میدان مارپیچ → جذب به سطح مدل → محصول سه‌بعدی → تجزیه دوباره
   ========================================================= */
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildCap, buildPellet } from './cap-model.js';

const host = document.getElementById('scene-3d');
const holder = document.querySelector('.scene__sticky');
const steps = [...document.querySelectorAll('.hud__step')];
const bar = document.getElementById('sceneBar');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- WebGL fallback ---------- */
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
if (!webglOK()) {
  const s = document.createElement('script');
  s.src = 'js/scene-2d.js';
  document.body.appendChild(s);
  document.getElementById('scene-canvas')?.style.setProperty('display', 'block');
  throw new Error('WebGL unavailable — fallback 2D');
}

/* ---------- helpers ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (v, a, b) => clamp((v - a) / (b - a));
const smooth = k => k * k * (3 - 2 * k);
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeIO = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.setClearColor(0x04070f, 1);
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04070f, 0.055);

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 2.6, 6.6);

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0x9ec8ff, 0x040814, 0.55));
const key = new THREE.DirectionalLight(0xdcecff, 2.3); key.position.set(-2.4, 4.2, 2.6); scene.add(key);
const rim = new THREE.PointLight(0x3d8bff, 26, 18, 2); rim.position.set(2.6, 1.4, -2.6); scene.add(rim);
const rim2 = new THREE.PointLight(0x6fb2ff, 14, 16, 2); rim2.position.set(-2.8, 0.9, -1.6); scene.add(rim2);
const under = new THREE.PointLight(0x1f4fd0, 10, 12, 2); under.position.set(0, -1.2, 1.2); scene.add(under);

/* ---------- floor ---------- */
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14, 64),
  new THREE.MeshStandardMaterial({ color: 0x03060e, roughness: 0.22, metalness: 0.95 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.001;
scene.add(floor);

/* ---------- product ---------- */
const stage = new THREE.Group();
scene.add(stage);

const capMat = new THREE.MeshPhysicalMaterial({
  color: 0x1d4fd8, metalness: 0.42, roughness: 0.26,
  clearcoat: 0.85, clearcoatRoughness: 0.22,
  emissive: 0x0a1f5c, emissiveIntensity: 0.55,
  transparent: true, opacity: 0
});

const { body, ring, grooves } = buildCap(THREE, { radius: 1, height: 0.34 });
const product = new THREE.Group();
const bodyMesh = new THREE.Mesh(body, capMat);
product.add(bodyMesh);
product.add(new THREE.Mesh(ring, capMat));
grooves.forEach(g => product.add(new THREE.Mesh(g, capMat)));
product.position.y = 0.02;
stage.add(product);

/* مرحله ۲ — اگر مدل واقعی موجود بود، جای مدل پروسیجرال می‌نشیند
   کافی است فایل خروجی Blender/CAD را در assets/product.glb بگذارید. */
const GLB_URL = 'assets/product.glb';
async function tryRealModel() {
  try {
    const head = await fetch(GLB_URL, { method: 'HEAD' });
    if (!head.ok) return;
    const gltf = await new GLTFLoader().loadAsync(GLB_URL);
    const root = gltf.scene;
    // نرمال‌سازی: مرکز روی مبدا، بزرگ‌ترین بعد = ۲ واحد، کف روی y=0
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(), center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const k = 2 / Math.max(size.x, size.y, size.z);
    root.scale.setScalar(k);
    root.position.set(-center.x * k, -box.min.y * k, -center.z * k);
    root.traverse(o => { if (o.isMesh) { o.material = capMat; o.castShadow = o.receiveShadow = true; } });

    // بزرگ‌ترین مش برای نمونه‌برداری ذرات
    let best = null, bestCount = 0;
    root.updateWorldMatrix(true, true);
    root.traverse(o => {
      if (o.isMesh && o.geometry?.attributes?.position?.count > bestCount) {
        bestCount = o.geometry.attributes.position.count; best = o;
      }
    });
    if (!best) return;
    const g = best.geometry.clone().applyMatrix4(best.matrixWorld);
    rebuildTargets(new THREE.Mesh(g, capMat));

    stage.remove(product);
    root.position.y += 0.02;
    stage.add(root);
    console.info('[TPT] مدل واقعی GLB بارگذاری شد.');
  } catch (e) {
    console.info('[TPT] مدل GLB یافت نشد؛ مدل پروسیجرال استفاده می‌شود.');
  }
}

/* ---------- pellets ---------- */
const COUNT = innerWidth < 760 ? 1600 : 3600;
const pelletGeo = buildPellet(THREE, innerWidth < 760 ? 1.25 : 1);
const pelletMat = new THREE.MeshStandardMaterial({
  color: 0x8ec2ff, emissive: 0x2f6bff, emissiveIntensity: 1.35,
  roughness: 0.35, metalness: 0.1
});
const pellets = new THREE.InstancedMesh(pelletGeo, pelletMat, COUNT);
pellets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
pellets.frustumCulled = false;
stage.add(pellets);

/* نمونه‌برداری از سطح مدل → مقصد هر گرانول */
const sPos = new THREE.Vector3(), sNor = new THREE.Vector3();
let sampler = new MeshSurfaceSampler(new THREE.Mesh(body, capMat)).build();

const P = [];
for (let i = 0; i < COUNT; i++) {
  sampler.sample(sPos, sNor);
  const th = Math.random() * Math.PI * 2;
  P.push({
    // مقصد روی سطح محصول
    tx: sPos.x + sNor.x * 0.012, ty: sPos.y + 0.02 + sNor.y * 0.012, tz: sPos.z + sNor.z * 0.012,
    // میدان مارپیچ
    h0: Math.random(), th0: th, spin: rnd(.6, 1.35), fall: rnd(.5, 1.25),
    // بارش اولیه
    rx: rnd(-2.9, 2.9), rz: rnd(-2.4, 2.4), ry0: Math.random(),
    // پاشیدن نهایی
    bx: Math.cos(th) * rnd(.8, 2.6), by: rnd(.4, 2.4), bz: Math.sin(th) * rnd(.8, 2.6),
    delay: Math.random() * .42,
    rot: new THREE.Euler(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)),
    rs: rnd(.5, 1.6), sc: rnd(.7, 1.35)
  });
}

/* مقصد ذرات را از روی مش داده‌شده دوباره می‌سازد (برای مدل واقعی) */
function rebuildTargets(mesh) {
  sampler = new MeshSurfaceSampler(mesh).build();
  for (let i = 0; i < COUNT; i++) {
    sampler.sample(sPos, sNor);
    P[i].tx = sPos.x + sNor.x * 0.012;
    P[i].ty = sPos.y + 0.02 + sNor.y * 0.012;
    P[i].tz = sPos.z + sNor.z * 0.012;
  }
}
tryRealModel();

const dummy = new THREE.Object3D();
const vTmp = new THREE.Vector3();

/* ---------- scroll progress ---------- */
let p = 0, pView = 0, t = 0, visible = true;

function setStep(prog) {
  const bounds = [0, .14, .30, .46, .62, .78, .90];
  let idx = 0;
  for (let i = 0; i < bounds.length; i++) if (prog >= bounds[i]) idx = i;
  steps.forEach((el, i) => el.classList.toggle('is-on', i === idx));
  if (bar) bar.style.width = (prog * 100).toFixed(1) + '%';
}

if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.create({
    trigger: '.scene',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: self => { p = self.progress; setStep(p); },
    onToggle: self => { visible = self.isActive || self.progress > 0; }
  });
} else {
  const sc = document.querySelector('.scene');
  addEventListener('scroll', () => {
    const r = sc.getBoundingClientRect();
    p = clamp(-r.top / (sc.offsetHeight - innerHeight));
    setStep(p);
  }, { passive: true });
}
setStep(0);

/* فقط وقتی صحنه در دید است رندر کن */
const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }, { threshold: 0 });
io.observe(holder);

/* ---------- resize ---------- */
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ---------- post ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.62, 0.16);
composer.addPass(bloom);
composer.addPass(new OutputPass());
resize();
addEventListener('resize', resize);

/* ---------- pointer parallax ---------- */
let mx = 0, my = 0;
addEventListener('pointermove', e => {
  mx = (e.clientX / innerWidth - .5) * 2;
  my = (e.clientY / innerHeight - .5) * 2;
}, { passive: true });

/* ---------- animation ---------- */
function frame() {
  requestAnimationFrame(frame);
  if (!visible) return;
  t += 0.016;
  pView = reduce ? p : lerp(pView, p, 0.11);
  const v = pView;

  /* فازها */
  const kSpiral = smooth(seg(v, .12, .40));   // بارش → مارپیچ
  const kForm = smooth(seg(v, .42, .70));   // مارپیچ → سطح محصول
  const kMesh = smooth(seg(v, .62, .80));   // ظاهر شدن مدل سه‌بعدی
  const kBack = smooth(seg(v, .87, .94));   // برگشت گرانول‌ها
  const kBurst = easeOut(seg(v, .88, 1));    // تجزیه
  const kGone = smooth(seg(v, .96, 1));

  /* محصول */
  capMat.opacity = kMesh * (1 - smooth(seg(v, .88, .96)));
  product.visible = capMat.opacity > 0.01;
  product.scale.setScalar(lerp(0.96, 1, kMesh) * (1 + kBurst * 0.06));

  /* چرخش صحنه */
  stage.rotation.y = t * 0.10 + v * 1.15;

  /* دوربین */
  const camK = smooth(seg(v, 0, .82));
  camera.position.x = lerp(camera.position.x, lerp(0, .30, camK) + mx * 0.26, 0.06);
  camera.position.y = lerp(camera.position.y, lerp(2.60, 1.22, camK) - my * 0.15, 0.06);
  camera.position.z = lerp(camera.position.z, lerp(6.6, 4.15, camK) + kBurst * 1.3, 0.06);
  camera.lookAt(0, lerp(0.85, -0.02, camK), 0);

  /* گرانول‌ها */
  for (let i = 0; i < COUNT; i++) {
    const o = P[i];

    // 1) بارش آزاد
    const fy = 4.2 - ((t * 0.16 * o.fall + o.ry0) % 1) * 6.4;
    let x = o.rx, y = fy, z = o.rz;

    // 2) میدان مارپیچ (قیف چرخان)
    const hh = (o.h0 + t * 0.055 * o.fall) % 1;
    const sr = lerp(2.45, 0.42, easeIO(hh));
    const ang = o.th0 + t * o.spin * (0.5 + (1 - hh) * 1.4);
    const sy = lerp(3.15, 0.34, hh);
    x = lerp(x, Math.cos(ang) * sr, kSpiral);
    y = lerp(y, sy, kSpiral);
    z = lerp(z, Math.sin(ang) * sr, kSpiral);

    // 3) جذب به سطح مدل
    const kf = easeIO(clamp((kForm - o.delay * .5) / (1 - o.delay * .5)));
    x = lerp(x, o.tx, kf); y = lerp(y, o.ty, kf); z = lerp(z, o.tz, kf);

    // 4) تجزیه دوباره
    if (kBurst > 0) {
      const kb = easeOut(clamp((kBurst - o.delay * .35) / .65));
      x += o.bx * kb; y += o.by * kb - kb * kb * 1.6; z += o.bz * kb;
    }

    // مقیاس: هنگام ظاهر شدن مدل محو، هنگام تجزیه دوباره پیدا
    let s = o.sc * (0.55 + 0.45 * kSpiral);
    s *= (1 - kMesh * 0.97);
    s += o.sc * kBack * 0.95;
    s *= (1 - kGone);
    if (s < 0.004) { dummy.scale.setScalar(0); dummy.position.set(0, -99, 0); }
    else {
      dummy.position.set(x, y, z);
      dummy.rotation.set(o.rot.x + t * o.rs * .6, o.rot.y + t * o.rs * .4, o.rot.z);
      dummy.scale.setScalar(s);
    }
    dummy.updateMatrix();
    pellets.setMatrixAt(i, dummy.matrix);
  }
  pellets.instanceMatrix.needsUpdate = true;

  /* شدت بلوم با فازها */
  bloom.strength = lerp(0.72, 1.15, smooth(seg(v, .35, .8))) * (1 - kGone * .6);

  composer.render();
}
frame();
