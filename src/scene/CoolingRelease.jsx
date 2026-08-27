import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

const FRAME_BLOCKS = [
  [-3.42, 0, 0, 1.18, 0.42, 7.9],
  [3.42, 0, 0, 1.18, 0.42, 7.9],
  [0, 0, -3.42, 5.66, 0.42, 1.18],
  [0, 0, 3.42, 5.66, 0.42, 1.18],
];

const CORNERS = [
  [-3.18, -3.18],
  [3.18, -3.18],
  [-3.18, 3.18],
  [3.18, 3.18],
];

const BOLTS = [
  [-2.72, -2.72], [0, -3.18], [2.72, -2.72],
  [-3.18, 0], [3.18, 0],
  [-2.72, 2.72], [0, 3.18], [2.72, 2.72],
];

function makeSteelMaterial(color, roughness, metalness, envMapIntensity = 0.72) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    clearcoat: 0.08,
    clearcoatRoughness: 0.42,
    specularIntensity: 0.38,
    envMapIntensity,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  });
}

function FrameBlocks({ material }) {
  return FRAME_BLOCKS.map(([x, y, z, sx, sy, sz], index) => (
    <mesh key={index} position={[x, y, z]} material={material}>
      <boxGeometry args={[sx, sy, sz, 1, 1, 1]} />
    </mesh>
  ));
}

