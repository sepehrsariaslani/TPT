import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const range = (value, start, end) => smooth((value - start) / (end - start));

function steelMaterial(color, roughness = 0.3, metalness = 0.62, envMapIntensity = 0.68) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    clearcoat: 0.045,
    clearcoatRoughness: 0.42,
    specularIntensity: 0.36,
    envMapIntensity,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
  });
}

function PlateFrame({ material, edgeMaterial, top = false }) {
  const y = top ? -0.02 : 0.02;
  return (
    <>
      <mesh position={[-3.18, y, 0]} material={material}>
        <boxGeometry args={[1.08, 0.24, 6.75]} />
      </mesh>
      <mesh position={[3.18, y, 0]} material={material}>
        <boxGeometry args={[1.08, 0.24, 6.75]} />
      </mesh>
      <mesh position={[0, y, -3.18]} material={material}>
        <boxGeometry args={[5.28, 0.24, 1.08]} />
      </mesh>
      <mesh position={[0, y, 3.18]} material={material}>
        <boxGeometry args={[5.28, 0.24, 1.08]} />
      </mesh>

      <mesh
        position={[0, top ? -0.145 : 0.145, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={edgeMaterial}
      >
        <ringGeometry args={[2.57, 2.88, 128]} />
      </mesh>
      <mesh
        position={[0, top ? -0.154 : 0.154, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={edgeMaterial}
      >
        <torusGeometry args={[2.57, 0.052, 8, 144]} />
      </mesh>

      {[[-2.95, -2.95], [2.95, -2.95], [-2.95, 2.95], [2.95, 2.95]].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, top ? 0.145 : -0.145, z]} material={edgeMaterial}>
          <cylinderGeometry args={[0.09, 0.09, 0.07, 24]} />
        </mesh>
      ))}
    </>
  );
}

