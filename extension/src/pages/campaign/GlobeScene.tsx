import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Stars } from "@react-three/drei";
import { feature, mesh } from "topojson-client";
import landTopology from "world-atlas/land-110m.json";
import countriesTopology from "world-atlas/countries-110m.json";
import * as THREE from "three";

const GLOBE_RADIUS = 2.05;
const LAND_OUTLINE_RADIUS = GLOBE_RADIUS + 0.028;
const BORDER_RADIUS = GLOBE_RADIUS + 0.035;
const MISSION_RADIUS = GLOBE_RADIUS + 0.095;

const latLngToVector3 = (
  lat: number,
  lng: number,
  radius: number = GLOBE_RADIUS,
) => {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
};

const createSeededRandom = (seed: number) => {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const createSurfacePoints = (count: number) => {
  const random = createSeededRandom(19450917);
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const lat = random() * 150 - 75;
    const lng = random() * 360 - 180;
    const point = latLngToVector3(lat, lng, GLOBE_RADIUS + 0.035);

    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = point.z;
  }

  return positions;
};

export const missionSites = [
  {
    id: "M-01",
    title: "赤色黎明",
    sector: "NA-07",
    operation: "DAWN STRIKE",
    status: "READY",
    coordinates: "39.0N / 98.0W",
    lat: 39,
    lng: -98,
    objective: "夺取中部通讯枢纽，切断敌方轨道链路。",
    risk: "普通",
  },
  {
    id: "M-02",
    title: "极夜防线",
    sector: "EU-13",
    operation: "NIGHT WALL",
    status: "LOCKED",
    coordinates: "52.5N / 13.4E",
    lat: 52.5,
    lng: 13.4,
    objective: "维持北部防线，拦截装甲纵队推进。",
    risk: "困难",
  },
  {
    id: "M-03",
    title: "蓝弧协议",
    sector: "PAC-04",
    operation: "BLUE ARC",
    status: "SCANNING",
    coordinates: "35.7N / 139.7E",
    lat: 35.7,
    lng: 139.7,
    objective: "护送数据核心穿越太平洋战区。",
    risk: "普通",
  },
  {
    id: "M-04",
    title: "灰烬轨道",
    sector: "SA-02",
    operation: "ASH ORBIT",
    status: "READY",
    coordinates: "15.8S / 47.9W",
    lat: -15.8,
    lng: -47.9,
    objective: "标定敌方轨道炮落点并部署干扰阵列。",
    risk: "休闲",
  },
  {
    id: "M-05",
    title: "深空回声",
    sector: "AF-09",
    operation: "DEEP ECHO",
    status: "READY",
    coordinates: "1.3S / 36.8E",
    lat: -1.3,
    lng: 36.8,
    objective: "追踪异常信号源，回收失联侦察单元。",
    risk: "困难",
  },
];

const collectCoordinateLines = (coordinates: any, lines: any[] = []) => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return lines;

  if (Array.isArray(coordinates[0]) && typeof coordinates[0][0] === "number") {
    lines.push(coordinates);
    return lines;
  }

  coordinates.forEach((child) => collectCoordinateLines(child, lines));
  return lines;
};

const createOutlineGeometry = (geometry: any, radius: number) => {
  const lines = collectCoordinateLines(geometry.coordinates);
  const positions: number[] = [];

  lines.forEach((line) => {
    for (let index = 0; index < line.length - 1; index += 1) {
      const start = latLngToVector3(line[index][1], line[index][0], radius);
      const end = latLngToVector3(
        line[index + 1][1],
        line[index + 1][0],
        radius,
      );

      positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
    }
  });

  const outlineGeometry = new THREE.BufferGeometry();
  outlineGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return outlineGeometry;
};

const createRegionRing = (
  lat: number,
  lng: number,
  angularRadius: number = 0.26,
  segments: number = 96,
) => {
  const center = latLngToVector3(lat, lng, 1).normalize();
  const up =
    Math.abs(center.y) > 0.92
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
  const tangentA = new THREE.Vector3().crossVectors(up, center).normalize();
  const tangentB = new THREE.Vector3()
    .crossVectors(center, tangentA)
    .normalize();
  const points = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const direction = tangentA
      .clone()
      .multiplyScalar(Math.cos(angle))
      .add(tangentB.clone().multiplyScalar(Math.sin(angle)));
    const ringPoint = center
      .clone()
      .multiplyScalar(Math.cos(angularRadius))
      .add(direction.multiplyScalar(Math.sin(angularRadius)))
      .normalize()
      .multiplyScalar(GLOBE_RADIUS + 0.055);

    points.push(ringPoint);
  }

  return points;
};

