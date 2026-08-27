import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const canvas = document.querySelector('#scene');
const phaseLabel = document.querySelector('#phaseLabel');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020817, 0.055);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.35, 9.2);

scene.add(new THREE.HemisphereLight(0x8fc2ff, 0x020817, 1.4));
const key = new THREE.PointLight(0x2f7cff, 22, 20, 2);
key.position.set(2.8, 4.3, 4.5);
scene.add(key);
const rim = new THREE.PointLight(0x6bdcff, 12, 16, 2);
rim.position.set(-4, -1, 3);
scene.add(rim);

const world = new THREE.Group();
scene.add(world);

// Final molded cap
const cap = new THREE.Group();
world.add(cap);

const capMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x0f4fc4,
  metalness: 0.18,
  roughness: 0.18,
  clearcoat: 1,
  clearcoatRoughness: 0.12,
  emissive: 0x061a52,
  emissiveIntensity: 0.8
});

const body = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.55, 128), capMaterial);
body.rotation.x = Math.PI / 2;
cap.add(body);

const top = new THREE.Mesh(new THREE.CylinderGeometry(1.96, 1.96, 0.07, 128), capMaterial);
top.rotation.x = Math.PI / 2;
top.position.z = 0.3;
cap.add(top);

const inner = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.035, 24, 160), new THREE.MeshStandardMaterial({ color: 0x7bb6ff, emissive: 0x1f6cff, emissiveIntensity: 1.3, roughness: 0.35 }));
inner.position.z = 0.34;
cap.add(inner);

// Ribbed side detail
const ribMat = new THREE.MeshStandardMaterial({ color: 0x0c3d9d, roughness: 0.35, metalness: 0.1 });
for (let i = 0; i < 80; i++) {
  const a = (i / 80) * Math.PI * 2;
  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.46), ribMat);
  rib.position.set(Math.cos(a) * 2.17, Math.sin(a) * 2.17, 0);
  rib.rotation.z = a;
  cap.add(rib);
}

cap.rotation.x = -0.32;
cap.rotation.z = -0.08;
cap.position.y = 0.15;

// Plastic pellet instancing
const COUNT = 2400;
const pelletGeo = new THREE.CapsuleGeometry(0.035, 0.045, 3, 6);
const pelletMat = new THREE.MeshPhysicalMaterial({
  color: 0x2f7fff,
  roughness: 0.28,
  metalness: 0.02,
  transmission: 0.05,
  clearcoat: 0.65,
  emissive: 0x061d5a,
  emissiveIntensity: 0.7
});
const pellets = new THREE.InstancedMesh(pelletGeo, pelletMat, COUNT);
pellets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
world.add(pellets);

const dummy = new THREE.Object3D();
const state = [];
const rand = (a, b) => a + Math.random() * (b - a);

for (let i = 0; i < COUNT; i++) {
  const lane = i % 18;
  const laneAngle = (lane / 18) * Math.PI * 2;
  const t = Math.random();
  const radius = 0.9 + 2.0 * Math.pow(Math.random(), 0.55);
  const angle = laneAngle + t * Math.PI * 8 + rand(-0.22, 0.22);
  const y = 6.3 - t * 12.5 + Math.sin(angle * 0.5) * 0.35;
  const spiral = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius * 0.72);

  const ringAngle = Math.random() * Math.PI * 2;
  const ringRadius = rand(1.5, 2.45);
  const capTarget = new THREE.Vector3(
    Math.cos(ringAngle) * ringRadius,
    Math.sin(ringAngle) * ringRadius,
    rand(-0.38, 0.38)
  );

  const rain = new THREE.Vector3(rand(-2.8, 2.8), rand(2.2, 7.8), rand(-1.8, 1.8));
  state.push({ spiral, capTarget, rain, phase: rand(0, Math.PI * 2), spin: rand(-2, 2), scale: rand(0.65, 1.3) });
}

// Light trails
const trails = new THREE.Group();
world.add(trails);
for (let lane = 0; lane < 14; lane++) {
  const pts = [];
  const laneAngle = (lane / 14) * Math.PI * 2;
  for (let j = 0; j < 90; j++) {
    const t = j / 89;
    const r = 1.05 + 1.55 * (0.5 + 0.5 * Math.sin(t * Math.PI));
    const a = laneAngle + t * Math.PI * 7.5;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 5.8 - t * 11.8, Math.sin(a) * r * 0.72));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 180, 0.008, 5, false);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2a7cff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
  trails.add(new THREE.Mesh(geo, mat));
}

