import { Fragment, useEffect, useRef } from "react";
import "./style.scss";

interface TextProps {
  content: string;
}

const TextApp: React.FC<TextProps> = ({ content = "CIO" }: TextProps) => {
  return (
    <>
      <div className="poster">
        <div className="bg-contour"></div>
        <div className="text">
          <span className="chromatic" data-text={content}>
            {content}
          </span>
          <span className="text-noise"></span>
        </div>
        <div className="blue-scribble"></div>
      </div>
    </>
  );
};

export default TextApp;
