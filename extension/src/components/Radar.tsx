import React from "react";
import "./radar.scss";

const Radar: React.FC = () => {
  return (
    <div className="radar-component">
      <div className="radar-component__radar">
        <div className="radar-component__targets" />
      </div>
      <input
        type="checkbox"
        className="radar-component__selector"
        aria-label="切换雷达模式"
      />
    </div>
  );
};

Radar.displayName = "Radar";

export default Radar;
