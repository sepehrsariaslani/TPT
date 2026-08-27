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

function createVirginPelletGeometry() {
  const profile = [
    [0.0, -0.135],
    [0.050, -0.135],
    [0.071, -0.124],
    [0.081, -0.103],
    [0.086, -0.072],
    [0.087, 0.072],
    [0.083, 0.102],
    [0.072, 0.123],
    [0.050, 0.135],
    [0.0, 0.135],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));

  const geometry = new THREE.LatheGeometry(profile, 18);
  geometry.rotateZ(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createRoundedPelletGeometry() {
  const profile = [
    [0.0, -0.128],
    [0.037, -0.124],
    [0.064, -0.109],
    [0.080, -0.083],
    [0.087, -0.045],
    [0.089, 0.0],
    [0.087, 0.045],
    [0.080, 0.083],
    [0.064, 0.109],
    [0.037, 0.124],
    [0.0, 0.128],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));

  const geometry = new THREE.LatheGeometry(profile, 20);
  geometry.rotateZ(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createImperfectPelletGeometry() {
  const profile = [
    [0.0, -0.126],
    [0.047, -0.126],
    [0.071, -0.113],
    [0.083, -0.083],
    [0.086, -0.032],
    [0.084, 0.028],
    [0.080, 0.076],
    [0.067, 0.109],
    [0.044, 0.126],
    [0.0, 0.126],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));

  const geometry = new THREE.LatheGeometry(profile, 16);
  geometry.rotateZ(Math.PI / 2);

  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const imperfection = 1
      + Math.sin(x * 31.7 + y * 47.2 + z * 23.4) * 0.018
      + Math.cos(x * 18.3 - y * 27.1 + z * 41.8) * 0.012;
    position.setXYZ(
      i,
      x * (1 + Math.sin(z * 19.5) * 0.012),
      y * imperfection,
      z * imperfection,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function buildParticleData(count) {
  const random = seededRandom(918273);
  const stream = new Float32Array(count * 3);
  const vortex = new Float32Array(count * 3);
  const cap = new Float32Array(count * 3);
  const release = new Float32Array(count * 3);
  const exit = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const spread = new Float32Array(count);
  const scale = new Float32Array(count * 3);
  const rotation = new Float32Array(count * 3);
  const tint = new Float32Array(count);
  const brightness = new Float32Array(count);
  const wobble = new Float32Array(count);
  const spin = new Float32Array(count);
  const fallSpeed = new Float32Array(count);
  const fallOffset = new Float32Array(count);
  const meltOffset = new Float32Array(count);
  const variant = new Uint8Array(count);

  const strandCount = 20;

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const strand = Math.floor(random() * strandCount);
    const strandAngle = (strand / strandCount) * TAU;
    const t = random();
    const localPhase = random() * TAU;
    const localSpread = 0.5 + random() * 1.18;

    phase[i] = localPhase;
    spread[i] = localSpread;
    tint[i] = random();
    brightness[i] = random();
    wobble[i] = 0.45 + random() * 0.9;
    spin[i] = 0.55 + random() * 1.35;
    fallSpeed[i] = 0.75 + random() * 0.5;
    fallOffset[i] = random();
    meltOffset[i] = (random() - 0.5) * 0.036;

    const variantPick = random();
    variant[i] = variantPick < 0.57 ? 0 : variantPick < 0.87 ? 1 : 2;

    // Tall loose streams coming from above. The tiny strand-to-strand offsets
    // stop the pellets from reading like a mathematically perfect particle line.
    const streamRadius = 1.1 + 2.95 * (1 - t) + Math.sin(t * Math.PI) * 0.48;
    const streamAngle = strandAngle
      + Math.sin(t * Math.PI * 1.62 + localPhase) * 0.235
      + (random() - 0.5) * 0.035;
    stream[i3] = Math.cos(streamAngle) * streamRadius + (random() - 0.5) * 0.2;
    stream[i3 + 1] = 8.2 - t * 15.8 + (random() - 0.5) * 0.38;
    stream[i3 + 2] = Math.sin(streamAngle) * streamRadius * 0.72 + (random() - 0.5) * 0.2;

    // Four-to-six turns around the future part, with a gently narrowing radius.
    const turns = 4.35 + random() * 1.45;
    const vortexAngle = strandAngle + t * TAU * turns + localPhase * 0.16;
    const vortexRadius = 4.05 - t * 1.55
      + Math.sin(t * Math.PI * 4.2 + localPhase) * 0.16
      + (random() - 0.5) * 0.12;
    vortex[i3] = Math.cos(vortexAngle) * vortexRadius;
    vortex[i3 + 1] = 5.05 - t * 8.9 + Math.sin(vortexAngle * 0.42) * 0.13;
    vortex[i3 + 2] = Math.sin(vortexAngle) * vortexRadius * 0.84;

    // Pellets settle onto the procedural cap surface before they visually melt
    // into the solid part. Top / side / lower rim are sampled separately.
    const surface = random();
    if (surface < 0.67) {
      const radius = Math.sqrt(random()) * 2.33;
      const angle = random() * TAU;
      cap[i3] = Math.cos(angle) * radius;
      cap[i3 + 1] = 0.445 + (random() - 0.5) * 0.045;
      cap[i3 + 2] = Math.sin(angle) * radius;
    } else if (surface < 0.955) {
      const angle = random() * TAU;
      const radius = 2.455 + (random() - 0.5) * 0.055;
      cap[i3] = Math.cos(angle) * radius;
      cap[i3 + 1] = -0.3 + random() * 0.63;
      cap[i3 + 2] = Math.sin(angle) * radius;
    } else {
      const angle = random() * TAU;
      const radius = 2.28 + random() * 0.22;
      cap[i3] = Math.cos(angle) * radius;
      cap[i3 + 1] = -0.43 + (random() - 0.5) * 0.04;
      cap[i3 + 2] = Math.sin(angle) * radius;
    }

    // Reverse path: pellets peel away in an expanding spiral rather than popping.
    const releaseT = random();
    const releaseAngle = localPhase + releaseT * TAU * (4.7 + random() * 2.25);
    const releaseRadius = 2.46 + releaseT * (2.25 + random() * 1.6);
    release[i3] = Math.cos(releaseAngle) * releaseRadius;
    release[i3 + 1] = 1.95 - releaseT * 7.3 + (random() - 0.5) * 0.48;
    release[i3 + 2] = Math.sin(releaseAngle) * releaseRadius * 0.82;

    const exitAngle = strandAngle + Math.sin(localPhase) * 0.15;
    const exitRadius = 0.95 + random() * 3.85;
    exit[i3] = Math.cos(exitAngle) * exitRadius;
    exit[i3 + 1] = -2.6 - random() * 9.4;
    exit[i3 + 2] = Math.sin(exitAngle) * exitRadius * 0.74;

    // Real resin pellets are not identical. Keep variation subtle: enough to break
    // repetition without making the material look like stones or candy.
    const base = 0.76 + random() * 0.29;
    if (variant[i] === 0) {
      scale[i3] = base * (1.06 + random() * 0.2);
      scale[i3 + 1] = base * (0.87 + random() * 0.11);
      scale[i3 + 2] = base * (0.9 + random() * 0.11);
    } else if (variant[i] === 1) {
      scale[i3] = base * (1.16 + random() * 0.22);
      scale[i3 + 1] = base * (0.82 + random() * 0.12);
      scale[i3 + 2] = base * (0.84 + random() * 0.12);
    } else {
      scale[i3] = base * (0.98 + random() * 0.22);
      scale[i3 + 1] = base * (0.9 + random() * 0.14);
      scale[i3 + 2] = base * (0.92 + random() * 0.15);
    }

    rotation[i3] = random() * TAU;
    rotation[i3 + 1] = random() * TAU;
    rotation[i3 + 2] = random() * TAU;
  }

  return {
    stream,
    vortex,
    cap,
    release,
    exit,
    phase,
    spread,
    scale,
    rotation,
    tint,
    brightness,
    wobble,
    spin,
    fallSpeed,
    fallOffset,
    meltOffset,
    variant,
  };
}

function resolvePelletTransform(data, i, progress, time, position, euler, scaleVector) {
  const i3 = i * 3;
  const toVortex = range(progress, 0.12, 0.34);
  const toCap = range(progress, 0.33, 0.525);
  const release = range(progress, 0.66, 0.84);
  const toExit = range(progress, 0.83, 1.0);

  let ax;
  let ay;
  let az;
  let bx;
  let by;
  let bz;
  let mix = 0;
  let curveStrength = 0;

  if (progress < 0.34) {
    ax = data.stream[i3];
    ay = data.stream[i3 + 1];
    az = data.stream[i3 + 2];
    bx = data.vortex[i3];
    by = data.vortex[i3 + 1];
    bz = data.vortex[i3 + 2];
    mix = toVortex;
    curveStrength = Math.sin(toVortex * Math.PI) * data.spread[i] * 0.31;

    if (progress < 0.2) {
      const fall = ((time * 0.22 * data.fallSpeed[i] + data.fallOffset[i]) % 1) * 1.65;
      ay -= fall;
      if (ay < -8.1) ay += 16.2;
    }
  } else if (progress < 0.66) {
    ax = data.vortex[i3];
    ay = data.vortex[i3 + 1];
    az = data.vortex[i3 + 2];
    bx = data.cap[i3];
    by = data.cap[i3 + 1];
    bz = data.cap[i3 + 2];
    mix = toCap;
    curveStrength = Math.sin(toCap * Math.PI) * data.spread[i] * 0.83;
  } else if (progress < 0.84) {
    ax = data.cap[i3];
    ay = data.cap[i3 + 1];
    az = data.cap[i3 + 2];
    bx = data.release[i3];
    by = data.release[i3 + 1];
    bz = data.release[i3 + 2];
    mix = release;
    curveStrength = Math.sin(release * Math.PI) * data.spread[i] * 1.04;
  } else {
    ax = data.release[i3];
    ay = data.release[i3 + 1];
    az = data.release[i3 + 2];
    bx = data.exit[i3];
    by = data.exit[i3 + 1];
    bz = data.exit[i3 + 2];
    mix = toExit;
    curveStrength = Math.sin(toExit * Math.PI) * data.spread[i] * 0.4;
  }

  const phase = data.phase[i] + progress * TAU * 3.25 + time * 0.115;
  const settle = range(progress, 0.4, 0.56) * (1 - range(progress, 0.66, 0.77));
  const turbulence = 1 - settle * 0.94;
  const micro = (0.012 + data.wobble[i] * 0.012) * turbulence;

  position.set(
    THREE.MathUtils.lerp(ax, bx, mix)
      + Math.cos(phase) * curveStrength
      + Math.cos(time * 1.6 + data.phase[i]) * micro,
    THREE.MathUtils.lerp(ay, by, mix)
      + Math.sin(phase * 0.63) * curveStrength * 0.17
      + Math.sin(time * 1.25 + data.phase[i] * 0.7) * micro * 0.42,
    THREE.MathUtils.lerp(az, bz, mix)
      + Math.sin(phase) * curveStrength * 0.72
      + Math.sin(time * 1.85 + data.phase[i]) * micro * 0.72,
  );

  const spinRate = data.spin[i];
  euler.set(
    data.rotation[i3] + time * (0.16 + spinRate * 0.13) * turbulence,
    data.rotation[i3 + 1] + progress * 2.15 + Math.sin(time * 0.8 + data.phase[i]) * 0.04 * turbulence,
    data.rotation[i3 + 2] + time * (0.1 + spinRate * 0.105) * turbulence,
  );

  const localForm = range(progress, 0.465 + data.meltOffset[i], 0.585 + data.meltOffset[i]);
  const localReturn = range(progress, 0.655 + data.meltOffset[i], 0.785 + data.meltOffset[i]);
  const melted = localForm * (1 - localReturn);
  const presence = 1 - melted * 0.89;
  const pulse = 1 + Math.sin(time * 1.7 + data.phase[i]) * 0.008 * turbulence;

  scaleVector.set(
    data.scale[i3] * presence * pulse,
    data.scale[i3 + 1] * presence / pulse,
    data.scale[i3 + 2] * presence,
  );
}

function PelletLayer({ indices, geometry, data, progressRef, palette, material }) {
  const meshRef = useRef();
  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const scaleVector = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dark = new THREE.Color(palette[0]);
    const mid = new THREE.Color(palette[1]);
    const light = new THREE.Color(palette[2]);
    const color = new THREE.Color();

    for (let localIndex = 0; localIndex < indices.length; localIndex += 1) {
      const particleIndex = indices[localIndex];
      const tint = data.tint[particleIndex];
      color.copy(dark).lerp(mid, 0.32 + tint * 0.55);
      color.lerp(light, data.brightness[particleIndex] * 0.16);
      mesh.setColorAt(localIndex, color);
    }

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [data, indices, palette]);

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const progress = progressRef.current;
    const time = clock.getElapsedTime();

    for (let localIndex = 0; localIndex < indices.length; localIndex += 1) {
      const particleIndex = indices[localIndex];
      resolvePelletTransform(
        data,
        particleIndex,
        progress,
        time,
        position,
        euler,
        scaleVector,
      );

      quaternion.setFromEuler(euler);
      helper.position.copy(position);
      helper.quaternion.copy(quaternion);
      helper.scale.copy(scaleVector);
      helper.updateMatrix();
      mesh.setMatrixAt(localIndex, helper.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.rotation.y = THREE.MathUtils.damp(mesh.rotation.y, progress * 0.39, 3.0, delta);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, indices.length]}
      frustumCulled={false}
    />
  );
}

