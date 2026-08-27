import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

function AreaLight({ position, color, intensity, width, height, target }) {
  const ref = useRef();
  const targetVector = useMemo(() => new THREE.Vector3(...target), [target]);

  useEffect(() => {
    ref.current?.lookAt(targetVector);
  }, [targetVector]);

  return (
    <rectAreaLight
      ref={ref}
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

  useEffect(() => {
    RectAreaLightUniformsLib.init();

    const previousEnvironment = scene.environment;
    const previousEnvironmentIntensity = scene.environmentIntensity;
    const previousToneMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;
    const previousColorSpace = gl.outputColorSpace;

    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(room, 0.045);

    scene.environment = target.texture;
    scene.environmentIntensity = 1.02;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.02;
    gl.outputColorSpace = THREE.SRGBColorSpace;

    // Shadows are intentionally disabled. The reference relies on glossy studio
    // reflections and luminous filaments, while realtime shadow maps were one of
    // the largest unnecessary GPU costs during startup and scrolling.
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

  useFrame(({ clock }) => {
    const p = progressRef.current;
    if (rigRef.current) {
      rigRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.07) * 0.014 + p * 0.02;
    }
    scene.environmentIntensity = 1.0 + Math.sin(Math.min(1, p) * Math.PI) * 0.12;
  });

  return (
    <group ref={rigRef}>
      <hemisphereLight intensity={0.28} color="#d3e6ff" groundColor="#01040a" />
      <ambientLight intensity={0.055} color="#44658e" />

      <AreaLight
        position={[3.8, 7.4, 6.4]}
        target={[0, 0.6, 0]}
        color="#f5fbff"
        intensity={19}
        width={5.8}
        height={8.0}
      />
      <AreaLight
        position={[-5.6, 2.4, 4.4]}
        target={[0, 0.15, 0]}
        color="#5e9eff"
        intensity={9.2}
        width={4.4}
        height={6.8}
      />
      <AreaLight
        position={[0.2, 4.8, -5.8]}
        target={[0, 0.35, 0]}
        color="#2f76ff"
        intensity={11.5}
        width={5.0}
        height={4.4}
      />

      <spotLight
        position={[1.8, 8.6, 6.6]}
        intensity={13}
        angle={0.38}
        penumbra={0.98}
        distance={22}
        decay={2}
        color="#eaf5ff"
      />
      <pointLight
        position={[0, -2.2, 1.8]}
        intensity={6.5}
        distance={9}
        decay={2}
        color="#1558ca"
      />
    </group>
  );
}
