import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import ErrorBoundary from '../ErrorBoundary.jsx';
import * as THREE from 'three';
import CinematicEnvironment from './CinematicEnvironment.jsx';
import PhotorealGranules from './PhotorealGranules.jsx';

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
    color: '#1459c7',
    emissive: '#03132f',
    emissiveIntensity: 0.08,
    metalness: 0,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    ior: 1.47,
    specularIntensity: 0.9,
    specularColor: new THREE.Color('#e8f3ff'),
    sheen: 0.15,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color('#4d8fe6'),
    envMapIntensity: 1.3,
    transparent: true,
    opacity: 0,
    depthWrite: true,
  }), []);

  const edgeMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#236fd8',
    emissive: '#06265e',
    emissiveIntensity: 0.12,
    metalness: 0,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    ior: 1.47,
    specularIntensity: 0.96,
    specularColor: new THREE.Color('#f4f8ff'),
    envMapIntensity: 1.42,
    transparent: true,
    opacity: 0,
    depthWrite: true,
  }), []);

  const ribGeometry = useMemo(() => new THREE.BoxGeometry(0.052, 0.55, 0.13), []);

  useEffect(() => {
    const mesh = ribsRef.current;
    if (!mesh) return undefined;

    const helper = new THREE.Object3D();
    const ribCount = 112;
    for (let i = 0; i < ribCount; i += 1) {
      const angle = (i / ribCount) * TAU;
      helper.position.set(Math.cos(angle) * 2.49, -0.04, Math.sin(angle) * 2.49);
      helper.rotation.set(0, -angle, 0);
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
    const reveal = range(p, 0.62, 0.9);
    const settle = range(p, 0.78, 0.94);

    shellMaterial.opacity = reveal * 0.97;
    edgeMaterial.opacity = reveal * 0.98;
    shellMaterial.emissiveIntensity = 0.05 + (1 - reveal) * 0.08;
    edgeMaterial.emissiveIntensity = 0.08 + (1 - reveal) * 0.1;

    group.position.y = THREE.MathUtils.damp(group.position.y, (1 - reveal) * 0.3, 4.6, delta);
    group.scale.x = THREE.MathUtils.damp(group.scale.x, 0.93 + reveal * 0.07, 4.2, delta);
    group.scale.z = THREE.MathUtils.damp(group.scale.z, 0.93 + reveal * 0.07, 4.2, delta);
    group.scale.y = THREE.MathUtils.damp(group.scale.y, 0.4 + reveal * 0.6, 4.4, delta);
    group.rotation.y = p * 0.34 + clock.getElapsedTime() * (0.01 - settle * 0.005);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, (1 - reveal) * -0.012, 3.2, delta);
  });

  return (
    <group ref={groupRef}>
      <mesh material={shellMaterial}>
        <cylinderGeometry args={[2.47, 2.47, 0.72, 80, 1, false]} />
      </mesh>

      <mesh position={[0, 0.385, 0]} material={shellMaterial}>
        <cylinderGeometry args={[2.39, 2.44, 0.15, 80, 1, false]} />
      </mesh>

      <mesh position={[0, 0.485, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
        <torusGeometry args={[2.34, 0.085, 12, 80]} />
      </mesh>

      <mesh position={[0, 0.497, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
        <torusGeometry args={[1.98, 0.026, 8, 80]} />
      </mesh>

      <mesh position={[0, 0.505, 0]} rotation={[-Math.PI / 2, 0, 0]} material={shellMaterial}>
        <circleGeometry args={[2.28, 80]} />
      </mesh>

      <mesh position={[0, -0.395, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
        <torusGeometry args={[2.42, 0.06, 10, 80]} />
      </mesh>

      <instancedMesh ref={ribsRef} args={[ribGeometry, edgeMaterial, 112]} frustumCulled={false} />
    </group>
  );
}

function BackgroundDust() {
  const geometry = useMemo(() => {
    const random = seededRandom(222);
    const count = typeof window !== 'undefined' && window.innerWidth < 680 ? 100 : 180;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      positions[i3] = (random() - 0.5) * 19;
      positions[i3 + 1] = (random() - 0.5) * 14;
      positions[i3 + 2] = -1.5 - random() * 10;
    }

    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return next;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#446b97" size={0.012} transparent opacity={0.12} depthWrite={false} />
    </points>
  );
}

function CameraRig({ progressRef }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const p = progressRef.current;
    const gathering = range(p, 0.1, 0.3) * (1 - range(p, 0.45, 0.58));
    const swirl = range(p, 0.3, 0.52) * (1 - range(p, 0.72, 0.86));
    const product = range(p, 0.62, 0.9);

    const targetX = pointer.x * 0.13;
    const targetY = 3.1 + pointer.y * 0.08 - product * 0.24 + gathering * 0.04;
    const targetZ = 11.3 - product * 0.72 + swirl * 0.08;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 3.0, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 3.0, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.0, delta);

    target.set(0, 0.22 - product * 0.14, 0);
    camera.lookAt(target);
  });

  return null;
}

function PostFX() {
  return (
    <ErrorBoundary scope="postprocessing" silent fallback={null}>
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.5} luminanceThreshold={0.7} luminanceSmoothing={0.88} mipmapBlur />
        <Vignette eskil={false} offset={0.14} darkness={0.58} />
      </EffectComposer>
    </ErrorBoundary>
  );
}

export default function GranuleScene({ progressRef }) {
  return (
    <>
      <color attach="background" args={['#01050d']} />
      <fog attach="fog" args={['#01050d', 13, 29]} />

      <CinematicEnvironment progressRef={progressRef} />
      <BackgroundDust />
      <PhotorealGranules progressRef={progressRef} />
      <CapModel progressRef={progressRef} />
      <CameraRig progressRef={progressRef} />
      <PostFX />
    </>
  );
}
