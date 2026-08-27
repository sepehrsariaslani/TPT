import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import ErrorBoundary from '../ErrorBoundary.jsx';
import * as THREE from 'three';
import RealisticGranules from './RealisticGranules.jsx';

const TAU = Math.PI * 2;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
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

function CapModel({ progressRef }) {
  const groupRef = useRef();
  const ribsRef = useRef();

  const shellMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0d55eb',
    emissive: '#031b61',
    emissiveIntensity: 0.75,
    metalness: 0.2,
    roughness: 0.21,
    clearcoat: 1,
    clearcoatRoughness: 0.13,
    transparent: true,
    opacity: 0,
  }), []);

  const edgeMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#347eff',
    emissive: '#0b50ff',
    emissiveIntensity: 1.05,
    metalness: 0.18,
    roughness: 0.17,
    clearcoat: 1,
    transparent: true,
    opacity: 0,
  }), []);

  const ribGeometry = useMemo(() => new THREE.BoxGeometry(0.058, 0.54, 0.145), []);

  useEffect(() => {
    const mesh = ribsRef.current;
    if (!mesh) return undefined;

    const helper = new THREE.Object3D();
    const ribCount = 112;
    for (let i = 0; i < ribCount; i += 1) {
      const angle = (i / ribCount) * TAU;
      helper.position.set(Math.cos(angle) * 2.485, -0.05, Math.sin(angle) * 2.485);
      helper.rotation.set(0, -angle, 0);
      helper.scale.set(1, 1, 1);
      helper.updateMatrix();
      mesh.setMatrixAt(i, helper.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    return () => ribGeometry.dispose();
  }, [ribGeometry]);

  useEffect(() => () => {
    shellMaterial.dispose();
    edgeMaterial.dispose();
  }, [edgeMaterial, shellMaterial]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const p = progressRef.current;
    const reveal = range(p, 0.39, 0.55);
    const dissolve = range(p, 0.66, 0.83);
    const visibility = reveal * (1 - dissolve);

    shellMaterial.opacity = visibility * 0.98;
    edgeMaterial.opacity = visibility;
    shellMaterial.emissiveIntensity = 0.42 + visibility * 0.62;
    edgeMaterial.emissiveIntensity = 0.72 + visibility * 0.85;

    const entrance = 1 - reveal;
    group.position.y = THREE.MathUtils.damp(
      group.position.y,
      entrance * 0.72 - dissolve * 0.18,
      4.5,
      delta,
    );
    group.scale.setScalar(0.91 + visibility * 0.09 - dissolve * 0.025);
    group.rotation.y = p * 1.03 + clock.getElapsedTime() * (0.018 + visibility * 0.009);
    group.rotation.z = THREE.MathUtils.damp(
      group.rotation.z,
      (1 - visibility) * -0.035,
      3.5,
      delta,
    );
  });

  return (
    <group ref={groupRef}>
      <mesh material={shellMaterial} castShadow receiveShadow>
        <cylinderGeometry args={[2.46, 2.46, 0.72, 128, 1, false]} />
      </mesh>

      <mesh position={[0, 0.39, 0]} material={shellMaterial} castShadow>
        <cylinderGeometry args={[2.39, 2.43, 0.14, 128, 1, false]} />
      </mesh>

      <mesh position={[0, 0.475, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
        <torusGeometry args={[2.33, 0.085, 16, 128]} />
      </mesh>

      <mesh position={[0, -0.39, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
        <torusGeometry args={[2.42, 0.072, 14, 128]} />
      </mesh>

      <mesh position={[0, 0.49, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
        <torusGeometry args={[1.94, 0.024, 10, 128]} />
      </mesh>

      <instancedMesh ref={ribsRef} args={[ribGeometry, edgeMaterial, 112]} castShadow frustumCulled={false} />
    </group>
  );
}

function makeTubeCurves(kind, amount) {
  const random = seededRandom(kind === 'fall' ? 41 : 82);
  const geometries = [];

  for (let line = 0; line < amount; line += 1) {
    const points = [];
    const base = (line / amount) * TAU + random() * 0.2;

    for (let step = 0; step <= 70; step += 1) {
      const t = step / 70;
      if (kind === 'fall') {
        const r = 1.05 + (1 - t) * (2.5 + random() * 0.3) + Math.sin(t * Math.PI) * 0.55;
        const angle = base + Math.sin(t * Math.PI * 1.5 + line) * 0.16;
        points.push(new THREE.Vector3(
          Math.cos(angle) * r,
          8.4 - t * 15.9,
          Math.sin(angle) * r * 0.7,
        ));
      } else {
        const r = 3.75 - t * 1.2 + Math.sin(t * Math.PI * 3 + line) * 0.16;
        const angle = base + t * TAU * 4.25;
        points.push(new THREE.Vector3(
          Math.cos(angle) * r,
          4.8 - t * 8.4,
          Math.sin(angle) * r * 0.83,
        ));
      }
    }

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
    geometries.push(new THREE.TubeGeometry(
      curve,
      100,
      kind === 'fall' ? 0.009 : 0.012,
      4,
      false,
    ));
  }

  return geometries;
}

function EnergyTrails({ progressRef }) {
  const fallGroup = useRef();
  const vortexGroup = useRef();
  const fallMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#2c72ff',
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);
  const vortexMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#4797ff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);
  const fallCurves = useMemo(() => makeTubeCurves('fall', 16), []);
  const vortexCurves = useMemo(() => makeTubeCurves('vortex', 18), []);

  useEffect(() => () => {
    fallCurves.forEach((geometry) => geometry.dispose());
    vortexCurves.forEach((geometry) => geometry.dispose());
    fallMaterial.dispose();
    vortexMaterial.dispose();
  }, [fallCurves, vortexCurves, fallMaterial, vortexMaterial]);

  useFrame(({ clock }) => {
    const p = progressRef.current;
    const fallOut = range(p, 0.13, 0.38);
    const vortexIn = range(p, 0.12, 0.3);
    const vortexOut = range(p, 0.73, 0.95);

    fallMaterial.opacity = (1 - fallOut) * 0.28;
    vortexMaterial.opacity = vortexIn * (1 - vortexOut) * 0.31 + range(p, 0.67, 0.8) * 0.16;

    if (fallGroup.current) {
      fallGroup.current.rotation.y = clock.getElapsedTime() * 0.012 + p * 0.18;
    }
    if (vortexGroup.current) {
      vortexGroup.current.rotation.y = clock.getElapsedTime() * 0.026 + p * 0.56;
    }
  });

  return (
    <>
      <group ref={fallGroup}>
        {fallCurves.map((geometry, index) => (
          <mesh key={`fall-${index}`} geometry={geometry} material={fallMaterial} />
        ))}
      </group>
      <group ref={vortexGroup}>
        {vortexCurves.map((geometry, index) => (
          <mesh key={`vortex-${index}`} geometry={geometry} material={vortexMaterial} />
        ))}
      </group>
    </>
  );
}

function HaloRings({ progressRef }) {
  const groupRef = useRef();
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#2b77ff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const p = progressRef.current;
    const group = groupRef.current;
    if (!group) return;

    const inView = range(p, 0.34, 0.5) * (1 - range(p, 0.7, 0.86));
    material.opacity = inView * 0.32;
    group.rotation.y = clock.getElapsedTime() * 0.08 + p * 0.4;
    group.rotation.z = 0.03 + Math.sin(clock.getElapsedTime() * 0.35) * 0.015;
    group.scale.setScalar(0.92 + inView * 0.08);
  });

  return (
    <group ref={groupRef} position={[0, -0.22, 0]}>
      {[2.95, 3.28, 3.64, 4.05].map((radius, index) => (
        <mesh key={radius} rotation={[Math.PI / 2 + index * 0.018, 0, index * 0.12]} material={material}>
          <torusGeometry args={[radius, 0.012 + index * 0.002, 6, 160]} />
        </mesh>
      ))}
    </group>
  );
}

function BackgroundDust() {
  const geometry = useMemo(() => {
    const random = seededRandom(222);
    const count = 380;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      positions[i3] = (random() - 0.5) * 22;
      positions[i3 + 1] = (random() - 0.5) * 15;
      positions[i3 + 2] = -2 - random() * 12;
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return next;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#2764bd" size={0.018} transparent opacity={0.4} depthWrite={false} />
    </points>
  );
}

function CameraRig({ progressRef }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const p = progressRef.current;
    const product = range(p, 0.38, 0.56) * (1 - range(p, 0.7, 0.85));
    const targetX = pointer.x * 0.36;
    const targetY = 2.6 + pointer.y * 0.2 - product * 0.34;
    const targetZ = 10.7 - product * 0.85;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 2.6, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 2.6, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 2.6, delta);

    target.set(0, -0.05 - product * 0.08, 0);
    camera.lookAt(target);
  });

  return null;
}

/**
 * پس‌پردازش در مرز خودش ایزوله شده است:
 * اگر روی سخت‌افزار/مرورگر کاربر ساخته نشود، صحنه بدون بلوم رندر می‌شود
 * به‌جای اینکه کل صفحه از کار بیفتد.
 */
function PostFX() {
  return (
    <ErrorBoundary scope="postprocessing" silent fallback={null}>
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.98} luminanceThreshold={0.38} luminanceSmoothing={0.72} mipmapBlur />
        <Vignette eskil={false} offset={0.12} darkness={0.82} />
      </EffectComposer>
    </ErrorBoundary>
  );
}

