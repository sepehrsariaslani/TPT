import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function makeCurve(points) {
  return new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    'centripetal',
    0.45,
  );
}

function makeTube(points, radius, segments = 84) {
  const curve = makeCurve(points);
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 10, false);
  geometry.computeVertexNormals();
  return geometry;
}

export default function PlasticizingFlow({ progressRef }) {
  const groupRef = useRef();
  const leftRef = useRef();
  const rightRef = useRef();
  const coreRef = useRef();
  const collarRef = useRef();

  const geometries = useMemo(() => ({
    left: makeTube([
      [-3.45, 4.95, 0.72],
      [-3.08, 4.3, 0.55],
      [-2.46, 3.55, 0.38],
      [-1.72, 2.75, 0.27],
      [-1.02, 1.9, 0.18],
      [-0.42, 1.08, 0.11],
      [-0.14, 0.62, 0.08],
    ], 0.115),
    right: makeTube([
      [3.45, 4.9, -0.62],
      [3.03, 4.22, -0.48],
      [2.42, 3.48, -0.34],
      [1.68, 2.7, -0.24],
      [0.98, 1.86, -0.16],
      [0.4, 1.05, -0.1],
      [0.14, 0.62, -0.06],
    ], 0.115),
    core: makeTube([
      [0, 0.82, 0.02],
      [0.28, 0.5, 0.16],
      [0.43, 0.09, -0.04],
      [0.3, -0.38, -0.22],
      [-0.04, -0.8, -0.25],
      [-0.34, -1.18, -0.05],
      [-0.26, -1.57, 0.18],
      [0, -1.92, 0.12],
    ], 0.175, 96),
  }), []);

  const meltMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1d5caa',
    metalness: 0,
    roughness: 0.2,
    clearcoat: 0.72,
    clearcoatRoughness: 0.14,
    ior: 1.47,
    specularIntensity: 0.6,
    specularColor: new THREE.Color('#c4dcf5'),
    envMapIntensity: 0.86,
    transmission: 0.018,
    thickness: 0.22,
    attenuationColor: new THREE.Color('#245b9c'),
    attenuationDistance: 0.8,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), []);

  const collarMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#205fa9',
    metalness: 0,
    roughness: 0.22,
    clearcoat: 0.6,
    clearcoatRoughness: 0.16,
    ior: 1.47,
    specularIntensity: 0.54,
    envMapIntensity: 0.78,
    transparent: true,
    opacity: 0,
    depthWrite: true,
  }), []);

  useEffect(() => () => {
    Object.values(geometries).forEach((geometry) => geometry.dispose());
    meltMaterial.dispose();
    collarMaterial.dispose();
  }, [collarMaterial, geometries, meltMaterial]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const p = progressRef.current;
    const enter = range(p, 0.205, 0.285);
    const plasticize = range(p, 0.245, 0.365);
    const handoff = range(p, 0.415, 0.49);
    const visibility = enter * (1 - handoff);

    group.visible = visibility > 0.002;
    meltMaterial.opacity = visibility * 0.9;
    collarMaterial.opacity = visibility * 0.68;

    // The material becomes glossier as pellets soften, then settles again before
    // the next beat. No emissive glow: this should read as molten polymer, not energy.
    meltMaterial.roughness = 0.24 - plasticize * 0.09 + handoff * 0.05;
    meltMaterial.clearcoat = 0.58 + plasticize * 0.2;

    const leftFill = range(p, 0.205, 0.315);
    const rightFill = range(p, 0.215, 0.325);
    const coreFill = range(p, 0.285, 0.405);

    const setDraw = (mesh, fill) => {
      const geometry = mesh?.geometry;
      if (!geometry?.index) return;
      const count = Math.floor((geometry.index.count * clamp01(fill)) / 3) * 3;
      geometry.setDrawRange(0, Math.max(0, count));
    };

    setDraw(leftRef.current, leftFill);
    setDraw(rightRef.current, rightFill);
    setDraw(coreRef.current, coreFill);

    const settle = range(p, 0.34, 0.43);
    const breathe = 1 + Math.sin(clock.getElapsedTime() * 0.42) * 0.006 * (1 - settle);
    const targetXZ = 0.94 + plasticize * 0.06;
    group.scale.x = THREE.MathUtils.damp(group.scale.x, targetXZ * breathe, 4.2, delta);
    group.scale.z = THREE.MathUtils.damp(group.scale.z, targetXZ / breathe, 4.2, delta);
    group.scale.y = THREE.MathUtils.damp(group.scale.y, 0.97 + plasticize * 0.03, 4.2, delta);

    // A fraction of a degree of drift gives viscous weight without reviving the
    // old vortex/spinning problem.
    group.rotation.y = Math.sin(clock.getElapsedTime() * 0.12) * 0.006 * visibility;

    if (collarRef.current) {
      collarRef.current.scale.setScalar(0.82 + plasticize * 0.24);
      collarRef.current.rotation.z = clock.getElapsedTime() * 0.01 * (1 - settle);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={leftRef} geometry={geometries.left} material={meltMaterial} />
      <mesh ref={rightRef} geometry={geometries.right} material={meltMaterial} />
      <mesh ref={coreRef} geometry={geometries.core} material={meltMaterial} />

      {/* A soft compression collar makes the two feeds visually merge into one mass. */}
      <mesh
        ref={collarRef}
        position={[0, 0.69, 0.01]}
        rotation={[Math.PI / 2, 0, 0]}
        material={collarMaterial}
      >
        <torusGeometry args={[0.31, 0.105, 10, 48]} />
      </mesh>
    </group>
  );
}
