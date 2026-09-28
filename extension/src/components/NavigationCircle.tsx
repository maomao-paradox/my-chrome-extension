import { useEffect, useState } from "react";
import "./navigationCircle.scss";

const ITEMS = Array.from({ length: 7 }, (_, index) => index + 1);
const CIRCLE_CIRCUMFERENCE = Math.PI * 160 * 2;
const INTRO_DELAY = 1000 * (1 + ITEMS.length / 5 - 1 / 5) + 500;

const getCircleOffset = (itemIndex: number) =>
  itemIndex === 0
    ? 0
    : (CIRCLE_CIRCUMFERENCE / ITEMS.length) * (ITEMS.length - itemIndex);

const NavigationCircle = () => {
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [hoveredItemIndex, setHoveredItemIndex] = useState<number | null>(null);
  const activeItemIndex = hoveredItemIndex ?? selectedItemIndex ?? 0;

  useEffect(() => {
    const introTimer = window.setTimeout(() => {
      setSelectedItemIndex((currentIndex) =>
        currentIndex === 1 ? null : 1,
      );
    }, INTRO_DELAY);

    return () => window.clearTimeout(introTimer);
  }, []);

  const handleItemClick = (itemIndex: number) => {
    setSelectedItemIndex((currentIndex) =>
      currentIndex === itemIndex ? null : itemIndex,
    );
  };

  return (
    <div className="navigation-circle-react">
      <div className="navigation-circle">
        <div className="navigation-circle__inner">
          <svg
            className="navigation-circle-svg navigation-circle-svg--opaque"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 320 320"
            aria-hidden="true"
          >
            <circle
              cx="160"
              cy="160"
              r="158"
              fill="none"
              strokeWidth="1"
              stroke="#c644fc"
              strokeLinecap="round"
              strokeMiterlimit="10"
            />
          </svg>
          <svg
            className="navigation-circle-svg navigation-circle-svg--mask"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 320 320"
            aria-hidden="true"
          >
            <circle
              cx="160"
              cy="160"
              r="158"
              fill="none"
              strokeWidth="2"
              stroke="#c644fc"
              strokeLinecap="round"
              strokeMiterlimit="10"
              strokeDasharray={`${CIRCLE_CIRCUMFERENCE}px`}
              strokeDashoffset={`${getCircleOffset(activeItemIndex)}px`}
            />
          </svg>
          <ul className="navigation-circle__list" aria-label="Circular navigation">
            {ITEMS.map((itemIndex) => (
              <li
                className={`navigation-circle-list-item${
                  selectedItemIndex === itemIndex ? " active" : ""
                }`}
                key={itemIndex}
              >
                <button
                  className="navigation-circle-list-item__point"
                  type="button"
                  aria-label={`Item #${itemIndex}`}
                  aria-pressed={selectedItemIndex === itemIndex}
                  onClick={() => handleItemClick(itemIndex)}
                  onMouseEnter={() => setHoveredItemIndex(itemIndex)}
                  onMouseLeave={() => setHoveredItemIndex(null)}
                  onFocus={() => setHoveredItemIndex(itemIndex)}
                  onBlur={() => setHoveredItemIndex(null)}
                >
                  <span className="navigation-circle-list-item__meta">
                    <span className="navigation-circle-list-item__title">
                      Item #{itemIndex}
                    </span>
                    <span className="navigation-circle-list-item__subtitle">
                      It just goes round and round
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NavigationCircle;