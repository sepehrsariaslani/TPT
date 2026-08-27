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
      const broad = Math.sin(nx * TAU * 6.2 + ny * 4.1) * 2.8;
      const fine = Math.sin(nx * TAU * 18.0 - ny * 11.0) * 1.3;
      const grain = (random() - 0.5) * 7.5;
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
  texture.repeat.set(4.2, 1.8);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function deformGeometry(geometry, phase, strength = 0.007) {
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radial = 1
      + Math.sin(x * 29 + y * 41 + z * 23 + phase) * strength
      + Math.cos(x * 17 - y * 31 + z * 37 + phase * 0.7) * strength * 0.45;

    position.setXYZ(
      i,
      x * (1 + Math.sin(z * 22 + phase) * strength * 0.24),
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
    const geometry = new THREE.DodecahedronGeometry(0.082, 1);
    geometry.scale(1.15, 0.9, 0.84);
    return deformGeometry(geometry, 4.2, 0.018);
  }

  const profile = type === 0
    ? [
      [0.0, -0.116], [0.045, -0.116], [0.064, -0.109], [0.074, -0.094],
      [0.079, -0.066], [0.080, 0.066], [0.075, 0.094], [0.065, 0.109],
      [0.045, 0.116], [0.0, 0.116],
    ]
    : [
      [0.0, -0.111], [0.039, -0.109], [0.058, -0.101], [0.071, -0.083],
      [0.079, -0.052], [0.081, 0], [0.079, 0.052], [0.071, 0.083],
      [0.058, 0.101], [0.039, 0.109], [0.0, 0.111],
    ];

  const geometry = new THREE.LatheGeometry(
    profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
    type === 0 ? 14 : 12,
  );
  geometry.rotateZ(Math.PI / 2);
  if (type === 1) geometry.scale(1.03, 0.95, 1.01);
  return deformGeometry(geometry, 1.3 + type * 1.8, type === 0 ? 0.004 : 0.0065);
}

function getQualityCount() {
  if (typeof window === 'undefined') return 1000;
  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency || 6;

  if (width < 680) return cores <= 4 ? 520 : 720;
  if (width < 1100) return cores <= 4 ? 760 : 1040;
  return cores <= 4 ? 980 : 1420;
}

function write3(target, i3, x, y, z) {
  target[i3] = x;
  target[i3 + 1] = y;
  target[i3 + 2] = z;
}

