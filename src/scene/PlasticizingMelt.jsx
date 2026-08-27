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

function makeMeltCurve(index, compact = false) {
  const points = [];
  const phase = index * (TAU / 3) + (index === 1 ? 0.28 : -0.16);
  const radialScale = compact ? 0.78 : 1;
  const verticalScale = compact ? 0.93 : 1;

  // All three softened streams now terminate at the same centre gate. This is
  // the continuity bridge between plasticizing and cavity fill: material never
  // fades in one place and reappears somewhere else.
  for (let step = 0; step <= 22; step += 1) {
    const t = step / 22;
    const eased = smooth(t);
    const gatePull = smooth(range(t, 0.58, 1));
    const radius = THREE.MathUtils.lerp(2.38, 0.075, eased) * radialScale;
    const turns = 0.92 + index * 0.05;
    const angle = phase
      + t * TAU * turns
      + Math.sin(t * Math.PI) * (index - 1) * 0.075;
    const x = Math.cos(angle) * radius * (1 - gatePull * 0.12);
    const y = THREE.MathUtils.lerp(4.0, 0.48, t) * verticalScale
      + Math.sin(t * Math.PI * 2 + phase) * 0.055 * (1 - gatePull);
    const z = Math.sin(angle) * radius * THREE.MathUtils.lerp(0.78, 0.36, gatePull)
      + Math.cos(t * Math.PI * 1.45 + phase) * 0.045 * (1 - gatePull);
    points.push(new THREE.Vector3(x, y, z));
  }

  return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45);
}

