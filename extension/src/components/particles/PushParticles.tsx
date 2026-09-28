import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import "./push-particles.scss";

interface Particle {
  x: number;
  y: number;
  angle: number;
  speed: number;
  normalSpeed: number;
  oscAmplitudeX: number;
  oscSpeedX: number;
  oscAmplitudeY: number;
  oscSpeedY: number;
  connectDistance: number;
  color: { r: number; g: number; b: number };
}

interface PushParticlesProps {
  particleCount?: number;
  children?: ReactNode;
}

const PI = Math.PI;
const TAU = PI * 2;

const lerp = (start: number, end: number, amount: number) =>
  (1 - amount) * start + end * amount;

const distance = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
};

const angleBetween = (cx: number, cy: number, ex: number, ey: number) =>
  Math.atan2(ey - cy, ex - cx);

function PushParticles({ particleCount = 400, children }: PushParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const dimensionsRef = useRef({ width: 0, height: 0, forceDistance: 0 });

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - bounds.left;
    const mouseY = event.clientY - bounds.top;
    const { forceDistance } = dimensionsRef.current;

    particlesRef.current.forEach((particle) => {
      const particleDistance = distance(mouseX, mouseY, particle.x, particle.y);
      if (particleDistance < forceDistance && particleDistance > 0) {
        particle.angle = angleBetween(mouseX, mouseY, particle.x, particle.y);
        const force = (forceDistance - particleDistance) * 0.1;
        particle.speed = lerp(particle.speed, force, 0.2);
      }
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!container || !canvas || !context) return;

    let width = 0;
    let height = 0;
    let connectDistance = 0;
    let frameId = 0;
    let time = 0;
    const random = (maximum = 1) => Math.random() * maximum;
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect();
      width = bounds.width || container.clientWidth || window.innerWidth;
      height = bounds.height || container.clientHeight || 280;
      const resolution = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * resolution);
      canvas.height = Math.round(height * resolution);
      context.setTransform(resolution, 0, 0, resolution, 0, 0);
      connectDistance = width * 0.05;
      dimensionsRef.current = {
        width,
        height,
        forceDistance: width * 0.1,
      };
    };

    const generateParticles = () => {
      particlesRef.current = Array.from({ length: particleCount }, () => {
        return {
          x: width * 0.5 + Math.cos(random(TAU)) * random(width * 0.5),
          y: height * 0.5 + Math.sin(random(TAU)) * random(width * 0.5),
          angle: random(TAU),
          speed: random(0.15),
          normalSpeed: random(0.15),
          oscAmplitudeX: random(2),
          oscSpeedX: 0.001 + random(0.008),
          oscAmplitudeY: random(2),
          oscSpeedY: 0.001 + random(0.008),
          connectDistance: random(connectDistance),
          color: {
            r: Math.round(200 + random(55)),
            g: Math.round(150 + random(105)),
            b: Math.round(200 + random(55)),
          },
        };
      });
    };

    const updateParticles = () => {
      particlesRef.current.forEach((particle) => {
        particle.x +=
          (Math.cos(particle.angle) +
            Math.cos(time * particle.oscSpeedX) * particle.oscAmplitudeX) *
          particle.speed;
        particle.y +=
          (Math.sin(particle.angle) +
            Math.cos(time * particle.oscSpeedY) * particle.oscAmplitudeY) *
          particle.speed;
        particle.speed = lerp(particle.speed, particle.normalSpeed, 0.1);

        if (particle.x > width || particle.x < 0) {
          particle.angle = PI - particle.angle;
        }
        if (particle.y > height || particle.y < 0) {
          particle.angle = -particle.angle;
        }

        if (random() < 0.005) particle.oscAmplitudeX = random(2);
        if (random() < 0.005) particle.oscSpeedX = 0.001 + random(0.008);
        if (random() < 0.005) particle.oscAmplitudeY = random(2);
        if (random() < 0.005) particle.oscSpeedY = 0.001 + random(0.008);

        particle.x = Math.max(-0.01, Math.min(particle.x, width + 0.01));
        particle.y = Math.max(-0.01, Math.min(particle.y, height + 0.01));
      });
    };

    const renderParticles = () => {
      context.clearRect(0, 0, width, height);

      particlesRef.current.forEach((particle) => {
        particlesRef.current.forEach((other) => {
          if (particle === other) return;
          const lineDistance = distance(particle.x, particle.y, other.x, other.y);
          if (lineDistance > particle.connectDistance) return;

          particle.speed = lerp(
            particle.speed,
            particle.speed + (0.05 / particle.connectDistance) * lineDistance,
            0.2,
          );
          const opacity =
            Math.floor(
              (100 / particle.connectDistance) *
                (particle.connectDistance - lineDistance),
            ) / 100;
          const colorSwing = Math.sin(time * particle.oscSpeedX);

          context.beginPath();
          context.globalAlpha = opacity;
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
          context.strokeStyle = `rgb(${Math.floor(
            particle.color.r * colorSwing,
          )}, ${Math.floor(
            particle.color.g * 0.5 + particle.color.g * 0.5 * colorSwing,
          )}, ${particle.color.b})`;
          context.lineWidth = opacity * 4;
          context.stroke();
          context.closePath();
        });
      });

      context.globalAlpha = 1;
    };

    const loop = () => {
      time = performance.now() * 0.001;
      updateParticles();
      renderParticles();
      frameId = window.requestAnimationFrame(loop);
    };

    resizeCanvas();
    generateParticles();

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
    window.addEventListener("resize", resizeCanvas);

    if (prefersReducedMotion) {
      renderParticles();
    } else {
      frameId = window.requestAnimationFrame(loop);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resizeCanvas);
      resizeObserver.disconnect();
      particlesRef.current = [];
    };
  }, [particleCount]);

  return (
    <div
      ref={containerRef}
      className="push-particles"
      onPointerMove={handlePointerMove}
    >
      <canvas ref={canvasRef} className="push-particles__canvas" aria-hidden="true" />
      {children && <div className="push-particles__content">{children}</div>}
    </div>
  );
}

export default PushParticles;