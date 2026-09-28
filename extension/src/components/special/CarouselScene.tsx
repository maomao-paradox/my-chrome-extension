import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./special.scss";

export interface CarouselSceneProps {
  cells?: number | React.ReactNode[];
  orientation?: "vertical" | "horizontal";
  initialIndex?: number;
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
  ariaLabel?: string;
}

const COLORS = [
  "hsla(0, 100%, 50%, 0.84)",
  "hsla(40, 100%, 50%, 0.84)",
  "hsla(80, 100%, 50%, 0.84)",
  "hsla(120, 100%, 50%, 0.84)",
  "hsla(160, 100%, 50%, 0.84)",
  "hsla(200, 100%, 50%, 0.84)",
  "hsla(240, 100%, 50%, 0.84)",
  "hsla(280, 100%, 50%, 0.84)",
  "hsla(320, 100%, 50%, 0.84)",
];

const DEFAULT_CELLS = 9;

const CarouselScene = ({
  cells = DEFAULT_CELLS,
  orientation = "horizontal",
  initialIndex = 0,
  activeIndex,
  onIndexChange,
  ariaLabel = "3D carousel",
}: CarouselSceneProps) => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ id: number; position: number } | null>(null);
  const [internalIndex, setInternalIndex] = useState(initialIndex);
  const [radius, setRadius] = useState(288);
  const isControlled = activeIndex !== undefined;
  const cellNodes = Array.isArray(cells)
    ? cells
    : Array.from({ length: Math.max(1, Math.floor(cells)) }, (_, index) => index + 1);
  const cellCount = Math.max(1, cellNodes.length);
  const theta = 360 / cellCount;
  const currentIndex = ((isControlled ? activeIndex : internalIndex) % cellCount + cellCount) % cellCount;
  const rotation = orientation === "horizontal" ? "rotateY" : "rotateX";
  const stageAngle = orientation === "horizontal" ? -currentIndex * theta : currentIndex * theta;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const updateRadius = () => {
      const bounds = scene.getBoundingClientRect();
      const cellSize = orientation === "horizontal"
        ? Math.min(320, bounds.width * 0.76)
        : Math.min(210, bounds.height * 0.7);
      const nextRadius = cellCount < 3
        ? cellSize * 0.75
        : Math.round((cellSize / 2) / Math.tan(Math.PI / cellCount));
      setRadius(nextRadius);
    };

    updateRadius();
    const observer = new ResizeObserver(updateRadius);
    observer.observe(scene);
    return () => observer.disconnect();
  }, [cellCount, orientation]);

  const moveTo = (index: number) => {
    const nextIndex = (index + cellCount) % cellCount;
    if (!isControlled) setInternalIndex(nextIndex);
    onIndexChange?.(nextIndex);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextDirection = orientation === "vertical" ? 1 : -1;
    moveTo(currentIndex + (event.deltaY < 0 ? nextDirection : -nextDirection));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerStart.current = {
      id: event.pointerId,
      position: orientation === "horizontal" ? event.clientX : event.clientY,
    };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const endPosition = orientation === "horizontal" ? event.clientX : event.clientY;
    const distance = endPosition - start.position;
    if (Math.abs(distance) < 32) return;
    const forward = distance < 0;
    moveTo(currentIndex + (forward ? 1 : -1));
  };

  return (
    <div
      ref={sceneRef}
      className={`special-carousel-scene special-carousel-scene--${orientation}`}
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { pointerStart.current = null; }}
      onKeyDown={(event) => {
        if ((orientation === "horizontal" && event.key === "ArrowRight") ||
            (orientation === "vertical" && event.key === "ArrowDown")) {
          event.preventDefault();
          moveTo(currentIndex + 1);
        }
        if ((orientation === "horizontal" && event.key === "ArrowLeft") ||
            (orientation === "vertical" && event.key === "ArrowUp")) {
          event.preventDefault();
          moveTo(currentIndex - 1);
        }
      }}
      tabIndex={0}
      style={{ "--carousel-radius": `${radius}px` } as React.CSSProperties}
    >
      <div
        className="special-carousel-scene__stage"
        style={{ transform: `translateZ(-${radius}px) ${rotation}(${stageAngle}deg)` }}
      >
        {cellNodes.map((node, index) => {
          const cellAngle = orientation === "horizontal" ? theta * index : -theta * index;
          const relativeAngle = ((index - currentIndex) * theta % 360 + 360) % 360;
          const isFront = relativeAngle < 90 || relativeAngle > 270;
          return (
            <div
              className="special-carousel-scene__cell"
              key={index}
              aria-hidden={!isFront && cellCount === 2}
              style={{
                background: typeof node === "number" ? COLORS[index % COLORS.length] : COLORS[index % COLORS.length],
                opacity: cellCount === 2 && !isFront ? 0 : 1,
                transform: `translate(-50%, -50%) ${rotation}(${cellAngle}deg) translateZ(${radius}px)`,
              }}
            >
              {node}
            </div>
          );
        })}
      </div>
      <div className="special-carousel-scene__controls">
        <button
          className="special-carousel-scene__control"
          type="button"
          aria-label="上一项"
          onClick={() => moveTo(currentIndex - 1)}
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <span className="special-carousel-scene__position" aria-live="polite">
          {currentIndex + 1} / {cellCount}
        </span>
        <button
          className="special-carousel-scene__control"
          type="button"
          aria-label="下一项"
          onClick={() => moveTo(currentIndex + 1)}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default CarouselScene;