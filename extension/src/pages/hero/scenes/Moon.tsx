import { useThree } from "@react-three/fiber";
import { getCelestialState } from "../systems/celestialMotion";

export const Moon = ({
  progress,
  cloudCover,
}: {
  progress: number;
  cloudCover: number;
}) => {
  const { viewport } = useThree();
  const state = getCelestialState(progress, "moon");
  const weatherOpacity = 1 - cloudCover * 0.76;
  const opacity = state.opacity * weatherOpacity;
  const x = (state.horizontal - 0.5) * viewport.width * 0.92;
  const y = viewport.height * 0.01 + state.height * viewport.height * 0.43;

  return (
    <group position={[x, y, 1]} visible={opacity > 0}>
      <mesh>
        <circleGeometry args={[0.7, 48]} />
        <meshBasicMaterial
          color="#b8d7ef"
          transparent
          opacity={opacity * 0.18}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <circleGeometry args={[0.33, 48]} />
        <meshBasicMaterial
          color="#e0efff"
          toneMapped={false}
          transparent
          opacity={opacity}
        />
      </mesh>
    </group>
  );
};
