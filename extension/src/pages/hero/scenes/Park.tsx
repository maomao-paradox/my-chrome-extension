import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, type Group } from "three";
import { getBirdMotion } from "../systems/birdMotion";
import { createCanopySnowGeometry } from "../systems/canopySnow";
import {
  getWeatherEffects,
  shouldShowBirds,
  type WeatherType,
} from "../systems/weather";

const canopyColors = ["#71865c", "#849365", "#657a57", "#9a9b69", "#526b53"];
const canopySnowGeometry = createCanopySnowGeometry();

const Tree = ({
  windStrength,
  snowy,
}: {
  windStrength: number;
  snowy: boolean;
}) => {
  const canopyRef = useRef<Group | null>(null);
  const reduceMotionRef = useRef(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useFrame(({ clock }) => {
    if (!canopyRef.current || reduceMotionRef.current) {
      return;
    }
    canopyRef.current.rotation.z =
      Math.sin(clock.elapsedTime * 0.65) * windStrength * 0.045;
    canopyRef.current.rotation.x =
      Math.cos(clock.elapsedTime * 0.42) * windStrength * 0.018;
  });

  useEffect(() => {
    const preference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const updatePreference = (event: MediaQueryListEvent) => {
      reduceMotionRef.current = event.matches;
    };
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  return (
    <group position={[-1.7, -2.4, -1]} scale={1.16}>
      <mesh position={[0, 1.45, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.32, 2.9, 7]} />
        <meshStandardMaterial color="#705345" roughness={0.96} flatShading />
      </mesh>
      <group ref={canopyRef} position={[0, 3.05, 0]}>
        {[
          [-0.7, 0.05, 0, 1.45, 0.62, 0.7, -0.16],
          [0.55, 0.22, -0.08, 1.35, 0.58, 0.66, 0.1],
          [-0.12, 0.75, 0.06, 1.24, 0.62, 0.7, -0.04],
          [-0.62, 0.83, -0.12, 0.96, 0.48, 0.58, 0.12],
          [0.62, 0.95, 0.02, 0.96, 0.47, 0.56, -0.14],
          [0.05, 1.3, -0.04, 0.87, 0.52, 0.6, 0.05],
        ].map(([x, y, z, scaleX, scaleY, scaleZ, rotation], index) => (
          <group
            key={index}
            position={[x, y, z]}
            rotation={[0, 0, rotation]}
            scale={[scaleX, scaleY, scaleZ]}
          >
            <mesh castShadow>
              <icosahedronGeometry args={[1, 2]} />
              <meshStandardMaterial
                color={canopyColors[index % canopyColors.length]}
                roughness={1}
                flatShading
              />
            </mesh>
            {snowy && (
              <mesh geometry={canopySnowGeometry}>
                <meshStandardMaterial
                  color="#dce3de"
                  roughness={0.96}
                  flatShading
                />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
};

const Bench = ({ snowy }: { snowy: boolean }) => (
  <group position={[1.35, -2.1, 1.2]} scale={1.16}>
    {[-0.38, -0.12, 0.14].map((y, index) => (
      <group key={index} position={[0, y + 0.55, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.05, 0.12, 0.55]} />
          <meshStandardMaterial
            color={index === 1 ? "#987955" : "#81684d"}
            roughness={0.92}
            flatShading
          />
        </mesh>
        {snowy && (
          <mesh position={[0, 0.067, 0]}>
            <boxGeometry args={[2.98, 0.025, 0.49]} />
            <meshStandardMaterial
              color="#dce3de"
              roughness={0.96}
              flatShading
            />
          </mesh>
        )}
      </group>
    ))}
    {[-1.18, 1.18].map((x) => (
      <group key={x} position={[x, 0, 0]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.14, 0.82, 0.48]} />
          <meshStandardMaterial color="#4b5544" roughness={0.95} flatShading />
        </mesh>
        <mesh position={[0, 0.64, -0.22]} rotation={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 1.05, 0.12]} />
          <meshStandardMaterial color="#59604a" roughness={0.95} flatShading />
        </mesh>
        {snowy && (
          <mesh position={[0, 1.17, -0.22]} rotation={[-0.12, 0, 0]}>
            <boxGeometry args={[0.18, 0.035, 0.14]} />
            <meshStandardMaterial
              color="#dce3de"
              roughness={0.96}
              flatShading
            />
          </mesh>
        )}
      </group>
    ))}
  </group>
);

const Bird = ({
  position,
  progress,
  index,
  viewportWidth,
  windStrength,
}: {
  position: [number, number, number];
  progress: number;
  index: number;
  viewportWidth: number;
  windStrength: number;
}) => {
  const groupRef = useRef<Group | null>(null);
  const reduceMotionRef = useRef(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const motion = getBirdMotion(progress, viewportWidth, position, index);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.visible = motion.visible;
    groupRef.current.position.set(...motion.position);

    if (motion.phase === "grounded" && !reduceMotionRef.current) {
      groupRef.current.position.x +=
        Math.sin(clock.elapsedTime * 0.5 + index) * windStrength * 0.04;
      groupRef.current.position.y +=
        Math.sin(clock.elapsedTime * 1.2 + index) * 0.035;
      groupRef.current.rotation.y =
        Math.sin(clock.elapsedTime * 0.4 + index) * 0.08;
      groupRef.current.rotation.z =
        Math.sin(clock.elapsedTime * 0.7 + index) * windStrength * 0.05;
    } else {
      groupRef.current.rotation.y = motion.direction * 0.08;
      groupRef.current.rotation.z = 0;
    }
  });

  useEffect(() => {
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const updateMotionPreference = (event: MediaQueryListEvent) => {
      reduceMotionRef.current = event.matches;
    };

    motionPreference.addEventListener("change", updateMotionPreference);
    return () =>
      motionPreference.removeEventListener("change", updateMotionPreference);
  }, []);

  return (
    <group ref={groupRef} position={motion.position} visible={motion.visible}>
      <mesh scale={[0.26, 0.19, 0.38]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#c8ab78" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.14, -0.22]} scale={0.16} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#d4b989" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.12, -0.39]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.065, 0.2, 4]} />
        <meshStandardMaterial color="#ad7251" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.12, 0.025, 0.02]} rotation={[0, 0, -0.2]} castShadow>
        <sphereGeometry args={[0.11, 6, 5]} />
        <meshStandardMaterial color="#a78c63" roughness={1} flatShading />
      </mesh>
    </group>
  );
};

const GroundBrushwork = () => {
  const strokes = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => {
        const x = ((index * 37) % 97) / 97;
        const z = ((index * 61) % 89) / 89;
        const tint = new Color(
          ["#c0a47b", "#667451", "#d3a071", "#8f795e"][index % 4],
        );
        return {
          position: [(x - 0.5) * 12, -2.46, -3 + z * 5] as [
            number,
            number,
            number,
          ],
          rotation: ((index * 17) % 35) / 100 - 0.17,
          scale: [
            0.24 + (index % 4) * 0.13,
            0.025,
            0.22 + (index % 3) * 0.07,
          ] as [number, number, number],
          color: `#${tint.getHexString()}`,
        };
      }),
    [],
  );

  return (
    <group>
      {strokes.map((stroke, index) => (
        <mesh
          key={index}
          position={stroke.position}
          rotation={[-Math.PI / 2, 0, stroke.rotation]}
          scale={stroke.scale}
        >
          <circleGeometry args={[1, 7]} />
          <meshStandardMaterial
            color={stroke.color}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
};

export const Park = ({
  progress,
  weather,
}: {
  progress: number;
  weather: WeatherType;
}) => {
  const { viewport } = useThree();
  const windStrength = getWeatherEffects(weather).windStrength;
  const snowy = weather === "下雪";
  const showBirds = shouldShowBirds(weather);
  const scale = Math.min(1.16, viewport.width / 9);
  const horizontalOffset = viewport.width * 0.08;
  const birdViewportWidth = viewport.width / scale;
  const birdGroundY = -2.5 / scale + 0.22;

  return (
    <group position={[horizontalOffset, 0, 0]} scale={scale}>
      <GroundBrushwork />
      <Tree windStrength={windStrength} snowy={snowy} />
      <Bench snowy={snowy} />
      {showBirds && (
        <>
          <Bird
            position={[-0.1, birdGroundY, 2.1]}
            progress={progress}
            index={0}
            viewportWidth={birdViewportWidth}
            windStrength={windStrength}
          />
          <Bird
            position={[2.3, birdGroundY, 2.55]}
            progress={progress}
            index={1}
            viewportWidth={birdViewportWidth}
            windStrength={windStrength}
          />
          <Bird
            position={[3.35, birdGroundY, 2.55]}
            progress={progress}
            index={2}
            viewportWidth={birdViewportWidth}
            windStrength={windStrength}
          />
        </>
      )}
    </group>
  );
};
