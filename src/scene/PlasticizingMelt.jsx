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
      const slow = Math.sin(nx * TAU * 2.6 + ny * 2.2) * 1.8;
      const streak = Math.sin(nx * TAU * 7.2 - ny * 4.5) * 0.8;
      const grain = (random() - 0.5) * 3.0;
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
  texture.repeat.set(2.5, 4.8);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function buildBlobData(count) {
  const random = seededRandom(88421);
  return Array.from({ length: count }, (_, index) => {
    const pick = random();
    const lane = pick < 0.37 ? -1 : pick < 0.74 ? 1 : 0;
    return {
      lane,
      t: random(),
      phase: random() * TAU,
      depth: (random() - 0.5) * 2,
      scale: 0.78 + random() * 0.36,
      speed: 0.82 + random() * 0.24,
      delay: random() * 0.055,
      stretch: 0.9 + random() * 0.34,
    };
  });
}

function resolvePoint(item, compact, time, visibility, position, tangent) {
  const driftT = (item.t + time * 0.0024 * item.speed * visibility) % 1;
  const t = clamp01(driftT * 0.94 + 0.03);
  const eps = 0.012;

  const sample = (value, target) => {
    const s = smooth(clamp01(value));
    const side = item.lane;
    const width = compact ? 0.72 : 1;

    if (side === 0) {
      target.set(
        Math.sin(item.phase + value * 2.1) * 0.11 * (1 - s),
        THREE.MathUtils.lerp(1.52, 0.46, value),
        item.depth * 0.08 * (1 - s) + Math.cos(item.phase) * 0.06,
      );
      return;
    }

    target.set(
      side * THREE.MathUtils.lerp(1.72 * width, 0.28 * width, s)
        + Math.sin(item.phase + value * 1.8) * 0.14 * (1 - s),
      THREE.MathUtils.lerp(3.05, 0.74, value),
      item.depth * THREE.MathUtils.lerp(0.34, 0.09, s)
        + side * Math.sin(value * Math.PI) * 0.1,
    );
  };

  sample(t, position);
  const next = new THREE.Vector3();
  sample(Math.min(1, t + eps), next);
  tangent.copy(next).sub(position).normalize();
}

