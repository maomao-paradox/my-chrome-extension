import {
  BufferGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
} from "three";

export const createCanopySnowGeometry = (): BufferGeometry => {
  const canopy = new IcosahedronGeometry(1, 2);
  const source = canopy.attributes.position.array as Float32Array;
  const snowPositions: number[] = [];

  for (let face = 0; face < source.length; face += 9) {
    const centerX = (source[face] + source[face + 3] + source[face + 6]) / 3;
    const centerY =
      (source[face + 1] + source[face + 4] + source[face + 7]) / 3;
    const centerZ =
      (source[face + 2] + source[face + 5] + source[face + 8]) / 3;
    const angle = Math.atan2(centerZ, centerX);
    const snowline =
      0.47 +
      Math.sin(angle * 3 + centerX * 2) * 0.09 +
      Math.sin(angle * 7 + centerZ * 3) * 0.035;

    if (centerY < snowline) {
      continue;
    }

    for (let vertex = 0; vertex < 9; vertex += 3) {
      snowPositions.push(
        source[face + vertex] * 1.018,
        source[face + vertex + 1] * 1.018,
        source[face + vertex + 2] * 1.018,
      );
    }
  }

  canopy.dispose();
  const snow = new BufferGeometry();
  snow.setAttribute(
    "position",
    new Float32BufferAttribute(snowPositions, 3),
  );
  snow.computeVertexNormals();
  return snow;
};
