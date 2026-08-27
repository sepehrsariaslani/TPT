import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

function AreaLight({ position, color, intensity, width, height, target = [0, 0, 0] }) {
  const ref = useRef();
  const targetVector = useMemo(() => new THREE.Vector3(...target), [target]);

  useEffect(() => {
    if (ref.current) ref.current.lookAt(targetVector);
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

/**
 * Local, deterministic studio environment. No remote HDRI is required.
 * RoomEnvironment is converted to a PMREM cubemap so the polymer pellets get
 * broad soft-box reflections and a readable Fresnel rim instead of flat blue.
 */
export default function CinematicEnvironment({ progressRef }) {
  const { gl, scene } = useThree();
  const lightRigRef = useRef();

  useEffect(() => {
    RectAreaLightUniformsLib.init();

    const previousEnvironment = scene.environment;
    const previousEnvironmentIntensity = scene.environmentIntensity;
    const previousToneMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;
    const previousOutputColorSpace = gl.outputColorSpace;
    const previousShadowEnabled = gl.shadowMap.enabled;
    const previousShadowType = gl.shadowMap.type;

    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(room, 0.035);

    scene.environment = target.texture;
    scene.environmentIntensity = 1.15;

    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.92;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;

    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousEnvironmentIntensity;
      gl.toneMapping = previousToneMapping;
      gl.toneMappingExposure = previousExposure;
      gl.outputColorSpace = previousOutputColorSpace;
      gl.shadowMap.enabled = previousShadowEnabled;
      gl.shadowMap.type = previousShadowType;

      target.dispose();
      pmrem.dispose();
      if (typeof room.dispose === 'function') room.dispose();
    };
  }, [gl, scene]);

  useFrame(({ clock }) => {
    const rig = lightRigRef.current;
    if (!rig) return;

    const p = progressRef.current;
    // Nearly static studio lights, with a tiny drift so reflections do not look frozen.
    rig.rotation.y = Math.sin(clock.getElapsedTime() * 0.08) * 0.018 + p * 0.035;
    scene.environmentIntensity = 1.08 + Math.sin(p * Math.PI) * 0.12;
  });

  return (
    <group ref={lightRigRef}>
      <hemisphereLight intensity={0.32} color="#c7ddff" groundColor="#01040b" />
      <ambientLight intensity={0.08} color="#476a9d" />

      <AreaLight
        position={[4.6, 6.8, 6.8]}
        target={[0, 0.35, 0]}
        color="#eef6ff"
        intensity={17}
        width={5.4}
        height={7.2}
      />
      <AreaLight
        position={[-5.2, 2.6, 4.2]}
        target={[0, 0.05, 0]}
        color="#75adff"
        intensity={8.5}
        width={4.0}
        height={6.2}
      />
      <AreaLight
        position={[0.4, 5.0, -5.8]}
        target={[0, 0.3, 0]}
        color="#2e72ff"
        intensity={10.5}
        width={4.6}
        height={4.0}
      />

      <spotLight
        position={[2.2, 7.5, 7.8]}
        intensity={14}
        angle={0.42}
        penumbra={0.96}
        distance={20}
        decay={2}
        color="#ffffff"
      />
      <pointLight
        position={[0, -2.8, 2.2]}
        intensity={7}
        distance={10}
        decay={2}
        color="#1555c9"
      />
    </group>
  );
}
