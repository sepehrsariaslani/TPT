import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const TAU = Math.PI * 2;
const STREAM_COUNT = 12;
const CLUSTERS_PER_SIDE = 5;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

// Slow at the source, accelerate while the material is pulled to the centre,
// then gently settle before it hands off to the next phase.
function attractionEase(value) {
  const t = clamp01(value);
  if (t < 0.72) return 0.8 * Math.pow(t / 0.72, 1.32);
  return 0.8 + smooth((t - 0.72) / 0.28) * 0.2;
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
      const broad = Math.sin(nx * TAU * 5.8 + ny * 4.4) * 2.3;
      const cutter = Math.sin(nx * TAU * 17 - ny * 9.5) * 1.1;
      const grain = (random() - 0.5) * 6.4;
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
  texture.repeat.set(4, 1.8);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function deformGeometry(geometry, phase, strength = 0.005) {
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radial = 1
      + Math.sin(x * 29 + y * 41 + z * 23 + phase) * strength
      + Math.cos(x * 17 - y * 31 + z * 37 + phase * 0.7) * strength * 0.42;

    position.setXYZ(
      i,
      x * (1 + Math.sin(z * 22 + phase) * strength * 0.2),
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
    const geometry = new THREE.DodecahedronGeometry(0.066, 1);
    geometry.scale(1.12, 0.92, 0.86);
    return deformGeometry(geometry, 4.2, 0.014);
  }

  const profile = type === 0
    ? [
      [0, -0.098], [0.038, -0.098], [0.054, -0.092], [0.064, -0.079],
      [0.069, -0.056], [0.07, 0.056], [0.065, 0.079], [0.055, 0.092],
      [0.038, 0.098], [0, 0.098],
    ]
    : [
      [0, -0.094], [0.034, -0.092], [0.05, -0.085], [0.061, -0.07],
      [0.068, -0.044], [0.069, 0], [0.068, 0.044], [0.061, 0.07],
      [0.05, 0.085], [0.034, 0.092], [0, 0.094],
    ];

  const geometry = new THREE.LatheGeometry(
    profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
    type === 0 ? 14 : 12,
  );
  geometry.rotateZ(Math.PI / 2);
  if (type === 1) geometry.scale(1.04, 0.96, 1.01);
  return deformGeometry(geometry, 1.3 + type * 1.8, type === 0 ? 0.0035 : 0.0055);
}

function getQualityCount() {
  if (typeof window === 'undefined') return 1800;
  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency || 6;

  // Stage 01 benefits from density, but keep the mobile budget conservative.
  if (width < 680) return cores <= 4 ? 660 : 900;
  if (width < 1100) return cores <= 4 ? 1120 : 1540;
  return cores <= 4 ? 1800 : 2600;
}

function write3(target, i3, x, y, z) {
  target[i3] = x;
  target[i3 + 1] = y;
  target[i3 + 2] = z;
}

function buildParticleData(count, compactViewport = false) {
  const random = seededRandom(918273);
  const stream = new Float32Array(count * 3);
  const funnel = new Float32Array(count * 3);
  const compressed = new Float32Array(count * 3);
  const preform = new Float32Array(count * 3);
  const surface = new Float32Array(count * 3);
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
  const separation = new Float32Array(count);
  const variant = new Uint8Array(count);

  const funnelScale = compactViewport ? 0.78 : 1;
  const verticalScale = compactViewport ? 0.9 : 1;
  const topSpread = compactViewport ? 3.05 : 5.7;
  const centreSpread = compactViewport ? 0.58 : 0.9;
  const depthSpread = compactViewport ? 0.72 : 1.35;

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const lane = i % STREAM_COUNT;
    const side = random() < 0.5 ? -1 : 1;
    const cluster = Math.floor(random() * CLUSTERS_PER_SIDE);
    const clusterBand = cluster / Math.max(1, CLUSTERS_PER_SIDE - 1);
    const laneAngle = side < 0 ? Math.PI : 0;
    const localPhase = random() * TAU;
    const arc = 0.72 + random() * 0.62;
    const depth = (random() - 0.5) * 2;

    // Most pellets sit in soft packets instead of a uniform mathematical lane.
    // A smaller filler population bridges the packets so the flow stays organic.
    const packetCentre = 0.08 + clusterBand * 0.84;
    const packetWidth = 0.11 + random() * 0.055;
    const clustered = random() < 0.76;
    const t = clustered
      ? clamp01(packetCentre + (random() - 0.5) * packetWidth)
      : random();

    pathT[i] = t;
    phase[i] = localPhase;
    tint[i] = random();
    flutter[i] = 0.42 + random() * 0.62;
    speed[i] = 0.88 + cluster * 0.012 + (random() - 0.5) * 0.1;
    lag[i] = (random() - 0.5) * 0.014;
    fuseOffset[i] = (random() - 0.5) * 0.038;
    entrySide[i] = side;
    entryArc[i] = arc;
    entryDepth[i] = depth;
    entryCluster[i] = clusterBand;
    separation[i] = random();

    // Roughly one third of the batch is present immediately. The rest starts
    // upstream, outside the camera, and naturally enters as the user scrolls.
    const delayPick = random();
    entryDelay[i] = delayPick < 0.34 ? 0 : ((delayPick - 0.34) / 0.66) * 0.07;

    const pick = random();
    variant[i] = pick < 0.68 ? 0 : pick < 0.95 ? 1 : 2;

    const entryEase = attractionEase(t);
    const spread = THREE.MathUtils.lerp(topSpread, centreSpread, entryEase);
    const bow = Math.sin(t * Math.PI);
    const packetWave = Math.sin((t + clusterBand * 0.11) * TAU * 1.12 + localPhase * 0.34);
    const streamX = side * (
      spread * (0.82 + arc * 0.15)
      + bow * (0.2 + arc * 0.13)
    );
    const streamY = (9.65 - t * 17.55) * verticalScale
      + (clusterBand - 0.5) * 0.52 * (1 - t)
      + Math.sin(t * Math.PI + localPhase * 0.11) * 0.12;
    const streamZ = depth * THREE.MathUtils.lerp(depthSpread, 0.34, entryEase)
      + Math.sin(t * TAU * 0.72 + localPhase) * 0.2
      + (clusterBand - 0.5) * 0.24 * (1 - entryEase);

    write3(
      stream,
      i3,
      streamX + packetWave * 0.12 + (random() - 0.5) * 0.09,
      streamY + (random() - 0.5) * 0.12,
      streamZ + (random() - 0.5) * 0.08,
    );

    // Stage 02 hand-off: a broad, slow central helix. It deliberately avoids
    // the frantic tornado feel so Stage 01 remains the visual hero.
    const funnelTurns = 1.66 + (lane % 6) * 0.032;
    const funnelAngle = laneAngle + t * TAU * funnelTurns + localPhase * 0.07;
    const funnelRadius = (3.45 - t * 1.9 + Math.sin(t * TAU * 1.4 + localPhase) * 0.1) * funnelScale;
    write3(
      funnel,
      i3,
      Math.cos(funnelAngle) * funnelRadius,
      (5.55 - t * 9.7) * verticalScale + (random() - 0.5) * 0.16,
      Math.sin(funnelAngle) * funnelRadius * 0.84,
    );

    const tightTurns = 2.72 + (lane % 6) * 0.042;
    const tightAngle = laneAngle + t * TAU * tightTurns + localPhase * 0.052;
    const tightRadius = (2.88 - t * 1.76 + Math.sin(t * TAU * 2 + localPhase) * 0.085) * funnelScale;
    write3(
      compressed,
      i3,
      Math.cos(tightAngle) * tightRadius,
      (4 - t * 6.65) * verticalScale + (random() - 0.5) * 0.15,
      Math.sin(tightAngle) * tightRadius * 0.86,
    );

    const band = Math.floor(random() * 8);
    const bandRadius = 0.48 + band * 0.29 + random() * 0.18;
    const bandAngle = localPhase + t * TAU * (1.08 + (band % 3) * 0.12);
    write3(
      preform,
      i3,
      Math.cos(bandAngle) * bandRadius,
      0.83 + (band - 3.5) * 0.018 + (random() - 0.5) * 0.05,
      Math.sin(bandAngle) * bandRadius * 0.96,
    );

    const surfacePick = random();
    if (surfacePick < 0.74) {
      const radius = Math.sqrt(random()) * 2.27;
      const a = random() * TAU;
      const sx = Math.cos(a) * radius;
      const sz = Math.sin(a) * radius;
      write3(surface, i3, sx, 0.625 + random() * 0.035, sz);
      write3(absorb, i3, sx, 0.475 - random() * 0.035, sz);
    } else {
      const a = random() * TAU;
      const radius = 2.56 + random() * 0.08;
      const y = -0.28 + random() * 0.77;
      const sx = Math.cos(a) * radius;
      const sz = Math.sin(a) * radius;
      write3(surface, i3, sx, y, sz);
      write3(
        absorb,
        i3,
        Math.cos(a) * (radius - 0.16),
        y,
        Math.sin(a) * (radius - 0.16),
      );
    }

    const base = 0.8 + random() * 0.2;
    if (variant[i] === 0) {
      scale[i3] = base * (0.92 + random() * 0.14);
      scale[i3 + 1] = base * (0.9 + random() * 0.09);
      scale[i3 + 2] = base * (0.91 + random() * 0.09);
    } else if (variant[i] === 1) {
      scale[i3] = base * (0.98 + random() * 0.15);
      scale[i3 + 1] = base * (0.86 + random() * 0.1);
      scale[i3 + 2] = base * (0.88 + random() * 0.1);
    } else {
      scale[i3] = base * (0.85 + random() * 0.13);
      scale[i3 + 1] = base * (0.82 + random() * 0.12);
      scale[i3 + 2] = base * (0.84 + random() * 0.12);
    }

    rotation[i3] = random() * TAU;
    rotation[i3 + 1] = random() * TAU;
    rotation[i3 + 2] = random() * TAU;
  }

  return {
    stream,
    funnel,
    compressed,
    preform,
    surface,
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
    separation,
    variant,
  };
}