export default function CoolingRelease({ progressRef }) {
  const topRef = useRef();
  const bottomRef = useRef();
  const guideRef = useRef();
  const nozzleRef = useRef();
  const sprueRef = useRef();
  const pinsRef = useRef();
  const coolLeftRef = useRef();
  const coolRightRef = useRef();
  const heroKeyRef = useRef();
  const heroRimRef = useRef();

  const plateMaterial = useMemo(() => steelMaterial('#263540', 0.32, 0.6, 0.66), []);
  const frameMaterial = useMemo(() => steelMaterial('#18242d', 0.38, 0.52, 0.56), []);
  const edgeMaterial = useMemo(() => steelMaterial('#7f8d98', 0.2, 0.74, 0.82), []);
  const guideMaterial = useMemo(() => steelMaterial('#667681', 0.18, 0.76, 0.8), []);
  const nozzleMaterial = useMemo(() => steelMaterial('#566672', 0.22, 0.7, 0.76), []);
  const pinMaterial = useMemo(() => steelMaterial('#9ca8b1', 0.17, 0.78, 0.86), []);
  const meltMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1d5d9a',
    metalness: 0,
    roughness: 0.2,
    clearcoat: 0.46,
    clearcoatRoughness: 0.14,
    ior: 1.47,
    specularIntensity: 0.47,
    specularColor: new THREE.Color('#c5d8e7'),
    envMapIntensity: 0.74,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
  }), []);

  useEffect(() => () => {
    plateMaterial.dispose();
    frameMaterial.dispose();
    edgeMaterial.dispose();
    guideMaterial.dispose();
    nozzleMaterial.dispose();
    pinMaterial.dispose();
    meltMaterial.dispose();
  }, [
    plateMaterial,
    frameMaterial,
    edgeMaterial,
    guideMaterial,
    nozzleMaterial,
    pinMaterial,
    meltMaterial,
  ]);

  useFrame((_, delta) => {
    const p = progressRef.current;
    const top = topRef.current;
    const bottom = bottomRef.current;
    const guides = guideRef.current;
    const nozzle = nozzleRef.current;
    const sprue = sprueRef.current;
    const pins = pinsRef.current;

    const mouldArrive = range(p, 0.405, 0.475);
    const clamp = range(p, 0.445, 0.525);
    const injection = range(p, 0.455, 0.64);
    const cooling = range(p, 0.615, 0.775);
    const release = range(p, 0.755, 0.84);
    const mouldFade = 1 - range(p, 0.855, 0.915);
    const visibility = mouldArrive * mouldFade;
    const ejection = range(p, 0.79, 0.845) * (1 - range(p, 0.865, 0.91));
    const hero = range(p, 0.815, 0.93);

    const nozzleApproach = range(p, 0.405, 0.48);
    const nozzleRetract = range(p, 0.645, 0.715);
    const nozzleVisibility = nozzleApproach * (1 - range(p, 0.735, 0.79));
    const sprueFlow = range(p, 0.465, 0.515) * (1 - range(p, 0.63, 0.69));

    frameMaterial.opacity = visibility * THREE.MathUtils.lerp(0.58, 0.88, clamp);
    plateMaterial.opacity = visibility * THREE.MathUtils.lerp(0.62, 0.92, clamp);
    edgeMaterial.opacity = visibility * THREE.MathUtils.lerp(0.72, 0.96, clamp);
    guideMaterial.opacity = visibility * THREE.MathUtils.lerp(0.55, 0.86, clamp);
    nozzleMaterial.opacity = nozzleVisibility * 0.9;
    pinMaterial.opacity = ejection * 0.84;
    meltMaterial.opacity = sprueFlow * THREE.MathUtils.lerp(0.42, 0.72, injection);

    if (top) {
      top.visible = visibility > 0.003;
      const seated = THREE.MathUtils.lerp(1.58, 0.69, clamp);
      const open = THREE.MathUtils.lerp(seated, 1.75, release);
      top.position.y = THREE.MathUtils.damp(top.position.y, open, 6.2, delta);
    }

    if (bottom) {
      bottom.visible = visibility > 0.003;
      const seated = THREE.MathUtils.lerp(-1.5, -0.67, clamp);
      const open = THREE.MathUtils.lerp(seated, -1.68, release);
      bottom.position.y = THREE.MathUtils.damp(bottom.position.y, open, 6.2, delta);
    }

    if (guides && top && bottom) {
      guides.visible = visibility > 0.003;
      const gap = Math.max(0.6, top.position.y - bottom.position.y);
      guides.position.y = (top.position.y + bottom.position.y) * 0.5;
      guides.scale.y = THREE.MathUtils.damp(guides.scale.y, gap / 1.65, 6, delta);
    }

    if (nozzle) {
      nozzle.visible = nozzleVisibility > 0.003;
      const seatedY = THREE.MathUtils.lerp(2.65, 1.18, nozzleApproach);
      const targetY = THREE.MathUtils.lerp(seatedY, 2.42, nozzleRetract);
      nozzle.position.y = THREE.MathUtils.damp(nozzle.position.y, targetY, 6.4, delta);
    }

    if (sprue) {
      sprue.visible = sprueFlow > 0.003;
      const length = 0.62;
      const topY = 1.02;
      const targetScaleY = THREE.MathUtils.lerp(0.05, 1, sprueFlow);
      sprue.scale.y = THREE.MathUtils.damp(sprue.scale.y, targetScaleY, 7.3, delta);
      sprue.position.y = THREE.MathUtils.damp(
        sprue.position.y,
        topY - (length * targetScaleY) / 2,
        7.3,
        delta,
      );
      const pressure = THREE.MathUtils.lerp(0.86, 1, range(p, 0.54, 0.63));
      sprue.scale.x = THREE.MathUtils.damp(sprue.scale.x, pressure, 6, delta);
      sprue.scale.z = THREE.MathUtils.damp(sprue.scale.z, pressure, 6, delta);
    }

    if (pins) {
      pins.visible = ejection > 0.003;
      const stroke = range(p, 0.795, 0.845);
      pins.position.y = THREE.MathUtils.damp(
        pins.position.y,
        THREE.MathUtils.lerp(-0.62, -0.31, stroke),
        6.8,
        delta,
      );
    }

    if (coolLeftRef.current) {
      coolLeftRef.current.intensity = THREE.MathUtils.damp(
        coolLeftRef.current.intensity,
        cooling * (1 - hero) * 0.78,
        5,
        delta,
      );
    }
    if (coolRightRef.current) {
      coolRightRef.current.intensity = THREE.MathUtils.damp(
        coolRightRef.current.intensity,
        cooling * (1 - hero) * 0.64,
        5,
        delta,
      );
    }
    if (heroKeyRef.current) {
      heroKeyRef.current.intensity = THREE.MathUtils.damp(
        heroKeyRef.current.intensity,
        hero * 2.35,
        4.4,
        delta,
      );
    }
    if (heroRimRef.current) {
      heroRimRef.current.intensity = THREE.MathUtils.damp(
        heroRimRef.current.intensity,
        hero * 1.15,
        4.4,
        delta,
      );
    }
  });

  return (
    <group>
      <group ref={topRef} position={[0, 1.58, 0]} visible={false}>
        <PlateFrame material={frameMaterial} edgeMaterial={edgeMaterial} top />
        <mesh position={[0, -0.06, 0]} material={plateMaterial}>
          <cylinderGeometry args={[2.86, 2.86, 0.17, 128, 1, true]} />
        </mesh>
        <mesh position={[0, -0.165, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
          <ringGeometry args={[0.14, 0.27, 48]} />
        </mesh>
      </group>

      <group ref={bottomRef} position={[0, -1.5, 0]} visible={false}>
        <PlateFrame material={frameMaterial} edgeMaterial={edgeMaterial} />
        <mesh position={[0, 0.06, 0]} material={plateMaterial}>
          <cylinderGeometry args={[2.84, 2.84, 0.17, 128, 1, true]} />
        </mesh>
        <mesh position={[0, 0.165, 0]} rotation={[Math.PI / 2, 0, 0]} material={edgeMaterial}>
          <ringGeometry args={[2.34, 2.48, 112]} />
        </mesh>
      </group>

      <group ref={guideRef} visible={false}>
        {[[-3.02, -3.02], [3.02, -3.02], [-3.02, 3.02], [3.02, 3.02]].map(([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 0, z]} material={guideMaterial}>
            <cylinderGeometry args={[0.075, 0.075, 1.65, 24]} />
          </mesh>
        ))}
      </group>

      <group ref={nozzleRef} position={[0, 2.65, 0]} visible={false}>
        <mesh position={[0, 0.15, 0]} material={nozzleMaterial}>
          <cylinderGeometry args={[0.22, 0.17, 0.34, 40]} />
        </mesh>
        <mesh position={[0, -0.18, 0]} material={nozzleMaterial}>
          <cylinderGeometry args={[0.17, 0.05, 0.38, 40]} />
        </mesh>
      </group>

      <mesh ref={sprueRef} position={[0, 0.72, 0]} material={meltMaterial} visible={false}>
        <cylinderGeometry args={[0.055, 0.045, 0.62, 28]} />
      </mesh>

      <group ref={pinsRef} position={[0, -0.62, 0]} visible={false}>
        {[-0.76, 0, 0.76].map((x) => (
          <mesh key={x} position={[x, 0, 0]} material={pinMaterial}>
            <cylinderGeometry args={[0.038, 0.038, 0.34, 18]} />
          </mesh>
        ))}
      </group>

      <pointLight ref={coolLeftRef} position={[-3.8, 1.8, 3.4]} color="#8ca9c2" intensity={0} distance={7} decay={2} />
      <pointLight ref={coolRightRef} position={[3.7, 1.4, 2.8]} color="#718fae" intensity={0} distance={7} decay={2} />
      <pointLight ref={heroKeyRef} position={[4.5, 5.8, 5.2]} color="#f2f6fb" intensity={0} distance={9} decay={2} />
      <pointLight ref={heroRimRef} position={[-4.4, 3.2, -2.8]} color="#7fa9d4" intensity={0} distance={8} decay={2} />
    </group>
  );
}
