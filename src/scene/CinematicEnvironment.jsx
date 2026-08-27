import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function AreaLight({ lightRef, position, color, intensity, width, height, target }) {
  const targetVector = useMemo(() => new THREE.Vector3(...target), [target]);

  useEffect(() => {
    lightRef.current?.lookAt(targetVector);
  }, [lightRef, targetVector]);

  return (
    <rectAreaLight
      ref={lightRef}
      position={position}
      color={color}
      intensity={intensity}
      width={width}
      height={height}
    />
  );
}

export default function CinematicEnvironment({ progressRef }) {
  const { gl, scene } = useThree();
  const rigRef = useRef();
  const keyRef = useRef();
  const fillRef = useRef();
  const rearRef = useRef();
  const spotRef = useRef();
  const lowRef = useRef();

  useEffect(() => {
    RectAreaLightUniformsLib.init();

    const previousEnvironment = scene.environment;
    const previousEnvironmentIntensity = scene.environmentIntensity;
    const previousToneMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;
    const previousColorSpace = gl.outputColorSpace;

    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(room, 0.065);

    scene.environment = target.texture;
    scene.environmentIntensity = 0.58;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.9;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = false;

    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousEnvironmentIntensity;
      gl.toneMapping = previousToneMapping;
      gl.toneMappingExposure = previousExposure;
      gl.outputColorSpace = previousColorSpace;
      target.dispose();
      pmrem.dispose();
      if (typeof room.dispose === 'function') room.dispose();
    };
  }, [gl, scene]);

  useFrame(({ clock }, delta) => {
    const p = progressRef.current;
    const hero = range(p, 0.8, 0.925);
    const inspection = range(p, 0.86, 0.96);
    const time = clock.getElapsedTime();

    if (rigRef.current) {
      const processDrift = Math.sin(time * 0.052) * 0.009 * (1 - hero * 0.82);
      const heroSettle = Math.sin(time * 0.14) * 0.0022 * inspection;
      rigRef.current.rotation.y = processDrift + heroSettle + p * 0.006;
    }

    // The process lighting hands off to a quieter photographic setup. The cap
    // keeps readable highlights, but the resin no longer looks emissive or chrome.
    scene.environmentIntensity = THREE.MathUtils.lerp(
      0.56 + Math.sin(Math.min(1, p) * Math.PI) * 0.05,
      0.5,
      hero,
    );
    gl.toneMappingExposure = THREE.MathUtils.lerp(0.9, 0.86, hero);

    if (keyRef.current) {
      keyRef.current.intensity = THREE.MathUtils.damp(
        keyRef.current.intensity,
        THREE.MathUtils.lerp(7.2, 5.15, hero),
        4.4,
        delta,
      );
    }
    if (fillRef.current) {
      fillRef.current.intensity = THREE.MathUtils.damp(
        fillRef.current.intensity,
        THREE.MathUtils.lerp(3.6, 1.95, hero),
        4.4,
        delta,
      );
    }
    if (rearRef.current) {
      rearRef.current.intensity = THREE.MathUtils.damp(
        rearRef.current.intensity,
        THREE.MathUtils.lerp(4.3, 2.9, hero),
        4.4,
        delta,
      );
    }
    if (spotRef.current) {
      spotRef.current.intensity = THREE.MathUtils.damp(
        spotRef.current.intensity,
        THREE.MathUtils.lerp(3.4, 1.55, hero),
        4.4,
        delta,
      );
    }
    if (lowRef.current) {
      lowRef.current.intensity = THREE.MathUtils.damp(
        lowRef.current.intensity,
        THREE.MathUtils.lerp(1.35, 0.38, hero),
        4.4,
        delta,
      );
    }
  });

  return (
    <group ref={rigRef}>
      <hemisphereLight intensity={0.17} color="#d8e5f3" groundColor="#010309" />
      <ambientLight intensity={0.022} color="#274566" />

      <AreaLight
        lightRef={keyRef}
        position={[4.8, 7.8, 6.7]}
        target={[0, 0.4, 0]}
        color="#edf5ff"
        intensity={7.2}
        width={6.8}
        height={8.6}
      />

      <AreaLight
        lightRef={fillRef}
        position={[-5.7, 2.8, 4.6]}
        target={[0, 0.05, 0]}
        color="#6c9bd2"
        intensity={3.6}
        width={5.2}
        height={7.2}
      />

      <AreaLight
        lightRef={rearRef}
        position={[0.4, 4.5, -5.9]}
        target={[0, 0.25, 0]}
        color="#477fc5"
        intensity={4.3}
        width={5.6}
        height={3.6}
      />

      <spotLight
        ref={spotRef}
        position={[2, 8.4, 6.3]}
        intensity={3.4}
        angle={0.42}
        penumbra={1}
        distance={22}
        decay={2}
        color="#f1f7ff"
      />
      <pointLight
        ref={lowRef}
        position={[0, -2, 1.6]}
        intensity={1.35}
        distance={8}
        decay={2}
        color="#28598f"
      />
    </group>
  );
}
