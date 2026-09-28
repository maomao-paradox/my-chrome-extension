import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./magneticPointer.scss";

export interface MagneticPointerProps {
  color?: string;
  size?: string;
  cssSelector?: string[];
  hideUntilTargetHover?: boolean;
  children?: React.ReactNode;
}

const MagneticPointer = ({
  color = "#1ff700",
  size = "4rem",
  cssSelector,
  hideUntilTargetHover = false,
  children,
}: MagneticPointerProps) => {
  const pointerRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [currentElement, setCurrentElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!portalTarget) return;
    const pointer = pointerRef.current;
    if (!pointer) return;

    pointer.style.setProperty("--color", color);
    pointer.style.setProperty("--width", size);
    pointer.style.setProperty("--height", size);

    const targets = document.querySelectorAll<HTMLElement>(
      cssSelector?.join(",") || "._target",
    );
    const handleMouseEnter = (event: Event) => {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      setCurrentElement(target);
      pointer.style.setProperty(
        "--width",
        `${rect.width + window.innerWidth * 0.02}px`,
      );
      pointer.style.setProperty(
        "--height",
        `${rect.height + window.innerHeight * 0.02}px`,
      );
    };
    const handleMouseLeave = () => {
      setCurrentElement(null);
      pointer.style.setProperty("--width", size);
      pointer.style.setProperty("--height", size);
    };

    targets.forEach((target) => {
      target.addEventListener("mouseenter", handleMouseEnter);
      target.addEventListener("mouseleave", handleMouseLeave);
    });

    return () => {
      targets.forEach((target) => {
        target.removeEventListener("mouseenter", handleMouseEnter);
        target.removeEventListener("mouseleave", handleMouseLeave);
      });
    };
  }, [color, cssSelector, portalTarget, size]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  let pointerX = mousePosition.x;
  let pointerY = mousePosition.y;
  if (currentElement) {
    const rect = currentElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    pointerX = centerX + (mousePosition.x - centerX) * 0.1;
    pointerY = centerY + (mousePosition.y - centerY) * 0.1;
  }

  return (
    <>
      {portalTarget &&
        createPortal(
      <div
        ref={pointerRef}
        className="magnetic-pointer"
        style={
          {
            "--x": `${pointerX}px`,
            "--y": `${pointerY}px`,
            visibility:
              hideUntilTargetHover && !currentElement ? "hidden" : undefined,
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <i className="magnetic-pointer__corner" key={index} />
        ))}
      </div>
        , portalTarget)}
      <div className="magnetic-pointer__content">
        {children ?? (
          <>
            <p className="_target">HOVER ME</p>
            <p className="_target">
              鼠标位置: {mousePosition.x} {mousePosition.y}
            </p>
          </>
        )}
      </div>
    </>
  );
};

export default MagneticPointer;