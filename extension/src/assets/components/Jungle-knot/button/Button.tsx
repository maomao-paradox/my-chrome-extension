import { Fragment } from "react";
import "./button.scss";

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}

const Button: React.FC<ButtonProps> = ({ children, onClick }) => {
  return (
    <Fragment>
      <div className="operation-button" onClick={onClick}>
        <div className="operation-button__bg"></div>
        <div className="operation-button__title">
          <span>{children}</span>
        </div>
      </div>
    </Fragment>
  );
};

export default Button;
