import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function seededRandom(seed = 1337) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function qualityScale() {
  if (typeof window === 'undefined') return 0.85;
  const cores = navigator.hardwareConcurrency || 6;
  if (window.innerWidth < 680) return cores <= 4 ? 0.52 : 0.65;
  if (window.innerWidth < 1100) return 0.78;
  return cores <= 4 ? 0.82 : 1;
}

function makeCurve(kind, index, amount, random) {
  const points = [];
  const base = (index / amount) * TAU + (random() - 0.5) * 0.16;
  const steps = kind === 'storm' || kind === 'inner' ? 88 : 70;

  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;

    if (kind === 'fall') {
      const drift = Math.sin(t * Math.PI * 1.7 + index * 0.53) * 0.18;
      const r = 0.35 + (index % 5) * 0.22 + Math.sin(t * TAU * 2.1 + index) * 0.035;
      const angle = base + drift;
      points.push(new THREE.Vector3(
        Math.cos(angle) * r,
        9.2 - t * 17.4,
        Math.sin(angle) * r * 0.76,
      ));
    } else if (kind === 'orbit') {
      const band = index % 8;
      const radius = 1.15 + band * 0.43 + Math.sin(t * TAU * 2.0 + index) * 0.055;
      const angle = base + t * TAU * (1.85 + (band % 3) * 0.18);
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        0.64 + (band - 3.5) * 0.055 + Math.sin(t * TAU * 2.0 + index) * 0.045,
        Math.sin(angle) * radius * 0.74,
      ));
    } else if (kind === 'form') {
      const radius = 2.85 - t * 0.44 + Math.sin(t * TAU * 2.7 + index) * 0.06;
      const angle = base + t * TAU * (3.45 + (index % 3) * 0.16);
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        1.02 - t * 1.85,
        Math.sin(angle) * radius * 0.82,
      ));
    } else {
      const inner = kind === 'inner';
      const turns = inner ? 6.7 + (index % 3) * 0.2 : 5.55 + (index % 4) * 0.18;
      const angle = base + t * TAU * turns;
      const pinch = Math.exp(-Math.pow((t - 0.62) / 0.22, 2));
      const radius = inner
        ? 2.25 - t * 1.45 + Math.sin(t * TAU * 3.0 + index) * 0.07
        : 4.62 - t * 3.55 - pinch * 0.14
          + Math.sin(t * TAU * 2.45 + index) * 0.11;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        5.3 - t * 9.25,
        Math.sin(angle) * radius * (inner ? 0.88 : 0.82),
      ));
    }
  }

  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.25);
}

function mergeTubeLayer(curves, radius, tubularSegments, radialSegments) {
  const parts = curves.map((curve) => new THREE.TubeGeometry(
    curve,
    tubularSegments,
    radius,
    radialSegments,
    false,
  ));
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
}

function buildBundle(kind, amount, seed, scale = 1) {
  const random = seededRandom(seed);
  const count = Math.max(3, Math.round(amount * scale));
  const curves = [];
  for (let index = 0; index < count; index += 1) {
    curves.push(makeCurve(kind, index, count, random));
  }

  const baseRadius = kind === 'fall' ? 0.008 : kind === 'orbit' ? 0.009 : kind === 'form' ? 0.01 : 0.011;
  const core = mergeTubeLayer(curves, baseRadius, kind === 'storm' || kind === 'inner' ? 84 : 68, 4);
  const halo = mergeTubeLayer(curves, baseRadius * 3.8, kind === 'storm' || kind === 'inner' ? 58 : 48, 3);
  const veil = mergeTubeLayer(curves, baseRadius * 7.2, kind === 'storm' || kind === 'inner' ? 42 : 36, 3);

  return { core, halo, veil };
}

