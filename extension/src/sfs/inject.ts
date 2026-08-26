/**
 * @author 她说喜欢窗外有树的房子
 * @version v1.0.0
 * @license MIT
 * @description 执行内联脚本
 */

(() => {
  "use strict";
  const scriptStr = sessionStorage.getItem("--script-content--");
  sessionStorage.removeItem("--script-content--");
  if (!scriptStr) {
    return;
  }

  const script = document.createElement("script");
  Object.assign(script, {
    innerHTML: scriptStr,
    async: true,
    defer: true,
    crossOrigin: "anonymous",
  });

  document.body.appendChild(script);

  setTimeout(() => {
    if (document.body.contains(script)) {
      script.remove();
    }
  }, 100);
})();
