import { Fragment, useEffect, useRef } from "react";
import "./styles/button.scss";

interface ButtonProps {
  label?: string;
  className?: string;
  clipPath?: string;
  primaryColor?: string;
  secondaryColor?: string;
  children: React.ReactNode;
  onClick: () => void;
}

const Button: React.FC<ButtonProps> = ({
  className = "",
  clipPath = "inset(0% 0% 75% 0%)",
  label = "OPERATION",
  primaryColor = "#000000",
  secondaryColor = "#ffffff",
  children,
  onClick,
}) => {
  const bgRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bgRef.current || !labelRef.current) return;
    bgRef.current.style.background = `linear-gradient(70deg, ${secondaryColor} 0%, ${secondaryColor} 20%, ${primaryColor} 35%, ${primaryColor} 100%)`;
    labelRef.current.style.background = `linear-gradient(70deg, ${primaryColor} 0%, ${primaryColor} 20%, ${secondaryColor} 35%, ${secondaryColor} 100%)`;
  }, [primaryColor, secondaryColor]);
  return (
    <Fragment>
      <div className={`operation-button ${className}`} onClick={onClick}>
        <div className="operation-button__bg" ref={bgRef}></div>
        <div
          className="operation-button__label"
          ref={labelRef}
          style={{ clipPath: clipPath, color: primaryColor }}
        >
          <span>{label}</span>
        </div>
        <div
          className="operation-button__content"
          style={{ color: secondaryColor }}
        >
          <span>{children}</span>
        </div>
      </div>
    </Fragment>
  );
};

export default Button;
