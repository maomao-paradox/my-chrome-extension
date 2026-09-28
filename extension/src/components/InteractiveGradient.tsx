import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import "./InteractiveGradient.scss";

export interface InteractiveGradientProps {
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const InteractiveGradient = ({
  title,
  children,
  className = "",
}: InteractiveGradientProps) => {
  const rootRef = useRef<HTMLElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const filterPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gooFilterId = `${filterPrefix}-goo`;
  const noiseFilterId = `${filterPrefix}-noise`;
  const backgroundNoiseFilterId = `${filterPrefix}-background-noise`;
  const animationFrameRef = useRef<number | null>(null);
  const currentPositionRef = useRef({ x: 0, y: 0 });
  const targetPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const root = rootRef.current;
    const bubble = bubbleRef.current;
    if (!root || !bubble) return;

    const animate = () => {
      animationFrameRef.current = null;
      const current = currentPositionRef.current;
      const target = targetPositionRef.current;
      current.x += (target.x - current.x) / 20;
      current.y += (target.y - current.y) / 20;
      bubble.style.transform = `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)`;

      if (Math.abs(target.x - current.x) > 0.5 || Math.abs(target.y - current.y) > 0.5) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      const bounds = root.getBoundingClientRect();
      targetPositionRef.current = {
        x: event.clientX - bounds.left - bounds.width / 2,
        y: event.clientY - bounds.top - bounds.height / 2,
      };
      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
      }
    };

    const handlePointerLeave = () => {
      targetPositionRef.current = { x: 0, y: 0 };
      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
      }
    };

    root.addEventListener("pointermove", handlePointerMove);
    root.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerleave", handlePointerLeave);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className={`interactive-gradient ${className}`.trim()}
      aria-label="Interactive gradient scene"
    >
      <svg className="interactive-gradient__filters" aria-hidden="true" focusable="false">
        <defs>
          <filter id={gooFilterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
          <filter id={noiseFilterId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="5"
              stitchTiles="stitch"
            />
          </filter>
          <filter id={backgroundNoiseFilterId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.6" stitchTiles="stitch" />
          </filter>
        </defs>
      </svg>

      {title != null && <div className="interactive-gradient__title">{title}</div>}

      <div className="interactive-gradient__card">
        <svg className="interactive-gradient__card-noise" viewBox="0 0 100 100" aria-hidden="true">
          <rect width="100%" height="100%" filter={`url(#${noiseFilterId})`} />
        </svg>
        <div className="interactive-gradient__content">
          {children ?? (
            <>
              <h1>Interactive Gradient</h1>
              <p>Move through a living field of color. The light follows your cursor and settles into place.</p>
            </>
          )}
        </div>
      </div>

      <div className="interactive-gradient__background" aria-hidden="true">
        <svg className="interactive-gradient__background-noise" viewBox="0 0 100 100">
          <rect width="100%" height="100%" filter={`url(#${backgroundNoiseFilterId})`} />
        </svg>
        <div
          className="interactive-gradient__blobs"
          style={{ filter: `url(#${gooFilterId}) blur(38px)` } as CSSProperties}
        >
          <div className="interactive-gradient__blob interactive-gradient__blob--one" />
          <div className="interactive-gradient__blob interactive-gradient__blob--two" />
          <div className="interactive-gradient__blob interactive-gradient__blob--three" />
          <div className="interactive-gradient__blob interactive-gradient__blob--four" />
          <div className="interactive-gradient__blob interactive-gradient__blob--five" />
          <div ref={bubbleRef} className="interactive-gradient__blob interactive-gradient__blob--interactive" />
        </div>
      </div>
    </section>
  );
};

export default InteractiveGradient;