/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/App.tsx
 * @description React 版 Popup 主组件 - 包含 tab 导航和页面切换
 */
import React, { useState, useEffect } from "react";
import "./style.scss";

/**
 * Popup 应用主组件
 */
const App: React.FC = () => {
  return (
    <div className="overlay">
      <span className="mask-text">MASK</span>
    </div>
  );
};

export default App;
