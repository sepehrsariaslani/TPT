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
      const broad = Math.sin(nx * TAU * 2.2 + ny * 2.4) * 1.35;
      const streak = Math.sin(nx * TAU * 6.2 - ny * 4.0) * 0.55;
      const grain = (random() - 0.5) * 2.3;
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
  texture.repeat.set(2.7, 4.1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createScrewFlightGeometry(compact) {
  const points = [];
  const turns = 3.05;
  const radius = compact ? 0.22 : 0.27;
  for (let i = 0; i <= 96; i += 1) {
    const t = i / 96;
    const angle = t * TAU * turns;
    const taper = THREE.MathUtils.lerp(1, 0.82, t);
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius * taper,
      THREE.MathUtils.lerp(2.72, 1.2, t),
      Math.sin(angle) * radius * taper,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, 120, compact ? 0.014 : 0.017, 8, false);
}

function createMeltColumnGeometry() {
  const profile = [
    [0, -0.68],
    [0.16, -0.68],
    [0.25, -0.55],
    [0.3, -0.26],
    [0.31, 0.1],
    [0.27, 0.42],
    [0.14, 0.66],
    [0, 0.68],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(profile, 72);
  geometry.computeVertexNormals();
  return geometry;
}

function createShotGeometry() {
  const profile = [
    [0, -0.34],
    [0.12, -0.34],
    [0.22, -0.27],
    [0.27, -0.1],
    [0.27, 0.13],
    [0.21, 0.27],
    [0.1, 0.34],
    [0, 0.34],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(profile, 56);
  geometry.computeVertexNormals();
  return geometry;
}

export default function PlasticizingMelt({ progressRef }) {
  const { size } = useThree();
  const compact = size.width <= 680;
  const groupRef = useRef();
  const hopperRef = useRef();
  const barrelRef = useRef();
  const screwRef = useRef();
  const meltColumnRef = useRef();
  const shotRef = useRef();
  const transferRef = useRef();
  const heatLightRef = useRef();

  const meltTexture = useMemo(() => createMeltTexture(), []);
  const screwFlightGeometry = useMemo(() => createScrewFlightGeometry(compact), [compact]);
  const meltColumnGeometry = useMemo(() => createMeltColumnGeometry(), []);
  const shotGeometry = useMemo(() => createShotGeometry(), []);

  const meltMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1b5a92',
    metalness: 0,
    roughness: 0.23,
    clearcoat: 0.4,
    clearcoatRoughness: 0.16,
    ior: 1.47,
    specularIntensity: 0.47,
    specularColor: new THREE.Color('#bfd3e3'),
    bumpMap: meltTexture,
    bumpScale: 0.0009,
    envMapIntensity: 0.72,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), [meltTexture]);

  const hopperMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#25323c',
    metalness: 0.56,
    roughness: 0.35,
    clearcoat: 0.035,
    clearcoatRoughness: 0.48,
    specularIntensity: 0.3,
    envMapIntensity: 0.56,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: true,
  }), []);

  const hopperEdgeMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#71808c',
    metalness: 0.7,
    roughness: 0.2,
    specularIntensity: 0.35,
    envMapIntensity: 0.72,
    transparent: true,
    opacity: 0,
    depthWrite: true,
  }), []);

  const barrelMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#2a3741',
    metalness: 0.5,
    roughness: 0.35,
    clearcoat: 0.03,
    clearcoatRoughness: 0.5,
    specularIntensity: 0.28,
    envMapIntensity: 0.55,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  }), []);

  const bandMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#4f5d67',
    metalness: 0.66,
    roughness: 0.26,
    specularIntensity: 0.32,
    envMapIntensity: 0.64,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }), []);

  const screwMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#74818b',
    metalness: 0.72,
    roughness: 0.24,
    specularIntensity: 0.36,
    envMapIntensity: 0.7,
    transparent: true,
    opacity: 0,
    depthWrite: true,
  }), []);

  useEffect(() => () => {
    screwFlightGeometry.dispose();
    meltColumnGeometry.dispose();
    shotGeometry.dispose();
    meltMaterial.dispose();
    hopperMaterial.dispose();
    hopperEdgeMaterial.dispose();
    barrelMaterial.dispose();
    bandMaterial.dispose();
    screwMaterial.dispose();
    meltTexture.dispose();
  }, [
    screwFlightGeometry,
    meltColumnGeometry,
    shotGeometry,
    meltMaterial,
    hopperMaterial,
    hopperEdgeMaterial,
    barrelMaterial,
    bandMaterial,
    screwMaterial,
    meltTexture,
  ]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const hopper = hopperRef.current;
    const barrel = barrelRef.current;
    const screw = screwRef.current;
    const meltColumn = meltColumnRef.current;
    const shot = shotRef.current;
    const transfer = transferRef.current;
    if (!group || !hopper || !barrel || !screw || !meltColumn || !shot || !transfer) return;

    const p = progressRef.current;
    const time = clock.getElapsedTime();

    // The machine appears before the pellets enter it, so the user can read the
    // physical destination. It stays visible through the injection handoff.
    const machineIn = range(p, 0.255, 0.315);
    const machineOut = range(p, 0.635, 0.7);
    const machineVisibility = machineIn * (1 - machineOut);
    const plasticize = range(p, 0.365, 0.49);
    const accumulate = range(p, 0.43, 0.535);
    const injectionPush = range(p, 0.49, 0.57);
    const handoff = range(p, 0.565, 0.635);

    group.visible = machineVisibility > 0.003 || plasticize > 0.003;
    if (!group.visible) return;

    hopper.visible = machineVisibility > 0.003;
    barrel.visible = machineVisibility > 0.003;
    screw.visible = machineVisibility > 0.003;

    hopperMaterial.opacity = machineVisibility * 0.52;
    hopperEdgeMaterial.opacity = machineVisibility * 0.84;
    barrelMaterial.opacity = machineVisibility * 0.12;
    bandMaterial.opacity = machineVisibility * 0.28;
    screwMaterial.opacity = machineVisibility * 0.54;

    // Slow screw motion: enough to read as plasticizing, not a decorative helix.
    const screwSpin = range(p, 0.335, 0.405) * (1 - range(p, 0.485, 0.54));
    screw.rotation.y += delta * 0.18 * screwSpin;
    screw.position.y = THREE.MathUtils.damp(
      screw.position.y,
      -0.1 * injectionPush,
      5.2,
      delta,
    );

    // Continuous melt forms around the lower screw as the last solid pellets
    // disappear. No separate bubble cloud is introduced.
    const meltVisible = plasticize * (1 - handoff * 0.88);
    meltColumn.visible = meltVisible > 0.003;
    meltMaterial.opacity = meltVisible * THREE.MathUtils.lerp(0.3, 0.76, accumulate);
    meltMaterial.roughness = THREE.MathUtils.lerp(0.25, 0.18, injectionPush);
    meltMaterial.clearcoat = THREE.MathUtils.lerp(0.36, 0.5, injectionPush);
    meltMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.18, 0.12, injectionPush);

    const meltGrowth = THREE.MathUtils.lerp(0.14, 1, plasticize);
    meltColumn.scale.x = THREE.MathUtils.damp(meltColumn.scale.x, compact ? 0.76 : 0.88, 5.4, delta);
    meltColumn.scale.z = THREE.MathUtils.damp(meltColumn.scale.z, compact ? 0.7 : 0.82, 5.4, delta);
    meltColumn.scale.y = THREE.MathUtils.damp(meltColumn.scale.y, meltGrowth, 5.6, delta);
    meltColumn.position.y = THREE.MathUtils.damp(
      meltColumn.position.y,
      2.52 - 0.68 * meltGrowth,
      5.6,
      delta,
    );
    meltColumn.rotation.y = Math.sin(time * 0.12) * 0.008;

    // A single accumulated shot forms at the end of the screw and is pushed into
    // the nozzle. This makes the direction of transfer unambiguous.
    const shotVisible = accumulate * (1 - handoff * 0.96);
    shot.visible = shotVisible > 0.003;
    shot.position.y = THREE.MathUtils.damp(
      shot.position.y,
      THREE.MathUtils.lerp(1.26, 1.09, injectionPush),
      6,
      delta,
    );
    const shotScale = THREE.MathUtils.lerp(0.66, 1, accumulate);
    shot.scale.x = THREE.MathUtils.damp(shot.scale.x, (compact ? 0.72 : 0.82) * shotScale, 5.8, delta);
    shot.scale.z = THREE.MathUtils.damp(shot.scale.z, (compact ? 0.66 : 0.76) * shotScale, 5.8, delta);
    shot.scale.y = THREE.MathUtils.damp(
      shot.scale.y,
      THREE.MathUtils.lerp(0.7, 0.94, accumulate) * THREE.MathUtils.lerp(1, 0.48, handoff),
      5.8,
      delta,
    );

    // Visible bridge from barrel to the metal nozzle rendered by CoolingRelease.
    // It grows downward as injection begins and fades only after the sprue takes over.
    const transferFlow = injectionPush * (1 - handoff);
    transfer.visible = transferFlow > 0.003;
    const transferLength = 0.34;
    const transferScaleY = THREE.MathUtils.lerp(0.04, 1, transferFlow);
    transfer.scale.y = THREE.MathUtils.damp(transfer.scale.y, transferScaleY, 7.2, delta);
    transfer.scale.x = THREE.MathUtils.damp(transfer.scale.x, THREE.MathUtils.lerp(0.82, 1, injectionPush), 6, delta);
    transfer.scale.z = THREE.MathUtils.damp(transfer.scale.z, THREE.MathUtils.lerp(0.82, 1, injectionPush), 6, delta);
    transfer.position.y = THREE.MathUtils.damp(
      transfer.position.y,
      1.11 - (transferLength * transferScaleY) / 2,
      7.2,
      delta,
    );

    if (heatLightRef.current) {
      heatLightRef.current.intensity = THREE.MathUtils.damp(
        heatLightRef.current.intensity,
        machineVisibility * plasticize * (1 - handoff) * 0.22,
        5,
        delta,
      );
    }
  });

  const barrelRadius = compact ? 0.52 : 0.58;
  const hopperTop = compact ? 0.9 : 1.06;
  const hopperBottom = compact ? 0.38 : 0.44;

  return (
    <group ref={groupRef} visible={false}>
      <group ref={hopperRef} visible={false}>
        <mesh position={[0, 3.28, 0]} material={hopperMaterial}>
          <cylinderGeometry args={[hopperTop, hopperBottom, 0.84, compact ? 48 : 64, 1, true]} />
        </mesh>
        <mesh position={[0, 3.7, 0]} rotation={[Math.PI / 2, 0, 0]} material={hopperEdgeMaterial}>
          <torusGeometry args={[hopperTop, 0.035, 8, compact ? 48 : 64]} />
        </mesh>
        <mesh position={[0, 2.76, 0]} material={hopperMaterial}>
          <cylinderGeometry args={[hopperBottom, hopperBottom * 0.82, 0.34, compact ? 40 : 56, 1, true]} />
        </mesh>
        <mesh position={[0, 2.93, 0]} rotation={[Math.PI / 2, 0, 0]} material={hopperEdgeMaterial}>
          <torusGeometry args={[hopperBottom, 0.022, 7, compact ? 40 : 56]} />
        </mesh>
      </group>

      <group ref={barrelRef} visible={false}>
        <mesh position={[0, 1.94, 0]} material={barrelMaterial}>
          <cylinderGeometry args={[barrelRadius, barrelRadius, 1.86, compact ? 40 : 56, 1, true]} />
        </mesh>
        {[2.5, 1.95, 1.4].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={bandMaterial}>
            <torusGeometry args={[barrelRadius + 0.014, 0.024, 7, compact ? 40 : 56]} />
          </mesh>
        ))}
      </group>

      <group ref={screwRef} visible={false}>
        <mesh position={[0, 1.92, 0]} material={screwMaterial}>
          <cylinderGeometry args={[compact ? 0.075 : 0.09, compact ? 0.075 : 0.09, 1.76, 28]} />
        </mesh>
        <mesh geometry={screwFlightGeometry} material={screwMaterial} />
      </group>

      <mesh
        ref={meltColumnRef}
        position={[0, 2.42, 0]}
        geometry={meltColumnGeometry}
        material={meltMaterial}
        visible={false}
      />

      <mesh ref={shotRef} position={[0, 1.26, 0]} geometry={shotGeometry} material={meltMaterial} visible={false} />

      <mesh ref={transferRef} position={[0, 1.06, 0]} material={meltMaterial} visible={false}>
        <cylinderGeometry args={[0.05, 0.038, 0.34, 28]} />
      </mesh>

      <pointLight
        ref={heatLightRef}
        position={[0, 1.8, 1.45]}
        color="#c6a28e"
        intensity={0}
        distance={3}
        decay={2}
      />
    </group>
  );
}
