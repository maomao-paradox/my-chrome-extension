import "./ring-disc.scss";

const LAYERS = [0, 1, 2];

function RingDisc() {
  return (
    <div className="ring-disc-loader">
      <div className="ring-disc-loader__rings" aria-hidden="true">
        {LAYERS.map((layer) => (
          <span
            className="ring-disc-loader__ring"
            key={layer}
            style={{
              width: `${220 + layer * 20}px`,
              height: `${220 + layer * 20}px`,
            }}
          />
        ))}
      </div>
      <div className="ring-disc-loader__discs" aria-hidden="true">
        {LAYERS.map((layer) => (
          <span
            className="ring-disc-loader__disc"
            key={layer}
            style={{ animationDelay: `${layer + 0.2}s` }}
          />
        ))}
      </div>
      <span className="ring-disc-loader__label" role="status">
        LOADING...
      </span>
    </div>
  );
}

export default RingDisc;