const MissionMarker = ({
  mission,
  isSelected,
  onSelect,
}: {
  mission: any;
  isSelected: boolean;
  onSelect: (mission: any) => void;
}) => {
  const position = useMemo(
    () => latLngToVector3(mission.lat, mission.lng, MISSION_RADIUS),
    [mission.lat, mission.lng],
  );
  const normal = useMemo(() => position.clone().normalize(), [position]);
  const markerQuaternion = useMemo(() => {
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    return quaternion;
  }, [normal]);
  const beaconLineGeometry = useMemo(() => {
    const start = normal.clone().multiplyScalar(0.055);
    const end = normal.clone().multiplyScalar(isSelected ? 0.42 : 0.28);
    return new THREE.BufferGeometry().setFromPoints([start, end]);
  }, [isSelected, normal]);

  const beaconLinePoints = useMemo(() => {
    const start = normal.clone().multiplyScalar(0.055);
    const end = normal.clone().multiplyScalar(isSelected ? 0.42 : 0.28);
    return [start, end];
  }, [isSelected, normal]);

  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(mission);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <Line points={beaconLinePoints}>
        <lineBasicMaterial
          color={isSelected ? "#ffffff" : "#00b4d8"}
          transparent
          opacity={isSelected ? 0.86 : 0.42}
          depthTest
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Line>

      <group quaternion={markerQuaternion}>
        <mesh>
          <ringGeometry args={[0.075, 0.098, 36]} />
          <meshBasicMaterial
            color={isSelected ? "#ffffff" : "#00b4d8"}
            transparent
            opacity={isSelected ? 0.9 : 0.62}
            side={THREE.DoubleSide}
            depthTest
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        <mesh scale={isSelected ? 1.55 : 1}>
          <ringGeometry args={[0.132, 0.138, 48]} />
          <meshBasicMaterial
            color={isSelected ? "#ffffff" : "#00b4d8"}
            transparent
            opacity={isSelected ? 0.55 : 0.28}
            side={THREE.DoubleSide}
            depthTest
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      <mesh
        position={normal.clone().multiplyScalar(0.015)}
        scale={isSelected ? 1.25 : 1}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(mission);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? "#ffffff" : "#00b4d8"}
          transparent
          opacity={0.95}
          depthTest
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

const Globe = ({
  selectedMissionId,
  onMissionSelect,
}: {
  selectedMissionId: string;
  onMissionSelect: (mission: any) => void;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const surfacePoints = useMemo(() => createSurfacePoints(84), []);
  const regionRing = useMemo(() => createRegionRing(39, -98), []);
  const landGeometry = useMemo(() => {
    //@ts-ignore
    const landFeature = feature(landTopology, landTopology.objects.land);
    return createOutlineGeometry(landFeature, LAND_OUTLINE_RADIUS);
  }, []);
  const countryGeometry = useMemo(() => {
    const countryMesh = mesh(
      //@ts-ignore
      countriesTopology,
      countriesTopology.objects.countries,
    );
    return createOutlineGeometry(countryMesh, BORDER_RADIUS);
  }, []);
  const regionRingGeometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(regionRing),
    [regionRing],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.09;
    groupRef.current.rotation.x = Math.sin(Date.now() * 0.00018) * 0.035;
  });

  return (
    <group ref={groupRef} rotation={[0.1, -0.35, 0]}>
      <mesh renderOrder={0}>
        <sphereGeometry args={[GLOBE_RADIUS - 0.018, 64, 32]} />
        <meshBasicMaterial
          color="#05070a"
          side={THREE.FrontSide}
          depthTest
          depthWrite
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 36, 24]} />
        <meshBasicMaterial
          color="#8e8e93"
          wireframe
          side={THREE.FrontSide}
          depthWrite
        />
      </mesh>

      <lineSegments geometry={landGeometry} renderOrder={2}>
        <lineBasicMaterial
          color="#35e7f2"
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      <lineSegments geometry={countryGeometry} renderOrder={3}>
        <lineBasicMaterial
          color="#eaffff"
          transparent
          opacity={0.78}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[surfacePoints, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#eaffff"
          size={0.035}
          transparent
          opacity={0.92}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <line>
        <primitive object={regionRingGeometry} attach="geometry" />
        <lineBasicMaterial
          attach="material"
          color="#f8ffff"
          transparent
          opacity={0.95}
        />
      </line>

      <mesh position={latLngToVector3(39, -98, GLOBE_RADIUS + 0.08)}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {missionSites.map((mission) => (
        <MissionMarker
          key={mission.id}
          mission={mission}
          isSelected={mission.id === selectedMissionId}
          onSelect={onMissionSelect}
        />
      ))}
    </group>
  );
};

const GlobeScene = ({
  selectedMissionId,
  onMissionSelect,
}: {
  selectedMissionId: string;
  onMissionSelect: (mission: any) => void;
}) => {
  return (
    <div className="h-full w-full cursor-grab active:cursor-grabbing">
      <Canvas
        camera={{ position: [0, 0.45, 5.7], fov: 43 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#05070a"]} />
        <fog attach="fog" args={["#05070a", 6, 12]} />
        <ambientLight intensity={0.72} />
        <Stars
          radius={42}
          depth={18}
          count={650}
          factor={1.8}
          saturation={0}
          fade
          speed={0.25}
        />
        <Globe
          selectedMissionId={selectedMissionId}
          onMissionSelect={onMissionSelect}
        />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.45}
        />
      </Canvas>
    </div>
  );
};

export default GlobeScene;
