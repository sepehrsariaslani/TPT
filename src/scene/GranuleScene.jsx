import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import ErrorBoundary from '../ErrorBoundary.jsx';
import * as THREE from 'three';
import CinematicEnvironment from './CinematicEnvironment.jsx';
import PhotorealGranules from './PhotorealGranules.jsx';
import VortexSystem from './VortexSystem.jsx';

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
    emissiveIntensity: 0.48,
    metalness: 0.02,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    ior: 1.47,
    envMapIntensity: 1.25,
    transparent: true,
    opacity: 0,
  }), []);

  const edgeMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#347eff',
    emissive: '#0b50ff',
    emissiveIntensity: 0.68,
    metalness: 0.02,
    roughness: 0.19,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    ior: 1.47,
    envMapIntensity: 1.3,
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
    shellMaterial.emissiveIntensity = 0.24 + visibility * 0.38;
    edgeMaterial.emissiveIntensity = 0.42 + visibility * 0.5;

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

function HaloRings({ progressRef }) {
  const groupRef = useRef();
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#2b77ff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }), []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const p = progressRef.current;
    const group = groupRef.current;
    if (!group) return;

    const inView = range(p, 0.34, 0.5) * (1 - range(p, 0.7, 0.86));
    material.opacity = inView * 0.18;
    group.rotation.y = clock.getElapsedTime() * 0.052 + p * 0.36;
    group.rotation.z = 0.03 + Math.sin(clock.getElapsedTime() * 0.35) * 0.012;
    group.scale.setScalar(0.92 + inView * 0.08);
  });

  return (
    <group ref={groupRef} position={[0, -0.22, 0]}>
      {[2.95, 3.28, 3.64, 4.05].map((radius, index) => (
        <mesh key={radius} rotation={[Math.PI / 2 + index * 0.018, 0, index * 0.12]} material={material}>
          <torusGeometry args={[radius, 0.009 + index * 0.0016, 6, 160]} />
        </mesh>
      ))}
    </group>
  );
}

function BackgroundDust() {
  const geometry = useMemo(() => {
    const random = seededRandom(222);
    const count = 420;
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
      <pointsMaterial color="#4f79ad" size={0.016} transparent opacity={0.28} depthWrite={false} />
    </points>
  );
}

function CameraRig({ progressRef }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const p = progressRef.current;
    const product = range(p, 0.38, 0.56) * (1 - range(p, 0.7, 0.85));
    const vortex = range(p, 0.15, 0.35) * (1 - range(p, 0.52, 0.66));
    const targetX = pointer.x * (0.24 + vortex * 0.08);
    const targetY = 2.6 + pointer.y * 0.15 - product * 0.34 + vortex * 0.08;
    const targetZ = 10.75 - product * 0.9 + vortex * 0.18;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 2.8, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 2.8, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 2.8, delta);

    target.set(0, -0.05 - product * 0.08, 0);
    camera.lookAt(target);
  });

  return null;
}

function PostFX() {
  return (
    <ErrorBoundary scope="postprocessing" silent fallback={null}>
      <EffectComposer multisampling={0}>
        <Bloom intensity={1.08} luminanceThreshold={0.46} luminanceSmoothing={0.78} mipmapBlur />
        <DepthOfField focusDistance={0.018} focalLength={0.032} bokehScale={0.72} />
        <Vignette eskil={false} offset={0.11} darkness={0.78} />
      </EffectComposer>
    </ErrorBoundary>
  );
}

export default function GranuleScene({ progressRef }) {
  return (
    <>
      <color attach="background" args={['#020713']} />
      <fog attach="fog" args={['#020713', 11, 27]} />

      <CinematicEnvironment progressRef={progressRef} />
      <BackgroundDust />
      <VortexSystem progressRef={progressRef} />
      <HaloRings progressRef={progressRef} />
      <PhotorealGranules progressRef={progressRef} />
      <CapModel progressRef={progressRef} />
      <CameraRig progressRef={progressRef} />
      <PostFX />
    </>
  );
}
