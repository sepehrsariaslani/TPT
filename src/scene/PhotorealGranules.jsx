import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const TAU = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
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

function createSurfaceTexture(seed = 144, size = 96) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const extrusion = Math.sin(nx * TAU * 5.1 + ny * 4.3) * 3.6;
      const micro = Math.sin(nx * TAU * 23.0 - ny * 15.0) * 1.8;
      const noise = (random() - 0.5) * 10;
      pixels[y * size + x] = Math.max(0, Math.min(255, 128 + extrusion + micro + noise));
    }
  }

  const texture = new THREE.DataTexture(pixels, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6.0, 2.1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createCutTexture(seed = 911, size = 96) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);
  const center = (size - 1) * 0.5;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const radius = Math.sqrt(dx * dx + dy * dy) / center;
      const angle = Math.atan2(dy, dx);
      const rings = Math.sin(radius * 56 + angle * 2.4) * 5.4;
      const blade = Math.sin(dx * 0.42 + dy * 0.12) * 2.2;
      const noise = (random() - 0.5) * 14;
      pixels[y * size + x] = Math.max(0, Math.min(255, 127 + rings + blade + noise));
    }
  }

  const texture = new THREE.DataTexture(pixels, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function deformCutEdges(geometry, amount = 0.002, phase = 0) {
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const mask = smooth((Math.abs(x) - 0.105) / 0.03);
    const angle = Math.atan2(z, y);
    const wave = Math.sin(angle * 5 + phase) * amount * mask;
    const chip = Math.sin(y * 57 + z * 43 + phase * 2.3) * amount * 0.3 * mask;
    position.setX(i, x + Math.sign(x || 1) * (wave + chip));
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function makePelletGeometry(type) {
  const profiles = [
    [
      [0.0, -0.139], [0.057, -0.139], [0.076, -0.133], [0.087, -0.119],
      [0.092, -0.097], [0.092, 0.097], [0.087, 0.119], [0.076, 0.133],
      [0.057, 0.139], [0.0, 0.139],
    ],
    [
      [0.0, -0.133], [0.050, -0.133], [0.070, -0.127], [0.084, -0.111],
      [0.092, -0.083], [0.095, -0.044], [0.095, 0.044], [0.092, 0.083],
      [0.084, 0.111], [0.070, 0.127], [0.050, 0.133], [0.0, 0.133],
    ],
    [
      [0.0, -0.132], [0.053, -0.132], [0.074, -0.124], [0.087, -0.104],
      [0.093, -0.071], [0.093, 0.068], [0.088, 0.102], [0.075, 0.122],
      [0.049, 0.133], [0.0, 0.133],
    ],
  ];

  const profile = profiles[type].map(([radius, height]) => new THREE.Vector2(radius, height));
  const geometry = new THREE.LatheGeometry(profile, type === 2 ? 18 : 22);
  geometry.rotateZ(Math.PI / 2);

  if (type === 2) {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const radial = 1
        + Math.sin(x * 31.3 + y * 45.2 + z * 21.8) * 0.009
        + Math.cos(x * 17.1 - y * 25.3 + z * 39.7) * 0.006;
      position.setXYZ(i, x + y * 0.025, y * radial, z * radial);
    }
    position.needsUpdate = true;
  }

  return deformCutEdges(geometry, type === 2 ? 0.0028 : 0.0016, 0.8 + type * 1.7);
}

function makeCutDisc(length, radius, direction) {
  const geometry = new THREE.CircleGeometry(radius, 22);
  geometry.rotateY(direction > 0 ? Math.PI / 2 : -Math.PI / 2);
  geometry.translate(direction * (length * 0.5 + 0.001), 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function vortexPoint(strand, pathT, phaseOffset = 0) {
  const strandCount = 24;
  const base = (strand / strandCount) * TAU;
  const turns = 5.75 + (strand % 5) * 0.11;
  const angle = base + pathT * TAU * turns + phaseOffset;
  const pinch = Math.exp(-Math.pow((pathT - 0.56) / 0.23, 2));
  const radius = 4.48 - pathT * 1.78 - pinch * 0.16
    + Math.sin(pathT * TAU * 2.25 + strand) * 0.12;

  return new THREE.Vector3(
    Math.cos(angle) * radius,
    5.65 - pathT * 10.15,
    Math.sin(angle) * radius * 0.82,
  );
}

function buildParticleData(count) {
  const random = seededRandom(918273);
  const stream = new Float32Array(count * 3);
  const vortex = new Float32Array(count * 3);
  const vortexTangent = new Float32Array(count * 3);
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
  const pathLag = new Float32Array(count);
  const variant = new Uint8Array(count);
  const strandIndex = new Uint8Array(count);
  const pathTArray = new Float32Array(count);

  const strandCount = 24;

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const strand = Math.floor(random() * strandCount);
    const pathT = random();
    const localPhase = (random() - 0.5) * 0.11;
    const strandAngle = (strand / strandCount) * TAU;

    strandIndex[i] = strand;
    pathTArray[i] = pathT;
    phase[i] = random() * TAU;
    spread[i] = 0.46 + random() * 0.92;
    tint[i] = random();
    brightness[i] = random();
    wobble[i] = 0.32 + random() * 0.72;
    spin[i] = 0.42 + random() * 1.05;
    fallSpeed[i] = 0.8 + random() * 0.4;
    fallOffset[i] = random();
    meltOffset[i] = (random() - 0.5) * 0.04;
    pathLag[i] = (random() - 0.5) * 0.015;

    const pick = random();
    variant[i] = pick < 0.6 ? 0 : pick < 0.88 ? 1 : 2;

    const streamRadius = 1.02 + 3.05 * (1 - pathT) + Math.sin(pathT * Math.PI) * 0.5;
    const streamAngle = strandAngle + Math.sin(pathT * Math.PI * 1.55 + strand) * 0.18;
    stream[i3] = Math.cos(streamAngle) * streamRadius + (random() - 0.5) * 0.12;
    stream[i3 + 1] = 8.8 - pathT * 16.8 + (random() - 0.5) * 0.26;
    stream[i3 + 2] = Math.sin(streamAngle) * streamRadius * 0.72 + (random() - 0.5) * 0.12;

    const point = vortexPoint(strand, pathT, localPhase);
    const before = vortexPoint(strand, Math.max(0, pathT - 0.0025), localPhase);
    const after = vortexPoint(strand, Math.min(1, pathT + 0.0025), localPhase);
    const tangent = after.sub(before).normalize();

    vortex[i3] = point.x + (random() - 0.5) * 0.06;
    vortex[i3 + 1] = point.y + (random() - 0.5) * 0.06;
    vortex[i3 + 2] = point.z + (random() - 0.5) * 0.06;
    vortexTangent[i3] = tangent.x;
    vortexTangent[i3 + 1] = tangent.y;
    vortexTangent[i3 + 2] = tangent.z;

    const surface = random();
    if (surface < 0.68) {
      const r = Math.sqrt(random()) * 2.33;
      const a = random() * TAU;
      cap[i3] = Math.cos(a) * r;
      cap[i3 + 1] = 0.445 + (random() - 0.5) * 0.04;
      cap[i3 + 2] = Math.sin(a) * r;
    } else if (surface < 0.955) {
      const a = random() * TAU;
      const r = 2.455 + (random() - 0.5) * 0.05;
      cap[i3] = Math.cos(a) * r;
      cap[i3 + 1] = -0.3 + random() * 0.63;
      cap[i3 + 2] = Math.sin(a) * r;
    } else {
      const a = random() * TAU;
      const r = 2.28 + random() * 0.22;
      cap[i3] = Math.cos(a) * r;
      cap[i3 + 1] = -0.43 + (random() - 0.5) * 0.04;
      cap[i3 + 2] = Math.sin(a) * r;
    }

    const releaseT = random();
    const releaseAngle = phase[i] + releaseT * TAU * (5.0 + (strand % 4) * 0.34);
    const releaseRadius = 2.5 + releaseT * (2.3 + random() * 1.35);
    release[i3] = Math.cos(releaseAngle) * releaseRadius;
    release[i3 + 1] = 1.85 - releaseT * 7.55 + (random() - 0.5) * 0.38;
    release[i3 + 2] = Math.sin(releaseAngle) * releaseRadius * 0.82;

    const exitRadius = 0.9 + random() * 4.0;
    const exitAngle = strandAngle + (random() - 0.5) * 0.18;
    exit[i3] = Math.cos(exitAngle) * exitRadius;
    exit[i3 + 1] = -2.8 - random() * 9.5;
    exit[i3 + 2] = Math.sin(exitAngle) * exitRadius * 0.74;

    const base = 0.8 + random() * 0.2;
    if (variant[i] === 0) {
      scale[i3] = base * (1.02 + random() * 0.13);
      scale[i3 + 1] = base * (0.92 + random() * 0.08);
      scale[i3 + 2] = base * (0.93 + random() * 0.08);
    } else if (variant[i] === 1) {
      scale[i3] = base * (1.09 + random() * 0.15);
      scale[i3 + 1] = base * (0.87 + random() * 0.09);
      scale[i3 + 2] = base * (0.89 + random() * 0.09);
    } else {
      scale[i3] = base * (0.98 + random() * 0.16);
      scale[i3 + 1] = base * (0.91 + random() * 0.1);
      scale[i3 + 2] = base * (0.93 + random() * 0.1);
    }

    rotation[i3] = random() * TAU;
    rotation[i3 + 1] = random() * TAU;
    rotation[i3 + 2] = random() * TAU;
  }

  return {
    stream,
    vortex,
    vortexTangent,
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
    pathLag,
    variant,
    strandIndex,
    pathTArray,
  };
}

function resolveTransform(data, i, rawProgress, time, position, quaternion, scaleVector, scratch) {
  const i3 = i * 3;
  const p = clamp01(rawProgress + data.pathLag[i]);
  const toVortex = range(p, 0.11, 0.34);
  const toCap = range(p, 0.33, 0.53);
  const release = range(p, 0.655, 0.84);
  const toExit = range(p, 0.83, 1.0);

  let ax; let ay; let az; let bx; let by; let bz; let mix; let curveStrength;

  if (p < 0.34) {
    ax = data.stream[i3]; ay = data.stream[i3 + 1]; az = data.stream[i3 + 2];
    bx = data.vortex[i3]; by = data.vortex[i3 + 1]; bz = data.vortex[i3 + 2];
    mix = toVortex;
    curveStrength = Math.sin(toVortex * Math.PI) * data.spread[i] * 0.22;

    if (p < 0.19) {
      const fall = ((time * 0.19 * data.fallSpeed[i] + data.fallOffset[i]) % 1) * 1.45;
      ay -= fall;
      if (ay < -8.3) ay += 17.0;
    }
  } else if (p < 0.655) {
    ax = data.vortex[i3]; ay = data.vortex[i3 + 1]; az = data.vortex[i3 + 2];
    bx = data.cap[i3]; by = data.cap[i3 + 1]; bz = data.cap[i3 + 2];
    mix = toCap;
    curveStrength = Math.sin(toCap * Math.PI) * data.spread[i] * 0.68;
  } else if (p < 0.84) {
    ax = data.cap[i3]; ay = data.cap[i3 + 1]; az = data.cap[i3 + 2];
    bx = data.release[i3]; by = data.release[i3 + 1]; bz = data.release[i3 + 2];
    mix = release;
    curveStrength = Math.sin(release * Math.PI) * data.spread[i] * 0.92;
  } else {
    ax = data.release[i3]; ay = data.release[i3 + 1]; az = data.release[i3 + 2];
    bx = data.exit[i3]; by = data.exit[i3 + 1]; bz = data.exit[i3 + 2];
    mix = toExit;
    curveStrength = Math.sin(toExit * Math.PI) * data.spread[i] * 0.34;
  }

  const settle = range(p, 0.41, 0.57) * (1 - range(p, 0.65, 0.77));
  const turbulence = 1 - settle * 0.97;
  const flowPhase = data.phase[i] + p * TAU * 2.8 + time * 0.085;
  const micro = (0.006 + data.wobble[i] * 0.008) * turbulence;

  position.set(
    THREE.MathUtils.lerp(ax, bx, mix) + Math.cos(flowPhase) * curveStrength + Math.cos(time * 1.31 + data.phase[i]) * micro,
    THREE.MathUtils.lerp(ay, by, mix) + Math.sin(flowPhase * 0.61) * curveStrength * 0.14 + Math.sin(time * 1.08 + data.phase[i]) * micro * 0.3,
    THREE.MathUtils.lerp(az, bz, mix) + Math.sin(flowPhase) * curveStrength * 0.68 + Math.sin(time * 1.49 + data.phase[i]) * micro * 0.54,
  );

  scratch.euler.set(
    data.rotation[i3] + time * (0.1 + data.spin[i] * 0.08) * turbulence,
    data.rotation[i3 + 1] + p * 1.8,
    data.rotation[i3 + 2] + time * (0.07 + data.spin[i] * 0.07) * turbulence,
  );
  scratch.randomQ.setFromEuler(scratch.euler);

  scratch.tangent.set(
    data.vortexTangent[i3],
    data.vortexTangent[i3 + 1],
    data.vortexTangent[i3 + 2],
  ).normalize();
  scratch.flowQ.setFromUnitVectors(X_AXIS, scratch.tangent);
  scratch.rollQ.setFromAxisAngle(X_AXIS, data.phase[i] * 0.34 + time * 0.12);
  scratch.flowQ.multiply(scratch.rollQ);

  const alignIn = range(p, 0.16, 0.3);
  const alignOut = range(p, 0.43, 0.54);
  const alignment = alignIn * (1 - alignOut) * 0.78;
  quaternion.copy(scratch.randomQ).slerp(scratch.flowQ, alignment);

  const localForm = range(p, 0.46 + data.meltOffset[i], 0.59 + data.meltOffset[i]);
  const localReturn = range(p, 0.65 + data.meltOffset[i], 0.79 + data.meltOffset[i]);
  const melted = localForm * (1 - localReturn);
  const presence = 1 - melted * 0.945;
  const pulse = 1 + Math.sin(time * 1.4 + data.phase[i]) * 0.0035 * turbulence;

  scaleVector.set(
    data.scale[i3] * presence * pulse,
    data.scale[i3 + 1] * presence / pulse,
    data.scale[i3 + 2] * presence,
  );
}

function PelletLayer({ indices, geometry, cutPositive, cutNegative, data, progressRef, palette, bodyMaterial, cutMaterial }) {
  const bodyRef = useRef();
  const positiveRef = useRef();
  const negativeRef = useRef();
  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const scaleVector = useMemo(() => new THREE.Vector3(), []);
  const scratch = useMemo(() => ({
    euler: new THREE.Euler(),
    randomQ: new THREE.Quaternion(),
    flowQ: new THREE.Quaternion(),
    rollQ: new THREE.Quaternion(),
    tangent: new THREE.Vector3(),
  }), []);

  useEffect(() => {
    const meshes = [bodyRef.current, positiveRef.current, negativeRef.current].filter(Boolean);
    meshes.forEach((mesh) => mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage));

    const dark = new THREE.Color(palette[0]);
    const mid = new THREE.Color(palette[1]);
    const light = new THREE.Color(palette[2]);
    const bodyColor = new THREE.Color();
    const faceColor = new THREE.Color();
    const faceLift = new THREE.Color('#d9e8f7');

    for (let local = 0; local < indices.length; local += 1) {
      const i = indices[local];
      bodyColor.copy(dark).lerp(mid, 0.38 + data.tint[i] * 0.44);
      bodyColor.lerp(light, data.brightness[i] * 0.1);
      faceColor.copy(bodyColor).lerp(faceLift, 0.12 + data.brightness[i] * 0.07);
      bodyRef.current?.setColorAt(local, bodyColor);
      positiveRef.current?.setColorAt(local, faceColor);
      negativeRef.current?.setColorAt(local, faceColor);
    }

    meshes.forEach((mesh) => {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [data, indices, palette]);

  useFrame(({ clock }, delta) => {
    const body = bodyRef.current;
    const positive = positiveRef.current;
    const negative = negativeRef.current;
    if (!body || !positive || !negative) return;

    const p = progressRef.current;
    const time = clock.getElapsedTime();

    for (let local = 0; local < indices.length; local += 1) {
      const i = indices[local];
      resolveTransform(data, i, p, time, position, quaternion, scaleVector, scratch);
      helper.position.copy(position);
      helper.quaternion.copy(quaternion);
      helper.scale.copy(scaleVector);
      helper.updateMatrix();
      body.setMatrixAt(local, helper.matrix);
      positive.setMatrixAt(local, helper.matrix);
      negative.setMatrixAt(local, helper.matrix);
    }

    body.instanceMatrix.needsUpdate = true;
    positive.instanceMatrix.needsUpdate = true;
    negative.instanceMatrix.needsUpdate = true;

    const target = p * 0.31;
    body.rotation.y = THREE.MathUtils.damp(body.rotation.y, target, 3.2, delta);
    positive.rotation.y = body.rotation.y;
    negative.rotation.y = body.rotation.y;
  });

  return (
    <>
      <instancedMesh ref={bodyRef} args={[geometry, bodyMaterial, indices.length]} frustumCulled={false} />
      <instancedMesh ref={positiveRef} args={[cutPositive, cutMaterial, indices.length]} frustumCulled={false} />
      <instancedMesh ref={negativeRef} args={[cutNegative, cutMaterial, indices.length]} frustumCulled={false} />
    </>
  );
}

export default function PhotorealGranules({ progressRef }) {
  const { gl } = useThree();
  const count = useMemo(() => {
    if (typeof window === 'undefined') return 1350;
    if (window.innerWidth < 680) return 820;
    if (window.innerWidth < 1100) return 1280;
    return 1900;
  }, []);

  const data = useMemo(() => buildParticleData(count), [count]);
  const geometries = useMemo(() => [makePelletGeometry(0), makePelletGeometry(1), makePelletGeometry(2)], []);
  const cutGeometries = useMemo(() => [
    [makeCutDisc(0.278, 0.083, 1), makeCutDisc(0.278, 0.083, -1)],
    [makeCutDisc(0.266, 0.081, 1), makeCutDisc(0.266, 0.081, -1)],
    [makeCutDisc(0.264, 0.080, 1), makeCutDisc(0.264, 0.080, -1)],
  ], []);

  const groups = useMemo(() => {
    const next = [[], [], []];
    for (let i = 0; i < count; i += 1) next[data.variant[i]].push(i);
    return next;
  }, [count, data]);

  const surfaceTexture = useMemo(() => createSurfaceTexture(), []);
  const cutTexture = useMemo(() => createCutTexture(), []);

  useEffect(() => {
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    surfaceTexture.anisotropy = anisotropy;
    cutTexture.anisotropy = anisotropy;
    surfaceTexture.needsUpdate = true;
    cutTexture.needsUpdate = true;
  }, [cutTexture, gl, surfaceTexture]);

  const materials = useMemo(() => {
    const bodyColors = ['#4a83d3', '#5792df', '#447bc9'];
    const transmission = [0.105, 0.14, 0.08];
    const roughness = [0.27, 0.24, 0.31];

    const body = bodyColors.map((color, index) => new THREE.MeshPhysicalMaterial({
      color,
      roughness: roughness[index],
      metalness: 0,
      clearcoat: 0.78 + index * 0.04,
      clearcoatRoughness: 0.14 + index * 0.025,
      ior: 1.47,
      transmission: transmission[index],
      thickness: 0.18,
      attenuationDistance: 0.72,
      attenuationColor: new THREE.Color(index === 1 ? '#4b83c8' : '#3b6da9'),
      specularIntensity: 0.84,
      specularColor: new THREE.Color('#e8f3ff'),
      sheen: 0.08,
      sheenRoughness: 0.22,
      sheenColor: new THREE.Color('#b8d9ff'),
      envMapIntensity: 1.25,
      bumpMap: surfaceTexture,
      bumpScale: 0.0032 + index * 0.0006,
      vertexColors: true,
    }));

    const cut = bodyColors.map((color, index) => new THREE.MeshPhysicalMaterial({
      color: index === 1 ? '#6697cb' : '#5887ba',
      roughness: 0.5 + index * 0.025,
      metalness: 0,
      clearcoat: 0.1,
      clearcoatRoughness: 0.58,
      ior: 1.46,
      transmission: 0.025,
      thickness: 0.08,
      attenuationDistance: 0.42,
      attenuationColor: new THREE.Color(color),
      specularIntensity: 0.45,
      specularColor: new THREE.Color('#dbe9f7'),
      envMapIntensity: 0.95,
      bumpMap: cutTexture,
      bumpScale: 0.0065,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }));

    return { body, cut };
  }, [cutTexture, surfaceTexture]);

  useEffect(() => () => {
    geometries.forEach((geometry) => geometry.dispose());
    cutGeometries.flat().forEach((geometry) => geometry.dispose());
    materials.body.forEach((material) => material.dispose());
    materials.cut.forEach((material) => material.dispose());
    surfaceTexture.dispose();
    cutTexture.dispose();
  }, [cutGeometries, cutTexture, geometries, materials, surfaceTexture]);

  const palettes = useMemo(() => [
    ['#24568b', '#5a8fc8', '#a7c7e3'],
    ['#2c6098', '#679bd2', '#bbd7ec'],
    ['#235080', '#5385bb', '#9fbfdb'],
  ], []);

  return (
    <group>
      {groups.map((indices, index) => (
        <PelletLayer
          key={index}
          indices={indices}
          geometry={geometries[index]}
          cutPositive={cutGeometries[index][0]}
          cutNegative={cutGeometries[index][1]}
          data={data}
          progressRef={progressRef}
          palette={palettes[index]}
          bodyMaterial={materials.body[index]}
          cutMaterial={materials.cut[index]}
        />
      ))}
    </group>
  );
}
