import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

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

function makeFallCurve(index, amount, random) {
  const points = [];
  const base = (index / amount) * TAU + (random() - 0.5) * 0.18;
  const lean = (random() - 0.5) * 0.22;

  for (let step = 0; step <= 110; step += 1) {
    const t = step / 110;
    const radius = 1.0
      + (1 - t) * (3.0 + random() * 0.18)
      + Math.sin(t * Math.PI) * 0.52;
    const angle = base
      + Math.sin(t * Math.PI * 1.58 + index * 0.61) * 0.18
      + lean * t;
    const micro = Math.sin(t * TAU * 3.2 + index) * 0.035;

    points.push(new THREE.Vector3(
      Math.cos(angle) * (radius + micro),
      9.0 - t * 17.2,
      Math.sin(angle) * (radius + micro) * 0.72,
    ));
  }

  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.28);
}

function makeVortexCurve(index, amount, random, inner = false) {
  const points = [];
  const base = (index / amount) * TAU + (random() - 0.5) * 0.15;
  const turns = inner ? 6.8 + random() * 0.7 : 5.55 + random() * 0.8;
  const wobblePhase = random() * TAU;

  for (let step = 0; step <= 140; step += 1) {
    const t = step / 140;
    const angle = base + t * TAU * turns;
    const middlePinch = Math.exp(-Math.pow((t - 0.56) / 0.22, 2));
    const radius = inner
      ? 2.0 - t * 0.62 + Math.sin(t * TAU * 3.6 + wobblePhase) * 0.08
      : 4.58 - t * 1.82 - middlePinch * 0.18
        + Math.sin(t * TAU * 2.35 + wobblePhase) * 0.13
        + Math.sin(t * TAU * 7.1 + index) * 0.035;

    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      5.75 - t * 10.35,
      Math.sin(angle) * radius * (inner ? 0.87 : 0.82),
    ));
  }

  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.24);
}

function makeReleaseCurve(index, amount, random) {
  const points = [];
  const base = (index / amount) * TAU + (random() - 0.5) * 0.2;
  const turns = 5.4 + random() * 1.2;

  for (let step = 0; step <= 120; step += 1) {
    const t = step / 120;
    const angle = base + t * TAU * turns;
    const radius = 2.55 + t * 2.7 + Math.sin(t * TAU * 3.4 + index) * 0.11;

    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      1.65 - t * 8.2,
      Math.sin(angle) * radius * 0.83,
    ));
  }

  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.26);
}

function buildBundle({ kind, amount, seed, inner = false }) {
  const random = seededRandom(seed);
  const bundle = [];

  for (let index = 0; index < amount; index += 1) {
    const curve = kind === 'fall'
      ? makeFallCurve(index, amount, random)
      : kind === 'release'
        ? makeReleaseCurve(index, amount, random)
        : makeVortexCurve(index, amount, random, inner);

    const coreRadius = inner
      ? 0.008 + random() * 0.004
      : kind === 'fall'
        ? 0.007 + random() * 0.003
        : 0.009 + random() * 0.004;

    const haloRadius = coreRadius * (inner ? 3.1 : 3.7);
    const veilRadius = coreRadius * (inner ? 5.3 : 6.4);

    bundle.push({
      core: new THREE.TubeGeometry(curve, 150, coreRadius, 5, false),
      halo: new THREE.TubeGeometry(curve, 150, haloRadius, 5, false),
      veil: new THREE.TubeGeometry(curve, 150, veilRadius, 4, false),
      phase: random() * TAU,
      speed: 0.7 + random() * 0.75,
      brightness: 0.65 + random() * 0.55,
    });
  }

  return bundle;
}

function FilamentBundle({ bundle, materials, prefix }) {
  return bundle.map((item, index) => (
    <group key={`${prefix}-${index}`}>
      <mesh geometry={item.veil} material={materials.veil} />
      <mesh geometry={item.halo} material={materials.halo} />
      <mesh geometry={item.core} material={materials.core} />
    </group>
  ));
}

