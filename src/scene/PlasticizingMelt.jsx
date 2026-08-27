import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function seededRandom(seed = 55291) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createMeltTexture(seed = 411, size = 64) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const broad = Math.sin(nx * TAU * 2.2 + ny * 2.4) * 1.45;
      const streak = Math.sin(nx * TAU * 6.2 - ny * 4.0) * 0.6;
      const grain = (random() - 0.5) * 2.5;
      pixels[y * size + x] = Math.max(0, Math.min(255, 128 + broad + streak + grain));
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
  texture.repeat.set(2.6, 4.2);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function buildBlobData(count) {
  const random = seededRandom(88421);
  return Array.from({ length: count }, () => ({
    t: random(),
    phase: random() * TAU,
    radius: 0.2 + random() * 0.44,
    depth: (random() - 0.5) * 2,
    scale: 0.76 + random() * 0.3,
    delay: random() * 0.05,
  }));
}

function createScrewFlightGeometry(compact) {
  const points = [];
  const turns = 3.25;
  const radius = compact ? 0.27 : 0.33;
  for (let i = 0; i <= 96; i += 1) {
    const t = i / 96;
    const angle = t * TAU * turns;
    const taper = THREE.MathUtils.lerp(1, 0.82, t);
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius * taper,
      THREE.MathUtils.lerp(2.62, 1.12, t),
      Math.sin(angle) * radius * taper,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, 120, compact ? 0.024 : 0.029, 8, false);
}

