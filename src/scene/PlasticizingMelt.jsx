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

function seededRandom(seed = 55291) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeMeltCurve(index, compact = false) {
  const points = [];
  const phase = index * (TAU / 3) + (index === 1 ? 0.32 : -0.18);
  const radialScale = compact ? 0.78 : 1;
  const verticalScale = compact ? 0.91 : 1;

  for (let step = 0; step <= 18; step += 1) {
    const t = step / 18;
    const eased = smooth(t);
    const radius = THREE.MathUtils.lerp(2.45, 0.68, eased) * radialScale;
    const turns = 1.18 + index * 0.08;
    const angle = phase + t * TAU * turns + Math.sin(t * Math.PI) * (index - 1) * 0.11;
    const x = Math.cos(angle) * radius;
    const y = THREE.MathUtils.lerp(4.05, -1.28, t) * verticalScale
      + Math.sin(t * Math.PI * 2 + phase) * 0.08;
    const z = Math.sin(angle) * radius * 0.78
      + Math.cos(t * Math.PI * 1.6 + phase) * 0.06;
    points.push(new THREE.Vector3(x, y, z));
  }

  return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45);
}

function createMeltTexture(seed = 411, size = 64) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const slow = Math.sin(nx * TAU * 3.1 + ny * 2.7) * 2.1;
      const streak = Math.sin(nx * TAU * 8.6 - ny * 5.2) * 1.05;
      const grain = (random() - 0.5) * 3.5;
      pixels[y * size + x] = Math.max(0, Math.min(255, 128 + slow + streak + grain));
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
  texture.repeat.set(2.1, 5.5);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function buildBlobData(count) {
  const random = seededRandom(88421);
  return Array.from({ length: count }, (_, index) => ({
    lane: index % 3,
    t: random(),
    offset: (random() - 0.5) * 0.13,
    phase: random() * TAU,
    scale: 0.78 + random() * 0.42,
    speed: 0.76 + random() * 0.34,
  }));
}

