import { useThree } from "@react-three/fiber";
import { getCelestialState, getNightOpacity } from "../systems/celestialMotion";
import type { ScenePalette } from "../systems/colorKeyframes";

interface LightsProps {
  progress: number;
  palette: ScenePalette;
}

export const Lights = ({ progress, palette }: LightsProps) => {
  const { viewport } = useThree();
  const nightWeight = getNightOpacity(progress);
  const sun = getCelestialState(progress, "sun");
  const moon = getCelestialState(progress, "moon");
  const horizontal =
    sun.horizontal + (moon.horizontal - sun.horizontal) * nightWeight;
  const height = sun.height + (moon.height - sun.height) * nightWeight;
  const lightPosition: [number, number, number] = [
    (horizontal - 0.5) * viewport.width * 0.82,
    0.8 + height * 6,
    7,
  ];

  return (
    <>
      <ambientLight
        color={palette.ambientColor}
        intensity={palette.ambientIntensity}
      />
      <directionalLight
        position={lightPosition}
        color={palette.keyLightColor}
        intensity={palette.keyLightIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={10}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.1}
        shadow-camera-far={30}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
    </>
  );
};