// Blueprint rings around the product
const rings = new THREE.Group();
world.add(rings);
for (const r of [2.55, 2.85, 3.18]) {
  const geo = new THREE.RingGeometry(r, r + 0.006, 180);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2c75ff, transparent: true, opacity: 0.24, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = -0.55;
  rings.add(mesh);
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function smooth(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function lerp3(a, b, t, out) {
  out.set(
    THREE.MathUtils.lerp(a.x, b.x, t),
    THREE.MathUtils.lerp(a.y, b.y, t),
    THREE.MathUtils.lerp(a.z, b.z, t)
  );
}

let progress = 0;
let targetProgress = 0;
const pos = new THREE.Vector3();

function updateScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  targetProgress = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener('scroll', updateScroll, { passive: true });
updateScroll();

function animate(now) {
  requestAnimationFrame(animate);
  progress += (targetProgress - progress) * 0.055;
  const time = now * 0.001;

  // Phase map: product -> break apart -> vortex -> free-flow pellets
  const breakup = smooth(0.08, 0.48, progress);
  const vortex = smooth(0.20, 0.72, progress);
  const free = smooth(0.64, 1.0, progress);

  if (progress < 0.18) phaseLabel.textContent = 'FORM';
  else if (progress < 0.55) phaseLabel.textContent = 'DISASSEMBLE';
  else if (progress < 0.82) phaseLabel.textContent = 'FLOW';
  else phaseLabel.textContent = 'GRANULE';

  cap.scale.setScalar(1 - breakup * 0.86);
  cap.visible = progress < 0.72;
  cap.rotation.z = -0.08 + progress * 0.22;
  cap.rotation.x = -0.32 + Math.sin(time * 0.25) * 0.02;

  rings.scale.setScalar(1 + breakup * 0.35);
  rings.rotation.z = time * 0.08 + progress * 1.2;
  trails.rotation.y = Math.sin(time * 0.18) * 0.05;
  trails.rotation.z = time * 0.015;
  trails.children.forEach((m, i) => m.material.opacity = 0.10 + vortex * 0.24 + Math.sin(time * 1.3 + i) * 0.02);

  for (let i = 0; i < COUNT; i++) {
    const s = state[i];

    // At start, most pellets are packed around/inside the cap silhouette.
    const wobbleTarget = s.capTarget.clone();
    wobbleTarget.z += Math.sin(time * 1.2 + s.phase) * 0.025;

    // As scroll advances they expand into long vertical helices.
    const spiralAnimated = s.spiral.clone();
    const localA = time * 0.15 + s.phase;
    spiralAnimated.x += Math.cos(localA) * 0.05;
    spiralAnimated.z += Math.sin(localA) * 0.05;

    // Final state: falling raw material, still carrying some swirl.
    const rainAnimated = s.rain.clone();
    const fall = ((time * 0.42 + s.phase * 0.12) % 1) * 12;
    rainAnimated.y -= fall;
    if (rainAnimated.y < -6) rainAnimated.y += 13;
    rainAnimated.x += Math.cos(time + s.phase) * 0.08;

    lerp3(wobbleTarget, spiralAnimated, vortex, pos);
    if (free > 0) lerp3(pos, rainAnimated, free, pos);

    // Reveal pellets progressively from the cap outward.
    const reveal = smooth(0.02 + (i / COUNT) * 0.08, 0.26 + (i / COUNT) * 0.08, breakup + 0.12);
    const scale = s.scale * (0.06 + reveal * 0.94);

    dummy.position.copy(pos);
    dummy.rotation.set(s.phase + time * 0.3, s.phase * 0.5 + time * s.spin * 0.15, s.phase * 0.25);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    pellets.setMatrixAt(i, dummy.matrix);
  }
  pellets.instanceMatrix.needsUpdate = true;

  // Camera travels downward with the material.
  camera.position.y = THREE.MathUtils.lerp(0.35, -0.8, smooth(0.32, 0.92, progress));
  camera.position.z = THREE.MathUtils.lerp(9.2, 8.4, smooth(0.2, 0.8, progress));
  camera.lookAt(0, THREE.MathUtils.lerp(0.15, -0.5, progress), 0);

  world.rotation.y = Math.sin(time * 0.15) * 0.06;
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
