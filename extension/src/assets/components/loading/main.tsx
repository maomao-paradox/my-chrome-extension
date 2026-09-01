import React from "react";
import "./style.scss";

const getItemStyle = (index: number) => {
  return {
    "--rotate": 45 * index + "deg",
    "--delay": 0.125 * (index - 1) + "s",
  };
};

const Loading: React.FC<{ progressDelay?: string }> = ({
  progressDelay = "2.5s",
}) => {
  return (
    <>
      <div className="container">
        <div className="item-container">
          {...Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`common item${i + 1}`}
              style={getItemStyle(i + 1)}
            ></div>
          ))}
        </div>

        <div className="bar">
          <div
            className="progress"
            style={{ "--progress-delay": progressDelay }}
          ></div>
        </div>
      </div>
    </>
  );
};

export default Loading;
