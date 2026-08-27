import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const TAU = Math.PI * 2;
const CLUSTERS_PER_SIDE = 5;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function attractionEase(value) {
  const t = clamp01(value);
  if (t < 0.7) return 0.78 * Math.pow(t / 0.7, 1.28);
  return 0.78 + smooth((t - 0.7) / 0.3) * 0.22;
}

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
      const broad = Math.sin(nx * TAU * 5.8 + ny * 4.4) * 2.0;
      const cutter = Math.sin(nx * TAU * 17 - ny * 9.5) * 0.9;
      const grain = (random() - 0.5) * 5.2;
      pixels[y * size + x] = Math.max(0, Math.min(255, 128 + broad + cutter + grain));
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
  texture.repeat.set(4.6, 2.1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function deformGeometry(geometry, phase, strength = 0.004) {
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radial = 1
      + Math.sin(x * 29 + y * 41 + z * 23 + phase) * strength
      + Math.cos(x * 17 - y * 31 + z * 37 + phase * 0.7) * strength * 0.38;

    position.setXYZ(
      i,
      x * (1 + Math.sin(z * 22 + phase) * strength * 0.16),
      y * radial,
      z * radial,
    );
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
  if (type === 1) geometry.scale(1.06, 0.94, 1.01);
  return deformGeometry(geometry, 1.4 + type * 1.9, type === 0 ? 0.0032 : 0.0048);
}

function getQualityCount() {
  if (typeof window === 'undefined') return 1800;
  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency || 6;

  if (width < 680) return cores <= 4 ? 620 : 860;
  if (width < 1100) return cores <= 4 ? 1080 : 1480;
  return cores <= 4 ? 1760 : 2500;
}

function write3(target, i3, x, y, z) {
  target[i3] = x;
  target[i3 + 1] = y;
  target[i3 + 2] = z;
}

function buildParticleData(count, compact = false) {
  const random = seededRandom(918273);
  const stream = new Float32Array(count * 3);
  const funnel = new Float32Array(count * 3);
  const compressed = new Float32Array(count * 3);
  const preform = new Float32Array(count * 3);
  const absorb = new Float32Array(count * 3);
  const rotation = new Float32Array(count * 3);
  const scale = new Float32Array(count * 3);
  const tint = new Float32Array(count);
  const phase = new Float32Array(count);
  const pathT = new Float32Array(count);
  const flutter = new Float32Array(count);
  const speed = new Float32Array(count);
  const lag = new Float32Array(count);
  const fuseOffset = new Float32Array(count);
  const entrySide = new Float32Array(count);
  const entryArc = new Float32Array(count);
  const entryDepth = new Float32Array(count);
  const entryCluster = new Float32Array(count);
  const entryDelay = new Float32Array(count);
  const entryWidth = new Float32Array(count);
  const separation = new Float32Array(count);
  const variant = new Uint8Array(count);

  const verticalScale = compact ? 0.9 : 1;
  const topSpread = compact ? 3.2 : 6.05;
  const lowerSpread = compact ? 0.78 : 1.28;
  const depthSpread = compact ? 0.76 : 1.52;

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const side = random() < 0.5 ? -1 : 1;
    const cluster = Math.floor(random() * CLUSTERS_PER_SIDE);
    const clusterBand = cluster / Math.max(1, CLUSTERS_PER_SIDE - 1);
    const localPhase = random() * TAU;
    const arc = 0.72 + random() * 0.62;
    const depth = (random() - 0.5) * 2;
    const widthJitter = (random() - 0.5) * 2;

    const packetCentre = 0.07 + clusterBand * 0.86;
    const packetWidth = 0.12 + random() * 0.06;
    const clustered = random() < 0.72;
    const t = clustered
      ? clamp01(packetCentre + (random() - 0.5) * packetWidth)
      : random();

    pathT[i] = t;
    phase[i] = localPhase;
    tint[i] = random();
    flutter[i] = 0.4 + random() * 0.56;
    speed[i] = 0.84 + random() * 0.2;
    lag[i] = (random() - 0.5) * 0.012;
    fuseOffset[i] = (random() - 0.5) * 0.035;
    entrySide[i] = side;
    entryArc[i] = arc;
    entryDepth[i] = depth;
    entryCluster[i] = clusterBand;
    entryWidth[i] = widthJitter;
    separation[i] = random();

    const delayPick = random();
    entryDelay[i] = delayPick < 0.34 ? 0 : ((delayPick - 0.34) / 0.66) * 0.065;
    variant[i] = random() < 0.76 ? 0 : 1;

    const entryEase = attractionEase(t);
    const spread = THREE.MathUtils.lerp(topSpread, lowerSpread, entryEase);
    const sourceWidth = THREE.MathUtils.lerp(compact ? 0.5 : 0.92, compact ? 0.18 : 0.34, entryEase);
    const bow = Math.sin(t * Math.PI);
    const packetWave = Math.sin((t + clusterBand * 0.13) * TAU * 0.86 + localPhase * 0.28);

    write3(
      stream,
      i3,
      side * (spread * (0.88 + arc * 0.08) + bow * 0.16)
        + widthJitter * sourceWidth
        + packetWave * 0.14,
      (9.7 - t * 17.55) * verticalScale
        + (clusterBand - 0.5) * 0.58 * (1 - t)
        + (random() - 0.5) * 0.16,
      depth * THREE.MathUtils.lerp(depthSpread, compact ? 0.36 : 0.52, entryEase)
        + Math.sin(t * TAU * 0.54 + localPhase) * 0.22
        + widthJitter * 0.08,
    );

    // Broad converging streams, not a DNA helix. The material is guided inward
    // with only a gentle S bend and depth variation.
    const funnelEase = smooth(t);
    write3(
      funnel,
      i3,
      side * THREE.MathUtils.lerp(compact ? 1.85 : 2.9, compact ? 0.5 : 0.82, funnelEase)
        + Math.sin(localPhase + t * 2.05) * (compact ? 0.22 : 0.38)
        + widthJitter * THREE.MathUtils.lerp(0.28, 0.08, funnelEase),
      (5.25 - t * 8.25) * verticalScale + (random() - 0.5) * 0.16,
      depth * THREE.MathUtils.lerp(compact ? 0.52 : 0.86, 0.22, funnelEase)
        + side * Math.sin(t * Math.PI) * (compact ? 0.18 : 0.3)
        + Math.sin(localPhase * 0.7) * 0.12,
    );

    const compactEase = smooth(t);
    write3(
      compressed,
      i3,
      side * THREE.MathUtils.lerp(compact ? 0.9 : 1.45, 0.14, compactEase)
        + Math.cos(localPhase) * (compact ? 0.12 : 0.2),
      (3.15 - t * 3.0) * verticalScale + (random() - 0.5) * 0.12,
      depth * THREE.MathUtils.lerp(compact ? 0.34 : 0.5, 0.1, compactEase)
        + Math.sin(localPhase) * (compact ? 0.11 : 0.17),
    );

    const preRadius = (compact ? 0.12 : 0.16) + random() * (compact ? 0.38 : 0.55);
    const preAngle = localPhase + side * 0.18;
    write3(
      preform,
      i3,
      Math.cos(preAngle) * preRadius + side * 0.08,
      (1.9 - t * 1.32) * verticalScale + (random() - 0.5) * 0.09,
      Math.sin(preAngle) * preRadius * 0.78,
    );

    const absorbRadius = 0.025 + random() * (compact ? 0.12 : 0.17);
    write3(
      absorb,
      i3,
      Math.cos(localPhase) * absorbRadius,
      0.56 + (0.5 - t) * 0.22 + (random() - 0.5) * 0.045,
      Math.sin(localPhase) * absorbRadius * 0.75,
    );

    const base = 0.82 + random() * 0.18;
    scale[i3] = base * (0.92 + random() * 0.1);
    scale[i3 + 1] = base * (0.9 + random() * 0.08);
    scale[i3 + 2] = base * (0.91 + random() * 0.08);

    rotation[i3] = random() * TAU;
    rotation[i3 + 1] = random() * TAU;
    rotation[i3 + 2] = random() * TAU;
  }

  return {
    stream,
    funnel,
    compressed,
    preform,
    absorb,
    rotation,
    scale,
    tint,
    phase,
    pathT,
    flutter,
    speed,
    lag,
    fuseOffset,
    entrySide,
    entryArc,
    entryDepth,
    entryCluster,
    entryDelay,
    entryWidth,
    separation,
    variant,
    compact,
  };
}

