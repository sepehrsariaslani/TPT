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
    const target = pmrem.fromScene(room, 0.055);

    scene.environment = target.texture;
    scene.environmentIntensity = 0.74;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.96;
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
      rigRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.065) * 0.012 + p * 0.016;
    }
    scene.environmentIntensity = 0.72 + Math.sin(Math.min(1, p) * Math.PI) * 0.08;
  });

  return (
    <group ref={rigRef}>
      <hemisphereLight intensity={0.24} color="#b9d8ff" groundColor="#01040a" />
      <ambientLight intensity={0.04} color="#31557f" />

      <AreaLight
        position={[3.8, 7.4, 6.4]}
        target={[0, 0.6, 0]}
        color="#d8ecff"
        intensity={10.5}
        width={5.8}
        height={8.0}
      />
      <AreaLight
        position={[-5.6, 2.4, 4.4]}
        target={[0, 0.15, 0]}
        color="#4f91e8"
        intensity={7.2}
        width={4.4}
        height={6.8}
      />
      <AreaLight
        position={[0.2, 4.8, -5.8]}
        target={[0, 0.35, 0]}
        color="#2e6ed2"
        intensity={8.2}
        width={5.0}
        height={4.4}
      />

      <spotLight
        position={[1.8, 8.6, 6.6]}
        intensity={6.5}
        angle={0.38}
        penumbra={0.98}
        distance={22}
        decay={2}
        color="#dceeff"
      />
      <pointLight
        position={[0, -2.2, 1.8]}
        intensity={4.0}
        distance={9}
        decay={2}
        color="#124fae"
      />
    </group>
  );
}
