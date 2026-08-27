import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import ErrorBoundary from '../ErrorBoundary.jsx';
import * as THREE from 'three';
import CinematicEnvironment from './CinematicEnvironment.jsx';
import PhotorealGranules from './PhotorealGranules.jsx';
import RealisticCap from './RealisticCap.jsx';

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

function BackgroundDust() {
  const geometry = useMemo(() => {
    const random = seededRandom(222);
    const count = typeof window !== 'undefined' && window.innerWidth < 680 ? 58 : 118;
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
      <pointsMaterial color="#355875" size={0.009} transparent opacity={0.07} depthWrite={false} />
    </points>
  );
}

function CameraRig({ progressRef }) {
  const { camera, pointer, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const p = progressRef.current;
    const mobile = size.width <= 680;
    const tablet = size.width > 680 && size.width <= 980;
    const braid = range(p, 0.12, 0.31) * (1 - range(p, 0.49, 0.61));
    const preform = range(p, 0.36, 0.53) * (1 - range(p, 0.65, 0.76));
    const product = range(p, 0.49, 0.7);
    const finalHero = range(p, 0.7, 0.86);

    const pointerAmount = mobile ? 0 : tablet ? 0.055 : 0.095;
    const targetX = pointer.x * pointerAmount;
    const targetY = mobile
      ? 2.52 - product * 0.16 - finalHero * 0.05 + braid * 0.02
      : 3.04 + pointer.y * 0.055 - product * 0.22 - finalHero * 0.08 + braid * 0.035;
    const targetZ = mobile
      ? 16.2 - product * 0.58 - finalHero * 0.08 + preform * 0.05
      : tablet
        ? 13.25 - product * 0.66 - finalHero * 0.1 + preform * 0.06
        : 11.2 - product * 0.57 - finalHero * 0.12 + preform * 0.07;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 3.2, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 3.2, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.2, delta);

    const targetFov = mobile ? 44 : tablet ? 41 : 38;
    const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 3.5, delta);
    if (Math.abs(nextFov - camera.fov) > 0.001) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }

    target.set(0, mobile ? 0.07 - product * 0.07 : 0.2 - product * 0.13, 0);
    camera.lookAt(target);
  });

  return null;
}

function PostFX() {
  const { size } = useThree();
  const mobile = size.width <= 680;

  return (
    <ErrorBoundary scope="postprocessing" silent fallback={null}>
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={mobile ? 0.17 : 0.23}
          luminanceThreshold={mobile ? 0.84 : 0.81}
          luminanceSmoothing={0.92}
          mipmapBlur
        />
        <Vignette eskil={false} offset={mobile ? 0.21 : 0.16} darkness={mobile ? 0.44 : 0.5} />
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
      <RealisticCap progressRef={progressRef} />
      <CameraRig progressRef={progressRef} />
      <PostFX />
    </>
  );
}