export default function PlasticizingMelt({ progressRef }) {
  const { size } = useThree();
  const compact = size.width <= 680;
  const groupRef = useRef();
  const blobsRef = useRef();
  const slugRef = useRef();
  const gateRef = useRef();
  const centreLightRef = useRef();

  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const baseAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  const meltTexture = useMemo(() => createMeltTexture(), []);
  const blobGeometry = useMemo(
    () => new THREE.SphereGeometry(0.19, compact ? 12 : 16, compact ? 8 : 12),
    [compact],
  );
  const slugGeometry = useMemo(
    () => new THREE.SphereGeometry(0.5, compact ? 18 : 24, compact ? 12 : 16),
    [compact],
  );
  const blobData = useMemo(() => buildBlobData(compact ? 58 : 94), [compact]);

  const coldColor = useMemo(() => new THREE.Color('#245f9f'), []);
  const warmColor = useMemo(() => new THREE.Color('#1c64a7'), []);
  const hotColor = useMemo(() => new THREE.Color('#1764a9'), []);

  const blobMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: coldColor.clone(),
    metalness: 0,
    roughness: 0.29,
    clearcoat: 0.34,
    clearcoatRoughness: 0.2,
    ior: 1.47,
    specularIntensity: 0.48,
    specularColor: new THREE.Color('#b7d1e8'),
    bumpMap: meltTexture,
    bumpScale: 0.0014,
    envMapIntensity: 0.76,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), [coldColor, meltTexture]);

  const slugMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: warmColor.clone(),
    metalness: 0,
    roughness: 0.23,
    clearcoat: 0.48,
    clearcoatRoughness: 0.15,
    ior: 1.47,
    specularIntensity: 0.52,
    specularColor: new THREE.Color('#c8ddec'),
    bumpMap: meltTexture,
    bumpScale: 0.0012,
    envMapIntensity: 0.8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), [meltTexture, warmColor]);

  useEffect(() => {
    if (blobsRef.current) {
      blobsRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      blobsRef.current.renderOrder = 3;
    }

    return () => {
      blobGeometry.dispose();
      slugGeometry.dispose();
      blobMaterial.dispose();
      slugMaterial.dispose();
      meltTexture.dispose();
    };
  }, [blobGeometry, slugGeometry, blobMaterial, slugMaterial, meltTexture]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const blobs = blobsRef.current;
    const slug = slugRef.current;
    const gate = gateRef.current;
    if (!group || !blobs || !slug || !gate) return;

    const p = progressRef.current;
    const time = clock.getElapsedTime();
    const soften = range(p, 0.205, 0.292);
    const merge = range(p, 0.27, 0.405);
    const delivery = range(p, 0.35, 0.47);
    const handoff = range(p, 0.485, 0.575);
    const visibility = soften * (1 - handoff);

    group.visible = visibility > 0.003;
    if (!group.visible) return;

    blobMaterial.opacity = visibility * THREE.MathUtils.lerp(0.72, 0.46, merge);
    slugMaterial.opacity = visibility * merge * THREE.MathUtils.lerp(0.3, 0.76, delivery);

    blobMaterial.color.lerpColors(coldColor, warmColor, merge);
    slugMaterial.color.lerpColors(warmColor, hotColor, delivery);
    blobMaterial.roughness = THREE.MathUtils.lerp(0.3, 0.19, merge);
    blobMaterial.clearcoat = THREE.MathUtils.lerp(0.3, 0.52, merge);
    blobMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.22, 0.13, merge);
    slugMaterial.roughness = THREE.MathUtils.lerp(0.24, 0.17, delivery);
    slugMaterial.clearcoat = THREE.MathUtils.lerp(0.42, 0.62, delivery);
    slugMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.17, 0.11, delivery);

    for (let i = 0; i < blobData.length; i += 1) {
      const item = blobData[i];
      const localSoft = range(p, 0.205 + item.delay, 0.295 + item.delay);
      const localMerge = range(p, 0.275 + item.delay * 0.5, 0.41 + item.delay * 0.35);
      resolvePoint(item, compact, time, visibility, position, tangent);
      quaternion.setFromUnitVectors(baseAxis, tangent);

      const sideFactor = item.lane === 0 ? 0.86 : 1;
      const radialMerge = THREE.MathUtils.lerp(0.66, 1.12, localMerge);
      const elongation = THREE.MathUtils.lerp(0.88, 1.78, localMerge) * item.stretch;
      const appear = 0.12 + localSoft * 0.88;
      const exit = 1 - handoff * 0.56;

      helper.position.copy(position);
      helper.quaternion.copy(quaternion);
      helper.scale.set(
        item.scale * sideFactor * 0.72 * radialMerge * appear * exit,
        item.scale * elongation * appear * exit,
        item.scale * sideFactor * 0.68 * radialMerge * appear * exit,
      );
      helper.updateMatrix();
      blobs.setMatrixAt(i, helper.matrix);
    }
    blobs.instanceMatrix.needsUpdate = true;

    const slugVisible = merge * (1 - handoff);
    slug.visible = slugVisible > 0.003;
    slug.position.y = THREE.MathUtils.damp(
      slug.position.y,
      THREE.MathUtils.lerp(1.05, 0.68, delivery),
      5.2,
      delta,
    );
    slug.scale.x = THREE.MathUtils.damp(
      slug.scale.x,
      (compact ? 0.55 : 0.66) * THREE.MathUtils.lerp(0.72, 1, delivery),
      5.2,
      delta,
    );
    slug.scale.z = THREE.MathUtils.damp(
      slug.scale.z,
      (compact ? 0.5 : 0.61) * THREE.MathUtils.lerp(0.72, 1, delivery),
      5.2,
      delta,
    );
    slug.scale.y = THREE.MathUtils.damp(
      slug.scale.y,
      THREE.MathUtils.lerp(1.1, compact ? 2.0 : 2.35, delivery) * (1 - handoff * 0.3),
      5.2,
      delta,
    );

    gate.visible = delivery > 0.003 && handoff < 0.98;
    gate.position.y = THREE.MathUtils.damp(gate.position.y, 0.43, 5.5, delta);
    const gateScale = THREE.MathUtils.lerp(0.38, 0.72, delivery) * (1 - handoff * 0.45);
    gate.scale.set(gateScale, gateScale * 0.72, gateScale);

    // Keep the material mass visually heavy. There is no looping or vortex turn.
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      Math.sin(time * 0.13) * 0.0035 * visibility,
      3.6,
      delta,
    );

    if (centreLightRef.current) {
      centreLightRef.current.intensity = THREE.MathUtils.damp(
        centreLightRef.current.intensity,
        visibility * (0.32 + merge * 0.58 + delivery * 0.28),
        5,
        delta,
      );
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <instancedMesh
        ref={blobsRef}
        args={[blobGeometry, blobMaterial, blobData.length]}
        frustumCulled={false}
        renderOrder={3}
      />

      <mesh ref={slugRef} geometry={slugGeometry} material={slugMaterial} visible={false} />

      <mesh ref={gateRef} position={[0, 0.43, 0]} material={slugMaterial} visible={false}>
        <sphereGeometry args={[0.19, compact ? 14 : 18, compact ? 10 : 12]} />
      </mesh>

      <pointLight
        ref={centreLightRef}
        position={[0, 0.9, 2.3]}
        color="#9fc2df"
        intensity={0}
        distance={5}
        decay={2}
      />
    </group>
  );
}
