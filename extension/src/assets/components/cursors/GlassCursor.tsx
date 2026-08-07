/**
 * @file src/assets/components/cursors/GlassCursor.tsx
 * @description React 版玻璃星轨光标。
 */
import { useEffect, useRef, useState } from 'react';
import './glass-cursor.scss';

interface CursorPosition {
  x: number;
  y: number;
}

interface StarParticle {
  id: number;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  delay: number;
}

const PARTICLE_COUNT = 50;
const CORE_FOLLOW_SPEED = 0.3;
const GLASS_FOLLOW_SPEED = 0.1;

const createParticle = (id: number, x: number, y: number): StarParticle => ({
  id,
  x,
  y,
  opacity: Math.random() * 0.8 + 0.2,
  scale: Math.random() * 0.8 + 0.2,
  delay: Math.random() * 2,
});

const GlassCursor = () => {
  const coreRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<CursorPosition>({ x: 0, y: 0 });
  const corePositionRef = useRef<CursorPosition>({ x: 0, y: 0 });
  const glassPositionRef = useRef<CursorPosition>({ x: 0, y: 0 });
  const orbitAngleRef = useRef(0);
  const particleIdRef = useRef(PARTICLE_COUNT);
  const isVisibleRef = useRef(true);
  const [isVisible, setIsVisible] = useState(true);
  const [starParticles, setStarParticles] = useState<StarParticle[]>([]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    const initialPosition = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };

    targetRef.current = initialPosition;
    corePositionRef.current = { ...initialPosition };
    glassPositionRef.current = { ...initialPosition };
    setStarParticles(
      Array.from({ length: PARTICLE_COUNT }, (_, index) =>
        createParticle(index, Math.random() * window.innerWidth, Math.random() * window.innerHeight),
      ),
    );

    const handleMouseMove = (event: MouseEvent) => {
      targetRef.current = { x: event.clientX, y: event.clientY };

      if (Math.random() < 0.1) {
        const nextParticle = createParticle(
          particleIdRef.current++,
          event.clientX + (Math.random() - 0.5) * 100,
          event.clientY + (Math.random() - 0.5) * 100,
        );
        setStarParticles((particles) => [...particles.slice(-(PARTICLE_COUNT - 1)), nextParticle]);
      }
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mouseenter', handleMouseEnter);

    let frameId = 0;
    const animate = () => {
      const target = targetRef.current;
      const core = corePositionRef.current;
      const glass = glassPositionRef.current;

      core.x += (target.x - core.x) * CORE_FOLLOW_SPEED;
      core.y += (target.y - core.y) * CORE_FOLLOW_SPEED;
      glass.x += (target.x - glass.x) * GLASS_FOLLOW_SPEED;
      glass.y += (target.y - glass.y) * GLASS_FOLLOW_SPEED;
      orbitAngleRef.current = (orbitAngleRef.current + 0.5) % 360;

      if (coreRef.current) {
        coreRef.current.style.transform = `translate(${core.x - 6}px, ${core.y - 6}px)`;
        coreRef.current.style.opacity = isVisibleRef.current ? '1' : '0';
      }
      if (glassRef.current) {
        glassRef.current.style.transform = `translate(${glass.x - 45}px, ${glass.y - 45}px)`;
        glassRef.current.style.opacity = isVisibleRef.current ? '1' : '0';
        glassRef.current.style.setProperty('--orbit-angle', `${orbitAngleRef.current}deg`);
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);

  return (
    <div className="glass-cursor-container" aria-hidden="true">
      <div ref={coreRef} className="cursor-core">
        <div className="star-shape" />
      </div>
      <div ref={glassRef} className="glass-cursor">
        <div className="cursor-glow" />
        <div className="cursor-ring" />
        <div className="star-orbit">
          <div className="star-particle" />
        </div>
      </div>
      {starParticles.map((particle) => (
        <div
          key={particle.id}
          className="random-star"
          style={{
            left: particle.x,
            top: particle.y,
            opacity: particle.opacity,
            transform: `scale(${particle.scale})`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

export default GlassCursor;