function makeMaterials(coreColor, haloColor) {
  const core = new THREE.MeshBasicMaterial({
    color: coreColor,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.MeshBasicMaterial({
    color: haloColor,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const veil = new THREE.MeshBasicMaterial({
    color: '#1f55c8',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  return { core, halo, veil };
}

/**
 * Layered filament system for the storm/vortex transition.
 * Every visible line is actually three nested tubes: sharp core, soft halo and
 * a much wider faint veil. That lets post-processing bloom feel optical rather
 * than like a single neon wire.
 */
export default function VortexSystem({ progressRef }) {
  const fallRef = useRef();
  const stormRef = useRef();
  const innerRef = useRef();
  const releaseRef = useRef();

  const fallBundle = useMemo(() => buildBundle({ kind: 'fall', amount: 22, seed: 41 }), []);
  const stormBundle = useMemo(() => buildBundle({ kind: 'vortex', amount: 24, seed: 82 }), []);
  const innerBundle = useMemo(() => buildBundle({ kind: 'vortex', amount: 10, seed: 128, inner: true }), []);
  const releaseBundle = useMemo(() => buildBundle({ kind: 'release', amount: 18, seed: 208 }), []);

  const fallMaterials = useMemo(() => makeMaterials('#7eb8ff', '#347eff'), []);
  const stormMaterials = useMemo(() => makeMaterials('#9dccff', '#4a8fff'), []);
  const innerMaterials = useMemo(() => makeMaterials('#c1e1ff', '#5da4ff'), []);
  const releaseMaterials = useMemo(() => makeMaterials('#89c0ff', '#377eff'), []);

  useEffect(() => () => {
    [fallBundle, stormBundle, innerBundle, releaseBundle].flat().forEach((item) => {
      item.core.dispose();
      item.halo.dispose();
      item.veil.dispose();
    });
    [fallMaterials, stormMaterials, innerMaterials, releaseMaterials].forEach((set) => {
      set.core.dispose();
      set.halo.dispose();
      set.veil.dispose();
    });
  }, [fallBundle, fallMaterials, innerBundle, innerMaterials, releaseBundle, releaseMaterials, stormBundle, stormMaterials]);

  useFrame(({ clock }) => {
    const p = progressRef.current;
    const time = clock.getElapsedTime();

    const fallVisibility = 1 - range(p, 0.12, 0.31);
    const stormIn = range(p, 0.11, 0.26);
    const stormOut = range(p, 0.54, 0.7);
    const stormVisibility = stormIn * (1 - stormOut);
    const innerVisibility = range(p, 0.21, 0.35) * (1 - range(p, 0.53, 0.67));
    const releaseVisibility = range(p, 0.665, 0.78) * (1 - range(p, 0.9, 1.0));

    fallMaterials.core.opacity = fallVisibility * 0.24;
    fallMaterials.halo.opacity = fallVisibility * 0.075;
    fallMaterials.veil.opacity = fallVisibility * 0.018;

    stormMaterials.core.opacity = stormVisibility * 0.36;
    stormMaterials.halo.opacity = stormVisibility * 0.12;
    stormMaterials.veil.opacity = stormVisibility * 0.026;

    innerMaterials.core.opacity = innerVisibility * 0.42;
    innerMaterials.halo.opacity = innerVisibility * 0.14;
    innerMaterials.veil.opacity = innerVisibility * 0.03;

    releaseMaterials.core.opacity = releaseVisibility * 0.3;
    releaseMaterials.halo.opacity = releaseVisibility * 0.095;
    releaseMaterials.veil.opacity = releaseVisibility * 0.022;

    if (fallRef.current) {
      fallRef.current.rotation.y = time * 0.012 + p * 0.12;
      fallRef.current.rotation.z = Math.sin(time * 0.17) * 0.006;
    }
    if (stormRef.current) {
      stormRef.current.rotation.y = time * 0.048 + p * 0.92;
      stormRef.current.rotation.z = Math.sin(time * 0.24) * 0.008;
      stormRef.current.scale.setScalar(0.985 + Math.sin(time * 0.16) * 0.01);
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -time * 0.072 + p * 1.22;
      innerRef.current.scale.setScalar(0.96 + innerVisibility * 0.04);
    }
    if (releaseRef.current) {
      releaseRef.current.rotation.y = -time * 0.035 + p * 0.68;
    }
  });

  return (
    <>
      <group ref={fallRef}>
        <FilamentBundle bundle={fallBundle} materials={fallMaterials} prefix="fall" />
      </group>
      <group ref={stormRef}>
        <FilamentBundle bundle={stormBundle} materials={stormMaterials} prefix="storm" />
      </group>
      <group ref={innerRef}>
        <FilamentBundle bundle={innerBundle} materials={innerMaterials} prefix="inner" />
      </group>
      <group ref={releaseRef}>
        <FilamentBundle bundle={releaseBundle} materials={releaseMaterials} prefix="release" />
      </group>
    </>
  );
}
