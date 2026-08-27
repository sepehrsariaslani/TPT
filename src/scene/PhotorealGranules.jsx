import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function seededRandom(seed = 1337) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createMicroTexture(seed = 91, size = 48) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const broad = Math.sin(nx * TAU * 5.4 + ny * 4.1) * 1.8;
      const fine = Math.sin(nx * TAU * 16.2 - ny * 8.7) * 0.8;
      const grain = (random() - 0.5) * 4.8;
      pixels[y * size + x] = Math.max(0, Math.min(255, 128 + broad + fine + grain));
    }
  }
  const texture = new THREE.DataTexture(
    pixels,
    size,
    size,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4.8, 2.2);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function deformGeometry(geometry, phase, strength) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radial = 1
      + Math.sin(x * 29 + y * 37 + z * 23 + phase) * strength
      + Math.cos(x * 15 - y * 27 + z * 31 + phase * 0.7) * strength * 0.35;
    position.setXYZ(i, x, y * radial, z * radial);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function makePelletGeometry(type) {
  const profile = type === 0
    ? [
      [0, -0.096], [0.036, -0.096], [0.052, -0.09], [0.063, -0.077],
      [0.068, -0.054], [0.069, 0.054], [0.064, 0.078], [0.053, 0.091],
      [0.036, 0.097], [0, 0.097],
    ]
    : [
      [0, -0.09], [0.032, -0.089], [0.048, -0.082], [0.06, -0.067],
      [0.066, -0.042], [0.067, 0], [0.066, 0.042], [0.06, 0.067],
      [0.048, 0.082], [0.032, 0.089], [0, 0.09],
    ];
  const geometry = new THREE.LatheGeometry(
    profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
    type === 0 ? 14 : 12,
  );
  geometry.rotateZ(Math.PI / 2);
  if (type === 1) geometry.scale(1.05, 0.95, 1.01);
  return deformGeometry(geometry, 1.4 + type * 1.7, type === 0 ? 0.003 : 0.0044);
}

function getQualityCount() {
  if (typeof window === 'undefined') return 1900;
  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency || 6;
  if (width < 680) return cores <= 4 ? 720 : 980;
  if (width < 1100) return cores <= 4 ? 1240 : 1650;
  return cores <= 4 ? 1900 : 2700;
}

function buildParticleData(count, compact) {
  const random = seededRandom(918273);
  return Array.from({ length: count }, (_, i) => ({
    side: i % 2 === 0 ? -1 : 1,
    t: random(),
    phase: random() * TAU,
    depth: (random() - 0.5) * 2,
    width: (random() - 0.5) * 2,
    size: 0.82 + random() * 0.2,
    speed: 0.82 + random() * 0.22,
    tint: random(),
    variant: random() < 0.76 ? 0 : 1,
    tumble: 0.7 + random() * 0.42,
    fuseOffset: (random() - 0.5) * 0.022,
    compact,
  }));
}