export default function GranuleScene({ progressRef }) {
  return (
    <>
      <color attach="background" args={['#020713']} />
      <fog attach="fog" args={['#020713', 11, 27]} />

      <hemisphereLight intensity={0.44} color="#b5d4ff" groundColor="#020816" />
      <ambientLight intensity={0.18} color="#41649b" />
      <directionalLight position={[5.5, 8.5, 6.5]} intensity={2.45} color="#d4e8ff" />
      <directionalLight position={[-5, 2, 4]} intensity={1.0} color="#2569dd" />
      <spotLight
        position={[2.5, 6.5, 7.5]}
        intensity={28}
        angle={0.48}
        penumbra={0.92}
        distance={18}
        decay={2}
        color="#d7ebff"
      />
      <pointLight position={[0, 3.5, 2.5]} intensity={21} distance={13} decay={2} color="#1267ff" />
      <pointLight position={[0, -2.4, 1]} intensity={10} distance={10} decay={2} color="#0a31a8" />

      <BackgroundDust />
      <EnergyTrails progressRef={progressRef} />
      <HaloRings progressRef={progressRef} />
      <RealisticGranules progressRef={progressRef} />
      <CapModel progressRef={progressRef} />
      <CameraRig progressRef={progressRef} />

      <PostFX />
    </>
  );
}
