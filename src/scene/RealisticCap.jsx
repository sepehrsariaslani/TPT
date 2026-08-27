import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function seededRandom(seed = 7341) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createMouldTexture(seed = 1409, size = 64) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const broad = Math.sin(nx * TAU * 4 + ny * 3.2) * 1.35;
      const fine = Math.sin(nx * TAU * 18 - ny * 13) * 0.52;
      const grain = (random() - 0.5) * 3.4;
      pixels[y * size + x] = Math.max(0, Math.min(255, 128 + broad + fine + grain));
    }
  }

  const texture = new THREE.DataTexture(
    pixels,
    size,
    size,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6.4, 3.9);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createRoughnessTexture(seed = 509, size = 64) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const low = Math.sin(nx * TAU * 2.1 + ny * 1.7) * 4.6;
      const tool = Math.sin(nx * TAU * 10.8 - ny * 6.7) * 1.45;
      const grain = (random() - 0.5) * 4.7;
      const value = Math.max(194, Math.min(244, 226 + low + tool + grain));
      const i = (y * size + x) * 4;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(
    pixels,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.1, 3.4);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createCapBodyGeometry() {
  // Slightly thinner than the previous hockey-puck silhouette while preserving
  // a continuous moulded shoulder and shallow top crown.
  const profile = [
    [0, -0.35],
    [2.31, -0.35],
    [2.405, -0.334],
    [2.475, -0.29],
    [2.515, -0.215],
    [2.522, 0.13],
    [2.507, 0.202],
    [2.466, 0.266],
    [2.39, 0.312],
    [2.255, 0.343],
    [1.92, 0.357],
    [1.15, 0.356],
    [0.6, 0.347],
    [0, 0.34],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));

  const geometry = new THREE.LatheGeometry(profile, 160);
  geometry.computeVertexNormals();
  return geometry;
}

