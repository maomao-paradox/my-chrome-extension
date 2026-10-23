import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  type NormalOrGLBufferAttributes,
  type Group,
  type LineSegments,
  type PointLight,
  type Points,
} from "three";
import {
  getWeatherEffects,
  type WeatherType,
} from "../systems/weather";

const RAIN_COUNT = 150;
const SNOW_LAYERS = [
  { count: 46, size: 1.5, opacity: 0.34, speed: [0.35, 0.65], drift: 0.5 },
  { count: 34, size: 2.4, opacity: 0.48, speed: [0.6, 1], drift: 0.85 },
  { count: 20, size: 3.4, opacity: 0.38, speed: [0.9, 1.35], drift: 1.15 },
] as const;

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

const useMotionPreference = () => {
  const motionAllowedRef = useRef(
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const preference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const updatePreference = (event: MediaQueryListEvent) => {
      motionAllowedRef.current = !event.matches;
    };
    preference.addEventListener("change", updatePreference);
    return () =>
      preference.removeEventListener("change", updatePreference);
  }, []);

  return motionAllowedRef;
};

const createRainGeometry = (width: number, height: number) => {
  const positions = new Float32Array(RAIN_COUNT * 6);
  const speeds = new Float32Array(RAIN_COUNT);
  const drifts = new Float32Array(RAIN_COUNT);
  const lengths = new Float32Array(RAIN_COUNT);

  for (let index = 0; index < RAIN_COUNT; index += 1) {
    const offset = index * 6;
    const x = randomBetween(-width / 2, width / 2);
    const y = randomBetween(-height / 2, height / 2);
    const z = randomBetween(1.5, 8);
    const length = randomBetween(0.16, 0.34);
    positions.set([x, y, z, x - length * 0.38, y + length, z], offset);
    speeds[index] = randomBetween(5.5, 9);
    drifts[index] = randomBetween(-0.7, -0.35);
    lengths[index] = length;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return { geometry, speeds, drifts, lengths };
};

const Rain = ({ windStrength }: { windStrength: number }) => {
  const linesRef = useRef<LineSegments | null>(null);
  const motionAllowedRef = useMotionPreference();
  const { viewport } = useThree();
  const { geometry, speeds, drifts, lengths } = useMemo(
    () => createRainGeometry(viewport.width, viewport.height),
    [viewport.height, viewport.width],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (!motionAllowedRef.current) {
      return;
    }
    const positions = linesRef.current?.geometry.attributes.position;
    if (!positions) {
      return;
    }

    const values = positions.array as Float32Array;
    const bottom = -viewport.height / 2 - 0.4;
    const top = viewport.height / 2 + 0.4;
    const horizontalLimit = viewport.width / 2 + 0.5;
    const step = Math.min(delta, 0.05);

    for (let index = 0; index < RAIN_COUNT; index += 1) {
      const offset = index * 6;
      let x = values[offset] + drifts[index] * windStrength * step;
      let y = values[offset + 1] - speeds[index] * step;
      const z = values[offset + 2];

      if (y < bottom) {
        y = top;
        x = randomBetween(-horizontalLimit, horizontalLimit);
      }
      if (x < -horizontalLimit) {
        x = horizontalLimit;
      }

      values[offset] = x;
      values[offset + 1] = y;
      values[offset + 3] = x - lengths[index] * 0.38;
      values[offset + 4] = y + lengths[index];
    }

    positions.needsUpdate = true;
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        color="#d9e0d9"
        transparent
        opacity={0.24}
        depthWrite={false}
      />
    </lineSegments>
  );
};

const createSnowGeometry = (
  width: number,
  height: number,
  count: number,
  speedRange: readonly [number, number],
) => {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    positions.set(
      [
        randomBetween(-width / 2, width / 2),
        randomBetween(-height / 2, height / 2),
        randomBetween(1.5, 8),
      ],
      index * 3,
    );
    speeds[index] = randomBetween(speedRange[0], speedRange[1]);
    phases[index] = randomBetween(0, Math.PI * 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return { geometry, speeds, phases };
};

const Snow = ({ windStrength }: { windStrength: number }) => {
  const pointsRefs = useRef<
    Array<Points<BufferGeometry<NormalOrGLBufferAttributes>> | null>
  >([]);
  const motionAllowedRef = useMotionPreference();
  const { viewport } = useThree();
  const layers = useMemo(
    () =>
      SNOW_LAYERS.map((layer) => ({
        ...layer,
        ...createSnowGeometry(
          viewport.width,
          viewport.height,
          layer.count,
          layer.speed,
        ),
      })),
    [viewport.height, viewport.width],
  );

  useEffect(
    () => () => layers.forEach((layer) => layer.geometry.dispose()),
    [layers],
  );

  useFrame(({ clock }, delta) => {
    if (!motionAllowedRef.current) {
      return;
    }
    const bottom = -viewport.height / 2 - 0.4;
    const top = viewport.height / 2 + 0.4;
    const horizontalLimit = viewport.width / 2 + 0.5;
    const step = Math.min(delta, 0.05);

    layers.forEach((layer, layerIndex) => {
      const positionAttribute =
        pointsRefs.current[layerIndex]?.geometry.getAttribute("position");
      if (
        !(positionAttribute instanceof BufferAttribute) ||
        !(positionAttribute.array instanceof Float32Array)
      ) {
        return;
      }
      const values = positionAttribute.array;
      for (let index = 0; index < layer.count; index += 1) {
        const offset = index * 3;
        let x =
          values[offset] +
          (Math.sin(clock.elapsedTime * 0.65 + layer.phases[index]) * 0.28 +
            windStrength * layer.drift) *
            step;
        let y = values[offset + 1] - layer.speeds[index] * step;

        if (y < bottom) {
          y = top;
          x = randomBetween(-horizontalLimit, horizontalLimit);
        }
        if (x > horizontalLimit) {
          x = -horizontalLimit;
        }

        values[offset] = x;
        values[offset + 1] = y;
      }
      positionAttribute.needsUpdate = true;
    });
  });

  return (
    <>
      {layers.map((layer, index) => (
        <points
          key={index}
          ref={(node) => {
            pointsRefs.current[index] = node;
          }}
          geometry={layer.geometry}
          frustumCulled={false}
        >
          <pointsMaterial
            color={index === 0 ? "#d7e0dd" : "#f0eee5"}
            size={layer.size}
            sizeAttenuation={false}
            transparent
            opacity={layer.opacity}
            depthWrite={false}
          />
        </points>
      ))}
    </>
  );
};

const CloudBank = ({
  opacity,
  color,
  viewportWidth,
  viewportHeight,
  windStrength,
}: {
  opacity: number;
  color: string;
  viewportWidth: number;
  viewportHeight: number;
  windStrength: number;
}) => {
  const bankRef = useRef<Group | null>(null);
  const motionAllowedRef = useMotionPreference();

  useFrame(({ clock }) => {
    if (
      !motionAllowedRef.current ||
      !bankRef.current ||
      windStrength === 0
    ) {
      return;
    }
    bankRef.current.position.x =
      Math.sin(clock.elapsedTime * 0.16) * windStrength * 0.8;
  });

  if (opacity === 0) {
    return null;
  }

  const cloudCenters = [
    [-0.38, 0.31, 0.88],
    [0.02, 0.39, 1.12],
    [0.35, 0.3, 0.82],
    [0.2, 0.25, 0.7],
  ];

  return (
    <group
      ref={bankRef}
      position={[0, viewportHeight * 0.31, -7]}
      scale={[viewportWidth * 0.78, viewportHeight * 0.15, 1]}
    >
      {[-0.62, 0.05, 0.68].map((x, bankIndex) => (
        <group
          key={x}
          position={[x, bankIndex === 1 ? 0.02 : -0.08, 0]}
          scale={bankIndex === 1 ? 1.2 : 0.88}
        >
          {cloudCenters.map(([centerX, centerY, size], index) => (
            <mesh
              key={index}
              position={[centerX + (bankIndex - 1) * 0.18, centerY, 0]}
              scale={[size, size * 0.56, 0.2]}
            >
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial
                color={color}
                roughness={1}
                flatShading
                transparent
                opacity={opacity * (index === 3 ? 0.5 : 0.78)}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

const ThunderFlash = ({ active }: { active: boolean }) => {
  const lightRef = useRef<PointLight | null>(null);
  const motionAllowedRef = useMotionPreference();

  useFrame(({ clock }) => {
    if (!lightRef.current || !motionAllowedRef.current) {
      if (lightRef.current) {
        lightRef.current.intensity = 0;
      }
      return;
    }
    if (!active) {
      lightRef.current.intensity = 0;
      return;
    }

    const phase = clock.elapsedTime % 13;
    const firstFlash = phase > 4.1 && phase < 4.2 ? 3.6 : 0;
    const secondFlash = phase > 4.34 && phase < 4.42 ? 2.2 : 0;
    lightRef.current.intensity = Math.max(firstFlash, secondFlash);
  });

  return (
    <pointLight
      ref={lightRef}
      position={[0, 4, 5]}
      color="#d8e1ed"
      intensity={0}
      distance={24}
      decay={2}
    />
  );
};

export const WeatherAtmosphere = ({ weather }: { weather: WeatherType }) => {
  const { viewport } = useThree();
  const effects = getWeatherEffects(weather);
  const cloudColor =
    weather === "雷雨"
      ? "#526171"
      : weather === "下雪"
        ? "#c9d2cf"
        : weather === "大风"
          ? "#89918a"
          : "#929b9b";

  return (
    <>
      <CloudBank
        opacity={effects.cloudCover}
        color={cloudColor}
        viewportWidth={viewport.width}
        viewportHeight={viewport.height}
        windStrength={effects.windStrength}
      />
      {effects.precipitation === "rain" && (
        <Rain windStrength={effects.windStrength} />
      )}
      {effects.precipitation === "snow" && (
        <Snow windStrength={effects.windStrength} />
      )}
      <ThunderFlash active={effects.thunderstorm} />
    </>
  );
};
