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
      const broad = Math.sin(nx * TAU * 4 + ny * 3.2) * 1.55;
      const fine = Math.sin(nx * TAU * 18 - ny * 13) * 0.62;
      const grain = (random() - 0.5) * 3.7;
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
  texture.repeat.set(6.2, 3.8);
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
      const low = Math.sin(nx * TAU * 2.4 + ny * 1.9) * 5.2;
      const tool = Math.sin(nx * TAU * 11.5 - ny * 7.2) * 1.8;
      const grain = (random() - 0.5) * 5.5;
      const value = Math.max(188, Math.min(246, 224 + low + tool + grain));
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
  texture.repeat.set(4.8, 3.2);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createShadowTexture(size = 96) {
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const d = Math.sqrt(nx * nx + ny * ny);
      const a = Math.pow(Math.max(0, 1 - d), 2.75);
      const i = (y * size + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(a * 255);
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function createCapBodyGeometry() {
  // Continuous revolved silhouette with a subtly crowned top and mould-friendly radii.
  const profile = [
    [0, -0.405],
    [2.30, -0.405],
    [2.405, -0.385],
    [2.475, -0.335],
    [2.515, -0.245],
    [2.522, 0.155],
    [2.507, 0.23],
    [2.468, 0.302],
    [2.392, 0.353],
    [2.265, 0.389],
    [1.94, 0.405],
    [1.18, 0.404],
    [0.62, 0.393],
    [0, 0.387],
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
        vec2 injectionPlane = vec2(vInjectionLocalPosition.x * 0.985, vInjectionLocalPosition.z * 1.015);
        float injectionRadius = length(injectionPlane);
        if (injectionRadius > uFillRadius) discard;`,
      );
  };

  material.customProgramCacheKey = () => 'tpt-cap-radial-injection-fill-v3';
  material.needsUpdate = true;
  return fillRadius;
}

export default function RealisticCap({ progressRef }) {
  const groupRef = useRef();
  const ribsRef = useRef();
  const shadowRef = useRef();
  const tightShadowRef = useRef();
  const flowFrontRef = useRef();
  const gatePoolRef = useRef();

  const mouldTexture = useMemo(() => createMouldTexture(), []);
  const roughnessTexture = useMemo(() => createRoughnessTexture(), []);
  const shadowTexture = useMemo(() => createShadowTexture(), []);
  const bodyGeometry = useMemo(() => createCapBodyGeometry(), []);
  const ribGeometry = useMemo(
    () => new RoundedBoxGeometry(0.046, 0.468, 0.096, 3, 0.014),
    [],
  );

  const hotBodyColor = useMemo(() => new THREE.Color('#2a73c4'), []);
  const warmBodyColor = useMemo(() => new THREE.Color('#215fab'), []);
  const solidBodyColor = useMemo(() => new THREE.Color('#154e98'), []);
  const heroBodyColor = useMemo(() => new THREE.Color('#174a8e'), []);

  const bodyMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: hotBodyColor.clone(),
    metalness: 0,
    roughness: 0.17,
    roughnessMap: roughnessTexture,
    clearcoat: 0.86,
    clearcoatRoughness: 0.1,
    ior: 1.47,
    specularIntensity: 0.62,
    specularColor: new THREE.Color('#c8dff4'),
    sheen: 0.018,
    sheenRoughness: 0.76,
    sheenColor: new THREE.Color('#2d67a8'),
    bumpMap: mouldTexture,
    bumpScale: 0.0008,
    envMapIntensity: 0.9,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    depthTest: true,
  }), [hotBodyColor, mouldTexture, roughnessTexture]);

  const fillRadiusUniform = useMemo(() => addRadialFillMask(bodyMaterial), [bodyMaterial]);

  const ribMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#123f7d',
    metalness: 0,
    roughness: 0.31,
    roughnessMap: roughnessTexture,
    clearcoat: 0.34,
    clearcoatRoughness: 0.21,
    ior: 1.47,
    specularIntensity: 0.43,
    specularColor: new THREE.Color('#9fbede'),
    bumpMap: mouldTexture,
    bumpScale: 0.0011,
    envMapIntensity: 0.67,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), [mouldTexture, roughnessTexture]);

  const topFinishMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#174b90',
    metalness: 0,
    roughness: 0.43,
    roughnessMap: roughnessTexture,
    clearcoat: 0.16,
    clearcoatRoughness: 0.31,
    ior: 1.47,
    specularIntensity: 0.4,
    specularColor: new THREE.Color('#adc9e6'),
    bumpMap: mouldTexture,
    bumpScale: 0.00135,
    envMapIntensity: 0.61,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), [mouldTexture, roughnessTexture]);

  const detailMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0d356b',
    metalness: 0,
    roughness: 0.5,
    clearcoat: 0.1,
    clearcoatRoughness: 0.43,
    ior: 1.47,
    specularIntensity: 0.25,
    envMapIntensity: 0.43,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), []);

  const highlightMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1a5aa7',
    metalness: 0,
    roughness: 0.34,
    clearcoat: 0.28,
    clearcoatRoughness: 0.25,
    ior: 1.47,
    specularIntensity: 0.43,
    specularColor: new THREE.Color('#c5d9ef'),
    envMapIntensity: 0.67,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), []);

  const moltenFrontMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#3982d1',
    metalness: 0,
    roughness: 0.11,
    clearcoat: 0.98,
    clearcoatRoughness: 0.06,
    ior: 1.47,
    specularIntensity: 0.74,
    specularColor: new THREE.Color('#e1effb'),
    envMapIntensity: 1.04,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), []);

  const shadowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#000000',
    map: shadowTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  }), [shadowTexture]);

  const tightShadowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#000000',
    map: shadowTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  }), [shadowTexture]);

  useEffect(() => {
    const mesh = ribsRef.current;
    if (!mesh) return;

    const helper = new THREE.Object3D();
    const ribCount = 120;

    for (let i = 0; i < ribCount; i += 1) {
      const angle = (i / ribCount) * TAU;
      const machiningVariation = 1 + Math.sin(angle * 11) * 0.012;
      helper.position.set(
        Math.cos(angle) * 2.518,
        -0.057,
        Math.sin(angle) * 2.518,
      );
      helper.rotation.set(0, Math.PI * 0.5 - angle, 0);
      helper.scale.set(machiningVariation, 1, 1);
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
    shadowTexture.dispose();
    bodyMaterial.dispose();
    ribMaterial.dispose();
    topFinishMaterial.dispose();
    detailMaterial.dispose();
    highlightMaterial.dispose();
    moltenFrontMaterial.dispose();
    shadowMaterial.dispose();
    tightShadowMaterial.dispose();
  }, [
    bodyGeometry,
    ribGeometry,
    mouldTexture,
    roughnessTexture,
    shadowTexture,
    bodyMaterial,
    ribMaterial,
    topFinishMaterial,
    detailMaterial,
    highlightMaterial,
    moltenFrontMaterial,
    shadowMaterial,
    tightShadowMaterial,
  ]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const p = progressRef.current;
    const injection = range(p, 0.405, 0.595);
    const radialProgress = Math.sqrt(injection);
    const fillRadius = THREE.MathUtils.lerp(0.025, 2.67, radialProgress);
    fillRadiusUniform.value = fillRadius;

    const outerFill = range(p, 0.545, 0.625);
    const cooling = range(p, 0.575, 0.755);
    const surfaceLock = range(p, 0.64, 0.785);
    const shrink = range(p, 0.665, 0.795);
    const ejection = range(p, 0.785, 0.845);
    const hero = range(p, 0.82, 0.92);
    const heroSettle = range(p, 0.88, 0.965);
    const injectionActivity = range(p, 0.392, 0.43) * (1 - range(p, 0.585, 0.655));

    const firstCool = clamp01(cooling / 0.56);
    const finalCool = clamp01((cooling - 0.56) / 0.44);
    if (cooling <= 0.56) {
      bodyMaterial.color.lerpColors(hotBodyColor, warmBodyColor, firstCool);
    } else {
      bodyMaterial.color.lerpColors(warmBodyColor, solidBodyColor, finalCool);
      bodyMaterial.color.lerp(heroBodyColor, hero * 0.42);
    }

    bodyMaterial.roughness = THREE.MathUtils.lerp(0.17, 0.4, cooling);
    bodyMaterial.clearcoat = THREE.MathUtils.lerp(0.86, 0.22, cooling);
    bodyMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.1, 0.3, cooling);
    bodyMaterial.envMapIntensity = THREE.MathUtils.lerp(0.9, 0.63, cooling);
    bodyMaterial.specularIntensity = THREE.MathUtils.lerp(0.62, 0.42, cooling);
    bodyMaterial.bumpScale = THREE.MathUtils.lerp(0.0008, 0.00165, surfaceLock);

    ribMaterial.opacity = outerFill * range(p, 0.565, 0.65);
    ribMaterial.roughness = THREE.MathUtils.lerp(0.31, 0.47, cooling);
    ribMaterial.clearcoat = THREE.MathUtils.lerp(0.34, 0.13, cooling);
    ribMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.21, 0.37, cooling);
    ribMaterial.bumpScale = THREE.MathUtils.lerp(0.0011, 0.00185, surfaceLock);

    const detailReveal = outerFill * range(p, 0.61, 0.72);
    detailMaterial.opacity = detailReveal;
    highlightMaterial.opacity = outerFill * range(p, 0.585, 0.69) * (1 - hero * 0.18);
    topFinishMaterial.opacity = outerFill * range(p, 0.635, 0.76) * (0.82 + hero * 0.18);

    const baseShadow = range(p, 0.59, 0.72);
    shadowMaterial.opacity = baseShadow * THREE.MathUtils.lerp(0.31, 0.46, surfaceLock) * (1 - ejection * 0.12);
    tightShadowMaterial.opacity = baseShadow * surfaceLock * THREE.MathUtils.lerp(0.18, 0.36, heroSettle);

    group.visible = p > 0.397;
    const ejectionLift = ejection * 0.055;
    const heroLift = THREE.MathUtils.lerp(ejectionLift, 0.022, heroSettle);
    group.position.y = THREE.MathUtils.damp(group.position.y, heroLift, 5.3, delta);

    const shrinkXZ = THREE.MathUtils.lerp(1, 0.992, shrink);
    const shrinkY = THREE.MathUtils.lerp(1, 0.996, shrink);
    group.scale.x = THREE.MathUtils.damp(group.scale.x, shrinkXZ, 5.2, delta);
    group.scale.y = THREE.MathUtils.damp(group.scale.y, shrinkY, 5.2, delta);
    group.scale.z = THREE.MathUtils.damp(group.scale.z, shrinkXZ, 5.2, delta);

    // Hero movement is a single controlled inspection turn, not endless rotation.
    const scrollTurn = range(p, 0.82, 0.95) * 0.082;
    const inspectionDrift = Math.sin(clock.getElapsedTime() * 0.18) * 0.0026 * heroSettle;
    const targetRotation = scrollTurn + inspectionDrift + ejection * 0.01 * (1 - hero);
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetRotation, 3.8, delta);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, hero * -0.004, 4.2, delta);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, 0, 4.2, delta);

    if (flowFrontRef.current) {
      const frontVisible = injectionActivity * (1 - range(injection, 0.94, 1));
      const wobbleX = 1 + Math.sin(clock.getElapsedTime() * 0.52) * 0.014;
      const wobbleZ = 1 + Math.cos(clock.getElapsedTime() * 0.47) * 0.011;
      flowFrontRef.current.visible = frontVisible > 0.003 && fillRadius > 0.12;
      flowFrontRef.current.scale.set(
        Math.max(0.08, fillRadius * wobbleX),
        Math.max(0.08, fillRadius * wobbleZ),
        1,
      );
      flowFrontRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.16) * 0.012;
      moltenFrontMaterial.opacity = frontVisible * 0.42;
    }

    if (gatePoolRef.current) {
      const gateVisible = injectionActivity * (1 - range(p, 0.59, 0.66));
      gatePoolRef.current.visible = gateVisible > 0.003;
      const gatePulse = 1 + Math.sin(clock.getElapsedTime() * 0.7) * 0.03 * gateVisible;
      gatePoolRef.current.scale.set(gatePulse, 1, gatePulse);
    }

    if (shadowRef.current) {
      const shadowScale = 1.03 - surfaceLock * 0.055 - hero * 0.028;
      shadowRef.current.scale.setScalar(shadowScale);
    }
    if (tightShadowRef.current) {
      tightShadowRef.current.scale.setScalar(0.88 + heroSettle * 0.05);
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

      {/* Fine top-surface finish: a separate skin avoids an unrealistically perfect CG disc. */}
      <mesh
        position={[0, 0.412, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={topFinishMaterial}
      >
        <circleGeometry args={[2.17, 128]} />
      </mesh>

      {/* Tooling witness rings and a restrained shoulder highlight. */}
      <mesh position={[0, 0.414, 0]} rotation={[Math.PI / 2, 0, 0]} material={highlightMaterial}>
        <torusGeometry args={[2.245, 0.022, 8, 144]} />
      </mesh>
      <mesh position={[0, 0.416, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[1.82, 0.0085, 6, 128]} />
      </mesh>
      <mesh position={[0, 0.417, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[1.08, 0.0055, 6, 112]} />
      </mesh>
      <mesh position={[0, -0.318, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[2.507, 0.008, 6, 144]} />
      </mesh>

      {/* Gate witness is deliberately tiny and matte. */}
      <mesh position={[0, 0.417, 0]} material={detailMaterial}>
        <cylinderGeometry args={[0.047, 0.047, 0.007, 36]} />
      </mesh>

      {/* Lower sealing edge, barely visible from the hero camera. */}
      <mesh position={[0, -0.398, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[2.28, 0.043, 8, 128]} />
      </mesh>

      <mesh
        ref={flowFrontRef}
        position={[0, 0.414, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={moltenFrontMaterial}
        visible={false}
        renderOrder={5}
      >
        <torusGeometry args={[1, 0.012, 6, 128]} />
      </mesh>

      <mesh
        ref={gatePoolRef}
        position={[0, 0.405, 0]}
        material={moltenFrontMaterial}
        visible={false}
        renderOrder={5}
      >
        <cylinderGeometry args={[0.105, 0.105, 0.018, 40]} />
      </mesh>

      {/* Broad and tight contact shadows keep the cap grounded after ejection. */}
      <mesh
        ref={shadowRef}
        position={[0, -0.485, 0.06]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={-1}
      >
        <planeGeometry args={[6.25, 6.25]} />
      </mesh>
      <mesh
        ref={tightShadowRef}
        position={[0, -0.477, 0.025]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={tightShadowMaterial}
        renderOrder={-1}
      >
        <planeGeometry args={[3.45, 3.45]} />
      </mesh>
    </group>
  );
}
