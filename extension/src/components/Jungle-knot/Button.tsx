import { Fragment, useEffect, useRef } from "react";
import "./styles/button.scss";

interface ButtonProps {
  subTitle?: string;
  className?: string;
  clipPath?: string;
  primaryColor?: string;
  secondaryColor?: string;
  mainTitle?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
  className = "",
  clipPath = "inset(0% 0% 75% 0%)",
  subTitle = "OPERATION",
  primaryColor = "#000000",
  secondaryColor = "#ffffff",
  mainTitle = "BUTTON",
  children,
  onClick,
}) => {
  const bgRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bgRef.current || !headerRef.current) return;
    bgRef.current.style.background = `linear-gradient(70deg, ${secondaryColor} 0%, ${secondaryColor} 20%, ${primaryColor} 35%, ${primaryColor} 100%)`;
    headerRef.current.style.background = `linear-gradient(70deg, ${primaryColor} 0%, ${primaryColor} 20%, ${secondaryColor} 35%, ${secondaryColor} 100%)`;
  }, [primaryColor, secondaryColor]);
  return (
    <Fragment>
      <div className={`operation-button ${className}`} onClick={onClick}>
        <div className="operation-button__bg" ref={bgRef}></div>
        <div
          className="operation-button__header"
          ref={headerRef}
          style={{ clipPath: clipPath, color: primaryColor }}
        >
          <span>{subTitle}</span>
        </div>
        <div
          className="operation-button__content"
          style={{ color: secondaryColor }}
        >
          {children ? children : <span>{mainTitle}</span>}
        </div>
      </div>
    </Fragment>
  );
};

export default Button;