function createMeltTexture(seed = 411, size = 64) {
  const random = seededRandom(seed);
  const pixels = new Uint8Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const slow = Math.sin(nx * TAU * 3.1 + ny * 2.7) * 2.1;
      const streak = Math.sin(nx * TAU * 8.6 - ny * 5.2) * 1.05;
      const grain = (random() - 0.5) * 3.5;
      pixels[y * size + x] = Math.max(0, Math.min(255, 128 + slow + streak + grain));
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
  texture.repeat.set(2.1, 5.5);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function buildBlobData(count) {
  const random = seededRandom(88421);
  return Array.from({ length: count }, (_, index) => ({
    lane: index % 3,
    t: random(),
    offset: (random() - 0.5) * 0.115,
    phase: random() * TAU,
    scale: 0.72 + random() * 0.42,
    speed: 0.78 + random() * 0.26,
    delay: random() * 0.045,
    stretch: 0.84 + random() * 0.34,
  }));
}

export default function PlasticizingMelt({ progressRef }) {
  const { size } = useThree();
  const compact = size.width <= 680;
  const groupRef = useRef();
  const blobsRef = useRef();
  const centreLightRef = useRef();
  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const baseAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  const coldColor = useMemo(() => new THREE.Color('#174f8f'), []);
  const hotColor = useMemo(() => new THREE.Color('#0c478c'), []);
  const coldBlobColor = useMemo(() => new THREE.Color('#1c619f'), []);
  const hotBlobColor = useMemo(() => new THREE.Color('#105394'), []);

  const meltTexture = useMemo(() => createMeltTexture(), []);
  const curves = useMemo(
    () => [0, 1, 2].map((index) => makeMeltCurve(index, compact)),
    [compact],
  );
  const tubes = useMemo(
    () => curves.map((curve, index) => new THREE.TubeGeometry(
      curve,
      compact ? 62 : 92,
      (compact ? 0.14 : 0.17) + index * 0.011,
      compact ? 8 : 10,
      false,
    )),
    [curves, compact],
  );
  const blobGeometry = useMemo(
    () => new THREE.SphereGeometry(0.2, compact ? 12 : 16, compact ? 8 : 12),
    [compact],
  );
  const blobData = useMemo(() => buildBlobData(compact ? 48 : 86), [compact]);

  const meltMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: coldColor.clone(),
    metalness: 0,
    roughness: 0.25,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
    ior: 1.47,
    specularIntensity: 0.72,
    specularColor: new THREE.Color('#c8e0f7'),
    sheen: 0.045,
    sheenRoughness: 0.44,
    sheenColor: new THREE.Color('#2e78bd'),
    bumpMap: meltTexture,
    bumpScale: 0.00145,
    envMapIntensity: 0.98,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), [coldColor, meltTexture]);

  const blobMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: coldBlobColor.clone(),
    metalness: 0,
    roughness: 0.22,
    clearcoat: 0.82,
    clearcoatRoughness: 0.12,
    ior: 1.47,
    specularIntensity: 0.74,
    specularColor: new THREE.Color('#d7e9f9'),
    envMapIntensity: 1.02,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), [coldBlobColor]);

  useEffect(() => {
    if (blobsRef.current) {
      blobsRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      blobsRef.current.renderOrder = 3;
    }

    tubes.forEach((geometry) => geometry.setDrawRange(0, 0));

    return () => {
      tubes.forEach((geometry) => geometry.dispose());
      blobGeometry.dispose();
      meltMaterial.dispose();
      blobMaterial.dispose();
      meltTexture.dispose();
    };
  }, [tubes, blobGeometry, meltMaterial, blobMaterial, meltTexture]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const blobs = blobsRef.current;
    if (!group || !blobs) return;

    const p = progressRef.current;
    const time = clock.getElapsedTime();
    const soften = range(p, 0.205, 0.305);
    const plasticized = range(p, 0.275, 0.425);
    const injectionTakeover = range(p, 0.385, 0.535);
    const drain = range(p, 0.415, 0.555);
    const fadeOut = range(p, 0.535, 0.595);
    const visibility = soften * (1 - fadeOut);

    group.visible = visibility > 0.003;
    if (!group.visible) return;

    // Grow each liquid path from the softened pellets, then drain its upstream
    // section while keeping the gate-side tail alive. This makes the eye follow
    // one uninterrupted mass into the injection point.
    const fills = [
      range(p, 0.205, 0.33),
      range(p, 0.215, 0.34),
      range(p, 0.235, 0.375),
    ];
    tubes.forEach((geometry, index) => {
      if (!geometry.index) return;
      const total = geometry.index.count;
      const filled = Math.floor((total * fills[index]) / 3) * 3;
      const trimRatio = THREE.MathUtils.lerp(0, 0.72, drain);
      const start = Math.floor((filled * trimRatio) / 3) * 3;
      const count = Math.max(0, filled - start);
      geometry.setDrawRange(start, count);
    });

    meltMaterial.opacity = visibility
      * (0.43 + plasticized * 0.23)
      * (1 - drain * 0.16);
    blobMaterial.opacity = visibility
      * (0.5 + plasticized * 0.26)
      * (1 - drain * 0.28);
    meltMaterial.color.lerpColors(coldColor, hotColor, plasticized);
    blobMaterial.color.lerpColors(coldBlobColor, hotBlobColor, plasticized);
    meltMaterial.roughness = THREE.MathUtils.lerp(0.28, 0.145, plasticized);
    meltMaterial.clearcoat = THREE.MathUtils.lerp(0.58, 0.91, plasticized);
    meltMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.19, 0.082, plasticized);
    blobMaterial.roughness = THREE.MathUtils.lerp(0.26, 0.14, plasticized);
    blobMaterial.clearcoat = THREE.MathUtils.lerp(0.68, 0.88, plasticized);

    const breathe = 1 + Math.sin(time * 0.42) * 0.0045 * visibility * (1 - drain);
    const targetScale = THREE.MathUtils.lerp(0.86, 1, soften) * breathe;
    group.scale.x = THREE.MathUtils.damp(
      group.scale.x,
      targetScale * THREE.MathUtils.lerp(1, 0.92, drain),
      5,
      delta,
    );
    group.scale.y = THREE.MathUtils.damp(
      group.scale.y,
      THREE.MathUtils.lerp(0.9, 1, soften),
      5,
      delta,
    );
    group.scale.z = THREE.MathUtils.damp(
      group.scale.z,
      targetScale * THREE.MathUtils.lerp(1, 0.92, drain),
      5,
      delta,
    );

    // Almost no global rotation: the material should read as viscous mass under
    // pressure, not a vortex. Rotation dies completely as injection takes over.
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      Math.sin(time * 0.14) * 0.005 * visibility * (1 - injectionTakeover),
      3.8,
      delta,
    );

    for (let i = 0; i < blobData.length; i += 1) {
      const item = blobData[i];
      const curve = curves[item.lane];
      const localSoft = range(p, 0.205 + item.delay, 0.3 + item.delay);
      const localMerge = range(p, 0.265 + item.delay * 0.45, 0.405 + item.delay * 0.3);
      const baseFlowT = (item.t + time * 0.0046 * item.speed * visibility) % 1;
      const gateTarget = 0.91 + item.t * 0.075;
      const t = clamp01(THREE.MathUtils.lerp(baseFlowT * 0.96 + 0.02, gateTarget, drain));

      curve.getPointAt(t, position);
      curve.getTangentAt(t, tangent).normalize();
      quaternion.setFromUnitVectors(baseAxis, tangent);

      const lateral = Math.sin(item.phase + time * 0.16)
        * item.offset
        * (1 - localMerge * 0.76)
        * (1 - drain * 0.9);
      position.x += Math.cos(item.phase) * lateral;
      position.z += Math.sin(item.phase) * lateral;

      const neck = 0.8 + Math.sin(t * Math.PI) * 0.28;
      const merge = THREE.MathUtils.lerp(0.72, 1.03, localMerge);
      const appear = 0.2 + localSoft * 0.8;
      const drainXZ = THREE.MathUtils.lerp(1, 0.34, drain);
      const drainY = THREE.MathUtils.lerp(1, 1.32, drain);
      const finalScale = 1 - fadeOut * 0.82;

      helper.position.copy(position);
      helper.quaternion.copy(quaternion);
      helper.scale.set(
        item.scale * neck * 0.72 * merge * appear * drainXZ * finalScale,
        item.scale * (1.08 + localMerge * 0.55) * item.stretch * appear * drainY * finalScale,
        item.scale * neck * 0.68 * merge * appear * drainXZ * finalScale,
      );
      helper.updateMatrix();
      blobs.setMatrixAt(i, helper.matrix);
    }
    blobs.instanceMatrix.needsUpdate = true;

    if (centreLightRef.current) {
      const targetIntensity = visibility
        * (0.42 + plasticized * 0.74 + injectionTakeover * 0.42)
        * (1 - fadeOut * 0.7);
      centreLightRef.current.intensity = THREE.MathUtils.damp(
        centreLightRef.current.intensity,
        targetIntensity,
        5.2,
        delta,
      );
      centreLightRef.current.position.y = THREE.MathUtils.damp(
        centreLightRef.current.position.y,
        THREE.MathUtils.lerp(0.92, 0.52, injectionTakeover),
        4.6,
        delta,
      );
      centreLightRef.current.position.z = THREE.MathUtils.damp(
        centreLightRef.current.position.z,
        THREE.MathUtils.lerp(2.25, 1.35, injectionTakeover),
        4.6,
        delta,
      );
    }
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={3}>
      {tubes.map((geometry, index) => (
        <mesh
          key={index}
          geometry={geometry}
          material={meltMaterial}
          renderOrder={3}
        />
      ))}

      <instancedMesh
        ref={blobsRef}
        args={[blobGeometry, blobMaterial, blobData.length]}
        frustumCulled={false}
        renderOrder={3}
      />

      <pointLight
        ref={centreLightRef}
        position={[0, 0.92, 2.25]}
        color="#c1d9ed"
        intensity={0}
        distance={5.2}
        decay={2}
      />
    </group>
  );
}