export default function RealisticGranules({ progressRef }) {
  const count = useMemo(() => {
    if (typeof window === 'undefined') return 1350;
    if (window.innerWidth < 680) return 900;
    if (window.innerWidth < 1100) return 1350;
    return 2050;
  }, []);

  const data = useMemo(() => buildParticleData(count), [count]);
  const virginGeometry = useMemo(() => createVirginPelletGeometry(), []);
  const roundedGeometry = useMemo(() => createRoundedPelletGeometry(), []);
  const imperfectGeometry = useMemo(() => createImperfectPelletGeometry(), []);

  const groups = useMemo(() => {
    const next = [[], [], []];
    for (let i = 0; i < count; i += 1) next[data.variant[i]].push(i);
    return next;
  }, [count, data]);

  const materials = useMemo(() => [
    new THREE.MeshPhysicalMaterial({
      color: '#4d89e8',
      roughness: 0.29,
      metalness: 0,
      clearcoat: 0.82,
      clearcoatRoughness: 0.17,
      ior: 1.47,
      specularIntensity: 0.78,
      specularColor: new THREE.Color('#d7e9ff'),
      emissive: new THREE.Color('#020b1d'),
      emissiveIntensity: 0.035,
      vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#5895f0',
      roughness: 0.25,
      metalness: 0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.14,
      ior: 1.46,
      specularIntensity: 0.84,
      specularColor: new THREE.Color('#e5f1ff'),
      emissive: new THREE.Color('#020b1d'),
      emissiveIntensity: 0.035,
      vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#4b86df',
      roughness: 0.33,
      metalness: 0,
      clearcoat: 0.72,
      clearcoatRoughness: 0.21,
      ior: 1.47,
      specularIntensity: 0.72,
      specularColor: new THREE.Color('#d8eaff'),
      emissive: new THREE.Color('#020b1d'),
      emissiveIntensity: 0.03,
      vertexColors: true,
    }),
  ], []);

  useEffect(() => () => {
    virginGeometry.dispose();
    roundedGeometry.dispose();
    imperfectGeometry.dispose();
    materials.forEach((material) => material.dispose());
  }, [imperfectGeometry, materials, roundedGeometry, virginGeometry]);

  const palettes = useMemo(() => [
    ['#235da8', '#5595e9', '#b6d9ff'],
    ['#2c68b6', '#69a5f2', '#c5e1ff'],
    ['#255b9d', '#4d8bda', '#a8cff9'],
  ], []);

  return (
    <group>
      <PelletLayer
        indices={groups[0]}
        geometry={virginGeometry}
        material={materials[0]}
        data={data}
        progressRef={progressRef}
        palette={palettes[0]}
      />
      <PelletLayer
        indices={groups[1]}
        geometry={roundedGeometry}
        material={materials[1]}
        data={data}
        progressRef={progressRef}
        palette={palettes[1]}
      />
      <PelletLayer
        indices={groups[2]}
        geometry={imperfectGeometry}
        material={materials[2]}
        data={data}
        progressRef={progressRef}
        palette={palettes[2]}
      />
    </group>
  );
}