function resolveParticle(item, progress, time, position, euler, scale) {
  const compact = item.compact;

  // 1) Calm feed: continuous material from above the viewport, still coming from
  // both sides. There is no packet/clump timing, so the stream never looks cropped.
  const feedT = (
    item.t
    + time * 0.0125 * item.speed
    + Math.min(progress, 0.11) * 0.2
  ) % 1;
  const feedEase = smooth(feedT);
  const feedTopY = compact ? 6.8 : 6.25;
  const feedBottomY = compact ? -6.4 : -5.55;
  const feedOuter = compact ? 3.4 : 5.7;
  const feedInner = compact ? 1.55 : 2.7;
  const feedX = item.side * THREE.MathUtils.lerp(feedOuter, feedInner, feedEase)
    + item.width * THREE.MathUtils.lerp(compact ? 0.52 : 0.82, 0.28, feedEase)
    + Math.sin(item.phase + feedT * 3.6) * 0.1;
  const feedY = THREE.MathUtils.lerp(feedTopY, feedBottomY, feedT);
  const feedZ = item.depth * THREE.MathUtils.lerp(compact ? 0.72 : 1.25, 0.5, feedEase)
    + Math.sin(item.phase + feedT * 2.8) * 0.14;

  // 2) Cinematic storm restored from the older experience, but calmer. The
  // pellets orbit the same centre while the cone narrows toward the hopper.
  const stormT = (
    item.t
    + time * 0.017 * item.speed
    + Math.min(Math.max(progress - 0.1, 0), 0.18) * 0.16
  ) % 1;
  const stormEase = smooth(stormT);
  const stormOuter = compact ? 2.75 : 3.95;
  const stormInner = compact ? 0.78 : 1.02;
  const stormRadius = THREE.MathUtils.lerp(stormOuter, stormInner, stormEase)
    * (0.94 + Math.sin(item.phase * 1.7) * 0.06);
  const stormAngle = item.phase
    + stormT * TAU * 2.55
    + time * 0.13
    + item.side * 0.08;
  const stormX = Math.cos(stormAngle) * stormRadius;
  const stormY = THREE.MathUtils.lerp(compact ? 5.25 : 5.55, 3.55, stormT)
    + Math.sin(item.phase * 0.8) * 0.07;
  const stormZ = Math.sin(stormAngle) * stormRadius * (compact ? 0.62 : 0.7)
    + item.depth * 0.08;

  // 3) Funnel into the hopper mouth. The radius physically collapses while the
  // centre of mass drops, so the pellets visibly enter the reservoir instead of
  // converging beneath the machine.
  const pourT = (
    item.t
    + time * 0.012 * item.speed
  ) % 1;
  const pourEase = smooth(pourT);
  const pourRadius = THREE.MathUtils.lerp(compact ? 1.28 : 1.5, 0.24, pourEase);
  const pourAngle = item.phase + pourT * TAU * 0.82 + time * 0.06;
  const pourX = Math.cos(pourAngle) * pourRadius;
  const pourY = THREE.MathUtils.lerp(compact ? 4.55 : 4.72, 3.0, pourT);
  const pourZ = Math.sin(pourAngle) * pourRadius * 0.72 + item.depth * 0.035;

  // 4) Inside the transparent barrel: pellets follow the screw flight downward
  // before they soften and disappear into the continuous melt.
  const insideT = clamp01(item.t * 0.94 + 0.03);
  const insideRadius = THREE.MathUtils.lerp(compact ? 0.28 : 0.34, 0.16, insideT);
  const insideAngle = item.phase + insideT * TAU * 2.25 + time * 0.08;
  const insideX = Math.cos(insideAngle) * insideRadius;
  const insideY = THREE.MathUtils.lerp(2.88, 1.22, insideT);
  const insideZ = Math.sin(insideAngle) * insideRadius * 0.82;

  const stormMix = range(progress, 0.105, 0.215);
  const pourMix = range(progress, 0.255, 0.345);
  const insideMix = range(progress, 0.335, 0.435);

  let x = THREE.MathUtils.lerp(feedX, stormX, stormMix);
  let y = THREE.MathUtils.lerp(feedY, stormY, stormMix);
  let z = THREE.MathUtils.lerp(feedZ, stormZ, stormMix);

  if (progress >= 0.255) {
    x = THREE.MathUtils.lerp(stormX, pourX, pourMix);
    y = THREE.MathUtils.lerp(stormY, pourY, pourMix);
    z = THREE.MathUtils.lerp(stormZ, pourZ, pourMix);
  }
  if (progress >= 0.335) {
    x = THREE.MathUtils.lerp(pourX, insideX, insideMix);
    y = THREE.MathUtils.lerp(pourY, insideY, insideMix);
    z = THREE.MathUtils.lerp(pourZ, insideZ, insideMix);
  }

  const stormStrength = range(progress, 0.105, 0.18) * (1 - range(progress, 0.31, 0.37));
  const micro = 0.004 + item.tumble * 0.002;
  position.set(
    x + Math.cos(item.phase + time * 0.31) * micro * (1 - stormStrength * 0.45),
    y + Math.sin(item.phase * 0.71 + time * 0.26) * micro * 0.5,
    z + Math.sin(item.phase + time * 0.28) * micro,
  );

  // Keep self rotation restrained. The obvious motion during the storm comes
  // from the path itself, not every pellet spinning like a propeller.
  const tumbleFade = 1 - range(progress, 0.36, 0.48);
  euler.set(
    item.phase + Math.sin(time * 0.14 * item.tumble + item.phase) * 0.017 * tumbleFade,
    item.phase * 0.61 + item.side * -0.05 * (1 - range(progress, 0.18, 0.34)),
    item.phase * 0.37 + Math.cos(time * 0.13 + item.phase) * 0.014 * tumbleFade,
  );

  // Melting happens only after the pellets are already inside the barrel. The
  // lower pellets soften first; upper pellets follow a few frames later.
  const soften = range(progress, 0.365, 0.475);
  const meltOrder = smooth(insideT);
  const fuseStart = 0.405 + (1 - meltOrder) * 0.038 + item.fuseOffset;
  const fuseEnd = 0.525 + (1 - meltOrder) * 0.026 + item.fuseOffset * 0.22;
  const fuse = range(progress, fuseStart, fuseEnd);
  const fusionScale = THREE.MathUtils.lerp(1, 0.015, fuse);
  const base = item.size * fusionScale;
  const roundness = soften * (1 - fuse * 0.4);
  scale.set(
    base * THREE.MathUtils.lerp(1, 0.8, roundness),
    base * THREE.MathUtils.lerp(1, 1.2, roundness),
    base * THREE.MathUtils.lerp(1, 1.18, roundness),
  );
}

