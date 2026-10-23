import { useThree } from "@react-three/fiber";
import { getCelestialState } from "../systems/celestialMotion";

export const Sun = ({
  progress,
  cloudCover,
}: {
  progress: number;
  cloudCover: number;
}) => {
  const { viewport } = useThree();
  const state = getCelestialState(progress, "sun");
  const weatherOpacity = 1 - cloudCover * 0.9;
  const opacity = state.opacity * weatherOpacity;
  const x = (state.horizontal - 0.5) * viewport.width * 0.92;
  const y = viewport.height * 0.01 + state.height * viewport.height * 0.47;

  return (
    <group position={[x, y, 1]} visible={opacity > 0}>
      <mesh>
        <circleGeometry args={[0.82, 48]} />
        <meshBasicMaterial
          color="#ffc777"
          transparent
          opacity={opacity * 0.2}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <circleGeometry args={[0.38, 48]} />
        <meshBasicMaterial
          color="#ffe0a3"
          toneMapped={false}
          transparent
          opacity={opacity}
        />
      </mesh>
    </group>
  );
};
