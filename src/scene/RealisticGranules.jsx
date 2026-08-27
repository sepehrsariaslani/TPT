import { useFrame, useThree } from '@react-three/fiber';
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

function createMicroSurfaceTexture(seed = 1, size = 96) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const broad = Math.sin(nx * TAU * 5.3 + ny * 4.7) * 4.5;
      const fine = Math.sin(nx * TAU * 19.0 - ny * 13.0) * 2.4;
      const noise = (random() - 0.5) * 13;
      pixels[y * size + x] = Math.max(0, Math.min(255, 128 + broad + fine + noise));
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
  texture.repeat.set(5.5, 2.2);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createCutFaceTexture(seed = 9, size = 96) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);
  const center = (size - 1) * 0.5;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const radius = Math.sqrt(dx * dx + dy * dy) / center;
      const angle = Math.atan2(dy, dx);
      const cutter = Math.sin(radius * 52 + angle * 2.2) * 6;
      const noise = (random() - 0.5) * 17;
      pixels[y * size + x] = Math.max(0, Math.min(255, 126 + cutter + noise));
    }
  }

  const texture = new THREE.DataTexture(
    pixels,
    size,
    size,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function deformCutEdges(geometry, amount = 0.0025, phase = 0) {
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const endMask = smooth((Math.abs(x) - 0.105) / 0.028);
    const radialAngle = Math.atan2(z, y);
    const cutterWave = Math.sin(radialAngle * 5 + phase) * amount * endMask;
    const micro = Math.sin(y * 53 + z * 39 + phase * 2.7) * amount * 0.35 * endMask;
    position.setX(i, x + Math.sign(x || 1) * (cutterWave + micro));
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createVirginPelletGeometry() {
  // Typical injection-moulding resin pellet: short cylinder, visibly cut faces,
  // and a small manufacturing bevel rather than a candy-like capsule end.
  const profile = [
    [0.0, -0.138],
    [0.056, -0.138],
    [0.074, -0.133],
    [0.085, -0.120],
    [0.090, -0.101],
    [0.091, 0.101],
    [0.086, 0.120],
    [0.075, 0.133],
    [0.056, 0.138],
    [0.0, 0.138],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));

  const geometry = new THREE.LatheGeometry(profile, 20);
  geometry.rotateZ(Math.PI / 2);
  return deformCutEdges(geometry, 0.0018, 0.7);
}

function createRoundedPelletGeometry() {
  // Some pellets leave the cutter slightly rolled/rounded. Keep the cut faces,
  // but soften the shoulder so the population does not look cloned.
  const profile = [
    [0.0, -0.132],
    [0.048, -0.132],
    [0.066, -0.127],
    [0.080, -0.113],
    [0.089, -0.088],
    [0.093, -0.048],
    [0.094, 0.048],
    [0.090, 0.088],
    [0.081, 0.113],
    [0.067, 0.127],
    [0.048, 0.132],
    [0.0, 0.132],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));

  const geometry = new THREE.LatheGeometry(profile, 20);
  geometry.rotateZ(Math.PI / 2);
  geometry.scale(1.04, 0.98, 1.0);
  return deformCutEdges(geometry, 0.0014, 2.1);
}

function createImperfectPelletGeometry() {
  const profile = [
    [0.0, -0.131],
    [0.052, -0.131],
    [0.073, -0.124],
    [0.085, -0.105],
    [0.091, -0.073],
    [0.092, 0.071],
    [0.087, 0.103],
    [0.073, 0.122],
    [0.048, 0.132],
    [0.0, 0.132],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));

  const geometry = new THREE.LatheGeometry(profile, 18);
  geometry.rotateZ(Math.PI / 2);

  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radialNoise = 1
      + Math.sin(x * 31.7 + y * 47.2 + z * 23.4) * 0.012
      + Math.cos(x * 18.3 - y * 27.1 + z * 41.8) * 0.008;
    const shear = y * 0.035 + Math.sin(z * 27.0) * 0.0015;
    position.setXYZ(
      i,
      x + shear,
      y * radialNoise,
      z * radialNoise * (1 + Math.sin(x * 24.0) * 0.009),
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return deformCutEdges(geometry, 0.0028, 4.3);
}