function createShotGeometry() {
  const profile = [
    [0, -0.56],
    [0.17, -0.55],
    [0.29, -0.45],
    [0.35, -0.24],
    [0.36, 0.19],
    [0.31, 0.42],
    [0.18, 0.54],
    [0, 0.56],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(profile, 64);
  geometry.computeVertexNormals();
  return geometry;
}

export default function PlasticizingMelt({ progressRef }) {
  const { size } = useThree();
  const compact = size.width <= 680;
  const groupRef = useRef();
  const barrelRef = useRef();
  const screwRef = useRef();
  const blobsRef = useRef();
  const shotRef = useRef();
  const heatLightRef = useRef();

  const helper = useMemo(() => new THREE.Object3D(), []);
  const meltTexture = useMemo(() => createMeltTexture(), []);
  const blobData = useMemo(() => buildBlobData(compact ? 58 : 88), [compact]);
  const blobGeometry = useMemo(
    () => new THREE.SphereGeometry(0.145, compact ? 12 : 16, compact ? 8 : 12),
    [compact],
  );
  const screwFlightGeometry = useMemo(() => createScrewFlightGeometry(compact), [compact]);
  const shotGeometry = useMemo(() => createShotGeometry(), []);

  const coolColor = useMemo(() => new THREE.Color('#245f9f'), []);
  const softColor = useMemo(() => new THREE.Color('#1f619f'), []);
  const meltColor = useMemo(() => new THREE.Color('#19588f'), []);

  const blobMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: coolColor.clone(),
    metalness: 0,
    roughness: 0.3,
    clearcoat: 0.28,
    clearcoatRoughness: 0.22,
    ior: 1.47,
    specularIntensity: 0.44,
    specularColor: new THREE.Color('#b8cfe0'),
    bumpMap: meltTexture,
    bumpScale: 0.00125,
    envMapIntensity: 0.7,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), [coolColor, meltTexture]);

  const meltMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: softColor.clone(),
    metalness: 0,
    roughness: 0.23,
    clearcoat: 0.42,
    clearcoatRoughness: 0.16,
    ior: 1.47,
    specularIntensity: 0.49,
    specularColor: new THREE.Color('#c2d6e5'),
    bumpMap: meltTexture,
    bumpScale: 0.0009,
    envMapIntensity: 0.76,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), [meltTexture, softColor]);

  const barrelMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#26343e',
    metalness: 0.52,
    roughness: 0.34,
    clearcoat: 0.04,
    clearcoatRoughness: 0.46,
    specularIntensity: 0.3,
    envMapIntensity: 0.58,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  }), []);

  const bandMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#53626d',
    metalness: 0.68,
    roughness: 0.24,
    specularIntensity: 0.34,
    envMapIntensity: 0.68,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }), []);

  const screwMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#8b969f',
    metalness: 0.76,
    roughness: 0.2,
    specularIntensity: 0.4,
    envMapIntensity: 0.78,
    transparent: true,
    opacity: 0,
    depthWrite: true,
  }), []);

  useEffect(() => {
    if (blobsRef.current) {
      blobsRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      blobsRef.current.renderOrder = 3;
    }
    return () => {
      blobGeometry.dispose();
      screwFlightGeometry.dispose();
      shotGeometry.dispose();
      blobMaterial.dispose();
      meltMaterial.dispose();
      barrelMaterial.dispose();
      bandMaterial.dispose();
      screwMaterial.dispose();
      meltTexture.dispose();
    };
  }, [
    blobGeometry,
    screwFlightGeometry,
    shotGeometry,
    blobMaterial,
    meltMaterial,
    barrelMaterial,
    bandMaterial,
    screwMaterial,
    meltTexture,
  ]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const barrel = barrelRef.current;
    const screw = screwRef.current;
    const blobs = blobsRef.current;
    const shot = shotRef.current;
    if (!group || !barrel || !screw || !blobs || !shot) return;

    const p = progressRef.current;
    const time = clock.getElapsedTime();
    const chamberIn = range(p, 0.19, 0.245);
    const chamberOut = range(p, 0.565, 0.625);
    const chamberVisibility = chamberIn * (1 - chamberOut);
    const soften = range(p, 0.255, 0.35);
    const coalesce = range(p, 0.315, 0.455);
    const accumulate = range(p, 0.365, 0.5);
    const injectionPush = range(p, 0.46, 0.56);
    const handoff = range(p, 0.545, 0.635);
    const materialVisibility = soften * (1 - range(p, 0.605, 0.655));

    group.visible = chamberVisibility > 0.003 || materialVisibility > 0.003;
    if (!group.visible) return;

    barrel.visible = chamberVisibility > 0.003;
    screw.visible = chamberVisibility > 0.003;
    barrelMaterial.opacity = chamberVisibility * 0.15;
    bandMaterial.opacity = chamberVisibility * 0.38;
    screwMaterial.opacity = chamberVisibility * 0.72;

    const screwSpin = range(p, 0.205, 0.29) * (1 - range(p, 0.425, 0.505));
    screw.rotation.y += delta * 0.3 * screwSpin;
    screw.position.y = THREE.MathUtils.damp(
      screw.position.y,
      -0.14 * injectionPush,
      5.4,
      delta,
    );

    blobMaterial.opacity = materialVisibility * THREE.MathUtils.lerp(0.68, 0.14, coalesce);
    meltMaterial.opacity = materialVisibility * accumulate * THREE.MathUtils.lerp(0.34, 0.82, coalesce);
    blobMaterial.color.lerpColors(coolColor, softColor, coalesce);
    meltMaterial.color.lerpColors(softColor, meltColor, injectionPush);
    blobMaterial.roughness = THREE.MathUtils.lerp(0.3, 0.21, coalesce);
    blobMaterial.clearcoat = THREE.MathUtils.lerp(0.28, 0.4, coalesce);
    blobMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.22, 0.15, coalesce);
    meltMaterial.roughness = THREE.MathUtils.lerp(0.23, 0.17, injectionPush);
    meltMaterial.clearcoat = THREE.MathUtils.lerp(0.42, 0.52, injectionPush);
    meltMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.16, 0.12, injectionPush);

    for (let i = 0; i < blobData.length; i += 1) {
      const item = blobData[i];
      const localSoft = range(p, 0.255 + item.delay, 0.355 + item.delay);
      const localMerge = range(p, 0.32 + item.delay * 0.4, 0.465 + item.delay * 0.18);
      const t = clamp01(item.t * 0.9 + 0.05);
      const radialBase = THREE.MathUtils.lerp(compact ? 0.43 : 0.5, compact ? 0.17 : 0.2, t);
      const radial = radialBase * THREE.MathUtils.lerp(1, 0.32, localMerge);
      const angle = item.phase + t * 0.72;
      const pullDown = localMerge * THREE.MathUtils.lerp(0.03, 0.14, 1 - t);

      helper.position.set(
        Math.cos(angle) * radial + item.depth * 0.025 * (1 - localMerge),
        THREE.MathUtils.lerp(2.53, 1.18, t) - pullDown,
        Math.sin(angle) * radial * 0.82 + item.depth * 0.035 * (1 - localMerge),
      );
      helper.rotation.set(
        Math.sin(item.phase) * 0.08,
        item.phase * 0.16,
        Math.cos(item.phase) * 0.07,
      );
      const appear = 0.14 + localSoft * 0.86;
      const flatten = THREE.MathUtils.lerp(1, 0.76, localMerge);
      const swell = THREE.MathUtils.lerp(0.92, 1.18, localMerge);
      const dissolve = THREE.MathUtils.lerp(1, 0.12, localMerge);
      const base = item.scale * appear * dissolve;
      helper.scale.set(base * swell, base * flatten, base * swell);
      helper.updateMatrix();
      blobs.setMatrixAt(i, helper.matrix);
    }
    blobs.instanceMatrix.needsUpdate = true;

    const shotVisible = accumulate * (1 - range(p, 0.605, 0.66));
    shot.visible = shotVisible > 0.003;
    shot.position.y = THREE.MathUtils.damp(
      shot.position.y,
      THREE.MathUtils.lerp(1.06, 0.82, injectionPush),
      5.5,
      delta,
    );
    const shotPressure = THREE.MathUtils.lerp(0.76, 1, accumulate);
    const squeeze = THREE.MathUtils.lerp(1, 0.76, handoff);
    shot.scale.x = THREE.MathUtils.damp(shot.scale.x, (compact ? 0.76 : 0.88) * shotPressure * squeeze, 5.5, delta);
    shot.scale.z = THREE.MathUtils.damp(shot.scale.z, (compact ? 0.68 : 0.78) * shotPressure * squeeze, 5.5, delta);
    shot.scale.y = THREE.MathUtils.damp(
      shot.scale.y,
      THREE.MathUtils.lerp(0.72, 1.04, accumulate) * THREE.MathUtils.lerp(1, 0.48, handoff),
      5.5,
      delta,
    );

    if (heatLightRef.current) {
      const heat = chamberVisibility * soften * (1 - handoff * 0.75);
      heatLightRef.current.intensity = THREE.MathUtils.damp(
        heatLightRef.current.intensity,
        heat * 0.28,
        5,
        delta,
      );
    }
  });

  const barrelRadius = compact ? 0.62 : 0.72;

  return (
    <group ref={groupRef} visible={false}>
      <group ref={barrelRef} visible={false}>
        <mesh position={[0, 1.9, 0]} material={barrelMaterial}>
          <cylinderGeometry args={[barrelRadius, barrelRadius, 2.15, compact ? 36 : 48, 1, true]} />
        </mesh>
        {[2.68, 2.22, 1.76, 1.3].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={bandMaterial}>
            <torusGeometry args={[barrelRadius + 0.018, 0.035, 8, compact ? 40 : 56]} />
          </mesh>
        ))}
      </group>

      <group ref={screwRef} visible={false}>
        <mesh position={[0, 1.86, 0]} material={screwMaterial}>
          <cylinderGeometry args={[compact ? 0.09 : 0.11, compact ? 0.09 : 0.11, 1.92, 28]} />
        </mesh>
        <mesh geometry={screwFlightGeometry} material={screwMaterial} />
      </group>

      <instancedMesh
        ref={blobsRef}
        args={[blobGeometry, blobMaterial, blobData.length]}
        frustumCulled={false}
        renderOrder={3}
      />

      <mesh ref={shotRef} geometry={shotGeometry} material={meltMaterial} visible={false} />

      <pointLight
        ref={heatLightRef}
        position={[0, 1.65, 1.55]}
        color="#d1a18a"
        intensity={0}
        distance={3.3}
        decay={2}
      />
    </group>
  );
}
