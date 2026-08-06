import { Fragment } from "react";
import "./button.scss";

export default function Button({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <Fragment>
      <div className="operation-button" onClick={onClick}>
        <div className="operation-button__bg"></div>
        <div className="operation-button__title">
          <span>{text}</span>
        </div>
      </div>
    </Fragment>
  );
}
