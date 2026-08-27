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

function createMicroTexture(seed = 91, size = 64) {
  const random = seededRandom(seed);
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const extrusion = Math.sin(nx * TAU * 7.0 + ny * 4.5) * 3.2;
      const cutter = Math.sin(nx * TAU * 21.0 - ny * 12.0) * 1.7;
      const grain = (random() - 0.5) * 9.5;
      data[y * size + x] = Math.max(0, Math.min(255, 128 + extrusion + cutter + grain));
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4.8, 2.0);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function deformGeometry(geometry, phase, strength = 0.012) {
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radial = 1
      + Math.sin(x * 29.0 + y * 41.0 + z * 23.0 + phase) * strength
      + Math.cos(x * 17.0 - y * 31.0 + z * 37.0 + phase * 0.7) * strength * 0.55;
    position.setXYZ(
      index,
      x * (1 + Math.sin(z * 22.0 + phase) * strength * 0.35),
      y * radial,
      z * radial,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function makePelletGeometry(type) {
  if (type === 2) {
    const geometry = new THREE.DodecahedronGeometry(0.105, 1);
    geometry.scale(1.3, 0.9, 0.82);
    return deformGeometry(geometry, 4.2, 0.028);
  }

  const profiles = type === 0
    ? [
      [0.0, -0.145], [0.058, -0.145], [0.079, -0.136], [0.092, -0.114],
      [0.099, -0.078], [0.101, 0.078], [0.094, 0.114], [0.081, 0.136],
      [0.058, 0.145], [0.0, 0.145],
    ]
    : [
      [0.0, -0.137], [0.047, -0.134], [0.072, -0.124], [0.089, -0.100],
      [0.099, -0.061], [0.102, 0], [0.099, 0.061], [0.089, 0.100],
      [0.072, 0.124], [0.047, 0.134], [0.0, 0.137],
    ];

  const geometry = new THREE.LatheGeometry(
    profiles.map(([radius, height]) => new THREE.Vector2(radius, height)),
    type === 0 ? 16 : 14,
  );
  geometry.rotateZ(Math.PI / 2);
  if (type === 1) geometry.scale(1.03, 0.95, 1.02);
  return deformGeometry(geometry, 1.3 + type * 1.8, type === 0 ? 0.007 : 0.012);
}

function getQualityCount() {
  if (typeof window === 'undefined') return 900;
  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency || 6;
  if (width < 680) return cores <= 4 ? 430 : 560;
  if (width < 1100) return cores <= 4 ? 620 : 780;
  return cores <= 4 ? 820 : 1120;
}

function buildParticleData(count) {
  const random = seededRandom(918273);
  const stream = new Float32Array(count * 3);
  const orbit = new Float32Array(count * 3);
  const tornado = new Float32Array(count * 3);
  const capSurface = new Float32Array(count * 3);
  const capInterior = new Float32Array(count * 3);
  const rotation = new Float32Array(count * 3);
  const scale = new Float32Array(count * 3);
  const tint = new Float32Array(count);
  const phase = new Float32Array(count);
  const flutter = new Float32Array(count);
  const variant = new Uint8Array(count);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const t = random();
    const angle = random() * TAU;
    const localPhase = random() * TAU;
    const streamSpread = Math.pow(random(), 1.6) * 1.65;

    phase[i] = localPhase;
    tint[i] = random();
    flutter[i] = 0.55 + random() * 0.8;

    const pick = random();
    variant[i] = pick < 0.58 ? 0 : pick < 0.86 ? 1 : 2;

    stream[i3] = Math.cos(angle) * streamSpread + (random() - 0.5) * 0.16;
    stream[i3 + 1] = 8.7 - t * 15.8 + (random() - 0.5) * 0.28;
    stream[i3 + 2] = Math.sin(angle) * streamSpread * 0.78 + (random() - 0.5) * 0.16;

    const orbitBand = Math.floor(random() * 7);
    const orbitRadius = 1.15 + orbitBand * 0.46 + random() * 0.34;
    const orbitAngle = angle + t * TAU * (1.4 + (orbitBand % 3) * 0.25);
    orbit[i3] = Math.cos(orbitAngle) * orbitRadius;
    orbit[i3 + 1] = 0.6 + (orbitBand - 3) * 0.055 + (random() - 0.5) * 0.2;
    orbit[i3 + 2] = Math.sin(orbitAngle) * orbitRadius * 0.74;

    const turns = 5.35 + (i % 5) * 0.18 + random() * 0.5;
    const tornadoAngle = angle + t * TAU * turns;
    const tornadoRadius = 4.15 - t * 3.08
      + Math.sin(t * TAU * 2.5 + localPhase) * 0.12
      + (random() - 0.5) * 0.1;
    tornado[i3] = Math.cos(tornadoAngle) * tornadoRadius;
    tornado[i3 + 1] = 4.7 - t * 8.2 + (random() - 0.5) * 0.18;
    tornado[i3 + 2] = Math.sin(tornadoAngle) * tornadoRadius * 0.82;

    const surfacePick = random();
    if (surfacePick < 0.7) {
      const r = Math.sqrt(random()) * 2.28;
      const a = random() * TAU;
      capSurface[i3] = Math.cos(a) * r;
      capSurface[i3 + 1] = 0.47 + random() * 0.04;
      capSurface[i3 + 2] = Math.sin(a) * r;
      capInterior[i3] = capSurface[i3];
      capInterior[i3 + 1] = 0.29 - random() * 0.18;
      capInterior[i3 + 2] = capSurface[i3 + 2];
    } else {
      const a = random() * TAU;
      const r = 2.40 + random() * 0.12;
      const y = -0.31 + random() * 0.7;
      capSurface[i3] = Math.cos(a) * r;
      capSurface[i3 + 1] = y;
      capSurface[i3 + 2] = Math.sin(a) * r;
      capInterior[i3] = Math.cos(a) * (r - 0.16);
      capInterior[i3 + 1] = y;
      capInterior[i3 + 2] = Math.sin(a) * (r - 0.16);
    }

    const base = 0.82 + random() * 0.22;
    if (variant[i] === 0) {
      scale[i3] = base * (0.95 + random() * 0.2);
      scale[i3 + 1] = base * (0.9 + random() * 0.12);
      scale[i3 + 2] = base * (0.9 + random() * 0.12);
    } else if (variant[i] === 1) {
      scale[i3] = base * (1.02 + random() * 0.22);
      scale[i3 + 1] = base * (0.86 + random() * 0.14);
      scale[i3 + 2] = base * (0.88 + random() * 0.14);
    } else {
      scale[i3] = base * (0.84 + random() * 0.22);
      scale[i3 + 1] = base * (0.8 + random() * 0.22);
      scale[i3 + 2] = base * (0.8 + random() * 0.22);
    }

    rotation[i3] = random() * TAU;
    rotation[i3 + 1] = random() * TAU;
    rotation[i3 + 2] = random() * TAU;
  }

  return {
    stream,
    orbit,
    tornado,
    capSurface,
    capInterior,
    rotation,
    scale,
    tint,
    phase,
    flutter,
    variant,
  };
}

function resolvePosition(data, index, progress, time, position, euler, scaleVector) {
  const i3 = index * 3;
  let from = data.stream;
  let to = data.orbit;
  let mix = range(progress, 0.1, 0.27);
  let agitation = Math.sin(mix * Math.PI) * 0.22;

  if (progress >= 0.27 && progress < 0.49) {
    from = data.orbit;
    to = data.tornado;
    mix = range(progress, 0.27, 0.49);
    agitation = Math.sin(mix * Math.PI) * 0.3;
  } else if (progress >= 0.49 && progress < 0.74) {
    from = data.tornado;
    to = data.capSurface;
    mix = range(progress, 0.49, 0.74);
    agitation = Math.sin(mix * Math.PI) * 0.24;
  } else if (progress >= 0.74) {
    from = data.capSurface;
    to = data.capInterior;
    mix = range(progress, 0.74, 0.9);
    agitation = Math.sin(mix * Math.PI) * 0.035;
  }

  const phase = data.phase[index];
  const liveFall = 1 - range(progress, 0.08, 0.2);
  const fallOffset = ((time * 0.36 * data.flutter[index] + phase / TAU) % 1) * 1.15 * liveFall;
  const micro = (0.012 + data.flutter[index] * 0.008) * (1 - range(progress, 0.65, 0.84));

  position.set(
    THREE.MathUtils.lerp(from[i3], to[i3], mix)
      + Math.cos(phase + time * 0.9) * agitation
      + Math.sin(time * 1.7 + phase) * micro,
    THREE.MathUtils.lerp(from[i3 + 1], to[i3 + 1], mix)
      - fallOffset
      + Math.sin(phase * 0.7 + time * 1.1) * agitation * 0.12,
    THREE.MathUtils.lerp(from[i3 + 2], to[i3 + 2], mix)
      + Math.sin(phase + time * 0.83) * agitation * 0.72
      + Math.cos(time * 1.5 + phase) * micro,
  );

  const storm = range(progress, 0.24, 0.42) * (1 - range(progress, 0.6, 0.76));
  euler.set(
    data.rotation[i3] + time * (0.11 + data.flutter[index] * 0.04),
    data.rotation[i3 + 1] + storm * progress * 3.2 + time * storm * 0.14,
    data.rotation[i3 + 2] + time * (0.08 + data.flutter[index] * 0.03),
  );

  const settle = range(progress, 0.64, 0.83);
  const compact = THREE.MathUtils.lerp(1, 0.9, settle);
  const pulse = 1 + Math.sin(time * 1.4 + phase) * 0.004 * (1 - settle);
  scaleVector.set(
    data.scale[i3] * compact * pulse,
    data.scale[i3 + 1] * compact / pulse,
    data.scale[i3 + 2] * compact,
  );
}

function PelletLayer({ indices, geometry, material, haloMaterial, palette, data, progressRef }) {
  const bodyRef = useRef();
  const haloRef = useRef();
  const groupRef = useRef();
  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const scaleVector = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const body = bodyRef.current;
    const halo = haloRef.current;
    if (!body || !halo) return;

    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dark = new THREE.Color(palette[0]);
    const mid = new THREE.Color(palette[1]);
    const high = new THREE.Color(palette[2]);
    const color = new THREE.Color();

    for (let local = 0; local < indices.length; local += 1) {
      const particle = indices[local];
      color.copy(dark).lerp(mid, 0.38 + data.tint[particle] * 0.48);
      color.lerp(high, 0.06 + data.tint[particle] * 0.08);
      body.setColorAt(local, color);
      halo.setColorAt(local, high);
    }
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
  }, [data, indices, palette]);

  useFrame(({ clock }, delta) => {
    const body = bodyRef.current;
    const halo = haloRef.current;
    const group = groupRef.current;
    if (!body || !halo || !group) return;

    const progress = progressRef.current;
    const time = clock.getElapsedTime();

    for (let local = 0; local < indices.length; local += 1) {
      const particle = indices[local];
      resolvePosition(data, particle, progress, time, position, euler, scaleVector);
      quaternion.setFromEuler(euler);

      helper.position.copy(position);
      helper.quaternion.copy(quaternion);
      helper.scale.copy(scaleVector);
      helper.updateMatrix();
      body.setMatrixAt(local, helper.matrix);

      helper.scale.multiplyScalar(1.045);
      helper.updateMatrix();
      halo.setMatrixAt(local, helper.matrix);
    }

    body.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;

    const orbit = range(progress, 0.13, 0.3) * (1 - range(progress, 0.43, 0.57));
    const tornado = range(progress, 0.28, 0.42) * (1 - range(progress, 0.62, 0.76));
    const targetRotation = time * (orbit * 0.12 + tornado * 0.19) + progress * tornado * 0.35;
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetRotation, 3.4, delta);
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={bodyRef}
        args={[geometry, material, indices.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={haloRef}
        args={[geometry, haloMaterial, indices.length]}
        frustumCulled={false}
        renderOrder={2}
      />
    </group>
  );
}

export default function PhotorealGranules({ progressRef }) {
  const count = useMemo(getQualityCount, []);
  const data = useMemo(() => buildParticleData(count), [count]);
  const microTexture = useMemo(() => createMicroTexture(), []);
  const geometries = useMemo(() => [0, 1, 2].map((type) => makePelletGeometry(type)), []);

  const groups = useMemo(() => {
    const next = [[], [], []];
    for (let index = 0; index < count; index += 1) next[data.variant[index]].push(index);
    return next;
  }, [count, data]);

  const materials = useMemo(() => [
    new THREE.MeshPhysicalMaterial({
      color: '#4f8ee7', roughness: 0.23, metalness: 0, clearcoat: 1,
      clearcoatRoughness: 0.11, ior: 1.47, specularIntensity: 0.95,
      specularColor: new THREE.Color('#edf6ff'), sheen: 0.28,
      sheenRoughness: 0.38, sheenColor: new THREE.Color('#5aa4ff'),
      bumpMap: microTexture, bumpScale: 0.003, envMapIntensity: 1.3,
      emissive: new THREE.Color('#03132c'), emissiveIntensity: 0.04, vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#6aa7f2', roughness: 0.2, metalness: 0, clearcoat: 1,
      clearcoatRoughness: 0.09, ior: 1.46, specularIntensity: 1,
      specularColor: new THREE.Color('#f3f8ff'), sheen: 0.34,
      sheenRoughness: 0.34, sheenColor: new THREE.Color('#74b9ff'),
      bumpMap: microTexture, bumpScale: 0.0025, envMapIntensity: 1.42,
      emissive: new THREE.Color('#041630'), emissiveIntensity: 0.045, vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#4b82d5', roughness: 0.27, metalness: 0, clearcoat: 0.88,
      clearcoatRoughness: 0.16, ior: 1.47, specularIntensity: 0.9,
      specularColor: new THREE.Color('#e1f0ff'), sheen: 0.3,
      sheenRoughness: 0.42, sheenColor: new THREE.Color('#4f94ed'),
      bumpMap: microTexture, bumpScale: 0.004, envMapIntensity: 1.25,
      emissive: new THREE.Color('#031126'), emissiveIntensity: 0.035,
      flatShading: true, vertexColors: true,
    }),
  ], [microTexture]);

  const haloMaterials = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({
    color: '#76b6ff', transparent: true, opacity: 0.045,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    toneMapped: false, vertexColors: true,
  })), []);

  const palettes = useMemo(() => [
    ['#235899', '#5c9be4', '#b9ddff'],
    ['#2e66ad', '#71acf0', '#d1e9ff'],
    ['#234f89', '#518ad0', '#a8d0f5'],
  ], []);

  useEffect(() => () => {
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    haloMaterials.forEach((material) => material.dispose());
    microTexture.dispose();
  }, [geometries, haloMaterials, materials, microTexture]);

  return (
    <group>
      {groups.map((indices, index) => (
        <PelletLayer
          key={index}
          indices={indices}
          geometry={geometries[index]}
          material={materials[index]}
          haloMaterial={haloMaterials[index]}
          palette={palettes[index]}
          data={data}
          progressRef={progressRef}
        />
      ))}
    </group>
  );
}