function createCutDiscGeometry(length, radius, direction = 1) {
  const geometry = new THREE.CircleGeometry(radius, 20);
  geometry.rotateY(direction > 0 ? Math.PI / 2 : -Math.PI / 2);
  geometry.translate(direction * (length * 0.5 + 0.0009), 0, 0);
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
  const pathLag = new Float32Array(count);
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
    wobble[i] = 0.38 + random() * 0.82;
    spin[i] = 0.48 + random() * 1.22;
    fallSpeed[i] = 0.78 + random() * 0.44;
    fallOffset[i] = random();
    meltOffset[i] = (random() - 0.5) * 0.044;
    pathLag[i] = (random() - 0.5) * 0.018;

    const variantPick = random();
    variant[i] = variantPick < 0.58 ? 0 : variantPick < 0.87 ? 1 : 2;

    const streamRadius = 1.1 + 2.95 * (1 - t) + Math.sin(t * Math.PI) * 0.48;
    const streamAngle = strandAngle
      + Math.sin(t * Math.PI * 1.62 + localPhase) * 0.235
      + (random() - 0.5) * 0.035;
    stream[i3] = Math.cos(streamAngle) * streamRadius + (random() - 0.5) * 0.2;
    stream[i3 + 1] = 8.2 - t * 15.8 + (random() - 0.5) * 0.38;
    stream[i3 + 2] = Math.sin(streamAngle) * streamRadius * 0.72 + (random() - 0.5) * 0.2;

    const turns = 4.35 + random() * 1.45;
    const vortexAngle = strandAngle + t * TAU * turns + localPhase * 0.16;
    const vortexRadius = 4.05 - t * 1.55
      + Math.sin(t * Math.PI * 4.2 + localPhase) * 0.16
      + (random() - 0.5) * 0.12;
    vortex[i3] = Math.cos(vortexAngle) * vortexRadius;
    vortex[i3 + 1] = 5.05 - t * 8.9 + Math.sin(vortexAngle * 0.42) * 0.13;
    vortex[i3 + 2] = Math.sin(vortexAngle) * vortexRadius * 0.84;

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

    // Physical size variation stays narrow. Real production pellets vary, but they
    // should still read as one resin batch rather than three different products.
    const base = 0.79 + random() * 0.22;
    if (variant[i] === 0) {
      scale[i3] = base * (1.02 + random() * 0.15);
      scale[i3 + 1] = base * (0.91 + random() * 0.09);
      scale[i3 + 2] = base * (0.92 + random() * 0.09);
    } else if (variant[i] === 1) {
      scale[i3] = base * (1.1 + random() * 0.16);
      scale[i3 + 1] = base * (0.86 + random() * 0.1);
      scale[i3 + 2] = base * (0.88 + random() * 0.1);
    } else {
      scale[i3] = base * (0.97 + random() * 0.18);
      scale[i3 + 1] = base * (0.91 + random() * 0.11);
      scale[i3 + 2] = base * (0.93 + random() * 0.12);
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
    pathLag,
    variant,
  };
}

function resolvePelletTransform(data, i, rawProgress, time, position, euler, scaleVector) {
  const i3 = i * 3;
  const progress = clamp01(rawProgress + data.pathLag[i]);
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
      const fall = ((time * 0.2 * data.fallSpeed[i] + data.fallOffset[i]) % 1) * 1.5;
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
    curveStrength = Math.sin(toCap * Math.PI) * data.spread[i] * 0.82;
  } else if (progress < 0.84) {
    ax = data.cap[i3];
    ay = data.cap[i3 + 1];
    az = data.cap[i3 + 2];
    bx = data.release[i3];
    by = data.release[i3 + 1];
    bz = data.release[i3 + 2];
    mix = release;
    curveStrength = Math.sin(release * Math.PI) * data.spread[i] * 1.03;
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

  const phase = data.phase[i] + progress * TAU * 3.25 + time * 0.1;
  const settle = range(progress, 0.4, 0.56) * (1 - range(progress, 0.66, 0.77));
  const turbulence = 1 - settle * 0.96;
  const micro = (0.008 + data.wobble[i] * 0.009) * turbulence;

  position.set(
    THREE.MathUtils.lerp(ax, bx, mix)
      + Math.cos(phase) * curveStrength
      + Math.cos(time * 1.43 + data.phase[i]) * micro,
    THREE.MathUtils.lerp(ay, by, mix)
      + Math.sin(phase * 0.63) * curveStrength * 0.17
      + Math.sin(time * 1.14 + data.phase[i] * 0.7) * micro * 0.36,
    THREE.MathUtils.lerp(az, bz, mix)
      + Math.sin(phase) * curveStrength * 0.72
      + Math.sin(time * 1.62 + data.phase[i]) * micro * 0.62,
  );

  const spinRate = data.spin[i];
  euler.set(
    data.rotation[i3] + time * (0.12 + spinRate * 0.1) * turbulence,
    data.rotation[i3 + 1] + progress * 2.05 + Math.sin(time * 0.72 + data.phase[i]) * 0.028 * turbulence,
    data.rotation[i3 + 2] + time * (0.08 + spinRate * 0.085) * turbulence,
  );

  // Do not fade the pellets with transparency. Real opaque pellets physically
  // disappear into the forming part, so scale them down into the surface instead.
  const localForm = range(progress, 0.46 + data.meltOffset[i], 0.59 + data.meltOffset[i]);
  const localReturn = range(progress, 0.65 + data.meltOffset[i], 0.79 + data.meltOffset[i]);
  const melted = localForm * (1 - localReturn);
  const presence = 1 - melted * 0.94;
  const pulse = 1 + Math.sin(time * 1.5 + data.phase[i]) * 0.0045 * turbulence;

  scaleVector.set(
    data.scale[i3] * presence * pulse,
    data.scale[i3 + 1] * presence / pulse,
    data.scale[i3 + 2] * presence,
  );
}

