import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function seededRandom(seed = 7341) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createMouldTexture(seed = 1409, size = 64) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const broad = Math.sin(nx * TAU * 4.0 + ny * 3.2) * 1.7;
      const fine = Math.sin(nx * TAU * 18.0 - ny * 13.0) * 0.7;
      const grain = (random() - 0.5) * 4.2;
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
  texture.repeat.set(5.5, 3.25);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createShadowTexture(size = 96) {
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const d = Math.sqrt(nx * nx + ny * ny);
      const a = Math.pow(Math.max(0, 1 - d), 2.6);
      const i = (y * size + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(a * 255);
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function createCapBodyGeometry() {
  // A single revolved profile gives the cap a continuous moulded silhouette:
  // bottom wall, side wall, rounded shoulder, top rim and a very shallow crown.
  const profile = [
    [0.0, -0.405],
    [2.30, -0.405],
    [2.405, -0.385],
    [2.475, -0.335],
    [2.515, -0.245],
    [2.522, 0.155],
    [2.505, 0.235],
    [2.465, 0.305],
    [2.385, 0.355],
    [2.255, 0.392],
    [1.92, 0.404],
    [0.72, 0.386],
    [0.0, 0.378],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));

  const geometry = new THREE.LatheGeometry(profile, 144);
  geometry.computeVertexNormals();
  return geometry;
}

export default function RealisticCap({ progressRef }) {
  const groupRef = useRef();
  const ribsRef = useRef();
  const shadowRef = useRef();

  const mouldTexture = useMemo(() => createMouldTexture(), []);
  const shadowTexture = useMemo(() => createShadowTexture(), []);
  const bodyGeometry = useMemo(() => createCapBodyGeometry(), []);
  const ribGeometry = useMemo(
    () => new RoundedBoxGeometry(0.052, 0.475, 0.105, 2, 0.016),
    [],
  );

  const bodyMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#154e98',
    metalness: 0,
    roughness: 0.34,
    clearcoat: 0.34,
    clearcoatRoughness: 0.24,
    ior: 1.47,
    specularIntensity: 0.48,
    specularColor: new THREE.Color('#b9d4ee'),
    sheen: 0.025,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color('#2d67a8'),
    bumpMap: mouldTexture,
    bumpScale: 0.0017,
    envMapIntensity: 0.72,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), [mouldTexture]);

  const ribMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#123f7d',
    metalness: 0,
    roughness: 0.43,
    clearcoat: 0.22,
    clearcoatRoughness: 0.32,
    ior: 1.47,
    specularIntensity: 0.4,
    specularColor: new THREE.Color('#9fbede'),
    bumpMap: mouldTexture,
    bumpScale: 0.0019,
    envMapIntensity: 0.62,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), [mouldTexture]);

  const detailMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0d356b',
    metalness: 0,
    roughness: 0.48,
    clearcoat: 0.12,
    clearcoatRoughness: 0.4,
    ior: 1.47,
    specularIntensity: 0.28,
    envMapIntensity: 0.46,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), []);

  const highlightMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1a5aa7',
    metalness: 0,
    roughness: 0.3,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
    ior: 1.47,
    specularIntensity: 0.5,
    specularColor: new THREE.Color('#c5d9ef'),
    envMapIntensity: 0.76,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), []);

  const shadowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#000000',
    map: shadowTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  }), [shadowTexture]);

  useEffect(() => {
    const mesh = ribsRef.current;
    if (!mesh) return;

    const helper = new THREE.Object3D();
    const ribCount = 120;

    for (let i = 0; i < ribCount; i += 1) {
      const angle = (i / ribCount) * TAU;
      helper.position.set(
        Math.cos(angle) * 2.525,
        -0.055,
        Math.sin(angle) * 2.525,
      );
      helper.rotation.set(0, Math.PI * 0.5 - angle, 0);
      helper.scale.set(1, 1, 1);
      helper.updateMatrix();
      mesh.setMatrixAt(i, helper.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => () => {
    bodyGeometry.dispose();
    ribGeometry.dispose();
    mouldTexture.dispose();
    shadowTexture.dispose();
    bodyMaterial.dispose();
    ribMaterial.dispose();
    detailMaterial.dispose();
    highlightMaterial.dispose();
    shadowMaterial.dispose();
  }, [
    bodyGeometry,
    ribGeometry,
    mouldTexture,
    shadowTexture,
    bodyMaterial,
    ribMaterial,
    detailMaterial,
    highlightMaterial,
    shadowMaterial,
  ]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const p = progressRef.current;
    const reveal = range(p, 0.49, 0.69);
    const settle = range(p, 0.64, 0.76);
    const opacity = Math.min(1, reveal * 1.02);

    bodyMaterial.opacity = opacity;
    ribMaterial.opacity = opacity;
    detailMaterial.opacity = opacity;
    highlightMaterial.opacity = opacity;
    shadowMaterial.opacity = reveal * 0.48;

    group.visible = reveal > 0.002;
    group.position.y = THREE.MathUtils.damp(group.position.y, (1 - reveal) * 0.18, 5.4, delta);
    group.scale.x = THREE.MathUtils.damp(group.scale.x, 0.95 + reveal * 0.05, 5.1, delta);
    group.scale.z = THREE.MathUtils.damp(group.scale.z, 0.95 + reveal * 0.05, 5.1, delta);
    group.scale.y = THREE.MathUtils.damp(group.scale.y, 0.58 + reveal * 0.42, 5.3, delta);

    // A tiny, slow studio turn only after the part has solidified.
    const finalTurn = clock.getElapsedTime() * 0.0055 * settle;
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, p * 0.12 + finalTurn, 4.0, delta);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, (1 - reveal) * -0.004, 4.0, delta);

    if (shadowRef.current) {
      shadowRef.current.scale.setScalar(0.94 + reveal * 0.06);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh geometry={bodyGeometry} material={bodyMaterial} />

      {/* Fine moulded grip ribs: integrated with the shell, not glowing ornaments. */}
      <instancedMesh
        ref={ribsRef}
        args={[ribGeometry, ribMaterial, 120]}
        frustumCulled={false}
      />

      {/* Subtle upper shoulder, concentric tooling groove and parting line. */}
      <mesh position={[0, 0.385, 0]} rotation={[Math.PI / 2, 0, 0]} material={highlightMaterial}>
        <torusGeometry args={[2.245, 0.026, 8, 128]} />
      </mesh>
      <mesh position={[0, 0.383, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[1.82, 0.0105, 6, 112]} />
      </mesh>
      <mesh position={[0, -0.318, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[2.507, 0.009, 6, 128]} />
      </mesh>

      {/* Small gate witness at the top centre – a common real moulding detail. */}
      <mesh position={[0, 0.382, 0]} material={detailMaterial}>
        <cylinderGeometry args={[0.052, 0.052, 0.009, 32]} />
      </mesh>

      {/* Lower sealing/inner edge glimpsed from the hero camera. */}
      <mesh position={[0, -0.398, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[2.28, 0.045, 8, 112]} />
      </mesh>

      {/* Soft optical contact shadow so the finished cap feels grounded. */}
      <mesh
        ref={shadowRef}
        position={[0, -0.485, 0.06]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={-1}
      >
        <planeGeometry args={[6.25, 6.25]} />
      </mesh>
    </group>
  );
}
