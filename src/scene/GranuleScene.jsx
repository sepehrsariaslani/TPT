import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const TAU = Math.PI * 2;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
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

function buildParticleData(count) {
  const random = seededRandom(918273);
  const stream = new Float32Array(count * 3);
  const vortex = new Float32Array(count * 3);
  const cap = new Float32Array(count * 3);
  const release = new Float32Array(count * 3);
  const exit = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const spread = new Float32Array(count);
  const scale = new Float32Array(count * 3);
  const rotation = new Float32Array(count * 3);
  const shade = new Float32Array(count);

  const strandCount = 18;

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const strand = Math.floor(random() * strandCount);
    const strandAngle = (strand / strandCount) * TAU;
    const t = random();
    const localPhase = random() * TAU;
    const localSpread = 0.45 + random() * 1.25;

    phase[i] = localPhase;
    spread[i] = localSpread;
    shade[i] = random();

    // 01 — long, softly curved vertical strings entering from above.
    const streamRadius = 1.15 + 2.85 * (1 - t) + Math.sin(t * Math.PI) * 0.45;
    const streamAngle = strandAngle + Math.sin(t * Math.PI * 1.65 + localPhase) * 0.22;
    stream[i3] = Math.cos(streamAngle) * streamRadius + (random() - 0.5) * 0.16;
    stream[i3 + 1] = 7.9 - t * 15.2 + (random() - 0.5) * 0.32;
    stream[i3 + 2] = Math.sin(streamAngle) * streamRadius * 0.72 + (random() - 0.5) * 0.16;

    // 02 — conical helix which wraps repeatedly around the future product.
    const vortexTurns = 4.1 + random() * 1.25;
    const vortexAngle = strandAngle + t * TAU * vortexTurns + localPhase * 0.18;
    const vortexRadius = 3.9 - t * 1.45 + Math.sin(t * Math.PI * 4 + localPhase) * 0.18;
    vortex[i3] = Math.cos(vortexAngle) * vortexRadius;
    vortex[i3 + 1] = 4.8 - t * 8.6 + Math.sin(vortexAngle * 0.45) * 0.12;
    vortex[i3 + 2] = Math.sin(vortexAngle) * vortexRadius * 0.84;

    // 03 — sample the surface of a screw cap. Most pellets land on the top,
    // the rest define the side wall and lower rim.
    const surface = random();
    if (surface < 0.67) {
      const r = Math.sqrt(random()) * 2.34;
      const a = random() * TAU;
      cap[i3] = Math.cos(a) * r;
      cap[i3 + 1] = 0.43 + (random() - 0.5) * 0.055;
      cap[i3 + 2] = Math.sin(a) * r;
    } else if (surface < 0.95) {
      const a = random() * TAU;
      const r = 2.46 + (random() - 0.5) * 0.07;
      cap[i3] = Math.cos(a) * r;
      cap[i3 + 1] = -0.27 + random() * 0.61;
      cap[i3 + 2] = Math.sin(a) * r;
    } else {
      const a = random() * TAU;
      const r = 2.25 + random() * 0.28;
      cap[i3] = Math.cos(a) * r;
      cap[i3 + 1] = -0.44 + (random() - 0.5) * 0.055;
      cap[i3 + 2] = Math.sin(a) * r;
    }

    // 04 — reverse transformation: the product loosens into a wide spiral.
    const releaseT = random();
    const releaseAngle = localPhase + releaseT * TAU * (4.5 + random() * 2.2);
    const releaseRadius = 2.45 + releaseT * (2.2 + random() * 1.7);
    release[i3] = Math.cos(releaseAngle) * releaseRadius;
    release[i3 + 1] = 1.9 - releaseT * 7.2 + (random() - 0.5) * 0.55;
    release[i3 + 2] = Math.sin(releaseAngle) * releaseRadius * 0.82;

    // 05 — final downward stream as the material completely leaves the form.
    const exitAngle = strandAngle + Math.sin(localPhase) * 0.16;
    const exitRadius = 1.0 + random() * 3.7;
    exit[i3] = Math.cos(exitAngle) * exitRadius;
    exit[i3 + 1] = -2.4 - random() * 9.2;
    exit[i3 + 2] = Math.sin(exitAngle) * exitRadius * 0.75;

    const base = 0.7 + random() * 0.8;
    scale[i3] = base * (0.8 + random() * 0.45);
    scale[i3 + 1] = base * (0.55 + random() * 0.25);
    scale[i3 + 2] = base * (0.72 + random() * 0.4);

    rotation[i3] = random() * TAU;
    rotation[i3 + 1] = random() * TAU;
    rotation[i3 + 2] = random() * TAU;
  }

  return { stream, vortex, cap, release, exit, phase, spread, scale, rotation, shade };
}