function PelletLayer({
  indices,
  geometry,
  cutPositiveGeometry,
  cutNegativeGeometry,
  data,
  progressRef,
  palette,
  bodyMaterial,
  cutMaterial,
}) {
  const bodyRef = useRef();
  const facePositiveRef = useRef();
  const faceNegativeRef = useRef();
  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const scaleVector = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const meshes = [bodyRef.current, facePositiveRef.current, faceNegativeRef.current].filter(Boolean);
    if (!meshes.length) return;

    meshes.forEach((mesh) => mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage));

    const dark = new THREE.Color(palette[0]);
    const mid = new THREE.Color(palette[1]);
    const light = new THREE.Color(palette[2]);
    const bodyColor = new THREE.Color();
    const cutColor = new THREE.Color();

    for (let localIndex = 0; localIndex < indices.length; localIndex += 1) {
      const particleIndex = indices[localIndex];
      const tint = data.tint[particleIndex];
      bodyColor.copy(dark).lerp(mid, 0.36 + tint * 0.48);
      bodyColor.lerp(light, data.brightness[particleIndex] * 0.11);

      // Cut faces are slightly chalkier/lighter than the glossy side wall,
      // exactly where the extrusion strand was chopped into pellets.
      cutColor.copy(bodyColor).lerp(new THREE.Color('#d8e8fb'), 0.12 + data.brightness[particleIndex] * 0.08);

      bodyRef.current?.setColorAt(localIndex, bodyColor);
      facePositiveRef.current?.setColorAt(localIndex, cutColor);
      faceNegativeRef.current?.setColorAt(localIndex, cutColor);
    }

    meshes.forEach((mesh) => {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [data, indices, palette]);

  useFrame(({ clock }, delta) => {
    const body = bodyRef.current;
    const facePositive = facePositiveRef.current;
    const faceNegative = faceNegativeRef.current;
    if (!body || !facePositive || !faceNegative) return;

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

      body.setMatrixAt(localIndex, helper.matrix);
      facePositive.setMatrixAt(localIndex, helper.matrix);
      faceNegative.setMatrixAt(localIndex, helper.matrix);
    }

    body.instanceMatrix.needsUpdate = true;
    facePositive.instanceMatrix.needsUpdate = true;
    faceNegative.instanceMatrix.needsUpdate = true;

    const targetRotation = progress * 0.37;
    body.rotation.y = THREE.MathUtils.damp(body.rotation.y, targetRotation, 3.0, delta);
    facePositive.rotation.y = body.rotation.y;
    faceNegative.rotation.y = body.rotation.y;
  });

  return (
    <>
      <instancedMesh
        ref={bodyRef}
        args={[geometry, bodyMaterial, indices.length]}
        frustumCulled={false}
        castShadow
      />
      <instancedMesh
        ref={facePositiveRef}
        args={[cutPositiveGeometry, cutMaterial, indices.length]}
        frustumCulled={false}
        castShadow
      />
      <instancedMesh
        ref={faceNegativeRef}
        args={[cutNegativeGeometry, cutMaterial, indices.length]}
        frustumCulled={false}
        castShadow
      />
    </>
  );
}