function buildParticleData(count) {
  const random = seededRandom(918273);
  const stream = new Float32Array(count * 3);
  const gathering = new Float32Array(count * 3);
  const swirl = new Float32Array(count * 3);
  const surface = new Float32Array(count * 3);
  const flow = new Float32Array(count * 3);
  const rotation = new Float32Array(count * 3);
  const scale = new Float32Array(count * 3);
  const tint = new Float32Array(count);
  const phase = new Float32Array(count);
  const flutter = new Float32Array(count);
  const speed = new Float32Array(count);
  const lag = new Float32Array(count);
  const variant = new Uint8Array(count);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const t = random();
    const angle = random() * TAU;
    const localPhase = random() * TAU;

    phase[i] = localPhase;
    tint[i] = random();
    flutter[i] = 0.48 + random() * 0.68;
    speed[i] = 0.8 + random() * 0.42;
    lag[i] = (random() - 0.5) * 0.028;

    const pick = random();
    variant[i] = pick < 0.62 ? 0 : pick < 0.9 ? 1 : 2;

    // Stage 01 — a dense but imperfect gravity stream. Every pellet starts here.
    const streamRadius = Math.pow(random(), 1.75) * 1.48;
    write3(
      stream,
      i3,
      Math.cos(angle) * streamRadius + (random() - 0.5) * 0.14,
      8.8 - t * 16.9 + (random() - 0.5) * 0.28,
      Math.sin(angle) * streamRadius * 0.78 + (random() - 0.5) * 0.14,
    );

    // Stage 02 — pellets broaden into a low circular flow without any neon guides.
    const band = Math.floor(random() * 8);
    const gatherRadius = 0.9 + band * 0.36 + random() * 0.26;
    const gatherAngle = angle + t * TAU * (1.15 + (band % 3) * 0.2);
    write3(
      gathering,
      i3,
      Math.cos(gatherAngle) * gatherRadius,
      0.72 + (band - 3.5) * 0.06 + (random() - 0.5) * 0.16,
      Math.sin(gatherAngle) * gatherRadius * 0.76,
    );

    // Stage 03/04 — the pellets themselves create the tornado. No TubeGeometry lines.
    const turns = 4.7 + (i % 5) * 0.17 + random() * 0.5;
    const swirlAngle = angle + t * TAU * turns;
    const swirlRadius = 4.0 - t * 2.75
      + Math.sin(t * TAU * 2.4 + localPhase) * 0.11
      + (random() - 0.5) * 0.1;
    write3(
      swirl,
      i3,
      Math.cos(swirlAngle) * swirlRadius,
      4.65 - t * 8.0 + (random() - 0.5) * 0.22,
      Math.sin(swirlAngle) * swirlRadius * 0.83,
    );

    // Stage 05 — settle ON the cap, not inside it. This prevents visual disappearance.
    const surfacePick = random();
    if (surfacePick < 0.72) {
      const radius = Math.sqrt(random()) * 2.26;
      const a = random() * TAU;
      write3(
        surface,
        i3,
        Math.cos(a) * radius,
        0.57 + random() * 0.035,
        Math.sin(a) * radius,
      );

      // Stage 06 — keep circulating just above the top surface.
      const flowRadius = Math.min(2.42, radius + 0.06 + random() * 0.12);
      const flowAngle = a + (random() - 0.5) * 0.12;
      write3(
        flow,
        i3,
        Math.cos(flowAngle) * flowRadius,
        0.61 + random() * 0.07,
        Math.sin(flowAngle) * flowRadius,
      );
    } else {
      const a = random() * TAU;
      const radius = 2.53 + random() * 0.12;
      const y = -0.3 + random() * 0.78;
      write3(surface, i3, Math.cos(a) * radius, y, Math.sin(a) * radius);

      const flowRadius = radius + 0.08 + random() * 0.1;
      write3(
        flow,
        i3,
        Math.cos(a) * flowRadius,
        y + (random() - 0.5) * 0.05,
        Math.sin(a) * flowRadius,
      );
    }

    const base = 0.82 + random() * 0.2;
    if (variant[i] === 0) {
      scale[i3] = base * (0.94 + random() * 0.14);
      scale[i3 + 1] = base * (0.91 + random() * 0.08);
      scale[i3 + 2] = base * (0.92 + random() * 0.08);
    } else if (variant[i] === 1) {
      scale[i3] = base * (1.0 + random() * 0.16);
      scale[i3 + 1] = base * (0.87 + random() * 0.1);
      scale[i3 + 2] = base * (0.89 + random() * 0.1);
    } else {
      scale[i3] = base * (0.86 + random() * 0.16);
      scale[i3 + 1] = base * (0.82 + random() * 0.14);
      scale[i3 + 2] = base * (0.84 + random() * 0.14);
    }

    rotation[i3] = random() * TAU;
    rotation[i3 + 1] = random() * TAU;
    rotation[i3 + 2] = random() * TAU;
  }

  return {
    stream,
    gathering,
    swirl,
    surface,
    flow,
    rotation,
    scale,
    tint,
    phase,
    flutter,
    speed,
    lag,
    variant,
  };
}

