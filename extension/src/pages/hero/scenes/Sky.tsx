import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Color, type ShaderMaterial } from "three";
import type { SkyPalette } from "../systems/colorKeyframes";

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  varying vec2 vUv;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    vec2 blend = local * local * (3.0 - 2.0 * local);
    float lower = mix(
      hash(cell),
      hash(cell + vec2(1.0, 0.0)),
      blend.x
    );
    float upper = mix(
      hash(cell + vec2(0.0, 1.0)),
      hash(cell + vec2(1.0, 1.0)),
      blend.x
    );
    return mix(lower, upper, blend.y);
  }

  void main() {
    float horizonBlend = smoothstep(0.0, 0.52, vUv.y);
    float zenithBlend = smoothstep(0.4, 1.0, vUv.y);
    vec3 color = mix(uGround, uHorizon, horizonBlend);
    color = mix(color, uZenith, zenithBlend);

    float pigment = noise(vUv * vec2(34.0, 16.0));
    float strokes = sin(vUv.y * 145.0 + vUv.x * 8.0 + pigment * 10.0);
    float grain = hash(gl_FragCoord.xy);
    color += (pigment - 0.5) * 0.1;
    color += strokes * 0.012 + (grain - 0.5) * 0.018;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 0.18);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const Sky = ({ palette }: { palette: SkyPalette }) => {
  const materialRef = useRef<ShaderMaterial | null>(null);
  const uniformsRef = useRef<{
    uZenith: { value: Color };
    uHorizon: { value: Color };
    uGround: { value: Color };
  } | null>(null);
  const { viewport } = useThree();

  if (!uniformsRef.current) {
    uniformsRef.current = {
      uZenith: { value: new Color(palette.zenith) },
      uHorizon: { value: new Color(palette.horizon) },
      uGround: { value: new Color(palette.ground) },
    };
  }

  useEffect(() => {
    const uniforms = materialRef.current?.uniforms;

    if (!uniforms) {
      return;
    }

    uniforms.uZenith.value.set(palette.zenith);
    uniforms.uHorizon.value.set(palette.horizon);
    uniforms.uGround.value.set(palette.ground);
  }, [palette.ground, palette.horizon, palette.zenith]);

  return (
    <mesh
      position={[0, 0, -18]}
      scale={[viewport.width * 2.5, viewport.height * 2.5, 1]}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniformsRef.current}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
};
