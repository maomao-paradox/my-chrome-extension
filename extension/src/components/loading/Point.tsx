import React from "react";
import "./point.scss";

const PointLoading: React.FC = () => {
  return (
    <div className="point-loading-preview">
      <div className="point-loading-preview__container">
        <input
          className="point-loading-preview__input"
          type="checkbox"
          aria-label="切换点阵动画配色"
        />
        <div className="point-loading-preview__bg" />
        <div className="point-loading-preview__content">
          {Array.from({ length: 12 }).map((_, i) => (
            <div className="point-loading-preview__dots" key={i}>
              <div className="point-loading-preview__dot">
                <span></span>
              </div>
            </div>
          ))}
          <div className="point-loading-preview__ring" />
        </div>
      </div>
    </div>
  );
};

export default PointLoading;
