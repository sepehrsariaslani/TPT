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
    const feed = 1 - range(p, 0.13, 0.25);
    const storm = range(p, 0.1, 0.19) * (1 - range(p, 0.31, 0.38));
    const pour = range(p, 0.26, 0.34) * (1 - range(p, 0.43, 0.5));
    const plasticizing = range(p, 0.35, 0.45) * (1 - range(p, 0.58, 0.65));
    const injection = range(p, 0.52, 0.66) * (1 - range(p, 0.72, 0.8));
    const hero = range(p, 0.81, 0.93);

    if (leftRef.current) {
      leftRef.current.intensity = THREE.MathUtils.damp(
        leftRef.current.intensity,
        (1.62 * feed + storm * 0.42) * (1 - hero),
        4.8,
        delta,
      );
    }
    if (rightRef.current) {
      rightRef.current.intensity = THREE.MathUtils.damp(
        rightRef.current.intensity,
        (1.58 * feed + storm * 0.4) * (1 - hero),
        4.8,
        delta,
      );
    }
    if (centreRef.current) {
      centreRef.current.intensity = THREE.MathUtils.damp(
        centreRef.current.intensity,
        (0.2 + storm * 0.62 + pour * 0.7 + plasticizing * 0.58 + injection * 0.54)
          * (1 - hero * 0.92),
        5,
        delta,
      );
      centreRef.current.position.y = THREE.MathUtils.damp(
        centreRef.current.position.y,
        THREE.MathUtils.lerp(3.15, 0.72, range(p, 0.31, 0.58)),
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
        intensity={1.62}
        distance={8.5}
        decay={2}
      />
      <pointLight
        ref={rightRef}
        position={[5.1, 5.9, 4.1]}
        color="#78a8da"
        intensity={1.58}
        distance={8.5}
        decay={2}
      />
      <pointLight
        ref={centreRef}
        position={[0, 3.15, 3.2]}
        color="#7aa5cf"
        intensity={0.2}
        distance={6.5}
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

    const feed = 1 - range(p, 0.13, 0.25);
    const storm = range(p, 0.1, 0.19) * (1 - range(p, 0.31, 0.38));
    const pour = range(p, 0.26, 0.34) * (1 - range(p, 0.43, 0.5));
    const plasticizing = range(p, 0.35, 0.45) * (1 - range(p, 0.58, 0.65));
    const injection = range(p, 0.52, 0.68);
    const cooling = range(p, 0.67, 0.8);
    const release = range(p, 0.78, 0.85);
    const hero = range(p, 0.81, 0.93);

    const basePointer = mobile ? 0 : tablet ? 0.04 : 0.07;
    const pointerAmount = basePointer * (1 - hero * 0.9);
    const processSide = mobile ? 0 : tablet ? 0.035 : 0.065;
    const heroSide = mobile ? 0 : tablet ? 0.03 : 0.06;
    const targetX = pointer.x * pointerAmount + injection * processSide + hero * heroSide;

    const targetY = mobile
      ? 2.62
        + feed * 0.18
        + storm * 0.08
        + pour * 0.05
        - plasticizing * 0.04
        + hero * 0.14
      : 3.08
        + feed * 0.24
        + storm * 0.08
        + pour * 0.04
        - plasticizing * 0.06
        + injection * 0.06
        + cooling * 0.02
        + hero * 0.3
        + pointer.y * 0.035 * (1 - hero);

    const targetZ = mobile
      ? 16.25
        + feed * 0.4
        + storm * 0.2
        - pour * 0.12
        - plasticizing * 0.24
        - injection * 0.22
        - hero * 0.26
      : tablet
        ? 13.3
          + feed * 0.32
          + storm * 0.16
          - pour * 0.12
          - plasticizing * 0.28
          - injection * 0.28
          - hero * 0.36
        : 11.28
          + feed * 0.3
          + storm * 0.18
          - pour * 0.12
          - plasticizing * 0.28
          - injection * 0.32
          - release * 0.04
          - hero * 0.44;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 3.4, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 3.4, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.4, delta);

    const baseFov = mobile ? 44 : tablet ? 41 : 38;
    const targetFov = baseFov
      + feed * (mobile ? 1.45 : tablet ? 1.1 : 0.9)
      + storm * (mobile ? 0.35 : 0.22)
      - pour * (mobile ? 0.12 : 0.18)
      - plasticizing * (mobile ? 0.22 : 0.36)
      - injection * (mobile ? 0.1 : 0.25)
      - hero * (mobile ? 0.15 : 0.42);
    const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 3.7, delta);
    if (Math.abs(nextFov - camera.fov) > 0.001) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }

    const lookY = mobile
      ? 0.16 + feed * 0.35 + storm * 0.55 + pour * 0.48 + plasticizing * 0.28 - hero * 0.06
      : 0.24 + feed * 0.48 + storm * 0.68 + pour * 0.58 + plasticizing * 0.34 - injection * 0.08 - hero * 0.08;

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
          intensity={mobile ? 0.1 : 0.15}
          luminanceThreshold={mobile ? 0.9 : 0.87}
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