function resolvePosition(data, index, rawProgress, time, position, euler, scaleVector) {
  const i3 = index * 3;
  const progress = clamp01(rawProgress + data.lag[index]);
  const phase = data.phase[index];

  let from = data.stream;
  let to = data.funnel;
  let mix = attractionEase(range(progress, 0.105, 0.24));
  let turbulence = Math.sin(mix * Math.PI) * 0.095;

  if (progress >= 0.24 && progress < 0.37) {
    from = data.funnel;
    to = data.compressed;
    mix = range(progress, 0.24, 0.37);
    turbulence = Math.sin(mix * Math.PI) * 0.125;
  } else if (progress >= 0.37 && progress < 0.5) {
    from = data.compressed;
    to = data.preform;
    mix = range(progress, 0.37, 0.5);
    turbulence = Math.sin(mix * Math.PI) * 0.078;
  } else if (progress >= 0.5 && progress < 0.63) {
    from = data.preform;
    to = data.surface;
    mix = range(progress, 0.5, 0.63);
    turbulence = Math.sin(mix * Math.PI) * 0.04;
  } else if (progress >= 0.63) {
    from = data.surface;
    to = data.absorb;
    mix = range(progress, 0.63, 0.76);
    turbulence = 0.005;
  }

  let fromX = from[i3];
  let fromY = from[i3 + 1];
  let fromZ = from[i3 + 2];

  // Stage 01: continuous feed from upper-left and upper-right. Pellets are not
  // spawned/hidden; late particles simply live upstream and enter the camera.
  if (progress < 0.235) {
    const mobile = typeof window !== 'undefined' && window.innerWidth < 680;
    const topSpread = mobile ? 3.05 : 5.7;
    const centreSpread = mobile ? 0.58 : 0.9;
    const depthSpread = mobile ? 0.72 : 1.35;
    const movingT = (
      data.pathT[index]
      + time * 0.016 * data.speed[index]
      + Math.min(rawProgress, 0.2) * 0.42
    ) % 1;
    const entryEase = attractionEase(movingT);
    const spread = THREE.MathUtils.lerp(topSpread, centreSpread, entryEase);
    const bow = Math.sin(movingT * Math.PI);
    const packetWave = Math.sin(
      (movingT + data.entryCluster[index] * 0.11) * TAU * 1.12 + phase * 0.34,
    );

    const animatedX = data.entrySide[index] * (
      spread * (0.82 + data.entryArc[index] * 0.15)
      + bow * (0.2 + data.entryArc[index] * 0.13)
    ) + packetWave * 0.12;
    let animatedY = (9.65 - movingT * 17.55) * (mobile ? 0.9 : 1)
      + (data.entryCluster[index] - 0.5) * 0.52 * (1 - movingT)
      + Math.sin(movingT * Math.PI + phase * 0.11) * 0.12;
    const animatedZ = data.entryDepth[index]
      * THREE.MathUtils.lerp(depthSpread, 0.34, entryEase)
      + Math.sin(movingT * TAU * 0.72 + phase) * 0.2
      + (data.entryCluster[index] - 0.5) * 0.24 * (1 - entryEase);

    const arrival = range(rawProgress + 0.008, data.entryDelay[index], data.entryDelay[index] + 0.048);
    const upstream = 1 - arrival;
    animatedY += upstream * (7.8 + data.entryDelay[index] * 22);

    const live = 1 - range(progress, 0.13, 0.235);
    fromX = THREE.MathUtils.lerp(fromX, animatedX + data.entrySide[index] * upstream * 0.8, live);
    fromY = THREE.MathUtils.lerp(fromY, animatedY, live);
    fromZ = THREE.MathUtils.lerp(fromZ, animatedZ, live);
  }

  const settle = range(progress, 0.52, 0.7);
  const micro = (0.007 + data.flutter[index] * 0.0038) * (1 - settle * 0.9);

  position.set(
    THREE.MathUtils.lerp(fromX, to[i3], mix)
      + Math.cos(phase + time * 0.46) * turbulence
      + Math.sin(time * 0.62 + phase) * micro,
    THREE.MathUtils.lerp(fromY, to[i3 + 1], mix)
      + Math.sin(phase * 0.71 + time * 0.56) * turbulence * 0.07,
    THREE.MathUtils.lerp(fromZ, to[i3 + 2], mix)
      + Math.sin(phase + time * 0.44) * turbulence * 0.7
      + Math.cos(time * 0.58 + phase) * micro,
  );

  // Collision-like visual spacing without an O(n²) physics pass. Each pellet
  // keeps a tiny deterministic personal radius that is strongest as the two
  // streams meet, preventing the centre from reading as a single solid clump.
  const convergenceWindow = range(progress, 0.075, 0.19) * (1 - range(progress, 0.31, 0.46));
  const spacingFade = 1 - range(progress, 0.46, 0.62);
  const spacing = (0.018 + data.separation[index] * 0.05)
    * (0.72 + convergenceWindow * 0.48)
    * spacingFade;
  const spacingAngle = phase * 1.37 + data.entryCluster[index] * 2.1;
  position.x += Math.cos(spacingAngle) * spacing;
  position.z += Math.sin(spacingAngle) * spacing;

  const braid = range(progress, 0.16, 0.32) * (1 - range(progress, 0.5, 0.62));
  const forming = range(progress, 0.4, 0.58) * (1 - range(progress, 0.68, 0.77));

  // Real pellets mostly tumble because of collisions; they do not spin like
  // coins. Keep the initial random orientation and only allow a 1–2° rock.
  const freeTumble = 1 - range(progress, 0.42, 0.66);
  const tumbleX = Math.sin(time * (0.2 + data.flutter[index] * 0.025) + phase)
    * 0.028 * freeTumble;
  const tumbleY = Math.sin(time * 0.17 + phase * 0.63)
    * 0.014 * freeTumble;
  const tumbleZ = Math.cos(time * (0.18 + data.flutter[index] * 0.02) + phase * 0.82)
    * 0.022 * freeTumble;
  const inwardLean = data.entrySide[index] * -0.095 * (1 - range(progress, 0.2, 0.36));

  euler.set(
    data.rotation[i3] + tumbleX,
    data.rotation[i3 + 1] + inwardLean + braid * 0.34 + forming * 0.1 + tumbleY,
    data.rotation[i3 + 2] + tumbleZ,
  );

  const fuseStart = 0.56 + data.fuseOffset[index];
  const fuseEnd = 0.73 + data.fuseOffset[index] * 0.2;
  const fuse = range(rawProgress, fuseStart, fuseEnd);
  const compact = THREE.MathUtils.lerp(1, 0.8, range(progress, 0.52, 0.65));
  const fusionScale = THREE.MathUtils.lerp(1, 0.015, fuse);
  const pulse = 1 + Math.sin(time * 1 + phase) * 0.002 * (1 - fuse);

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
      color.copy(dark).lerp(mid, 0.45 + data.tint[particle] * 0.38);
      color.lerp(high, 0.035 + data.tint[particle] * 0.055);
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

    const braid = range(progress, 0.16, 0.32) * (1 - range(progress, 0.51, 0.62));
    const preform = range(progress, 0.37, 0.5) * (1 - range(progress, 0.62, 0.72));
    const targetRotation = time * (braid * 0.008 + preform * 0.005);
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetRotation, 3, delta);
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
  const compactViewport = useMemo(() => (
    typeof window !== 'undefined' && window.innerWidth < 680
  ), []);
  const data = useMemo(() => buildParticleData(count, compactViewport), [count, compactViewport]);
  const microTexture = useMemo(() => createMicroTexture(), []);
  const geometries = useMemo(() => [0, 1, 2].map((type) => makePelletGeometry(type)), []);

  const groups = useMemo(() => {
    const next = [[], [], []];
    for (let i = 0; i < count; i += 1) next[data.variant[i]].push(i);
    return next;
  }, [count, data]);

  const materials = useMemo(() => [
    new THREE.MeshPhysicalMaterial({
      color: '#2365b4',
      roughness: 0.31,
      metalness: 0,
      clearcoat: 0.58,
      clearcoatRoughness: 0.2,
      ior: 1.47,
      specularIntensity: 0.58,
      specularColor: new THREE.Color('#9fc8f5'),
      sheen: 0.1,
      sheenRoughness: 0.48,
      sheenColor: new THREE.Color('#397fd0'),
      bumpMap: microTexture,
      bumpScale: 0.0022,
      envMapIntensity: 0.86,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#3b7bc5',
      roughness: 0.28,
      metalness: 0,
      clearcoat: 0.64,
      clearcoatRoughness: 0.17,
      ior: 1.46,
      specularIntensity: 0.62,
      specularColor: new THREE.Color('#b5d8fb'),
      sheen: 0.12,
      sheenRoughness: 0.44,
      sheenColor: new THREE.Color('#4d91d7'),
      bumpMap: microTexture,
      bumpScale: 0.002,
      envMapIntensity: 0.92,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#285f9e',
      roughness: 0.36,
      metalness: 0,
      clearcoat: 0.42,
      clearcoatRoughness: 0.26,
      ior: 1.47,
      specularIntensity: 0.5,
      specularColor: new THREE.Color('#8bb8e8'),
      bumpMap: microTexture,
      bumpScale: 0.0028,
      envMapIntensity: 0.78,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      flatShading: true,
      vertexColors: true,
    }),
  ], [microTexture]);

  const palettes = useMemo(() => [
    ['#153f73', '#2f71bd', '#7eb5ea'],
    ['#1a4d82', '#4282c9', '#9bc8ef'],
    ['#173d68', '#346ca8', '#78aada'],
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
