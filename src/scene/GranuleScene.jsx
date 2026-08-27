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

function BackgroundDust({ progressRef }) {
  const materialRef = useRef();
  const geometry = useMemo(() => {
    const random = seededRandom(222);
    const count = typeof window !== 'undefined' && window.innerWidth < 680 ? 48 : 94;
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
    const calmScene = range(progressRef.current, 0.72, 0.9);
    materialRef.current.opacity = THREE.MathUtils.damp(
      materialRef.current.opacity,
      0.055 * (1 - calmScene * 0.94),
      4.8,
      delta,
    );
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={materialRef}
        color="#355875"
        size={0.008}
        transparent
        opacity={0.055}
        depthWrite={false}
      />
    </points>
  );
}

function ProcessLights({ progressRef }) {
  const leftRef = useRef();
  const rightRef = useRef();
  const centreRef = useRef();

  useFrame((_, delta) => {
    const p = progressRef.current;
    const feed = 1 - range(p, 0.18, 0.33);
    const convergence = range(p, 0.07, 0.18) * (1 - range(p, 0.28, 0.39));
    const plasticizing = range(p, 0.2, 0.34) * (1 - range(p, 0.5, 0.59));
    const injection = range(p, 0.44, 0.63) * (1 - range(p, 0.68, 0.78));
    const hero = range(p, 0.8, 0.92);

    if (leftRef.current) {
      leftRef.current.intensity = THREE.MathUtils.damp(
        leftRef.current.intensity,
        (1.72 * feed + convergence * 0.34) * (1 - hero),
        4.8,
        delta,
      );
    }
    if (rightRef.current) {
      rightRef.current.intensity = THREE.MathUtils.damp(
        rightRef.current.intensity,
        (1.68 * feed + convergence * 0.3) * (1 - hero),
        4.8,
        delta,
      );
    }
    if (centreRef.current) {
      centreRef.current.intensity = THREE.MathUtils.damp(
        centreRef.current.intensity,
        (0.22 + convergence * 0.72 + plasticizing * 0.58 + injection * 0.62)
          * (1 - hero * 0.92),
        5,
        delta,
      );
      centreRef.current.position.y = THREE.MathUtils.damp(
        centreRef.current.position.y,
        THREE.MathUtils.lerp(1.2, 0.68, range(p, 0.34, 0.52)),
        4.4,
        delta,
      );
    }
  });

  return (
    <group>
      <pointLight
        ref={leftRef}
        position={[-5.1, 6.2, 4]}
        color="#8ebbe6"
        intensity={1.72}
        distance={8.5}
        decay={2}
      />
      <pointLight
        ref={rightRef}
        position={[5.1, 5.9, 4.1]}
        color="#78a8da"
        intensity={1.68}
        distance={8.5}
        decay={2}
      />
      <pointLight
        ref={centreRef}
        position={[0, 1.2, 3.2]}
        color="#6f9fcf"
        intensity={0.22}
        distance={6}
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

    const feed = 1 - range(p, 0.16, 0.29);
    const convergence = range(p, 0.07, 0.2) * (1 - range(p, 0.29, 0.4));
    const plasticizing = range(p, 0.2, 0.34) * (1 - range(p, 0.51, 0.6));
    const injection = range(p, 0.44, 0.63);
    const cooling = range(p, 0.61, 0.78);
    const release = range(p, 0.75, 0.845);
    const hero = range(p, 0.805, 0.925);

    const basePointer = mobile ? 0 : tablet ? 0.045 : 0.075;
    const pointerAmount = basePointer * (1 - hero * 0.9);
    const processSide = mobile ? 0 : tablet ? 0.045 : 0.09;
    const heroSide = mobile ? 0 : tablet ? 0.035 : 0.07;
    const targetX = pointer.x * pointerAmount + injection * processSide + hero * heroSide;

    const targetY = mobile
      ? 2.58
        + feed * 0.18
        - convergence * 0.08
        - plasticizing * 0.06
        + injection * 0.05
        + hero * 0.14
      : 3.08
        + feed * 0.25
        - convergence * 0.12
        - plasticizing * 0.08
        + injection * 0.09
        + cooling * 0.025
        + hero * 0.32
        + pointer.y * 0.04 * (1 - hero);

    const targetZ = mobile
      ? 16.25
        + feed * 0.42
        - convergence * 0.22
        - plasticizing * 0.24
        - injection * 0.24
        - hero * 0.26
      : tablet
        ? 13.3
          + feed * 0.34
          - convergence * 0.2
          - plasticizing * 0.28
          - injection * 0.3
          - hero * 0.36
        : 11.28
          + feed * 0.32
          - convergence * 0.18
          - plasticizing * 0.3
          - injection * 0.34
          - release * 0.04
          - hero * 0.46;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 3.5, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 3.5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.5, delta);

    const baseFov = mobile ? 44 : tablet ? 41 : 38;
    const targetFov = baseFov
      + feed * (mobile ? 1.55 : tablet ? 1.15 : 0.95)
      - plasticizing * (mobile ? 0.25 : 0.4)
      - injection * (mobile ? 0.12 : 0.28)
      - hero * (mobile ? 0.15 : 0.45);
    const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 3.8, delta);
    if (Math.abs(nextFov - camera.fov) > 0.001) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }

    const lookY = mobile
      ? 0.08 + feed * 0.34 - convergence * 0.12 - plasticizing * 0.06 - hero * 0.02
      : 0.19 + feed * 0.48 - convergence * 0.18 - plasticizing * 0.1 - injection * 0.02 - hero * 0.07;

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
          intensity={mobile ? 0.1 : 0.16}
          luminanceThreshold={mobile ? 0.9 : 0.86}
          luminanceSmoothing={0.94}
          mipmapBlur
        />
        <Vignette eskil={false} offset={mobile ? 0.23 : 0.18} darkness={mobile ? 0.4 : 0.46} />
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
      <ProcessLights progressRef={progressRef} />
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
