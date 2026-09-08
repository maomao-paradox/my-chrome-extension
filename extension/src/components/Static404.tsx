/**
 * Static404.tsx - React 版 404 占位组件
 * 从 Vue 版 response-code/Static404.vue 迁移而来
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React from "react";
import "./Static404.scss";

interface Static404Props {
  /** 返回按钮回调（可选，默认不显示）*/
  onGoBack?: () => void;
}

/**
 * Static404 - 404 页面占位组件
 */
const Static404: React.FC<Static404Props> = ({ onGoBack }) => {
  return (
    <div className="static-404">
      <div className="container">
        <div className="error-code">404</div>
        <div className="error-message">页面未找到</div>
        <div className="error-description">
          抱歉，您访问的页面不存在或已被移除。
        </div>
        {onGoBack && (
          <button className="back-button" onClick={onGoBack}>
            返回首页
          </button>
        )}
      </div>
    </div>
  );
};

Static404.displayName = "Static404";

export default Static404;
