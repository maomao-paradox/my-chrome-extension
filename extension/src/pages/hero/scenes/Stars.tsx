import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { getNightOpacity } from "../systems/celestialMotion";

const STAR_COUNT = 220;

const createStarPositions = (width: number, height: number) => {
  let seed = 19450917;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const positions = new Float32Array(STAR_COUNT * 3);

  for (let index = 0; index < STAR_COUNT; index += 1) {
    positions[index * 3] = (random() - 0.5) * width * 0.96;
    positions[index * 3 + 1] = (random() * 0.55 - 0.15) * height;
    positions[index * 3 + 2] = 0;
  }

  return positions;
};

export const Stars = ({
  progress,
  cloudCover,
}: {
  progress: number;
  cloudCover: number;
}) => {
  const { viewport } = useThree();
  const geometry = useMemo(() => {
    const positions = createStarPositions(viewport.width, viewport.height);
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return starGeometry;
  }, [viewport.height, viewport.width]);
  const opacity = getNightOpacity(progress) * (1 - cloudCover * 0.92);

  return (
    <points geometry={geometry} position={[0, 0, -1]}>
      <pointsMaterial
        color="#f5e9c9"
        size={0.045}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </points>
  );
};