function resolvePosition(data, index, rawProgress, time, position, euler, scaleVector) {
  const i3 = index * 3;
  const progress = clamp01(rawProgress + data.lag[index]);

  let from = data.stream;
  let to = data.gathering;
  let mix = range(progress, 0.08, 0.28);
  let turbulence = Math.sin(mix * Math.PI) * 0.14;

  if (progress >= 0.28 && progress < 0.55) {
    from = data.gathering;
    to = data.swirl;
    mix = range(progress, 0.28, 0.55);
    turbulence = Math.sin(mix * Math.PI) * 0.22;
  } else if (progress >= 0.55 && progress < 0.82) {
    from = data.swirl;
    to = data.surface;
    mix = range(progress, 0.55, 0.82);
    turbulence = Math.sin(mix * Math.PI) * 0.14;
  } else if (progress >= 0.82) {
    from = data.surface;
    to = data.flow;
    mix = range(progress, 0.82, 1.0);
    turbulence = 0.018;
  }

  const phase = data.phase[index];
  const liveFall = 1 - range(progress, 0.08, 0.2);
  const fallCycle = ((time * 0.31 * data.speed[index] + phase / TAU) % 1) * 1.2 * liveFall;
  const settle = range(progress, 0.69, 0.88);
  const micro = (0.012 + data.flutter[index] * 0.006) * (1 - settle * 0.8);

  position.set(
    THREE.MathUtils.lerp(from[i3], to[i3], mix)
      + Math.cos(phase + time * 0.72) * turbulence
      + Math.sin(time * 1.35 + phase) * micro,
    THREE.MathUtils.lerp(from[i3 + 1], to[i3 + 1], mix)
      - fallCycle
      + Math.sin(phase * 0.71 + time * 0.92) * turbulence * 0.1,
    THREE.MathUtils.lerp(from[i3 + 2], to[i3 + 2], mix)
      + Math.sin(phase + time * 0.67) * turbulence * 0.75
      + Math.cos(time * 1.22 + phase) * micro,
  );

  // Crucial: at the end, granules keep flowing around the formed product forever.
  // They never get zero scale, zero opacity, or a target inside the cap mesh.
  const finalFlow = range(progress, 0.78, 1.0);
  const orbitAngle = time * (0.15 + data.speed[index] * 0.05) + phase;
  position.x += Math.cos(orbitAngle) * 0.035 * finalFlow;
  position.z += Math.sin(orbitAngle) * 0.035 * finalFlow;
  position.y += Math.sin(time * 0.55 + phase * 0.6) * 0.012 * finalFlow;

  const activeSwirl = range(progress, 0.2, 0.46) * (1 - range(progress, 0.72, 0.88));
  euler.set(
    data.rotation[i3] + time * (0.08 + data.flutter[index] * 0.025),
    data.rotation[i3 + 1] + activeSwirl * progress * 2.6 + time * activeSwirl * 0.08,
    data.rotation[i3 + 2] + time * (0.06 + data.flutter[index] * 0.02),
  );

  const compact = THREE.MathUtils.lerp(1, 0.96, settle);
  const pulse = 1 + Math.sin(time * 1.1 + phase) * 0.0025 * (1 - settle);
  scaleVector.set(
    data.scale[i3] * compact * pulse,
    data.scale[i3 + 1] * compact / pulse,
    data.scale[i3 + 2] * compact,
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
    mesh.renderOrder = 5;

    const dark = new THREE.Color(palette[0]);
    const mid = new THREE.Color(palette[1]);
    const high = new THREE.Color(palette[2]);
    const color = new THREE.Color();

    for (let local = 0; local < indices.length; local += 1) {
      const particle = indices[local];
      color.copy(dark).lerp(mid, 0.42 + data.tint[particle] * 0.42);
      color.lerp(high, 0.045 + data.tint[particle] * 0.07);
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

    const gathering = range(progress, 0.12, 0.3) * (1 - range(progress, 0.42, 0.58));
    const swirl = range(progress, 0.3, 0.5) * (1 - range(progress, 0.7, 0.84));
    const finalFlow = range(progress, 0.78, 1.0);
    const targetRotation = time * (gathering * 0.06 + swirl * 0.12 + finalFlow * 0.025);
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
  const data = useMemo(() => buildParticleData(count), [count]);
  const microTexture = useMemo(() => createMicroTexture(), []);
  const geometries = useMemo(() => [0, 1, 2].map((type) => makePelletGeometry(type)), []);

  const groups = useMemo(() => {
    const next = [[], [], []];
    for (let i = 0; i < count; i += 1) next[data.variant[i]].push(i);
    return next;
  }, [count, data]);

  const materials = useMemo(() => [
    new THREE.MeshPhysicalMaterial({
      color: '#4d8bdd',
      roughness: 0.27,
      metalness: 0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.16,
      ior: 1.47,
      specularIntensity: 0.82,
      specularColor: new THREE.Color('#e8f3ff'),
      sheen: 0.16,
      sheenRoughness: 0.42,
      sheenColor: new THREE.Color('#5f9ce2'),
      bumpMap: microTexture,
      bumpScale: 0.0025,
      envMapIntensity: 1.18,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#6aa4e8',
      roughness: 0.24,
      metalness: 0,
      clearcoat: 0.94,
      clearcoatRoughness: 0.13,
      ior: 1.46,
      specularIntensity: 0.88,
      specularColor: new THREE.Color('#f1f7ff'),
      sheen: 0.2,
      sheenRoughness: 0.38,
      sheenColor: new THREE.Color('#78b1ec'),
      bumpMap: microTexture,
      bumpScale: 0.0022,
      envMapIntensity: 1.24,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      vertexColors: true,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#4f82c7',
      roughness: 0.32,
      metalness: 0,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
      ior: 1.47,
      specularIntensity: 0.74,
      specularColor: new THREE.Color('#dcecff'),
      bumpMap: microTexture,
      bumpScale: 0.0032,
      envMapIntensity: 1.1,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      flatShading: true,
      vertexColors: true,
    }),
  ], [microTexture]);

  const palettes = useMemo(() => [
    ['#2b5f92', '#6596c9', '#b8d6ee'],
    ['#32699d', '#78a8d7', '#d0e4f4'],
    ['#295781', '#5f8dbc', '#a9c9e2'],
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
