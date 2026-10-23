import type { ScenePalette } from "../systems/colorKeyframes";

export const Ground = ({ palette }: { palette: ScenePalette }) => (
  <mesh
    position={[0, -2.5, 0]}
    rotation={[-Math.PI / 2, 0, 0]}
    receiveShadow
  >
    <planeGeometry args={[100, 100]} />
    <meshStandardMaterial
      color={palette.ground}
      roughness={1}
      metalness={0}
      flatShading
    />
  </mesh>
);
