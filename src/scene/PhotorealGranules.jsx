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
  if (width < 680) return cores <= 4 ? 700 : 940;
  if (width < 1100) return cores <= 4 ? 1180 : 1580;
  return cores <= 4 ? 1850 : 2600;
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
    speed: 0.84 + random() * 0.2,
    tint: random(),
    variant: random() < 0.76 ? 0 : 1,
    tumble: 0.74 + random() * 0.45,
    fuseOffset: (random() - 0.5) * 0.026,
    compact,
  }));
}

function resolveParticle(item, progress, time, position, euler, scale) {
  const compact = item.compact;
  const topY = compact ? 6.4 : 5.8;
  const bottomY = compact ? -6.2 : -5.1;
  const topSpread = compact ? 3.45 : 6.15;
  const lowerSpread = compact ? 0.72 : 1.12;
  const depthSpread = compact ? 0.8 : 1.5;

  const movingT = (
    item.t
    + time * 0.0135 * item.speed
    + Math.min(progress, 0.19) * 0.34
  ) % 1;
  const feedEase = smooth(movingT);
  const feedX = item.side * THREE.MathUtils.lerp(topSpread, lowerSpread, feedEase)
    + item.width * THREE.MathUtils.lerp(compact ? 0.48 : 0.92, compact ? 0.16 : 0.3, feedEase)
    + Math.sin(item.phase + movingT * 4.1) * 0.12;
  const feedY = THREE.MathUtils.lerp(topY, bottomY, movingT)
    + Math.sin(item.phase * 0.6 + movingT * Math.PI) * 0.08;
  const feedZ = item.depth * THREE.MathUtils.lerp(depthSpread, compact ? 0.34 : 0.5, feedEase)
    + Math.sin(item.phase + movingT * 3.2) * 0.18;

  const funnelT = item.t;
  const funnelEase = smooth(funnelT);
  const funnelX = item.side * THREE.MathUtils.lerp(compact ? 1.9 : 3.0, compact ? 0.46 : 0.72, funnelEase)
    + item.width * THREE.MathUtils.lerp(0.24, 0.05, funnelEase)
    + Math.sin(item.phase + funnelT * 2.0) * (compact ? 0.14 : 0.22);
  const funnelY = THREE.MathUtils.lerp(compact ? 4.8 : 4.5, compact ? -2.7 : -2.45, funnelT)
    + Math.sin(item.phase * 0.7) * 0.08;
  const funnelZ = item.depth * THREE.MathUtils.lerp(compact ? 0.48 : 0.8, 0.18, funnelEase)
    + item.side * Math.sin(funnelT * Math.PI) * (compact ? 0.13 : 0.22);

  const compressedEase = smooth(item.t);
  const compressedX = item.side * THREE.MathUtils.lerp(compact ? 0.82 : 1.22, 0.11, compressedEase)
    + Math.cos(item.phase) * (compact ? 0.09 : 0.15);
  const compressedY = THREE.MathUtils.lerp(compact ? 2.7 : 2.5, 0.72, item.t)
    + Math.sin(item.phase) * 0.055;
  const compressedZ = item.depth * THREE.MathUtils.lerp(compact ? 0.28 : 0.42, 0.08, compressedEase)
    + Math.sin(item.phase) * (compact ? 0.07 : 0.11);

  const preRadius = (compact ? 0.12 : 0.15) + ((item.phase / TAU) % 1) * (compact ? 0.32 : 0.48);
  const preX = Math.cos(item.phase) * preRadius + item.side * 0.05;
  const preY = THREE.MathUtils.lerp(1.72, 0.98, item.t) + Math.sin(item.phase * 1.3) * 0.04;
  const preZ = Math.sin(item.phase) * preRadius * 0.76;

  const absorbRadius = 0.035 + ((item.phase * 0.37) % 1) * (compact ? 0.09 : 0.13);
  const absorbX = Math.cos(item.phase) * absorbRadius;
  const absorbY = 0.95 + (0.5 - item.t) * 0.12;
  const absorbZ = Math.sin(item.phase) * absorbRadius * 0.7;

  const toFunnel = range(progress, 0.105, 0.225);
  const toCompressed = range(progress, 0.22, 0.335);
  const toPreform = range(progress, 0.32, 0.425);
  const toAbsorb = range(progress, 0.415, 0.535);

  let x = THREE.MathUtils.lerp(feedX, funnelX, toFunnel);
  let y = THREE.MathUtils.lerp(feedY, funnelY, toFunnel);
  let z = THREE.MathUtils.lerp(feedZ, funnelZ, toFunnel);
  if (progress >= 0.22) {
    x = THREE.MathUtils.lerp(funnelX, compressedX, toCompressed);
    y = THREE.MathUtils.lerp(funnelY, compressedY, toCompressed);
    z = THREE.MathUtils.lerp(funnelZ, compressedZ, toCompressed);
  }
  if (progress >= 0.32) {
    x = THREE.MathUtils.lerp(compressedX, preX, toPreform);
    y = THREE.MathUtils.lerp(compressedY, preY, toPreform);
    z = THREE.MathUtils.lerp(compressedZ, preZ, toPreform);
  }
  if (progress >= 0.415) {
    x = THREE.MathUtils.lerp(preX, absorbX, toAbsorb);
    y = THREE.MathUtils.lerp(preY, absorbY, toAbsorb);
    z = THREE.MathUtils.lerp(preZ, absorbZ, toAbsorb);
  }

  const turbulence = Math.sin(range(progress, 0.12, 0.36) * Math.PI) * 0.045;
  position.set(
    x + Math.cos(item.phase + time * 0.31) * turbulence,
    y + Math.sin(item.phase * 0.7 + time * 0.27) * turbulence * 0.06,
    z + Math.sin(item.phase + time * 0.29) * turbulence * 0.55,
  );

  const freeTumble = 1 - range(progress, 0.34, 0.48);
  euler.set(
    item.phase + Math.sin(time * 0.16 * item.tumble + item.phase) * 0.018 * freeTumble,
    item.phase * 0.61 + item.side * -0.055 * (1 - range(progress, 0.16, 0.34)),
    item.phase * 0.37 + Math.cos(time * 0.14 + item.phase) * 0.015 * freeTumble,
  );

  // The pellet first loses its crisp cylindrical silhouette, then is absorbed
  // into the surrounding polymer. This overlap avoids the old shrink-to-zero pop.
  const soften = range(progress, 0.275, 0.43);
  const fuse = range(progress, 0.405 + item.fuseOffset, 0.555 + item.fuseOffset * 0.22);
  const fusionScale = THREE.MathUtils.lerp(1, 0.018, fuse);
  const base = item.size * fusionScale;
  const roundness = soften * (1 - fuse * 0.35);
  scale.set(
    base * THREE.MathUtils.lerp(1, 0.82, roundness),
    base * THREE.MathUtils.lerp(1, 1.18, roundness),
    base * THREE.MathUtils.lerp(1, 1.16, roundness),
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
      color: '#245f9f', roughness: 0.36, metalness: 0, clearcoat: 0.26,
      clearcoatRoughness: 0.25, ior: 1.47, specularIntensity: 0.43,
      specularColor: new THREE.Color('#9fc4e8'), bumpMap: microTexture,
      bumpScale: 0.0018, envMapIntensity: 0.7, vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#2e6bab', roughness: 0.34, metalness: 0, clearcoat: 0.29,
      clearcoatRoughness: 0.23, ior: 1.47, specularIntensity: 0.45,
      specularColor: new THREE.Color('#afd0ef'), bumpMap: microTexture,
      bumpScale: 0.0016, envMapIntensity: 0.73, vertexColors: true,
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