function resolvePosition(data, index, rawProgress, time, position, euler, scaleVector) {
  const i3 = index * 3;
  const progress = clamp01(rawProgress + data.lag[index]);
  const phase = data.phase[index];

  let from = data.stream;
  let to = data.funnel;
  let mix = attractionEase(range(progress, 0.105, 0.22));
  let turbulence = Math.sin(mix * Math.PI) * 0.078;

  if (progress >= 0.22 && progress < 0.32) {
    from = data.funnel;
    to = data.compressed;
    mix = range(progress, 0.22, 0.32);
    turbulence = Math.sin(mix * Math.PI) * 0.065;
  } else if (progress >= 0.32 && progress < 0.42) {
    from = data.compressed;
    to = data.preform;
    mix = range(progress, 0.32, 0.42);
    turbulence = Math.sin(mix * Math.PI) * 0.038;
  } else if (progress >= 0.42 && progress < 0.515) {
    from = data.preform;
    to = data.absorb;
    mix = range(progress, 0.42, 0.515);
    turbulence = Math.sin(mix * Math.PI) * 0.016;
  } else if (progress >= 0.515) {
    from = data.absorb;
    to = data.absorb;
    mix = 1;
    turbulence = 0.0025;
  }

  let fromX = from[i3];
  let fromY = from[i3 + 1];
  let fromZ = from[i3 + 2];

  if (progress < 0.22) {
    const topSpread = data.compact ? 3.2 : 6.05;
    const lowerSpread = data.compact ? 0.78 : 1.28;
    const depthSpread = data.compact ? 0.76 : 1.52;
    const movingT = (
      data.pathT[index]
      + time * 0.013 * data.speed[index]
      + Math.min(rawProgress, 0.19) * 0.38
    ) % 1;
    const entryEase = attractionEase(movingT);
    const spread = THREE.MathUtils.lerp(topSpread, lowerSpread, entryEase);
    const sourceWidth = THREE.MathUtils.lerp(
      data.compact ? 0.5 : 0.92,
      data.compact ? 0.18 : 0.34,
      entryEase,
    );
    const bow = Math.sin(movingT * Math.PI);
    const packetWave = Math.sin(
      (movingT + data.entryCluster[index] * 0.13) * TAU * 0.86 + phase * 0.28,
    );

    const animatedX = data.entrySide[index]
      * (spread * (0.88 + data.entryArc[index] * 0.08) + bow * 0.16)
      + data.entryWidth[index] * sourceWidth
      + packetWave * 0.14;
    let animatedY = (9.7 - movingT * 17.55) * (data.compact ? 0.9 : 1)
      + (data.entryCluster[index] - 0.5) * 0.58 * (1 - movingT);
    const animatedZ = data.entryDepth[index]
      * THREE.MathUtils.lerp(depthSpread, data.compact ? 0.36 : 0.52, entryEase)
      + Math.sin(movingT * TAU * 0.54 + phase) * 0.22
      + data.entryWidth[index] * 0.08;

    const arrival = range(rawProgress + 0.008, data.entryDelay[index], data.entryDelay[index] + 0.048);
    const upstream = 1 - arrival;
    animatedY += upstream * (7.6 + data.entryDelay[index] * 20);

    const live = 1 - range(progress, 0.13, 0.22);
    fromX = THREE.MathUtils.lerp(
      fromX,
      animatedX + data.entrySide[index] * upstream * 0.65,
      live,
    );
    fromY = THREE.MathUtils.lerp(fromY, animatedY, live);
    fromZ = THREE.MathUtils.lerp(fromZ, animatedZ, live);
  }

  const micro = (0.0055 + data.flutter[index] * 0.0028) * (1 - range(progress, 0.46, 0.58));

  position.set(
    THREE.MathUtils.lerp(fromX, to[i3], mix)
      + Math.cos(phase + time * 0.35) * turbulence
      + Math.sin(time * 0.48 + phase) * micro,
    THREE.MathUtils.lerp(fromY, to[i3 + 1], mix)
      + Math.sin(phase * 0.71 + time * 0.43) * turbulence * 0.055,
    THREE.MathUtils.lerp(fromZ, to[i3 + 2], mix)
      + Math.sin(phase + time * 0.33) * turbulence * 0.64
      + Math.cos(time * 0.44 + phase) * micro,
  );

  const convergenceWindow = range(progress, 0.08, 0.18) * (1 - range(progress, 0.3, 0.43));
  const spacingFade = 1 - range(progress, 0.43, 0.52);
  const spacing = (0.014 + data.separation[index] * 0.038)
    * (0.75 + convergenceWindow * 0.35)
    * spacingFade;
  const spacingAngle = phase * 1.31 + data.entryCluster[index] * 2.0;
  position.x += Math.cos(spacingAngle) * spacing;
  position.z += Math.sin(spacingAngle) * spacing;

  const freeTumble = 1 - range(progress, 0.38, 0.5);
  const tumbleX = Math.sin(time * (0.18 + data.flutter[index] * 0.02) + phase)
    * 0.021 * freeTumble;
  const tumbleY = Math.sin(time * 0.15 + phase * 0.63)
    * 0.011 * freeTumble;
  const tumbleZ = Math.cos(time * (0.16 + data.flutter[index] * 0.018) + phase * 0.82)
    * 0.017 * freeTumble;
  const inwardLean = data.entrySide[index] * -0.07 * (1 - range(progress, 0.18, 0.34));

  euler.set(
    data.rotation[i3] + tumbleX,
    data.rotation[i3 + 1] + inwardLean + tumbleY,
    data.rotation[i3 + 2] + tumbleZ,
  );

  // Pellets are absorbed into the plasticizing mass before the mould arrives.
  // This prevents the old pile of granules sitting on top of the formed part.
  const fuseStart = 0.405 + data.fuseOffset[index] * 0.42;
  const fuseEnd = 0.535 + data.fuseOffset[index] * 0.14;
  const fuse = range(rawProgress, fuseStart, fuseEnd);
  const compact = THREE.MathUtils.lerp(1, 0.84, range(progress, 0.35, 0.49));
  const fusionScale = THREE.MathUtils.lerp(1, 0.012, fuse);
  const pulse = 1 + Math.sin(time * 0.82 + phase) * 0.0015 * (1 - fuse);

  scaleVector.set(
    data.scale[i3] * compact * fusionScale * pulse,
    data.scale[i3 + 1] * compact * fusionScale / pulse,
    data.scale[i3 + 2] * compact * fusionScale,
  );
}