export default function PlasticizingMelt({ progressRef }) {
  const { size } = useThree();
  const compact = size.width <= 680;
  const groupRef = useRef();
  const blobsRef = useRef();
  const centreLightRef = useRef();
  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const baseAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  const meltTexture = useMemo(() => createMeltTexture(), []);
  const curves = useMemo(
    () => [0, 1, 2].map((index) => makeMeltCurve(index, compact)),
    [compact],
  );
  const tubes = useMemo(
    () => curves.map((curve, index) => new THREE.TubeGeometry(
      curve,
      compact ? 56 : 82,
      (compact ? 0.16 : 0.19) + index * 0.014,
      compact ? 8 : 10,
      false,
    )),
    [curves, compact],
  );
  const blobGeometry = useMemo(
    () => new THREE.SphereGeometry(0.22, compact ? 12 : 16, compact ? 8 : 12),
    [compact],
  );
  const blobData = useMemo(() => buildBlobData(compact ? 38 : 62), [compact]);

  const meltMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0d4f98',
    metalness: 0,
    roughness: 0.2,
    clearcoat: 0.92,
    clearcoatRoughness: 0.11,
    ior: 1.47,
    specularIntensity: 0.88,
    specularColor: new THREE.Color('#c8e0f7'),
    sheen: 0.08,
    sheenRoughness: 0.34,
    sheenColor: new THREE.Color('#2e78bd'),
    bumpMap: meltTexture,
    bumpScale: 0.0017,
    envMapIntensity: 1.18,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), [meltTexture]);

  const blobMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#145ca6',
    metalness: 0,
    roughness: 0.17,
    clearcoat: 0.98,
    clearcoatRoughness: 0.09,
    ior: 1.47,
    specularIntensity: 0.92,
    specularColor: new THREE.Color('#d7e9f9'),
    envMapIntensity: 1.26,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), []);

  useEffect(() => {
    if (blobsRef.current) {
      blobsRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      blobsRef.current.renderOrder = 3;
    }

    return () => {
      tubes.forEach((geometry) => geometry.dispose());
      blobGeometry.dispose();
      meltMaterial.dispose();
      blobMaterial.dispose();
      meltTexture.dispose();
    };
  }, [tubes, blobGeometry, meltMaterial, blobMaterial, meltTexture]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const blobs = blobsRef.current;
    if (!group || !blobs) return;

    const p = progressRef.current;
    const time = clock.getElapsedTime();
    const soften = range(p, 0.215, 0.31);
    const plasticized = range(p, 0.29, 0.43);
    const handoff = range(p, 0.46, 0.585);
    const visibility = soften * (1 - handoff);

    group.visible = visibility > 0.003;
    if (!group.visible) return;

    // The melt becomes smoother and wetter as pellets plasticize. It is not
    // emissive: all highlights come from the studio environment and local light.
    meltMaterial.opacity = visibility * (0.56 + plasticized * 0.28);
    blobMaterial.opacity = visibility * (0.42 + plasticized * 0.34);
    meltMaterial.roughness = THREE.MathUtils.lerp(0.29, 0.145, plasticized);
    meltMaterial.clearcoat = THREE.MathUtils.lerp(0.62, 0.98, plasticized);
    meltMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.18, 0.075, plasticized);
    blobMaterial.roughness = THREE.MathUtils.lerp(0.25, 0.13, plasticized);

    const breathe = 1 + Math.sin(time * 0.55) * 0.008 * visibility;
    const targetScale = THREE.MathUtils.lerp(0.84, 1, soften) * breathe;
    group.scale.x = THREE.MathUtils.damp(group.scale.x, targetScale, 4.8, delta);
    group.scale.y = THREE.MathUtils.damp(
      group.scale.y,
      THREE.MathUtils.lerp(0.88, 1, soften),
      4.8,
      delta,
    );
    group.scale.z = THREE.MathUtils.damp(group.scale.z, targetScale, 4.8, delta);

    // Keep the polymer mass stable in space; only a nearly imperceptible drift
    // remains so it reads as viscous material, not a rotating visual effect.
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      Math.sin(time * 0.18) * 0.009 * visibility,
      3.5,
      delta,
    );

    for (let i = 0; i < blobData.length; i += 1) {
      const item = blobData[i];
      const curve = curves[item.lane];
      const flowT = (item.t + time * 0.0075 * item.speed * visibility) % 1;
      const t = clamp01(flowT * 0.96 + 0.02);

      curve.getPointAt(t, position);
      curve.getTangentAt(t, tangent).normalize();
      quaternion.setFromUnitVectors(baseAxis, tangent);

      const lateral = Math.sin(item.phase + time * 0.26) * item.offset * (1 - plasticized * 0.62);
      position.x += Math.cos(item.phase) * lateral;
      position.z += Math.sin(item.phase) * lateral;

      const neck = 0.78 + Math.sin(t * Math.PI) * 0.34;
      const merge = THREE.MathUtils.lerp(0.82, 1.08, plasticized);
      helper.position.copy(position);
      helper.quaternion.copy(quaternion);
      helper.scale.set(
        item.scale * neck * 0.76 * merge,
        item.scale * (1.18 + plasticized * 0.42),
        item.scale * neck * 0.72 * merge,
      );
      helper.updateMatrix();
      blobs.setMatrixAt(i, helper.matrix);
    }
    blobs.instanceMatrix.needsUpdate = true;

    if (centreLightRef.current) {
      centreLightRef.current.intensity = THREE.MathUtils.damp(
        centreLightRef.current.intensity,
        visibility * (0.7 + plasticized * 1.45),
        5,
        delta,
      );
    }
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={3}>
      {tubes.map((geometry, index) => (
        <mesh
          key={index}
          geometry={geometry}
          material={meltMaterial}
          renderOrder={3}
        />
      ))}

      <instancedMesh
        ref={blobsRef}
        args={[blobGeometry, blobMaterial, blobData.length]}
        frustumCulled={false}
        renderOrder={3}
      />

      <pointLight
        ref={centreLightRef}
        position={[0, 0.9, 2.45]}
        color="#a9d2f5"
        intensity={0}
        distance={5.8}
        decay={2}
      />
    </group>
  );
}