function Granules({ progressRef }) {
  const meshRef = useRef();
  const materialRef = useRef();
  const count = useMemo(() => {
    if (typeof window === 'undefined') return 1200;
    if (window.innerWidth < 680) return 820;
    if (window.innerWidth < 1100) return 1250;
    return 1850;
  }, []);

  const data = useMemo(() => buildParticleData(count), [count]);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.082, 8, 6), []);
  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const scaleVector = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return undefined;

    const low = new THREE.Color('#1768ff');
    const high = new THREE.Color('#92c9ff');
    const color = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      color.copy(low).lerp(high, data.shade[i] * 0.72);
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    return () => geometry.dispose();
  }, [count, data.shade, geometry]);

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;

    const p = progressRef.current;
    const time = clock.getElapsedTime();

    const toVortex = range(p, 0.12, 0.34);
    const toCap = range(p, 0.33, 0.52);
    const release = range(p, 0.66, 0.84);
    const toExit = range(p, 0.83, 1.0);

    const formFade = range(p, 0.47, 0.58);
    const returnFade = range(p, 0.65, 0.77);
    material.opacity = THREE.MathUtils.lerp(0.96, 0.16, formFade) + returnFade * 0.8;
    material.emissiveIntensity = 1.15 + (1 - formFade) * 0.85 + returnFade * 0.45;

    const streamDrift = (time * 0.24) % 1;

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      let ax;
      let ay;
      let az;
      let bx;
      let by;
      let bz;
      let mix = 0;
      let curveStrength = 0;

      if (p < 0.34) {
        ax = data.stream[i3];
        ay = data.stream[i3 + 1];
        az = data.stream[i3 + 2];
        bx = data.vortex[i3];
        by = data.vortex[i3 + 1];
        bz = data.vortex[i3 + 2];
        mix = toVortex;
        curveStrength = Math.sin(toVortex * Math.PI) * data.spread[i] * 0.34;

        // A subtle continuous top-to-bottom flow remains alive when the user pauses.
        if (p < 0.2) {
          ay -= streamDrift * 1.7;
          if (ay < -7.8) ay += 15.4;
        }
      } else if (p < 0.66) {
        ax = data.vortex[i3];
        ay = data.vortex[i3 + 1];
        az = data.vortex[i3 + 2];
        bx = data.cap[i3];
        by = data.cap[i3 + 1];
        bz = data.cap[i3 + 2];
        mix = toCap;
        curveStrength = Math.sin(toCap * Math.PI) * data.spread[i] * 0.92;
      } else if (p < 0.84) {
        ax = data.cap[i3];
        ay = data.cap[i3 + 1];
        az = data.cap[i3 + 2];
        bx = data.release[i3];
        by = data.release[i3 + 1];
        bz = data.release[i3 + 2];
        mix = release;
        curveStrength = Math.sin(release * Math.PI) * data.spread[i] * 1.16;
      } else {
        ax = data.release[i3];
        ay = data.release[i3 + 1];
        az = data.release[i3 + 2];
        bx = data.exit[i3];
        by = data.exit[i3 + 1];
        bz = data.exit[i3 + 2];
        mix = toExit;
        curveStrength = Math.sin(toExit * Math.PI) * data.spread[i] * 0.46;
      }

      const phase = data.phase[i] + p * TAU * 3.2 + time * 0.14;
      position.set(
        THREE.MathUtils.lerp(ax, bx, mix) + Math.cos(phase) * curveStrength,
        THREE.MathUtils.lerp(ay, by, mix) + Math.sin(phase * 0.63) * curveStrength * 0.18,
        THREE.MathUtils.lerp(az, bz, mix) + Math.sin(phase) * curveStrength * 0.74,
      );

      euler.set(
        data.rotation[i3] + time * 0.18,
        data.rotation[i3 + 1] + p * 2.4,
        data.rotation[i3 + 2] + time * 0.12,
      );
      quaternion.setFromEuler(euler);
      scaleVector.set(
        data.scale[i3],
        data.scale[i3 + 1],
        data.scale[i3 + 2],
      );

      helper.position.copy(position);
      helper.quaternion.copy(quaternion);
      helper.scale.copy(scaleVector);
      helper.updateMatrix();
      mesh.setMatrixAt(i, helper.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.rotation.y = THREE.MathUtils.damp(mesh.rotation.y, p * 0.42, 3.2, delta);
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, null, count]} frustumCulled={false}>
      <meshPhysicalMaterial
        ref={materialRef}
        color="#2a79ff"
        emissive="#0b4dd8"
        emissiveIntensity={1.6}
        roughness={0.2}
        metalness={0.06}
        clearcoat={0.85}
        clearcoatRoughness={0.2}
        transparent
        opacity={0.96}
        vertexColors
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function CapModel({ progressRef }) {
  const groupRef = useRef();
  const ribsRef = useRef();

  const shellMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0d55eb',
    emissive: '#031b61',
    emissiveIntensity: 0.75,
    metalness: 0.2,
    roughness: 0.21,
    clearcoat: 1,
    clearcoatRoughness: 0.13,
    transparent: true,
    opacity: 0,
  }), []);

  const edgeMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#347eff',
    emissive: '#0b50ff',
    emissiveIntensity: 1.05,
    metalness: 0.18,
    roughness: 0.17,
    clearcoat: 1,
    transparent: true,
    opacity: 0,
  }), []);

  const ribGeometry = useMemo(() => new THREE.BoxGeometry(0.058, 0.54, 0.145), []);

  useEffect(() => {
    const mesh = ribsRef.current;
    if (!mesh) return undefined;

    const helper = new THREE.Object3D();
    const ribCount = 112;
    for (let i = 0; i < ribCount; i += 1) {
      const angle = (i / ribCount) * TAU;
      helper.position.set(Math.cos(angle) * 2.485, -0.05, Math.sin(angle) * 2.485);
      helper.rotation.set(0, -angle, 0);
      helper.scale.set(1, 1, 1);
      helper.updateMatrix();
      mesh.setMatrixAt(i, helper.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    return () => ribGeometry.dispose();
  }, [ribGeometry]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const p = progressRef.current;
    const reveal = range(p, 0.39, 0.55);
    const dissolve = range(p, 0.66, 0.83);
    const visibility = reveal * (1 - dissolve);

    shellMaterial.opacity = visibility * 0.98;
    edgeMaterial.opacity = visibility;
    shellMaterial.emissiveIntensity = 0.42 + visibility * 0.62;
    edgeMaterial.emissiveIntensity = 0.72 + visibility * 0.85;

    const entrance = 1 - reveal;
    group.position.y = THREE.MathUtils.damp(group.position.y, entrance * 0.72 - dissolve * 0.18, 4.5, delta);
    group.scale.setScalar(0.91 + visibility * 0.09 - dissolve * 0.025);
    group.rotation.y = p * 1.03 + clock.getElapsedTime() * (0.018 + visibility * 0.009);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, (1 - visibility) * -0.035, 3.5, delta);
  });

  return (
    <group ref={groupRef}>
      <mesh material={shellMaterial} castShadow receiveShadow>
        <cylinderGeometry args={[2.46, 2.46, 0.72, 128, 1, false]} />
      </mesh>

      <mesh position={[0, 0.39, 0]} material={shellMaterial} castShadow>
        <cylinderGeometry args={[2.39, 2.43, 0.14, 128, 1, false]} />
      </mesh>

      <mesh position={[0, 0.475, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
        <torusGeometry args={[2.33, 0.085, 16, 128]} />
      </mesh>

      <mesh position={[0, -0.39, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
        <torusGeometry args={[2.42, 0.072, 14, 128]} />
      </mesh>

      <mesh position={[0, 0.49, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
        <torusGeometry args={[1.94, 0.024, 10, 128]} />
      </mesh>

      <instancedMesh ref={ribsRef} args={[ribGeometry, edgeMaterial, 112]} castShadow frustumCulled={false} />
    </group>
  );
}

function makeTubeCurves(kind, amount) {
  const random = seededRandom(kind === 'fall' ? 41 : 82);
  const geometries = [];

  for (let line = 0; line < amount; line += 1) {
    const points = [];
    const base = (line / amount) * TAU + random() * 0.2;

    for (let step = 0; step <= 70; step += 1) {
      const t = step / 70;
      if (kind === 'fall') {
        const r = 1.05 + (1 - t) * (2.5 + random() * 0.3) + Math.sin(t * Math.PI) * 0.55;
        const angle = base + Math.sin(t * Math.PI * 1.5 + line) * 0.16;
        points.push(new THREE.Vector3(
          Math.cos(angle) * r,
          8.4 - t * 15.9,
          Math.sin(angle) * r * 0.7,
        ));
      } else {
        const r = 3.75 - t * 1.2 + Math.sin(t * Math.PI * 3 + line) * 0.16;
        const angle = base + t * TAU * 4.25;
        points.push(new THREE.Vector3(
          Math.cos(angle) * r,
          4.8 - t * 8.4,
          Math.sin(angle) * r * 0.83,
        ));
      }
    }

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
    geometries.push(new THREE.TubeGeometry(curve, 100, kind === 'fall' ? 0.009 : 0.012, 4, false));
  }

  return geometries;
}

function EnergyTrails({ progressRef }) {
  const fallGroup = useRef();
  const vortexGroup = useRef();
  const fallMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#2c72ff',
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);
  const vortexMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#4797ff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);
  const fallCurves = useMemo(() => makeTubeCurves('fall', 16), []);
  const vortexCurves = useMemo(() => makeTubeCurves('vortex', 18), []);

  useEffect(() => () => {
    fallCurves.forEach((geometry) => geometry.dispose());
    vortexCurves.forEach((geometry) => geometry.dispose());
    fallMaterial.dispose();
    vortexMaterial.dispose();
  }, [fallCurves, vortexCurves, fallMaterial, vortexMaterial]);

  useFrame(({ clock }) => {
    const p = progressRef.current;
    const fallOut = range(p, 0.13, 0.38);
    const vortexIn = range(p, 0.12, 0.3);
    const vortexOut = range(p, 0.73, 0.95);

    fallMaterial.opacity = (1 - fallOut) * 0.28;
    vortexMaterial.opacity = vortexIn * (1 - vortexOut) * 0.31 + range(p, 0.67, 0.8) * 0.16;

    if (fallGroup.current) {
      fallGroup.current.rotation.y = clock.getElapsedTime() * 0.012 + p * 0.18;
    }
    if (vortexGroup.current) {
      vortexGroup.current.rotation.y = clock.getElapsedTime() * 0.026 + p * 0.56;
    }
  });

  return (
    <>
      <group ref={fallGroup}>
        {fallCurves.map((geometry, index) => (
          <mesh key={`fall-${index}`} geometry={geometry} material={fallMaterial} />
        ))}
      </group>
      <group ref={vortexGroup}>
        {vortexCurves.map((geometry, index) => (
          <mesh key={`vortex-${index}`} geometry={geometry} material={vortexMaterial} />
        ))}
      </group>
    </>
  );
}

function HaloRings({ progressRef }) {
  const groupRef = useRef();
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#2b77ff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  useFrame(({ clock }) => {
    const p = progressRef.current;
    const group = groupRef.current;
    if (!group) return;

    const inView = range(p, 0.34, 0.5) * (1 - range(p, 0.7, 0.86));
    material.opacity = inView * 0.32;
    group.rotation.y = clock.getElapsedTime() * 0.08 + p * 0.4;
    group.rotation.z = 0.03 + Math.sin(clock.getElapsedTime() * 0.35) * 0.015;
    group.scale.setScalar(0.92 + inView * 0.08);
  });

  return (
    <group ref={groupRef} position={[0, -0.22, 0]}>
      {[2.95, 3.28, 3.64, 4.05].map((radius, index) => (
        <mesh key={radius} rotation={[Math.PI / 2 + index * 0.018, 0, index * 0.12]} material={material}>
          <torusGeometry args={[radius, 0.012 + index * 0.002, 6, 160]} />
        </mesh>
      ))}
    </group>
  );
}

function BackgroundDust() {
  const geometry = useMemo(() => {
    const random = seededRandom(222);
    const count = 380;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      positions[i3] = (random() - 0.5) * 22;
      positions[i3 + 1] = (random() - 0.5) * 15;
      positions[i3 + 2] = -2 - random() * 12;
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return next;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#2764bd" size={0.018} transparent opacity={0.4} depthWrite={false} />
    </points>
  );
}

function CameraRig({ progressRef }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const p = progressRef.current;
    const product = range(p, 0.38, 0.56) * (1 - range(p, 0.7, 0.85));
    const targetX = pointer.x * 0.36;
    const targetY = 2.6 + pointer.y * 0.2 - product * 0.34;
    const targetZ = 10.7 - product * 0.85;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 2.6, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 2.6, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 2.6, delta);

    target.set(0, -0.05 - product * 0.08, 0);
    camera.lookAt(target);
  });

  return null;
}

export default function GranuleScene({ progressRef }) {
  return (
    <>
      <color attach="background" args={['#020713']} />
      <fog attach="fog" args={['#020713', 11, 27]} />

      <ambientLight intensity={0.32} color="#4b74b8" />
      <directionalLight position={[5, 8, 6]} intensity={2.1} color="#8bbaff" />
      <directionalLight position={[-5, 2, 4]} intensity={1.15} color="#1658ff" />
      <pointLight position={[0, 3.5, 2.5]} intensity={34} distance={13} decay={2} color="#1267ff" />
      <pointLight position={[0, -2.4, 1]} intensity={15} distance={10} decay={2} color="#0a31a8" />

      <BackgroundDust />
      <EnergyTrails progressRef={progressRef} />
      <HaloRings progressRef={progressRef} />
      <Granules progressRef={progressRef} />
      <CapModel progressRef={progressRef} />
      <CameraRig progressRef={progressRef} />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.35} luminanceThreshold={0.22} luminanceSmoothing={0.66} mipmapBlur />
        <Vignette eskil={false} offset={0.12} darkness={0.82} />
      </EffectComposer>
    </>
  );
}