function PelletLayer({ indices, geometry, material, palette, data, progressRef }) {
  const meshRef = useRef();
  const groupRef = useRef();
  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const scaleVector = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.renderOrder = 4;

    const dark = new THREE.Color(palette[0]);
    const mid = new THREE.Color(palette[1]);
    const high = new THREE.Color(palette[2]);
    const color = new THREE.Color();

    for (let local = 0; local < indices.length; local += 1) {
      const particle = indices[local];
      color.copy(dark).lerp(mid, 0.5 + data.tint[particle] * 0.34);
      color.lerp(high, 0.025 + data.tint[particle] * 0.045);
      mesh.setColorAt(local, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [data, indices, palette]);

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    const group = groupRef.current;
    if (!mesh || !group) return;

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
      mesh.setMatrixAt(local, helper.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;

    const convergence = range(progress, 0.15, 0.3) * (1 - range(progress, 0.42, 0.52));
    const targetRotation = Math.sin(time * 0.1) * 0.003 * convergence;
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetRotation, 3.2, delta);
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, indices.length]}
        frustumCulled={false}
      />
    </group>
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

  const groups = useMemo(() => {
    const next = [[], []];
    for (let i = 0; i < count; i += 1) next[data.variant[i]].push(i);
    return next;
  }, [count, data]);

  const materials = useMemo(() => [
    new THREE.MeshPhysicalMaterial({
      color: '#245f9f',
      roughness: 0.36,
      metalness: 0,
      clearcoat: 0.28,
      clearcoatRoughness: 0.24,
      ior: 1.47,
      specularIntensity: 0.44,
      specularColor: new THREE.Color('#9fc4e8'),
      bumpMap: microTexture,
      bumpScale: 0.0019,
      envMapIntensity: 0.72,
      vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#2e6bab',
      roughness: 0.33,
      metalness: 0,
      clearcoat: 0.31,
      clearcoatRoughness: 0.21,
      ior: 1.47,
      specularIntensity: 0.47,
      specularColor: new THREE.Color('#afd0ef'),
      bumpMap: microTexture,
      bumpScale: 0.0017,
      envMapIntensity: 0.76,
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
      {groups.map((indices, index) => (
        <PelletLayer
          key={index}
          indices={indices}
          geometry={geometries[index]}
          material={materials[index]}
          palette={palettes[index]}
          data={data}
          progressRef={progressRef}
        />
      ))}
    </group>
  );
}
