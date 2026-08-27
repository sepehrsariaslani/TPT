import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import ErrorBoundary from '../ErrorBoundary.jsx';
import * as THREE from 'three';
import CinematicEnvironment from './CinematicEnvironment.jsx';
import CoolingRelease from './CoolingRelease.jsx';
import PhotorealGranules from './PhotorealGranules.jsx';
import PlasticizingMelt from './PlasticizingMelt.jsx';
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

function BackgroundDust({ progressRef }) {
  const materialRef = useRef();
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

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    const hero = range(progressRef.current, 0.78, 0.91);
    materialRef.current.opacity = THREE.MathUtils.damp(
      materialRef.current.opacity,
      0.07 * (1 - hero * 0.88),
      4.6,
      delta,
    );
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={materialRef}
        color="#355875"
        size={0.009}
        transparent
        opacity={0.07}
        depthWrite={false}
      />
    </points>
  );
}

function MaterialFeedLights({ progressRef }) {
  const leftRef = useRef();
  const rightRef = useRef();
  const centreRef = useRef();

  useFrame((_, delta) => {
    const p = progressRef.current;
    const feed = 1 - range(p, 0.19, 0.36);
    const convergence = range(p, 0.065, 0.19) * (1 - range(p, 0.27, 0.42));
    const plasticizing = range(p, 0.22, 0.34) * (1 - range(p, 0.47, 0.59));
    const injection = range(p, 0.39, 0.455) * (1 - range(p, 0.6, 0.69));
    const hero = range(p, 0.8, 0.91);

    if (leftRef.current) {
      leftRef.current.intensity = THREE.MathUtils.damp(
        leftRef.current.intensity,
        2.2 * feed * (1 - hero),
        4.5,
        delta,
      );
    }
    if (rightRef.current) {
      rightRef.current.intensity = THREE.MathUtils.damp(
        rightRef.current.intensity,
        2.2 * feed * (1 - hero),
        4.5,
        delta,
      );
    }
    if (centreRef.current) {
      centreRef.current.intensity = THREE.MathUtils.damp(
        centreRef.current.intensity,
        (0.45 + convergence * 1.35 + plasticizing * 0.85 + injection * 1.05) * (1 - hero * 0.86),
        4.8,
        delta,
      );
    }
  });

  return (
    <group>
      <pointLight
        ref={leftRef}
        position={[-5.2, 6.4, 4.2]}
        color="#8fc5ff"
        intensity={2.2}
        distance={8.5}
        decay={2}
      />
      <pointLight
        ref={rightRef}
        position={[5.2, 6.1, 4.3]}
        color="#79b8ff"
        intensity={2.2}
        distance={8.5}
        decay={2}
      />
      <pointLight
        ref={centreRef}
        position={[0, 1.2, 3.4]}
        color="#4a94ef"
        intensity={0.45}
        distance={6.4}
        decay={2}
      />
    </group>
  );
}

function CameraRig({ progressRef }) {
  const { camera, pointer, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const p = progressRef.current;
    const mobile = size.width <= 680;
    const tablet = size.width > 680 && size.width <= 980;
    const feed = 1 - range(p, 0.16, 0.28);
    const convergence = range(p, 0.06, 0.22) * (1 - range(p, 0.3, 0.42));
    const plasticizing = range(p, 0.22, 0.34) * (1 - range(p, 0.48, 0.59));
    const injection = range(p, 0.39, 0.47) * (1 - range(p, 0.61, 0.7));
    const cooling = range(p, 0.58, 0.735) * (1 - range(p, 0.79, 0.86));
    const release = range(p, 0.755, 0.84);
    const hero = range(p, 0.805, 0.915);
    const braid = range(p, 0.16, 0.32) * (1 - range(p, 0.49, 0.61));
    const preform = range(p, 0.37, 0.53) * (1 - range(p, 0.65, 0.76));
    const product = range(p, 0.49, 0.7);

    const basePointer = mobile ? 0 : tablet ? 0.055 : 0.095;
    const pointerAmount = basePointer * (1 - hero * 0.84);
    const heroSide = mobile ? 0 : tablet ? 0.055 : 0.11;
    const targetX = pointer.x * pointerAmount + hero * heroSide;
    const targetY = mobile
      ? 2.52 + feed * 0.23 - convergence * 0.12 - plasticizing * 0.08 - injection * 0.06 - cooling * 0.04 - release * 0.04 - product * 0.16 - hero * 0.08 + braid * 0.02
      : 3.04 + feed * 0.34 - convergence * 0.2 - plasticizing * 0.15 - injection * 0.11 - cooling * 0.06 - release * 0.05 + pointer.y * 0.055 * (1 - hero) - product * 0.22 - hero * 0.16 + braid * 0.035;
    const targetZ = mobile
      ? 16.2 + feed * 0.62 - convergence * 0.35 - plasticizing * 0.34 - injection * 0.22 - cooling * 0.08 - product * 0.58 - hero * 0.34 + preform * 0.05
      : tablet
        ? 13.25 + feed * 0.48 - convergence * 0.3 - plasticizing * 0.42 - injection * 0.28 - cooling * 0.1 - product * 0.66 - hero * 0.42 + preform * 0.06
        : 11.2 + feed * 0.42 - convergence * 0.28 - plasticizing * 0.48 - injection * 0.34 - cooling * 0.12 - product * 0.57 - hero * 0.46 + preform * 0.07;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 3.2, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 3.2, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.2, delta);

    const baseFov = mobile ? 44 : tablet ? 41 : 38;
    const targetFov = baseFov
      + feed * (mobile ? 2.1 : tablet ? 1.6 : 1.35)
      - plasticizing * (mobile ? 0.45 : 0.75)
      - injection * (mobile ? 0.18 : 0.34)
      - hero * (mobile ? 0.2 : 0.42);
    const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 3.5, delta);
    if (Math.abs(nextFov - camera.fov) > 0.001) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }

    const lookY = mobile
      ? 0.07 + feed * 0.44 - convergence * 0.18 - plasticizing * 0.1 - injection * 0.05 - cooling * 0.025 - product * 0.07 - hero * 0.035
      : 0.2 + feed * 0.62 - convergence * 0.28 - plasticizing * 0.18 - injection * 0.09 - cooling * 0.035 - product * 0.13 - hero * 0.055;
    target.set(0, lookY, 0);
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
      <MaterialFeedLights progressRef={progressRef} />
      <BackgroundDust progressRef={progressRef} />
      <PhotorealGranules progressRef={progressRef} />
      <PlasticizingMelt progressRef={progressRef} />
      <RealisticCap progressRef={progressRef} />
      <CoolingRelease progressRef={progressRef} />
      <CameraRig progressRef={progressRef} />
      <PostFX />
    </>
  );
}
