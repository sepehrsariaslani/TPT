import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function steelMaterial(color, roughness = 0.3, metalness = 0.58, envMapIntensity = 0.62) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    clearcoat: 0.05,
    clearcoatRoughness: 0.44,
    specularIntensity: 0.34,
    envMapIntensity,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  });
}

export default function CoolingRelease({ progressRef }) {
  const topRef = useRef();
  const bottomRef = useRef();
  const nozzleRef = useRef();
  const sprueRef = useRef();
  const pinsRef = useRef();
  const coolLeftRef = useRef();
  const coolRightRef = useRef();
  const heroKeyRef = useRef();
  const heroRimRef = useRef();

  const plateMaterial = useMemo(() => steelMaterial('#19252e', 0.34, 0.54, 0.56), []);
  const edgeMaterial = useMemo(() => steelMaterial('#52616d', 0.22, 0.7, 0.72), []);
  const nozzleMaterial = useMemo(() => steelMaterial('#46545f', 0.24, 0.66, 0.68), []);
  const pinMaterial = useMemo(() => steelMaterial('#8997a2', 0.2, 0.74, 0.76), []);
  const meltMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1c5f9f',
    metalness: 0,
    roughness: 0.18,
    clearcoat: 0.5,
    clearcoatRoughness: 0.13,
    ior: 1.47,
    specularIntensity: 0.5,
    specularColor: new THREE.Color('#c6dceb'),
    envMapIntensity: 0.78,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), []);

  useEffect(() => () => {
    plateMaterial.dispose();
    edgeMaterial.dispose();
    nozzleMaterial.dispose();
    pinMaterial.dispose();
    meltMaterial.dispose();
  }, [plateMaterial, edgeMaterial, nozzleMaterial, pinMaterial, meltMaterial]);

  useFrame((_, delta) => {
    const p = progressRef.current;
    const top = topRef.current;
    const bottom = bottomRef.current;
    const nozzle = nozzleRef.current;
    const sprue = sprueRef.current;
    const pins = pinsRef.current;

    // A restrained mould moment: only the cavity/core rings enter frame. The old
    // table, legs and heavy frame are intentionally removed so the polymer stays
    // the visual subject.
    const mouldArrive = range(p, 0.435, 0.495);
    const clamp = range(p, 0.47, 0.545);
    const injection = range(p, 0.465, 0.64);
    const cooling = range(p, 0.615, 0.765);
    const release = range(p, 0.75, 0.835);
    const mouldFade = 1 - range(p, 0.83, 0.895);
    const visibility = mouldArrive * mouldFade;
    const ejection = range(p, 0.785, 0.842) * (1 - range(p, 0.86, 0.9));
    const hero = range(p, 0.805, 0.93);

    const nozzleApproach = range(p, 0.43, 0.495);
    const nozzleRetract = range(p, 0.64, 0.71);
    const nozzleVisibility = nozzleApproach * (1 - range(p, 0.715, 0.77));
    const sprueFlow = range(p, 0.475, 0.525) * (1 - range(p, 0.62, 0.675));

    plateMaterial.opacity = visibility * THREE.MathUtils.lerp(0.2, 0.44, clamp);
    edgeMaterial.opacity = visibility * THREE.MathUtils.lerp(0.32, 0.62, clamp);
    nozzleMaterial.opacity = nozzleVisibility * 0.72;
    pinMaterial.opacity = ejection * 0.62;
    meltMaterial.opacity = sprueFlow * THREE.MathUtils.lerp(0.34, 0.62, injection);

    if (top) {
      top.visible = visibility > 0.003;
      const seated = THREE.MathUtils.lerp(1.16, 0.72, clamp);
      const open = THREE.MathUtils.lerp(seated, 1.46, release);
      top.position.y = THREE.MathUtils.damp(top.position.y, open, 6, delta);
    }

    if (bottom) {
      bottom.visible = visibility > 0.003;
      const seated = THREE.MathUtils.lerp(-1.14, -0.7, clamp);
      const open = THREE.MathUtils.lerp(seated, -1.36, release);
      bottom.position.y = THREE.MathUtils.damp(bottom.position.y, open, 6, delta);
    }

    if (nozzle) {
      nozzle.visible = nozzleVisibility > 0.003;
      const seatedY = THREE.MathUtils.lerp(2.08, 1.1, nozzleApproach);
      const targetY = THREE.MathUtils.lerp(seatedY, 2.12, nozzleRetract);
      nozzle.position.y = THREE.MathUtils.damp(nozzle.position.y, targetY, 6.2, delta);
    }

    if (sprue) {
      sprue.visible = sprueFlow > 0.003;
      const length = 0.58;
      const topY = 0.98;
      const targetScaleY = THREE.MathUtils.lerp(0.08, 1, sprueFlow);
      sprue.scale.y = THREE.MathUtils.damp(sprue.scale.y, targetScaleY, 7.2, delta);
      sprue.position.y = THREE.MathUtils.damp(
        sprue.position.y,
        topY - (length * targetScaleY) / 2,
        7.2,
        delta,
      );
      const pressure = THREE.MathUtils.lerp(0.86, 1, range(p, 0.55, 0.63));
      sprue.scale.x = THREE.MathUtils.damp(sprue.scale.x, pressure, 6, delta);
      sprue.scale.z = THREE.MathUtils.damp(sprue.scale.z, pressure, 6, delta);
    }

    if (pins) {
      pins.visible = ejection > 0.003;
      const stroke = range(p, 0.792, 0.842);
      pins.position.y = THREE.MathUtils.damp(
        pins.position.y,
        THREE.MathUtils.lerp(-0.64, -0.38, stroke),
        6.6,
        delta,
      );
    }

    if (coolLeftRef.current) {
      coolLeftRef.current.intensity = THREE.MathUtils.damp(
        coolLeftRef.current.intensity,
        cooling * (1 - hero) * 0.72,
        5,
        delta,
      );
    }
    if (coolRightRef.current) {
      coolRightRef.current.intensity = THREE.MathUtils.damp(
        coolRightRef.current.intensity,
        cooling * (1 - hero) * 0.58,
        5,
        delta,
      );
    }
    if (heroKeyRef.current) {
      heroKeyRef.current.intensity = THREE.MathUtils.damp(
        heroKeyRef.current.intensity,
        hero * 2.35,
        4.4,
        delta,
      );
    }
    if (heroRimRef.current) {
      heroRimRef.current.intensity = THREE.MathUtils.damp(
        heroRimRef.current.intensity,
        hero * 1.15,
        4.4,
        delta,
      );
    }
  });

  return (
    <group>
      <group ref={topRef} position={[0, 1.16, 0]} visible={false}>
        <mesh position={[0, -0.24, 0]} rotation={[Math.PI / 2, 0, 0]} material={plateMaterial}>
          <ringGeometry args={[2.58, 3.02, 112]} />
        </mesh>
        <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
          <torusGeometry args={[2.58, 0.052, 8, 144]} />
        </mesh>
        <mesh position={[0, -0.13, 0]} material={plateMaterial}>
          <cylinderGeometry args={[2.99, 2.99, 0.16, 112, 1, true]} />
        </mesh>
        <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
          <ringGeometry args={[0.16, 0.27, 48]} />
        </mesh>
      </group>

      <group ref={bottomRef} position={[0, -1.14, 0]} visible={false}>
        <mesh position={[0, 0.24, 0]} rotation={[-Math.PI / 2, 0, 0]} material={plateMaterial}>
          <ringGeometry args={[2.46, 3.0, 112]} />
        </mesh>
        <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
          <torusGeometry args={[2.47, 0.056, 8, 144]} />
        </mesh>
        <mesh position={[0, 0.13, 0]} material={plateMaterial}>
          <cylinderGeometry args={[2.98, 2.98, 0.16, 112, 1, true]} />
        </mesh>
      </group>

      <group ref={nozzleRef} position={[0, 2.08, 0]} visible={false}>
        <mesh position={[0, 0.1, 0]} material={nozzleMaterial}>
          <cylinderGeometry args={[0.14, 0.12, 0.28, 32]} />
        </mesh>
        <mesh position={[0, -0.2, 0]} material={nozzleMaterial}>
          <cylinderGeometry args={[0.12, 0.045, 0.34, 32]} />
        </mesh>
      </group>

      <mesh ref={sprueRef} position={[0, 0.7, 0]} material={meltMaterial} visible={false}>
        <cylinderGeometry args={[0.052, 0.045, 0.58, 28]} />
      </mesh>

      <group ref={pinsRef} position={[0, -0.64, 0]} visible={false}>
        {[-0.72, 0, 0.72].map((x) => (
          <mesh key={x} position={[x, 0, 0]} material={pinMaterial}>
            <cylinderGeometry args={[0.035, 0.035, 0.32, 18]} />
          </mesh>
        ))}
      </group>

      <pointLight
        ref={coolLeftRef}
        position={[-3.8, 1.8, 3.4]}
        color="#7da4ca"
        intensity={0}
        distance={7}
        decay={2}
      />
      <pointLight
        ref={coolRightRef}
        position={[3.7, 1.4, 2.8]}
        color="#638bb5"
        intensity={0}
        distance={7}
        decay={2}
      />
      <pointLight
        ref={heroKeyRef}
        position={[4.5, 5.8, 5.2]}
        color="#f2f6fb"
        intensity={0}
        distance={9}
        decay={2}
      />
      <pointLight
        ref={heroRimRef}
        position={[-4.4, 3.2, -2.8]}
        color="#7fa9d4"
        intensity={0}
        distance={8}
        decay={2}
      />
    </group>
  );
}