export default function CoolingRelease({ progressRef }) {
  const topHalfRef = useRef();
  const bottomHalfRef = useRef();
  const cavityCutawayRef = useRef();
  const nozzleRef = useRef();
  const sprueMeltRef = useRef();
  const pinsRef = useRef();
  const coolLeftRef = useRef();
  const coolRightRef = useRef();
  const heroKeyRef = useRef();
  const heroRimRef = useRef();

  const plateMaterial = useMemo(
    () => makeSteelMaterial('#18232d', 0.31, 0.58, 0.66),
    [],
  );
  const insertMaterial = useMemo(
    () => makeSteelMaterial('#566673', 0.2, 0.7, 0.82),
    [],
  );
  const edgeMaterial = useMemo(
    () => makeSteelMaterial('#8b99a4', 0.17, 0.76, 0.9),
    [],
  );
  const pillarMaterial = useMemo(
    () => makeSteelMaterial('#6f7f8b', 0.16, 0.78, 0.86),
    [],
  );
  const pinMaterial = useMemo(
    () => makeSteelMaterial('#a5b1ba', 0.14, 0.8, 0.92),
    [],
  );
  const nozzleMaterial = useMemo(
    () => makeSteelMaterial('#414f5a', 0.22, 0.68, 0.76),
    [],
  );
  const cutawayMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#72899a',
    metalness: 0.42,
    roughness: 0.29,
    clearcoat: 0.12,
    clearcoatRoughness: 0.38,
    specularIntensity: 0.34,
    envMapIntensity: 0.62,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  }), []);
  const channelMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#3f637d',
    metalness: 0.48,
    roughness: 0.27,
    clearcoat: 0.06,
    clearcoatRoughness: 0.42,
    specularIntensity: 0.3,
    envMapIntensity: 0.58,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), []);
  const meltMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#185ca5',
    metalness: 0,
    roughness: 0.16,
    clearcoat: 0.86,
    clearcoatRoughness: 0.09,
    ior: 1.47,
    specularIntensity: 0.66,
    specularColor: new THREE.Color('#cfe5f7'),
    envMapIntensity: 0.92,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), []);

  useEffect(() => () => {
    plateMaterial.dispose();
    insertMaterial.dispose();
    edgeMaterial.dispose();
    pillarMaterial.dispose();
    pinMaterial.dispose();
    nozzleMaterial.dispose();
    cutawayMaterial.dispose();
    channelMaterial.dispose();
    meltMaterial.dispose();
  }, [
    plateMaterial,
    insertMaterial,
    edgeMaterial,
    pillarMaterial,
    pinMaterial,
    nozzleMaterial,
    cutawayMaterial,
    channelMaterial,
    meltMaterial,
  ]);

  useFrame(({ clock }, delta) => {
    const p = progressRef.current;
    const topHalf = topHalfRef.current;
    const bottomHalf = bottomHalfRef.current;
    const cavityCutaway = cavityCutawayRef.current;
    const nozzle = nozzleRef.current;
    const sprueMelt = sprueMeltRef.current;
    const pins = pinsRef.current;

    // One continuous mechanical event: the mould enters while the melt is being
    // delivered, clamps before the main cavity-fill moment, stays closed through
    // holding/cooling, then opens for ejection.
    const mouldArrive = range(p, 0.385, 0.47);
    const clamp = range(p, 0.425, 0.515);
    const injection = range(p, 0.405, 0.61);
    const hold = range(p, 0.57, 0.68) * (1 - range(p, 0.69, 0.75));
    const cooling = range(p, 0.58, 0.745);
    const release = range(p, 0.745, 0.84);
    const mouldFade = 1 - range(p, 0.855, 0.915);
    const mouldVisibility = mouldArrive * mouldFade;
    const ejection = range(p, 0.785, 0.85) * (1 - range(p, 0.865, 0.915));
    const hero = range(p, 0.81, 0.925);

    const nozzleApproach = range(p, 0.365, 0.435);
    const nozzleRetract = range(p, 0.625, 0.715);
    const nozzleVisibility = nozzleApproach * (1 - range(p, 0.72, 0.79));
    const sprueFlow = range(p, 0.395, 0.455) * (1 - range(p, 0.605, 0.665));
    const fillInspect = range(p, 0.44, 0.505) * (1 - range(p, 0.635, 0.7));
    const coolInspect = range(p, 0.585, 0.63) * (1 - range(p, 0.745, 0.81));

    plateMaterial.opacity = mouldVisibility * THREE.MathUtils.lerp(0.42, 0.82, clamp);
    insertMaterial.opacity = mouldVisibility * THREE.MathUtils.lerp(0.58, 0.94, clamp);
    edgeMaterial.opacity = mouldVisibility * THREE.MathUtils.lerp(0.52, 0.9, clamp);
    pillarMaterial.opacity = mouldVisibility * THREE.MathUtils.lerp(0.58, 0.9, release);
    pinMaterial.opacity = ejection * 0.9;
    nozzleMaterial.opacity = nozzleVisibility * 0.92;
    meltMaterial.opacity = sprueFlow * THREE.MathUtils.lerp(0.58, 0.86, injection);
    cutawayMaterial.opacity = mouldVisibility
      * (fillInspect * 0.2 + coolInspect * 0.075)
      * (1 - release * 0.9);
    channelMaterial.opacity = mouldVisibility * cooling * (1 - release) * 0.32;

    if (topHalf) {
      topHalf.visible = mouldVisibility > 0.002;
      const approachY = THREE.MathUtils.lerp(1.48, 0.79, clamp);
      const openY = THREE.MathUtils.lerp(approachY, 2.62, release);
      topHalf.position.y = THREE.MathUtils.damp(topHalf.position.y, openY, 6.1, delta);
      topHalf.rotation.y = THREE.MathUtils.damp(
        topHalf.rotation.y,
        release * 0.012,
        4.8,
        delta,
      );
    }

    if (bottomHalf) {
      bottomHalf.visible = mouldVisibility > 0.002;
      const approachY = THREE.MathUtils.lerp(-1.44, -0.76, clamp);
      const openY = THREE.MathUtils.lerp(approachY, -2.45, release);
      bottomHalf.position.y = THREE.MathUtils.damp(bottomHalf.position.y, openY, 6.1, delta);
      bottomHalf.rotation.y = THREE.MathUtils.damp(
        bottomHalf.rotation.y,
        release * -0.009,
        4.8,
        delta,
      );
    }

    if (cavityCutaway) {
      cavityCutaway.visible = cutawayMaterial.opacity > 0.003;
      cavityCutaway.scale.y = THREE.MathUtils.damp(
        cavityCutaway.scale.y,
        THREE.MathUtils.lerp(1.04, 1, clamp),
        5.6,
        delta,
      );
    }

    if (nozzle) {
      nozzle.visible = nozzleVisibility > 0.003;
      const seatedY = THREE.MathUtils.lerp(2.28, 1.5, nozzleApproach);
      const targetY = THREE.MathUtils.lerp(seatedY, 2.55, nozzleRetract);
      nozzle.position.y = THREE.MathUtils.damp(nozzle.position.y, targetY, 6.2, delta);
      nozzle.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 0.45) * 0.0015 * injection);
    }

    if (sprueMelt) {
      sprueMelt.visible = sprueFlow > 0.003;

      // The sprue grows from the nozzle down toward the gate, rather than scaling
      // from its centre. Keeping the upstream end fixed makes the injection path
      // read as one directional flow into the cavity.
      const sprueLength = 0.78;
      const sprueTopY = 1.21;
      const targetScaleY = THREE.MathUtils.lerp(0.08, 1, sprueFlow);
      sprueMelt.scale.y = THREE.MathUtils.damp(
        sprueMelt.scale.y,
        targetScaleY,
        7.4,
        delta,
      );
      sprueMelt.position.y = THREE.MathUtils.damp(
        sprueMelt.position.y,
        sprueTopY - (sprueLength * targetScaleY) / 2,
        7.4,
        delta,
      );
      sprueMelt.scale.x = THREE.MathUtils.damp(sprueMelt.scale.x, 0.9 + hold * 0.12, 6, delta);
      sprueMelt.scale.z = THREE.MathUtils.damp(sprueMelt.scale.z, 0.9 + hold * 0.12, 6, delta);
    }

    if (pins) {
      pins.visible = ejection > 0.003;
      const pinStroke = range(p, 0.79, 0.845);
      pins.position.y = THREE.MathUtils.damp(
        pins.position.y,
        THREE.MathUtils.lerp(-0.67, -0.35, pinStroke),
        6.8,
        delta,
      );
    }

    // Cooling illumination begins while the mould is fully clamped and hands off
    // continuously to the final product lighting as the mould opens.
    if (coolLeftRef.current) {
      coolLeftRef.current.intensity = THREE.MathUtils.damp(
        coolLeftRef.current.intensity,
        (clamp * 0.2 + cooling * 1.04) * (1 - hero) * 1.18,
        5.2,
        delta,
      );
    }
    if (coolRightRef.current) {
      coolRightRef.current.intensity = THREE.MathUtils.damp(
        coolRightRef.current.intensity,
        (clamp * 0.16 + cooling * 0.88) * (1 - hero),
        5.2,
        delta,
      );
    }
    if (heroKeyRef.current) {
      heroKeyRef.current.intensity = THREE.MathUtils.damp(
        heroKeyRef.current.intensity,
        hero * 2.9,
        4.4,
        delta,
      );
    }
    if (heroRimRef.current) {
      heroRimRef.current.intensity = THREE.MathUtils.damp(
        heroRimRef.current.intensity,
        hero * 1.82,
        4.4,
        delta,
      );
    }
  });

  return (
    <group>
      {/* Moving A-side / cavity plate. The four-block frame keeps the actual
          cavity visible to camera instead of hiding the product behind a disc. */}
      <group ref={topHalfRef} position={[0, 1.48, 0]} visible={false}>
        <FrameBlocks material={plateMaterial} />

        <mesh position={[0, -0.16, 0]} material={insertMaterial}>
          <cylinderGeometry args={[2.82, 2.82, 0.28, 112, 1, true]} />
        </mesh>
        <mesh position={[0, -0.31, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
          <torusGeometry args={[2.69, 0.065, 10, 144]} />
        </mesh>
        <mesh position={[0, -0.29, 0]} rotation={[-Math.PI / 2, 0, 0]} material={insertMaterial}>
          <ringGeometry args={[2.63, 2.82, 112]} />
        </mesh>

        {/* Sprue bushing and the polished seat around the injection point. */}
        <mesh position={[0, 0.1, 0]} material={edgeMaterial}>
          <cylinderGeometry args={[0.24, 0.18, 0.28, 48]} />
        </mesh>
        <mesh position={[0, -0.035, 0]} rotation={[Math.PI / 2, 0, 0]} material={insertMaterial}>
          <torusGeometry args={[0.25, 0.028, 8, 64]} />
        </mesh>

        {BOLTS.map(([x, z], index) => (
          <mesh key={index} position={[x, 0.235, z]} material={edgeMaterial}>
            <cylinderGeometry args={[0.075, 0.075, 0.055, 20]} />
          </mesh>
        ))}

        {CORNERS.map(([x, z], index) => (
          <mesh key={index} position={[x, -0.05, z]} rotation={[-Math.PI / 2, 0, 0]} material={insertMaterial}>
            <torusGeometry args={[0.19, 0.035, 8, 36]} />
          </mesh>
        ))}
      </group>

      {/* Moving B-side / core and ejector plate. */}
      <group ref={bottomHalfRef} position={[0, -1.44, 0]} visible={false}>
        <FrameBlocks material={plateMaterial} />

        <mesh position={[0, 0.17, 0]} material={insertMaterial}>
          <cylinderGeometry args={[2.68, 2.68, 0.3, 112, 1, true]} />
        </mesh>
        <mesh position={[0, 0.33, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
          <torusGeometry args={[2.57, 0.07, 10, 144]} />
        </mesh>
        <mesh position={[0, 0.315, 0]} rotation={[-Math.PI / 2, 0, 0]} material={insertMaterial}>
          <ringGeometry args={[2.45, 2.7, 112]} />
        </mesh>

        {/* Guide pillars make the opening movement read as an actual mould set. */}
        {CORNERS.map(([x, z], index) => (
          <mesh key={index} position={[x, 0.82, z]} material={pillarMaterial}>
            <cylinderGeometry args={[0.145, 0.145, 1.72, 28]} />
          </mesh>
        ))}

        {/* Concentric cutaway cues stand in for buried cooling circuits. They are
            visible only while cooling is active and remain non-emissive. */}
        {[1.12, 1.72, 2.18].map((radius) => (
          <mesh
            key={radius}
            position={[0, 0.345, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={channelMaterial}
          >
            <torusGeometry args={[radius, 0.018, 6, 112]} />
          </mesh>
        ))}
      </group>

      {/* Temporary inspection cutaway. It outlines the cavity envelope while the
          polymer is filling, then disappears as cooling takes over. */}
      <group ref={cavityCutawayRef} visible={false}>
        <mesh material={cutawayMaterial}>
          <cylinderGeometry args={[2.62, 2.62, 0.88, 144, 1, true]} />
        </mesh>
        <mesh position={[0, 0.44, 0]} rotation={[-Math.PI / 2, 0, 0]} material={cutawayMaterial}>
          <ringGeometry args={[2.47, 2.62, 144]} />
        </mesh>
        <mesh position={[0, -0.44, 0]} rotation={[-Math.PI / 2, 0, 0]} material={cutawayMaterial}>
          <ringGeometry args={[2.47, 2.62, 144]} />
        </mesh>
        <mesh position={[0, 0.425, 0]} rotation={[Math.PI / 2, 0, 0]} material={cutawayMaterial}>
          <torusGeometry args={[2.54, 0.018, 6, 144]} />
        </mesh>
      </group>

      {/* Machine nozzle: it seats into the sprue bushing before fill and retracts
          after packing. The melt column bridges the previous liquid-flow stage to
          the gate at the centre of the real cap. */}
      <group ref={nozzleRef} position={[0, 2.28, 0]} visible={false}>
        <mesh material={nozzleMaterial}>
          <cylinderGeometry args={[0.34, 0.19, 0.72, 48]} />
        </mesh>
        <mesh position={[0, 0.46, 0]} material={nozzleMaterial}>
          <cylinderGeometry args={[0.46, 0.34, 0.24, 48]} />
        </mesh>
        <mesh position={[0, -0.39, 0]} material={edgeMaterial}>
          <cylinderGeometry args={[0.19, 0.14, 0.12, 40]} />
        </mesh>
      </group>

      <mesh ref={sprueMeltRef} position={[0, 1.18, 0]} material={meltMaterial} visible={false}>
        <cylinderGeometry args={[0.052, 0.076, 0.78, 28]} />
      </mesh>
      <mesh position={[0, 0.426, 0]} material={meltMaterial}>
        <cylinderGeometry args={[0.078, 0.09, 0.018, 32]} />
      </mesh>

      <group ref={pinsRef} position={[0, -0.67, 0]} visible={false}>
        {[
          [-1.28, 0, -1.1],
          [1.28, 0, -1.1],
          [-1.28, 0, 1.1],
          [1.28, 0, 1.1],
        ].map(([x, y, z], index) => (
          <mesh key={index} position={[x, y, z]} material={pinMaterial}>
            <cylinderGeometry args={[0.05, 0.05, 0.4, 20]} />
          </mesh>
        ))}
      </group>

      <pointLight
        ref={coolLeftRef}
        position={[-3.8, 2.4, 4.8]}
        color="#9bc9ee"
        intensity={0}
        distance={7}
        decay={2}
      />
      <pointLight
        ref={coolRightRef}
        position={[3.5, 1.5, 3.7]}
        color="#78a9d1"
        intensity={0}
        distance={6.5}
        decay={2}
      />

      <spotLight
        ref={heroKeyRef}
        position={[-4.2, 5.2, 6.4]}
        color="#dcecff"
        intensity={0}
        angle={0.52}
        penumbra={0.78}
        distance={13}
        decay={2}
        target-position={[0, 0, 0]}
      />
      <spotLight
        ref={heroRimRef}
        position={[4.8, 2.6, -3.8]}
        color="#659bd1"
        intensity={0}
        angle={0.64}
        penumbra={0.86}
        distance={12}
        decay={2}
        target-position={[0, 0, 0]}
      />
    </group>
  );
}