function addRadialFillMask(material) {
  const fillRadius = { value: -0.08 };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFillRadius = fillRadius;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vInjectionLocalPosition;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvInjectionLocalPosition = position;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vInjectionLocalPosition;\nuniform float uFillRadius;',
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        vec2 injectionPlane = vec2(vInjectionLocalPosition.x * 0.99, vInjectionLocalPosition.z * 1.01);
        float injectionRadius = length(injectionPlane);
        if (injectionRadius > uFillRadius) discard;`,
      );
  };

  material.customProgramCacheKey = () => 'tpt-cap-radial-injection-fill-v4';
  material.needsUpdate = true;
  return fillRadius;
}

export default function RealisticCap({ progressRef }) {
  const groupRef = useRef();
  const ribsRef = useRef();
  const flowFrontRef = useRef();
  const gatePoolRef = useRef();

  const mouldTexture = useMemo(() => createMouldTexture(), []);
  const roughnessTexture = useMemo(() => createRoughnessTexture(), []);
  const bodyGeometry = useMemo(() => createCapBodyGeometry(), []);
  const ribGeometry = useMemo(
    () => new RoundedBoxGeometry(0.044, 0.405, 0.088, 3, 0.013),
    [],
  );

  const hotBodyColor = useMemo(() => new THREE.Color('#286eb5'), []);
  const warmBodyColor = useMemo(() => new THREE.Color('#205fa5'), []);
  const solidBodyColor = useMemo(() => new THREE.Color('#174d92'), []);
  const heroBodyColor = useMemo(() => new THREE.Color('#164787'), []);

  const bodyMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: hotBodyColor.clone(),
    metalness: 0,
    roughness: 0.21,
    roughnessMap: roughnessTexture,
    clearcoat: 0.56,
    clearcoatRoughness: 0.14,
    ior: 1.47,
    specularIntensity: 0.54,
    specularColor: new THREE.Color('#c2d8ea'),
    sheen: 0.012,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color('#2a639b'),
    bumpMap: mouldTexture,
    bumpScale: 0.00075,
    envMapIntensity: 0.78,
    depthWrite: true,
    depthTest: true,
  }), [hotBodyColor, mouldTexture, roughnessTexture]);

  const fillRadiusUniform = useMemo(() => addRadialFillMask(bodyMaterial), [bodyMaterial]);

  const ribMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#153f77',
    metalness: 0,
    roughness: 0.38,
    roughnessMap: roughnessTexture,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
    ior: 1.47,
    specularIntensity: 0.36,
    specularColor: new THREE.Color('#9db9d2'),
    bumpMap: mouldTexture,
    bumpScale: 0.00115,
    envMapIntensity: 0.56,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), [mouldTexture, roughnessTexture]);

  const detailMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#123b70',
    metalness: 0,
    roughness: 0.5,
    clearcoat: 0.08,
    clearcoatRoughness: 0.44,
    ior: 1.47,
    specularIntensity: 0.22,
    envMapIntensity: 0.4,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), []);

  const shoulderMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1b579d',
    metalness: 0,
    roughness: 0.35,
    clearcoat: 0.18,
    clearcoatRoughness: 0.29,
    ior: 1.47,
    specularIntensity: 0.36,
    specularColor: new THREE.Color('#bdd1e5'),
    envMapIntensity: 0.58,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), []);

  const flowFrontMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#2a6fb4',
    metalness: 0,
    roughness: 0.18,
    clearcoat: 0.52,
    clearcoatRoughness: 0.12,
    ior: 1.47,
    specularIntensity: 0.45,
    specularColor: new THREE.Color('#c7dceb'),
    envMapIntensity: 0.7,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), []);

  useEffect(() => {
    const mesh = ribsRef.current;
    if (!mesh) return;

    const helper = new THREE.Object3D();
    const ribCount = 120;

    for (let i = 0; i < ribCount; i += 1) {
      const angle = (i / ribCount) * TAU;
      const tinyVariation = 1 + Math.sin(angle * 11) * 0.008;
      helper.position.set(
        Math.cos(angle) * 2.515,
        -0.02,
        Math.sin(angle) * 2.515,
      );
      helper.rotation.set(0, Math.PI * 0.5 - angle, 0);
      helper.scale.set(tinyVariation, 1, 1);
      helper.updateMatrix();
      mesh.setMatrixAt(i, helper.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => () => {
    bodyGeometry.dispose();
    ribGeometry.dispose();
    mouldTexture.dispose();
    roughnessTexture.dispose();
    bodyMaterial.dispose();
    ribMaterial.dispose();
    detailMaterial.dispose();
    shoulderMaterial.dispose();
    flowFrontMaterial.dispose();
  }, [
    bodyGeometry,
    ribGeometry,
    mouldTexture,
    roughnessTexture,
    bodyMaterial,
    ribMaterial,
    detailMaterial,
    shoulderMaterial,
    flowFrontMaterial,
  ]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const p = progressRef.current;
    const injection = range(p, 0.455, 0.625);
    const radialProgress = Math.pow(injection, 0.64);
    const fillRadius = THREE.MathUtils.lerp(0.035, 2.63, radialProgress);
    fillRadiusUniform.value = fillRadius;

    const outerFill = range(p, 0.575, 0.66);
    const cooling = range(p, 0.61, 0.785);
    const surfaceLock = range(p, 0.655, 0.805);
    const shrink = range(p, 0.68, 0.81);
    const ejection = range(p, 0.785, 0.845);
    const hero = range(p, 0.81, 0.925);
    const heroSettle = range(p, 0.875, 0.96);
    const injectionActivity = range(p, 0.445, 0.475) * (1 - range(p, 0.61, 0.665));

    const firstCool = clamp01(cooling / 0.55);
    const finalCool = clamp01((cooling - 0.55) / 0.45);
    if (cooling <= 0.55) {
      bodyMaterial.color.lerpColors(hotBodyColor, warmBodyColor, firstCool);
    } else {
      bodyMaterial.color.lerpColors(warmBodyColor, solidBodyColor, finalCool);
      bodyMaterial.color.lerp(heroBodyColor, hero * 0.36);
    }

    bodyMaterial.roughness = THREE.MathUtils.lerp(0.21, 0.43, cooling);
    bodyMaterial.clearcoat = THREE.MathUtils.lerp(0.56, 0.16, cooling);
    bodyMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.14, 0.32, cooling);
    bodyMaterial.envMapIntensity = THREE.MathUtils.lerp(0.78, 0.58, cooling);
    bodyMaterial.specularIntensity = THREE.MathUtils.lerp(0.54, 0.39, cooling);
    bodyMaterial.bumpScale = THREE.MathUtils.lerp(0.00075, 0.00155, surfaceLock);

    const ribReveal = outerFill * range(p, 0.59, 0.67);
    ribMaterial.opacity = ribReveal;
    ribMaterial.roughness = THREE.MathUtils.lerp(0.38, 0.47, cooling);
    ribMaterial.clearcoat = THREE.MathUtils.lerp(0.2, 0.11, cooling);
    ribMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.3, 0.39, cooling);
    ribMaterial.bumpScale = THREE.MathUtils.lerp(0.00115, 0.00175, surfaceLock);

    const detailReveal = outerFill * range(p, 0.62, 0.735);
    detailMaterial.opacity = detailReveal * 0.34;
    shoulderMaterial.opacity = outerFill * range(p, 0.595, 0.69) * 0.42;

    group.visible = p > 0.447;
    const ejectionLift = ejection * 0.052;
    const heroLift = THREE.MathUtils.lerp(ejectionLift, 0.024, heroSettle);
    group.position.y = THREE.MathUtils.damp(group.position.y, heroLift, 5.2, delta);

    const shrinkXZ = THREE.MathUtils.lerp(1, 0.995, shrink);
    const shrinkY = THREE.MathUtils.lerp(1, 0.997, shrink);
    group.scale.x = THREE.MathUtils.damp(group.scale.x, shrinkXZ, 5.2, delta);
    group.scale.y = THREE.MathUtils.damp(group.scale.y, shrinkY, 5.2, delta);
    group.scale.z = THREE.MathUtils.damp(group.scale.z, shrinkXZ, 5.2, delta);

    // One restrained inspection turn after the process is finished.
    const scrollTurn = range(p, 0.815, 0.95) * 0.075;
    const inspectionDrift = Math.sin(clock.getElapsedTime() * 0.16) * 0.002 * heroSettle;
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      scrollTurn + inspectionDrift,
      3.8,
      delta,
    );
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, hero * -0.006, 4.2, delta);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, 0, 4.2, delta);

    if (flowFrontRef.current) {
      const frontVisible = injectionActivity * (1 - range(injection, 0.92, 1));
      flowFrontRef.current.visible = frontVisible > 0.003 && fillRadius > 0.12;
      flowFrontRef.current.scale.set(fillRadius, fillRadius, 1);
      flowFrontMaterial.opacity = frontVisible * 0.14;
    }

    if (gatePoolRef.current) {
      const gateVisible = injectionActivity * (1 - range(p, 0.6, 0.655));
      gatePoolRef.current.visible = gateVisible > 0.003;
      const gateScale = 0.82 + injection * 0.12;
      gatePoolRef.current.scale.set(gateScale, 1, gateScale);
      flowFrontMaterial.opacity = Math.max(flowFrontMaterial.opacity, gateVisible * 0.12);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh geometry={bodyGeometry} material={bodyMaterial} />

      <instancedMesh
        ref={ribsRef}
        args={[ribGeometry, ribMaterial, 120]}
        frustumCulled={false}
      />

      {/* Restrained tooling cues; no large flat overlay or bright concentric discs. */}
      <mesh position={[0, 0.355, 0]} rotation={[Math.PI / 2, 0, 0]} material={shoulderMaterial}>
        <torusGeometry args={[2.22, 0.018, 7, 144]} />
      </mesh>
      <mesh position={[0, 0.359, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[1.68, 0.0045, 5, 112]} />
      </mesh>
      <mesh position={[0, -0.275, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[2.505, 0.006, 5, 144]} />
      </mesh>

      <mesh position={[0, 0.351, 0]} material={detailMaterial}>
        <cylinderGeometry args={[0.041, 0.041, 0.006, 32]} />
      </mesh>

      <mesh position={[0, -0.344, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[2.29, 0.036, 7, 120]} />
      </mesh>

      <mesh
        ref={flowFrontRef}
        position={[0, 0.359, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={flowFrontMaterial}
        visible={false}
        renderOrder={5}
      >
        <torusGeometry args={[1, 0.0055, 5, 128]} />
      </mesh>

      <mesh
        ref={gatePoolRef}
        position={[0, 0.349, 0]}
        material={flowFrontMaterial}
        visible={false}
        renderOrder={5}
      >
        <cylinderGeometry args={[0.062, 0.062, 0.012, 36]} />
      </mesh>
    </group>
  );
}
