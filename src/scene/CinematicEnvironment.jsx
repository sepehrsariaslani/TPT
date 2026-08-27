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

  useFrame(({ clock }) => {
    const p = progressRef.current;
    if (rigRef.current) {
      rigRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.052) * 0.009 + p * 0.01;
    }
    scene.environmentIntensity = 0.56 + Math.sin(Math.min(1, p) * Math.PI) * 0.055;
  });

  return (
    <group ref={rigRef}>
      <hemisphereLight intensity={0.17} color="#d8e5f3" groundColor="#010309" />
      <ambientLight intensity={0.022} color="#274566" />

      {/* Large neutral studio key: broad highlight, not a neon glow. */}
      <AreaLight
        position={[4.8, 7.8, 6.7]}
        target={[0, 0.4, 0]}
        color="#edf5ff"
        intensity={7.2}
        width={6.8}
        height={8.6}
      />

      {/* Cool fill preserves the TPT blue identity without turning the resin chrome. */}
      <AreaLight
        position={[-5.7, 2.8, 4.6]}
        target={[0, 0.05, 0]}
        color="#6c9bd2"
        intensity={3.6}
        width={5.2}
        height={7.2}
      />

      {/* Thin rear strip produces realistic edge separation on the finished cap. */}
      <AreaLight
        position={[0.4, 4.5, -5.9]}
        target={[0, 0.25, 0]}
        color="#477fc5"
        intensity={4.3}
        width={5.6}
        height={3.6}
      />

      <spotLight
        position={[2.0, 8.4, 6.3]}
        intensity={3.4}
        angle={0.42}
        penumbra={1}
        distance={22}
        decay={2}
        color="#f1f7ff"
      />
      <pointLight
        position={[0, -2.0, 1.6]}
        intensity={1.35}
        distance={8}
        decay={2}
        color="#28598f"
      />
    </group>
  );
}
