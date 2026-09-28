import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import "./aladdin.scss";

const LINES = [
  { left: "Aladdin", right: "Aladdin", speed: "slow" },
  { left: "What do", right: "what do", speed: "slow" },
  { left: "you", right: "you", speed: "fast" },
  { left: "want", right: "want", speed: "slow" },
] as const;

function Aladdin() {
  const wrapRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const bounds = wrap.getBoundingClientRect();
    if (bounds.width === 0) return;

    const normalizedPosition = Math.max(
      -1,
      Math.min(1, (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2)),
    );
    const slowDistance = Math.min(100, bounds.width / 12);
    const fastDistance = Math.min(200, bounds.width / 6);

    wrap.style.setProperty(
      "--aladdin-slow-shift",
      `${slowDistance * normalizedPosition}px`,
    );
    wrap.style.setProperty(
      "--aladdin-fast-shift",
      `${fastDistance * normalizedPosition}px`,
    );
  };

  const resetPointerShift = () => {
    wrapRef.current?.style.setProperty("--aladdin-slow-shift", "0px");
    wrapRef.current?.style.setProperty("--aladdin-fast-shift", "0px");
  };

  return (
    <div
      ref={wrapRef}
      className="aladdin"
      role="img"
      aria-label="Aladdin: What do you want?"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointerShift}
    >
      <div className="aladdin__lines" aria-hidden="true">
        {LINES.map((line, index) => (
          <div className="aladdin__line" key={`${line.left}-${index}`}>
            <div className="aladdin__side aladdin__side--left">
              <div className="aladdin__content">
                <span className={`aladdin__word aladdin__word--${line.speed}`}>
                  {line.left}
                </span>
              </div>
            </div>
            <div className="aladdin__side aladdin__side--right">
              <div className="aladdin__content">
                <span className={`aladdin__word aladdin__word--${line.speed}`}>
                  {line.right}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Aladdin;