export default function RealisticGranules({ progressRef }) {
  const { gl } = useThree();

  const count = useMemo(() => {
    if (typeof window === 'undefined') return 1400;
    if (window.innerWidth < 680) return 880;
    if (window.innerWidth < 1100) return 1380;
    return 2150;
  }, []);

  const data = useMemo(() => buildParticleData(count), [count]);
  const virginGeometry = useMemo(() => createVirginPelletGeometry(), []);
  const roundedGeometry = useMemo(() => createRoundedPelletGeometry(), []);
  const imperfectGeometry = useMemo(() => createImperfectPelletGeometry(), []);

  const cutGeometries = useMemo(() => [
    [createCutDiscGeometry(0.276, 0.082, 1), createCutDiscGeometry(0.276, 0.082, -1)],
    [createCutDiscGeometry(0.274, 0.079, 1), createCutDiscGeometry(0.274, 0.079, -1)],
    [createCutDiscGeometry(0.264, 0.079, 1), createCutDiscGeometry(0.264, 0.079, -1)],
  ], []);

  const groups = useMemo(() => {
    const next = [[], [], []];
    for (let i = 0; i < count; i += 1) next[data.variant[i]].push(i);
    return next;
  }, [count, data]);

  const microTexture = useMemo(() => createMicroSurfaceTexture(144), []);
  const cutTexture = useMemo(() => createCutFaceTexture(911), []);

  useEffect(() => {
    const maxAnisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    microTexture.anisotropy = maxAnisotropy;
    cutTexture.anisotropy = maxAnisotropy;
    microTexture.needsUpdate = true;
    cutTexture.needsUpdate = true;
  }, [cutTexture, gl, microTexture]);

  const materials = useMemo(() => {
    const body = [
      new THREE.MeshPhysicalMaterial({
        color: '#4b86dc',
        roughness: 0.31,
        metalness: 0,
        clearcoat: 0.74,
        clearcoatRoughness: 0.2,
        ior: 1.47,
        specularIntensity: 0.76,
        specularColor: new THREE.Color('#dbeaff'),
        bumpMap: microTexture,
        bumpScale: 0.0038,
        vertexColors: true,
      }),
      new THREE.MeshPhysicalMaterial({
        color: '#5791e4',
        roughness: 0.28,
        metalness: 0,
        clearcoat: 0.82,
        clearcoatRoughness: 0.17,
        ior: 1.46,
        specularIntensity: 0.82,
        specularColor: new THREE.Color('#e6f1ff'),
        bumpMap: microTexture,
        bumpScale: 0.0033,
        vertexColors: true,
      }),
      new THREE.MeshPhysicalMaterial({
        color: '#467fcf',
        roughness: 0.35,
        metalness: 0,
        clearcoat: 0.62,
        clearcoatRoughness: 0.24,
        ior: 1.47,
        specularIntensity: 0.7,
        specularColor: new THREE.Color('#d6e8fb'),
        bumpMap: microTexture,
        bumpScale: 0.0048,
        vertexColors: true,
      }),
    ];

    const cut = body.map((_, index) => new THREE.MeshPhysicalMaterial({
      color: index === 1 ? '#6599dc' : '#5a8dcf',
      roughness: 0.48 + index * 0.025,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.54,
      ior: 1.46,
      specularIntensity: 0.48,
      specularColor: new THREE.Color('#d9e7f8'),
      bumpMap: cutTexture,
      bumpScale: 0.006,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }));

    return { body, cut };
  }, [cutTexture, microTexture]);

  useEffect(() => () => {
    virginGeometry.dispose();
    roundedGeometry.dispose();
    imperfectGeometry.dispose();
    cutGeometries.flat().forEach((geometry) => geometry.dispose());
    materials.body.forEach((material) => material.dispose());
    materials.cut.forEach((material) => material.dispose());
    microTexture.dispose();
    cutTexture.dispose();
  }, [cutGeometries, cutTexture, imperfectGeometry, materials, microTexture, roundedGeometry, virginGeometry]);

  const palettes = useMemo(() => [
    ['#24578f', '#5b91cf', '#a9cce9'],
    ['#2c6099', '#679bd5', '#b9d6ee'],
    ['#255485', '#5588c3', '#9fc2df'],
  ], []);

  const geometries = [virginGeometry, roundedGeometry, imperfectGeometry];

  return (
    <group>
      {groups.map((indices, index) => (
        <PelletLayer
          key={index}
          indices={indices}
          geometry={geometries[index]}
          cutPositiveGeometry={cutGeometries[index][0]}
          cutNegativeGeometry={cutGeometries[index][1]}
          bodyMaterial={materials.body[index]}
          cutMaterial={materials.cut[index]}
          data={data}
          progressRef={progressRef}
          palette={palettes[index]}
        />
      ))}
    </group>
  );
}
