import { useEffect, useMemo, useRef, useState, type AnchorHTMLAttributes } from "react";
import "./RollingText.scss";

export interface RollingTextProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  text?: string;
  href?: string;
}

const RollingText = ({
  text = "",
  href = "#",
  className = "",
  ...props
}: RollingTextProps) => {
  const letters = useMemo(() => Array.from(text || ""), [text]);
  const [isPlaying, setIsPlaying] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsPlaying(true), 600);

    const handleMouseOver = () => {
      setIsPlaying(false);
    };

    const node = anchorRef.current;
    node?.addEventListener("mouseover", handleMouseOver);

    return () => {
      window.clearTimeout(timer);
      node?.removeEventListener("mouseover", handleMouseOver);
    };
  }, []);

  return (
    <a
      {...props}
      ref={anchorRef}
      href={href}
      className={`rolling-text ${isPlaying ? "play" : ""} ${className}`.trim()}
    >
      <div className="block">
        {letters.map((letter, index) => (
          <span
            key={`main-${index}`}
            className="letter rolling-text__letter"
            style={{ transitionDelay: `${index * 0.015}s` }}
          >
            {letter.trim() === "" ? "\u00A0" : letter}
          </span>
        ))}
      </div>
      <div className="block-shadow">
        {letters.map((letter, index) => (
          <span
            key={`shadow-${index}`}
            className="letter rolling-text__letter"
            style={{ transitionDelay: `${index * 0.015}s` }}
          >
            {letter.trim() === "" ? "\u00A0" : letter}
          </span>
        ))}
      </div>
    </a>
  );
};

export default RollingText;