function makeMaterials(coreColor, haloColor, veilColor = '#1d55cb') {
  return {
    core: new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    halo: new THREE.MeshBasicMaterial({
      color: haloColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    veil: new THREE.MeshBasicMaterial({
      color: veilColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  };
}

function Bundle({ geometry, materials }) {
  return (
    <>
      <mesh geometry={geometry.veil} material={materials.veil} />
      <mesh geometry={geometry.halo} material={materials.halo} />
      <mesh geometry={geometry.core} material={materials.core} />
    </>
  );
}

function StormSparks({ progressRef }) {
  const ref = useRef();
  const geometry = useMemo(() => {
    const random = seededRandom(4401);
    const count = typeof window !== 'undefined' && window.innerWidth < 680 ? 320 : 620;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      const t = random();
      const angle = random() * TAU + t * TAU * 5.6;
      const radius = 4.5 - t * 3.45 + (random() - 0.5) * 0.5;
      const i3 = i * 3;
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = 5.25 - t * 9.15 + (random() - 0.5) * 0.5;
      positions[i3 + 2] = Math.sin(angle) * radius * 0.82;
      color.set(random() > 0.8 ? '#b9dcff' : '#4b94ff');
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    next.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return next;
  }, []);

  const material = useMemo(() => new THREE.PointsMaterial({
    size: 0.032,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), []);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const p = progressRef.current;
    const visibility = range(p, 0.25, 0.39) * (1 - range(p, 0.66, 0.8));
    material.opacity = visibility * 0.72;
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.085 + p * 0.7;
    }
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}

export default function VortexSystem({ progressRef }) {
  const fallRef = useRef();
  const orbitRef = useRef();
  const stormRef = useRef();
  const innerRef = useRef();
  const formRef = useRef();
  const scale = useMemo(qualityScale, []);

  const fallGeometry = useMemo(() => buildBundle('fall', 18, 41, scale), [scale]);
  const orbitGeometry = useMemo(() => buildBundle('orbit', 14, 81, scale), [scale]);
  const stormGeometry = useMemo(() => buildBundle('storm', 18, 121, scale), [scale]);
  const innerGeometry = useMemo(() => buildBundle('inner', 8, 161, scale), [scale]);
  const formGeometry = useMemo(() => buildBundle('form', 11, 201, scale), [scale]);

  const fallMaterials = useMemo(() => makeMaterials('#9bcaff', '#3e82ff', '#174ba7'), []);
  const orbitMaterials = useMemo(() => makeMaterials('#a8d2ff', '#4b96ff', '#1c5ac9'), []);
  const stormMaterials = useMemo(() => makeMaterials('#c0e0ff', '#5ea7ff', '#245fd4'), []);
  const innerMaterials = useMemo(() => makeMaterials('#d9ecff', '#7bbaff', '#2a68da'), []);
  const formMaterials = useMemo(() => makeMaterials('#c9e5ff', '#5da6ff', '#235fd2'), []);

  useEffect(() => () => {
    [fallGeometry, orbitGeometry, stormGeometry, innerGeometry, formGeometry].forEach((bundle) => {
      bundle.core?.dispose();
      bundle.halo?.dispose();
      bundle.veil?.dispose();
    });
    [fallMaterials, orbitMaterials, stormMaterials, innerMaterials, formMaterials].forEach((set) => {
      set.core.dispose();
      set.halo.dispose();
      set.veil.dispose();
    });
  }, [fallGeometry, fallMaterials, formGeometry, formMaterials, innerGeometry, innerMaterials, orbitGeometry, orbitMaterials, stormGeometry, stormMaterials]);

  useFrame(({ clock }) => {
    const p = progressRef.current;
    const time = clock.getElapsedTime();

    const fall = 1 - range(p, 0.14, 0.31);
    const orbit = range(p, 0.1, 0.23) * (1 - range(p, 0.34, 0.49));
    const storm = range(p, 0.28, 0.4) * (1 - range(p, 0.59, 0.76));
    const inner = range(p, 0.34, 0.45) * (1 - range(p, 0.61, 0.75));
    const form = range(p, 0.51, 0.62) * (1 - range(p, 0.75, 0.9));

    fallMaterials.core.opacity = fall * 0.26;
    fallMaterials.halo.opacity = fall * 0.09;
    fallMaterials.veil.opacity = fall * 0.025;

    orbitMaterials.core.opacity = orbit * 0.38;
    orbitMaterials.halo.opacity = orbit * 0.15;
    orbitMaterials.veil.opacity = orbit * 0.052;

    stormMaterials.core.opacity = storm * 0.48;
    stormMaterials.halo.opacity = storm * 0.19;
    stormMaterials.veil.opacity = storm * 0.064;

    innerMaterials.core.opacity = inner * 0.56;
    innerMaterials.halo.opacity = inner * 0.22;
    innerMaterials.veil.opacity = inner * 0.072;

    formMaterials.core.opacity = form * 0.44;
    formMaterials.halo.opacity = form * 0.18;
    formMaterials.veil.opacity = form * 0.055;

    if (fallRef.current) {
      fallRef.current.rotation.y = time * 0.012;
      fallRef.current.position.y = -((time * 0.16) % 0.32) * fall;
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.y = time * 0.11 + p * 0.6;
      orbitRef.current.rotation.z = Math.sin(time * 0.2) * 0.01;
    }
    if (stormRef.current) {
      stormRef.current.rotation.y = time * 0.065 + p * 0.95;
      stormRef.current.rotation.z = Math.sin(time * 0.19) * 0.012;
      stormRef.current.scale.setScalar(0.99 + Math.sin(time * 0.16) * 0.012);
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -time * 0.09 + p * 1.18;
      innerRef.current.scale.setScalar(0.96 + inner * 0.045);
    }
    if (formRef.current) {
      formRef.current.rotation.y = time * 0.045 + p * 0.52;
      formRef.current.scale.setScalar(0.96 + form * 0.035);
    }
  });

  return (
    <>
      <group ref={fallRef}><Bundle geometry={fallGeometry} materials={fallMaterials} /></group>
      <group ref={orbitRef}><Bundle geometry={orbitGeometry} materials={orbitMaterials} /></group>
      <group ref={stormRef}><Bundle geometry={stormGeometry} materials={stormMaterials} /></group>
      <group ref={innerRef}><Bundle geometry={innerGeometry} materials={innerMaterials} /></group>
      <group ref={formRef}><Bundle geometry={formGeometry} materials={formMaterials} /></group>
      <StormSparks progressRef={progressRef} />
    </>
  );
}
