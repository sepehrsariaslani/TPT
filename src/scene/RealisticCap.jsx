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
      const broad = Math.sin(nx * TAU * 4 + ny * 3.2) * 1.7;
      const fine = Math.sin(nx * TAU * 18 - ny * 13) * 0.7;
      const grain = (random() - 0.5) * 4.2;
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
  texture.repeat.set(5.5, 3.25);
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
      const a = Math.pow(Math.max(0, 1 - d), 2.6);
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
  const profile = [
    [0, -0.405],
    [2.30, -0.405],
    [2.405, -0.385],
    [2.475, -0.335],
    [2.515, -0.245],
    [2.522, 0.155],
    [2.505, 0.235],
    [2.465, 0.305],
    [2.385, 0.355],
    [2.255, 0.392],
    [1.92, 0.404],
    [0.72, 0.386],
    [0, 0.378],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));

  const geometry = new THREE.LatheGeometry(profile, 144);
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
        // Centre-gated cavity fill: the product is physically revealed from the
        // gate outwards instead of fading in as a complete pre-existing mesh.
        vec2 injectionPlane = vec2(vInjectionLocalPosition.x * 0.985, vInjectionLocalPosition.z * 1.015);
        float injectionRadius = length(injectionPlane);
        if (injectionRadius > uFillRadius) discard;`,
      );
  };

  material.customProgramCacheKey = () => 'tpt-cap-radial-injection-fill-v2';
  material.needsUpdate = true;
  return fillRadius;
}

export default function RealisticCap({ progressRef }) {
  const groupRef = useRef();
  const ribsRef = useRef();
  const shadowRef = useRef();
  const flowFrontRef = useRef();
  const gatePoolRef = useRef();

  const mouldTexture = useMemo(() => createMouldTexture(), []);
  const shadowTexture = useMemo(() => createShadowTexture(), []);
  const bodyGeometry = useMemo(() => createCapBodyGeometry(), []);
  const ribGeometry = useMemo(
    () => new RoundedBoxGeometry(0.052, 0.475, 0.105, 2, 0.016),
    [],
  );

  const hotBodyColor = useMemo(() => new THREE.Color('#2a73c4'), []);
  const solidBodyColor = useMemo(() => new THREE.Color('#154e98'), []);

  const bodyMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: hotBodyColor.clone(),
    metalness: 0,
    roughness: 0.17,
    clearcoat: 0.86,
    clearcoatRoughness: 0.1,
    ior: 1.47,
    specularIntensity: 0.62,
    specularColor: new THREE.Color('#c8dff4'),
    sheen: 0.025,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color('#2d67a8'),
    bumpMap: mouldTexture,
    bumpScale: 0.0017,
    envMapIntensity: 0.9,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    depthTest: true,
  }), [hotBodyColor, mouldTexture]);

  const fillRadiusUniform = useMemo(() => addRadialFillMask(bodyMaterial), [bodyMaterial]);

  const ribMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#123f7d',
    metalness: 0,
    roughness: 0.43,
    clearcoat: 0.22,
    clearcoatRoughness: 0.32,
    ior: 1.47,
    specularIntensity: 0.4,
    specularColor: new THREE.Color('#9fbede'),
    bumpMap: mouldTexture,
    bumpScale: 0.0019,
    envMapIntensity: 0.62,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), [mouldTexture]);

  const detailMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0d356b',
    metalness: 0,
    roughness: 0.48,
    clearcoat: 0.12,
    clearcoatRoughness: 0.4,
    ior: 1.47,
    specularIntensity: 0.28,
    envMapIntensity: 0.46,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  }), []);

  const highlightMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1a5aa7',
    metalness: 0,
    roughness: 0.3,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
    ior: 1.47,
    specularIntensity: 0.5,
    specularColor: new THREE.Color('#c5d9ef'),
    envMapIntensity: 0.76,
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

  useEffect(() => {
    const mesh = ribsRef.current;
    if (!mesh) return;

    const helper = new THREE.Object3D();
    const ribCount = 120;

    for (let i = 0; i < ribCount; i += 1) {
      const angle = (i / ribCount) * TAU;
      helper.position.set(
        Math.cos(angle) * 2.525,
        -0.055,
        Math.sin(angle) * 2.525,
      );
      helper.rotation.set(0, Math.PI * 0.5 - angle, 0);
      helper.scale.set(1, 1, 1);
      helper.updateMatrix();
      mesh.setMatrixAt(i, helper.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => () => {
    bodyGeometry.dispose();
    ribGeometry.dispose();
    mouldTexture.dispose();
    shadowTexture.dispose();
    bodyMaterial.dispose();
    ribMaterial.dispose();
    detailMaterial.dispose();
    highlightMaterial.dispose();
    moltenFrontMaterial.dispose();
    shadowMaterial.dispose();
  }, [
    bodyGeometry,
    ribGeometry,
    mouldTexture,
    shadowTexture,
    bodyMaterial,
    ribMaterial,
    detailMaterial,
    highlightMaterial,
    moltenFrontMaterial,
    shadowMaterial,
  ]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const p = progressRef.current;

    // Stage 03 — Injection / cavity fill. Area growth is approximately linear,
    // therefore radius follows sqrt(fill). That makes the front feel materially
    // plausible instead of moving at a constant, synthetic radial speed.
    const injection = range(p, 0.405, 0.595);
    const radialProgress = Math.sqrt(injection);
    const fillRadius = THREE.MathUtils.lerp(0.025, 2.67, radialProgress);
    fillRadiusUniform.value = fillRadius;

    const outerFill = range(p, 0.545, 0.625);
    const cooling = range(p, 0.575, 0.745);
    const settle = range(p, 0.68, 0.8);
    const injectionActivity = range(p, 0.392, 0.43) * (1 - range(p, 0.585, 0.655));

    // Molten polymer transitions into the final moulded surface rather than the
    // cap changing opacity. Highlights calm down as the part cools and solidifies.
    bodyMaterial.color.lerpColors(hotBodyColor, solidBodyColor, cooling);
    bodyMaterial.roughness = THREE.MathUtils.lerp(0.17, 0.34, cooling);
    bodyMaterial.clearcoat = THREE.MathUtils.lerp(0.86, 0.34, cooling);
    bodyMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.1, 0.24, cooling);
    bodyMaterial.envMapIntensity = THREE.MathUtils.lerp(0.9, 0.72, cooling);

    ribMaterial.opacity = outerFill;
    detailMaterial.opacity = outerFill;
    highlightMaterial.opacity = outerFill;
    shadowMaterial.opacity = range(p, 0.59, 0.72) * 0.48;

    group.visible = p > 0.397;
    group.position.y = THREE.MathUtils.damp(group.position.y, 0, 5.4, delta);
    group.scale.x = THREE.MathUtils.damp(group.scale.x, 1, 5.1, delta);
    group.scale.y = THREE.MathUtils.damp(group.scale.y, 1, 5.1, delta);
    group.scale.z = THREE.MathUtils.damp(group.scale.z, 1, 5.1, delta);

    // A tiny studio turn begins only after the fill front has completed and the
    // surface has substantially cooled. During injection the moulded part is still.
    const finalTurn = clock.getElapsedTime() * 0.0055 * settle;
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      settle * (p * 0.12 + finalTurn),
      4,
      delta,
    );
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, 0, 4, delta);

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
      gatePoolRef.current.visible = injectionActivity > 0.003;
      const gatePulse = 1 + Math.sin(clock.getElapsedTime() * 0.7) * 0.035 * injectionActivity;
      gatePoolRef.current.scale.set(gatePulse, 1, gatePulse);
    }

    if (shadowRef.current) {
      shadowRef.current.scale.setScalar(0.94 + cooling * 0.06);
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

      <mesh position={[0, 0.385, 0]} rotation={[Math.PI / 2, 0, 0]} material={highlightMaterial}>
        <torusGeometry args={[2.245, 0.026, 8, 128]} />
      </mesh>
      <mesh position={[0, 0.383, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[1.82, 0.0105, 6, 112]} />
      </mesh>
      <mesh position={[0, -0.318, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[2.507, 0.009, 6, 128]} />
      </mesh>

      <mesh position={[0, 0.382, 0]} material={detailMaterial}>
        <cylinderGeometry args={[0.052, 0.052, 0.009, 32]} />
      </mesh>

      <mesh position={[0, -0.398, 0]} rotation={[Math.PI / 2, 0, 0]} material={detailMaterial}>
        <torusGeometry args={[2.28, 0.045, 8, 112]} />
      </mesh>

      {/* A very subtle wet flow front marks the leading edge of cavity filling. */}
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

      {/* Centre gate pool: small enough to read as a material source, not a glow effect. */}
      <mesh
        ref={gatePoolRef}
        position={[0, 0.405, 0]}
        material={moltenFrontMaterial}
        visible={false}
        renderOrder={5}
      >
        <cylinderGeometry args={[0.105, 0.105, 0.018, 40]} />
      </mesh>

      <mesh
        ref={shadowRef}
        position={[0, -0.485, 0.06]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={-1}
      >
        <planeGeometry args={[6.25, 6.25]} />
      </mesh>
    </group>
  );
}
