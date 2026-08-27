import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function makeSteelMaterial(color, roughness, metalness = 0.42) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    clearcoat: 0.08,
    clearcoatRoughness: 0.42,
    specularIntensity: 0.36,
    envMapIntensity: 0.72,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  });
}

export default function CoolingRelease({ progressRef }) {
  const topHalfRef = useRef();
  const bottomHalfRef = useRef();
  const pinsRef = useRef();
  const coolLeftRef = useRef();
  const coolRightRef = useRef();
  const heroKeyRef = useRef();
  const heroRimRef = useRef();

  const plateMaterial = useMemo(() => makeSteelMaterial('#111b25', 0.34, 0.48), []);
  const lipMaterial = useMemo(() => makeSteelMaterial('#263544', 0.27, 0.55), []);
  const pinMaterial = useMemo(() => makeSteelMaterial('#435464', 0.22, 0.62), []);

  useEffect(() => () => {
    plateMaterial.dispose();
    lipMaterial.dispose();
    pinMaterial.dispose();
  }, [plateMaterial, lipMaterial, pinMaterial]);

  useFrame((_, delta) => {
    const p = progressRef.current;
    const topHalf = topHalfRef.current;
    const bottomHalf = bottomHalfRef.current;
    const pins = pinsRef.current;

    const closed = range(p, 0.565, 0.635);
    const cooling = range(p, 0.59, 0.735);
    const release = range(p, 0.755, 0.835);
    const mouldFade = 1 - range(p, 0.84, 0.895);
    const mouldVisibility = closed * mouldFade;
    const ejection = range(p, 0.785, 0.845) * (1 - range(p, 0.855, 0.9));
    const hero = range(p, 0.805, 0.915);

    plateMaterial.opacity = mouldVisibility * 0.78;
    lipMaterial.opacity = mouldVisibility * 0.86;
    pinMaterial.opacity = ejection * 0.8;

    if (topHalf) {
      topHalf.visible = mouldVisibility > 0.002;
      const targetY = THREE.MathUtils.lerp(0.77, 2.3, release);
      topHalf.position.y = THREE.MathUtils.damp(topHalf.position.y, targetY, 5.8, delta);
      topHalf.rotation.y = THREE.MathUtils.damp(topHalf.rotation.y, release * 0.018, 4.5, delta);
    }

    if (bottomHalf) {
      bottomHalf.visible = mouldVisibility > 0.002;
      const targetY = THREE.MathUtils.lerp(-0.73, -2.18, release);
      bottomHalf.position.y = THREE.MathUtils.damp(bottomHalf.position.y, targetY, 5.8, delta);
      bottomHalf.rotation.y = THREE.MathUtils.damp(bottomHalf.rotation.y, release * -0.012, 4.5, delta);
    }

    if (pins) {
      pins.visible = ejection > 0.003;
      pins.position.y = THREE.MathUtils.damp(
        pins.position.y,
        THREE.MathUtils.lerp(-0.62, -0.39, range(p, 0.785, 0.835)),
        6.4,
        delta,
      );
    }

    // During cooling, the light is broad and technical; as the mould opens the
    // lighting hands off to a cleaner studio setup for the final hero product.
    if (coolLeftRef.current) {
      coolLeftRef.current.intensity = THREE.MathUtils.damp(
        coolLeftRef.current.intensity,
        cooling * (1 - hero) * 1.35,
        5,
        delta,
      );
    }
    if (coolRightRef.current) {
      coolRightRef.current.intensity = THREE.MathUtils.damp(
        coolRightRef.current.intensity,
        cooling * (1 - hero) * 1.05,
        5,
        delta,
      );
    }
    if (heroKeyRef.current) {
      heroKeyRef.current.intensity = THREE.MathUtils.damp(
        heroKeyRef.current.intensity,
        hero * 3.25,
        4.2,
        delta,
      );
    }
    if (heroRimRef.current) {
      heroRimRef.current.intensity = THREE.MathUtils.damp(
        heroRimRef.current.intensity,
        hero * 2.1,
        4.2,
        delta,
      );
    }
  });

  return (
    <group>
      <group ref={topHalfRef} position={[0, 0.77, 0]} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={plateMaterial}>
          <ringGeometry args={[2.78, 4.05, 112]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={lipMaterial}>
          <torusGeometry args={[2.72, 0.105, 10, 128]} />
        </mesh>
        <mesh position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]} material={plateMaterial}>
          <torusGeometry args={[3.86, 0.13, 8, 96]} />
        </mesh>
      </group>

      <group ref={bottomHalfRef} position={[0, -0.73, 0]} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={plateMaterial}>
          <ringGeometry args={[2.72, 4.02, 112]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={lipMaterial}>
          <torusGeometry args={[2.67, 0.11, 10, 128]} />
        </mesh>
      </group>

      <group ref={pinsRef} position={[0, -0.62, 0]} visible={false}>
        {[
          [-1.28, 0, -1.1],
          [1.28, 0, -1.1],
          [-1.28, 0, 1.1],
          [1.28, 0, 1.1],
        ].map(([x, y, z], index) => (
          <mesh key={index} position={[x, y, z]} material={pinMaterial}>
            <cylinderGeometry args={[0.055, 0.055, 0.36, 18]} />
          </mesh>
        ))}
      </group>

      <pointLight
        ref={coolLeftRef}
        position={[-3.8, 2.4, 4.8]}
        color="#9bc9ee"
        intensity={0}
        distance={7}
        decay={2}
      />
      <pointLight
        ref={coolRightRef}
        position={[3.5, 1.5, 3.7]}
        color="#78a9d1"
        intensity={0}
        distance={6.5}
        decay={2}
      />

      <spotLight
        ref={heroKeyRef}
        position={[-4.2, 5.2, 6.4]}
        color="#dcecff"
        intensity={0}
        angle={0.52}
        penumbra={0.78}
        distance={13}
        decay={2}
        target-position={[0, 0, 0]}
      />
      <spotLight
        ref={heroRimRef}
        position={[4.8, 2.6, -3.8]}
        color="#659bd1"
        intensity={0}
        angle={0.64}
        penumbra={0.86}
        distance={12}
        decay={2}
        target-position={[0, 0, 0]}
      />
    </group>
  );
}