function PelletLayer({ items, geometry, material, palette, progressRef }) {
  const meshRef = useRef();
  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.renderOrder = 4;
    const dark = new THREE.Color(palette[0]);
    const mid = new THREE.Color(palette[1]);
    const high = new THREE.Color(palette[2]);
    const color = new THREE.Color();
    items.forEach((item, index) => {
      color.copy(dark).lerp(mid, 0.5 + item.tint * 0.34);
      color.lerp(high, 0.025 + item.tint * 0.04);
      mesh.setColorAt(index, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, palette]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const p = progressRef.current;
    const time = clock.getElapsedTime();
    for (let i = 0; i < items.length; i += 1) {
      resolveParticle(items[i], p, time, position, euler, scale);
      quaternion.setFromEuler(euler);
      helper.position.copy(position);
      helper.quaternion.copy(quaternion);
      helper.scale.copy(scale);
      helper.updateMatrix();
      mesh.setMatrixAt(i, helper.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, items.length]} frustumCulled={false} />
  );
}

export default function PhotorealGranules({ progressRef }) {
  const count = useMemo(getQualityCount, []);
  const compact = useMemo(() => (
    typeof window !== 'undefined' && window.innerWidth < 680
  ), []);
  const data = useMemo(() => buildParticleData(count, compact), [count, compact]);
  const microTexture = useMemo(() => createMicroTexture(), []);
  const geometries = useMemo(() => [0, 1].map((type) => makePelletGeometry(type)), []);
  const groups = useMemo(() => [
    data.filter((item) => item.variant === 0),
    data.filter((item) => item.variant === 1),
  ], [data]);

  const materials = useMemo(() => [
    new THREE.MeshPhysicalMaterial({
      color: '#245f9f',
      roughness: 0.36,
      metalness: 0,
      clearcoat: 0.26,
      clearcoatRoughness: 0.25,
      ior: 1.47,
      specularIntensity: 0.43,
      specularColor: new THREE.Color('#9fc4e8'),
      bumpMap: microTexture,
      bumpScale: 0.0018,
      envMapIntensity: 0.7,
      vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#2e6bab',
      roughness: 0.34,
      metalness: 0,
      clearcoat: 0.29,
      clearcoatRoughness: 0.23,
      ior: 1.47,
      specularIntensity: 0.45,
      specularColor: new THREE.Color('#afd0ef'),
      bumpMap: microTexture,
      bumpScale: 0.0016,
      envMapIntensity: 0.73,
      vertexColors: true,
    }),
  ], [microTexture]);

  const palettes = useMemo(() => [
    ['#163f6a', '#2c6aa8', '#75a8d7'],
    ['#194872', '#3977b3', '#83b0dc'],
  ], []);

  useEffect(() => () => {
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    microTexture.dispose();
  }, [geometries, materials, microTexture]);

  return (
    <group>
      {groups.map((items, index) => (
        <PelletLayer
          key={index}
          items={items}
          geometry={geometries[index]}
          material={materials[index]}
          palette={palettes[index]}
          progressRef={progressRef}
        />
      ))}
    </group>
  );
}
