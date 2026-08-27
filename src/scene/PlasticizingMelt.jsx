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

function createMeltTexture(seed = 411, size = 64) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const broad = Math.sin(nx * TAU * 2.2 + ny * 2.4) * 1.5;
      const streak = Math.sin(nx * TAU * 6.6 - ny * 4.1) * 0.65;
      const grain = (random() - 0.5) * 2.7;
      pixels[y * size + x] = Math.max(0, Math.min(255, 128 + broad + streak + grain));
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
  texture.repeat.set(2.8, 4.1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function buildBlobData(count) {
  const random = seededRandom(88421);
  return Array.from({ length: count }, () => ({
    t: random(),
    phase: random() * TAU,
    radius: 0.15 + random() * 0.65,
    depth: (random() - 0.5) * 2,
    scale: 0.78 + random() * 0.3,
    delay: random() * 0.045,
    speed: 0.84 + random() * 0.2,
  }));
}

export default function PlasticizingMelt({ progressRef }) {
  const { size } = useThree();
  const compact = size.width <= 680;
  const groupRef = useRef();
  const blobsRef = useRef();
  const massRef = useRef();
  const neckRef = useRef();
  const gateRef = useRef();
  const lightRef = useRef();

  const helper = useMemo(() => new THREE.Object3D(), []);
  const meltTexture = useMemo(() => createMeltTexture(), []);
  const blobData = useMemo(() => buildBlobData(compact ? 54 : 82), [compact]);
  const blobGeometry = useMemo(
    () => new THREE.SphereGeometry(0.16, compact ? 12 : 16, compact ? 8 : 12),
    [compact],
  );
  const massGeometry = useMemo(
    () => new THREE.SphereGeometry(0.48, compact ? 18 : 26, compact ? 12 : 18),
    [compact],
  );

  const coolColor = useMemo(() => new THREE.Color('#245f9f'), []);
  const softColor = useMemo(() => new THREE.Color('#2165aa'), []);
  const meltColor = useMemo(() => new THREE.Color('#1b5f9f'), []);

  const blobMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: coolColor.clone(),
    metalness: 0,
    roughness: 0.31,
    clearcoat: 0.28,
    clearcoatRoughness: 0.22,
    ior: 1.47,
    specularIntensity: 0.45,
    specularColor: new THREE.Color('#b9d0e3'),
    bumpMap: meltTexture,
    bumpScale: 0.00135,
    envMapIntensity: 0.72,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), [coolColor, meltTexture]);

  const massMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: softColor.clone(),
    metalness: 0,
    roughness: 0.24,
    clearcoat: 0.43,
    clearcoatRoughness: 0.16,
    ior: 1.47,
    specularIntensity: 0.5,
    specularColor: new THREE.Color('#c4d9e9'),
    bumpMap: meltTexture,
    bumpScale: 0.001,
    envMapIntensity: 0.78,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), [meltTexture, softColor]);

  useEffect(() => {
    if (blobsRef.current) {
      blobsRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      blobsRef.current.renderOrder = 3;
    }
    return () => {
      blobGeometry.dispose();
      massGeometry.dispose();
      blobMaterial.dispose();
      massMaterial.dispose();
      meltTexture.dispose();
    };
  }, [blobGeometry, massGeometry, blobMaterial, massMaterial, meltTexture]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const blobs = blobsRef.current;
    const mass = massRef.current;
    const neck = neckRef.current;
    const gate = gateRef.current;
    if (!group || !blobs || !mass || !neck || !gate) return;

    const p = progressRef.current;
    const time = clock.getElapsedTime();
    const soften = range(p, 0.255, 0.34);
    const coalesce = range(p, 0.31, 0.425);
    const melt = range(p, 0.365, 0.47);
    const gateDelivery = range(p, 0.43, 0.525);
    const handoff = range(p, 0.52, 0.595);
    const visibility = soften * (1 - handoff);

    group.visible = visibility > 0.003;
    if (!group.visible) return;

    blobMaterial.opacity = visibility * THREE.MathUtils.lerp(0.68, 0.18, coalesce);
    massMaterial.opacity = visibility * THREE.MathUtils.lerp(0.08, 0.84, melt);
    blobMaterial.color.lerpColors(coolColor, softColor, coalesce);
    massMaterial.color.lerpColors(softColor, meltColor, gateDelivery);

    blobMaterial.roughness = THREE.MathUtils.lerp(0.31, 0.22, coalesce);
    blobMaterial.clearcoat = THREE.MathUtils.lerp(0.28, 0.4, coalesce);
    blobMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.22, 0.16, coalesce);
    massMaterial.roughness = THREE.MathUtils.lerp(0.24, 0.18, gateDelivery);
    massMaterial.clearcoat = THREE.MathUtils.lerp(0.43, 0.54, gateDelivery);
    massMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.16, 0.12, gateDelivery);

    for (let i = 0; i < blobData.length; i += 1) {
      const item = blobData[i];
      const localSoft = range(p, 0.255 + item.delay, 0.345 + item.delay);
      const localMerge = range(p, 0.315 + item.delay * 0.4, 0.43 + item.delay * 0.2);
      const t = clamp01(item.t * 0.9 + 0.05);
      const narrow = THREE.MathUtils.lerp(1, 0.18, localMerge);
      const y = THREE.MathUtils.lerp(compact ? 2.45 : 2.7, 0.66, t);
      const spiral = item.phase + t * 1.05;
      const radial = item.radius * narrow;

      helper.position.set(
        Math.cos(spiral) * radial + Math.sin(item.phase * 0.4) * 0.05 * (1 - localMerge),
        y + Math.sin(item.phase + time * 0.2) * 0.025,
        Math.sin(spiral) * radial * 0.76 + item.depth * 0.07 * (1 - localMerge),
      );
      helper.rotation.set(
        Math.sin(item.phase) * 0.12,
        item.phase * 0.22,
        Math.cos(item.phase) * 0.1,
      );
      const appear = 0.15 + localSoft * 0.85;
      const dissolve = THREE.MathUtils.lerp(1, 0.18, localMerge);
      const rounded = THREE.MathUtils.lerp(0.82, 1.05, localMerge);
      const base = item.scale * appear * dissolve;
      helper.scale.set(base * rounded, base * THREE.MathUtils.lerp(1.18, 0.92, localMerge), base * rounded);
      helper.updateMatrix();
      blobs.setMatrixAt(i, helper.matrix);
    }
    blobs.instanceMatrix.needsUpdate = true;

    const massVisible = melt * (1 - handoff * 0.82);
    mass.visible = massVisible > 0.003;
    mass.position.y = THREE.MathUtils.damp(
      mass.position.y,
      THREE.MathUtils.lerp(1.18, 0.72, gateDelivery),
      5.4,
      delta,
    );
    const massPulse = 1 + Math.sin(time * 0.45) * 0.008 * melt;
    mass.scale.x = THREE.MathUtils.damp(
      mass.scale.x,
      (compact ? 0.72 : 0.84) * THREE.MathUtils.lerp(0.72, 1, coalesce) * massPulse,
      5.4,
      delta,
    );
    mass.scale.z = THREE.MathUtils.damp(
      mass.scale.z,
      (compact ? 0.62 : 0.74) * THREE.MathUtils.lerp(0.72, 1, coalesce) / massPulse,
      5.4,
      delta,
    );
    mass.scale.y = THREE.MathUtils.damp(
      mass.scale.y,
      THREE.MathUtils.lerp(0.85, 1.28, melt) * (1 - handoff * 0.18),
      5.4,
      delta,
    );

    const neckVisible = gateDelivery * (1 - handoff);
    neck.visible = neckVisible > 0.003;
    neck.position.y = THREE.MathUtils.damp(neck.position.y, 0.56, 5.8, delta);
    neck.scale.set(
      THREE.MathUtils.lerp(0.13, 0.19, gateDelivery),
      THREE.MathUtils.lerp(0.3, 0.5, gateDelivery),
      THREE.MathUtils.lerp(0.13, 0.19, gateDelivery),
    );

    gate.visible = neckVisible > 0.003;
    const gateScale = THREE.MathUtils.lerp(0.2, 0.42, gateDelivery) * (1 - handoff * 0.55);
    gate.scale.setScalar(gateScale);

    if (lightRef.current) {
      lightRef.current.intensity = THREE.MathUtils.damp(
        lightRef.current.intensity,
        visibility * (0.2 + coalesce * 0.3 + melt * 0.26),
        5,
        delta,
      );
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <instancedMesh
        ref={blobsRef}
        args={[blobGeometry, blobMaterial, blobData.length]}
        frustumCulled={false}
        renderOrder={3}
      />

      <mesh ref={massRef} geometry={massGeometry} material={massMaterial} visible={false} />

      <mesh ref={neckRef} position={[0, 0.56, 0]} material={massMaterial} visible={false}>
        <capsuleGeometry args={[0.18, 0.36, 6, compact ? 12 : 18]} />
      </mesh>

      <mesh ref={gateRef} position={[0, 0.42, 0]} material={massMaterial} visible={false}>
        <sphereGeometry args={[0.2, compact ? 14 : 18, compact ? 10 : 12]} />
      </mesh>

      <pointLight
        ref={lightRef}
        position={[0, 0.95, 2.2]}
        color="#9db8cf"
        intensity={0}
        distance={4.8}
        decay={2}
      />
    </group>
  );
}
